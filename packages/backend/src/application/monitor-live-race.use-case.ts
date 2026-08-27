import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  MEET_PROVIDER,
  MeetProviderPort,
} from '../core/ports/meet.provider.port';
import {
  CALENDAR_PROVIDER,
  CalendarProviderPort,
} from '../core/ports/calendar.provider.port';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../core/ports/starting-grid.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import { Race, RaceStatus } from '../core/entities/race.entity';
import { StartingGridEntry } from '../core/entities/starting-grid-entry.entity';
import { BuildStartingGridUseCase } from './build-starting-grid.use-case';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { FindConferenceRecordService } from './find-conference-record.service';
import { ConfigService } from '@nestjs/config';
import { DAILY_MEETING_CODE, ALL_TIME_START, ALL_TIME_END } from '../core/constants';

// Tope de ticks que se dedican a cerrar una carrera. Persistir es idempotente
// (se recupera la carrera ya guardada), asi que solo limita los reintentos de
// las notificaciones para no quedarse en bucle si Discord no responde.
const MAX_FINALIZE_ATTEMPTS = 3;

interface LiveState {
  conferenceRecordName: string;
  messageId: string;
  greenLight: Date;
  meetingCode: string;
  participantCount: number;
  // Ticks gastados en cerrar la carrera. 0 mientras sigue en directo
  finalizeAttempts: number;
  // Notificaciones de cierre que ya han salido, para no repetirlas al reintentar
  finalMessageSent: boolean;
  championshipSent: boolean;
}

@Injectable()
export class MonitorLiveRaceUseCase {
  private readonly logger = new Logger(MonitorLiveRaceUseCase.name);
  private readonly meetingCode: string;
  private liveState: LiveState | null = null;

  constructor(
    @Inject(MEET_PROVIDER)
    private readonly meetProvider: MeetProviderPort,
    @Inject(CALENDAR_PROVIDER)
    private readonly calendarProvider: CalendarProviderPort,
    @Inject(RACE_REPOSITORY)
    private readonly raceRepository: RaceRepositoryPort,
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepositoryPort,
    @Inject(STARTING_GRID_REPOSITORY)
    private readonly startingGridRepository: StartingGridRepositoryPort,
    @Inject(NOTIFICATION_PORT)
    private readonly notification: NotificationPort,
    private readonly buildStartingGrid: BuildStartingGridUseCase,
    private readonly getChampionship: GetChampionshipStandingsUseCase,
    private readonly findConferenceRecord: FindConferenceRecordService,
    config: ConfigService,
  ) {
    this.meetingCode = config.get('DAILY_MEETING_CODE', DAILY_MEETING_CODE);
  }

  async execute(): Promise<void> {
    if (this.liveState) {
      await this.updateOrFinalize();
    } else {
      await this.detectActiveMeeting();
    }
  }

  private async detectActiveMeeting(): Promise<void> {
    const calendarEvent = await this.calendarProvider.getDailyEvent(
      this.meetingCode,
    );
    if (!calendarEvent?.meetingCode) return;

    const activeRecord =
      await this.findConferenceRecord.findActiveForEvent(calendarEvent);
    if (!activeRecord) return;

    const alreadySaved =
      await this.raceRepository.existsByConferenceRecordName(activeRecord.name);
    if (alreadySaved) return;

    const dailyAlreadyProcessed =
      await this.raceRepository.existsProcessedRaceForSchedule(
        calendarEvent.meetingCode,
        calendarEvent.scheduledStart,
      );
    if (dailyAlreadyProcessed) {
      this.logger.debug(
        `Daily already processed for ${calendarEvent.scheduledStart.toISOString()}, ignoring reopen of ${activeRecord.name}`,
      );
      return;
    }

    const participants = await this.meetProvider.getParticipants(
      activeRecord.name,
    );
    if (participants.length === 0) return;

    const greenLight = calendarEvent.scheduledStart;
    const grid = this.buildStartingGrid.execute({ participants, greenLight });

    try {
      const messageId = await this.notification.createLiveRaceMessage(
        grid,
        greenLight,
      );

      this.liveState = {
        conferenceRecordName: activeRecord.name,
        messageId,
        greenLight,
        meetingCode: calendarEvent.meetingCode,
        participantCount: participants.length,
        finalizeAttempts: 0,
        finalMessageSent: false,
        championshipSent: false,
      };

      this.logger.log(
        `Live tracking started: ${participants.length} drivers, message ${messageId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create live message: ${error}`);
    }
  }

  private async updateOrFinalize(): Promise<void> {
    const state = this.liveState!;

    const currentRecord = await this.findConferenceRecord.findByName(
      this.meetingCode,
      state.conferenceRecordName,
    );

    if (!currentRecord) {
      // Si ya estabamos cerrando, el record puede haberse caido de la ventana
      // reciente de Meet. Las notificaciones pendientes no dependen de el,
      // asi que se reintentan igual con la carrera ya persistida
      if (state.finalizeAttempts > 0) {
        await this.finalize(null);
        return;
      }

      // Aqui solo se llega con una ausencia real: si la consulta a Meet falla, el
      // adaptador propaga el error, el tick se cae y el estado se queda intacto
      // para el siguiente. Antes un fallo pasajero llegaba disfrazado de ausencia
      // y esta linea abria la puerta a un segundo mensaje en directo
      this.logger.warn(
        `Conference record ${state.conferenceRecordName} not found, clearing state`,
      );
      this.liveState = null;
      return;
    }

    if (currentRecord.endTime) {
      await this.finalize(currentRecord.endTime);
    } else {
      await this.updateLiveMessage();
    }
  }

  private async updateLiveMessage(): Promise<void> {
    const state = this.liveState!;

    const participants = await this.meetProvider.getParticipants(
      state.conferenceRecordName,
    );

    if (participants.length === state.participantCount) return;

    const grid = this.buildStartingGrid.execute({
      participants,
      greenLight: state.greenLight,
    });

    try {
      await this.notification.editLiveRaceMessage(
        state.messageId,
        grid,
        state.greenLight,
      );
      state.participantCount = participants.length;
      this.logger.log(`Live update: ${participants.length} drivers`);
    } catch (error) {
      this.logger.error(`Failed to edit live message: ${error}`);
    }
  }

  // Cierra la carrera en dos fases independientes: primero persistir (idempotente)
  // y despues notificar. Un fallo al notificar conserva liveState para reintentar
  // en el siguiente tick, hasta agotar MAX_FINALIZE_ATTEMPTS
  private async finalize(endTime: Date | null): Promise<void> {
    const state = this.liveState!;
    state.finalizeAttempts += 1;
    const lastAttempt = state.finalizeAttempts >= MAX_FINALIZE_ATTEMPTS;

    const race = await this.persistRace(endTime);
    if (!race) {
      if (lastAttempt) {
        this.logger.error(
          `Carrera ${state.conferenceRecordName} abandonada tras ${state.finalizeAttempts} intentos: no se pudo persistir, mensaje final y campeonato sin publicar`,
        );
        this.liveState = null;
      }
      return;
    }

    if (!state.finalMessageSent) {
      state.finalMessageSent = await this.sendFinalMessage(state.messageId, race);
    }

    // El campeonato se intenta aunque el mensaje final haya fallado, y al reves
    if (!state.championshipSent) {
      state.championshipSent = await this.sendChampionship(race);
    }

    if (state.finalMessageSent && state.championshipSent) {
      this.logger.log(
        `Race finalized: ${race.startingGrid.length} drivers, P1: ${race.startingGrid[0]?.driver.displayName}`,
      );
      this.liveState = null;
      return;
    }

    if (lastAttempt) {
      if (!state.finalMessageSent) {
        this.logger.error(
          `Mensaje final no actualizado para la carrera ${race.conferenceRecordName} (id ${race.id}) tras ${state.finalizeAttempts} intentos: se queda publicado como EN DIRECTO`,
        );
      }
      if (!state.championshipSent) {
        this.logger.error(
          `Campeonato no publicado para la carrera ${race.conferenceRecordName} (id ${race.id}) tras ${state.finalizeAttempts} intentos`,
        );
      }
      this.liveState = null;
      return;
    }

    this.logger.warn(
      `Cierre incompleto de ${race.conferenceRecordName} (mensaje final: ${state.finalMessageSent ? 'ok' : 'pendiente'}, campeonato: ${state.championshipSent ? 'ok' : 'pendiente'}), reintento en el siguiente tick`,
    );
  }

  // Devuelve la carrera guardada, recuperandola si un intento anterior ya la
  // persistio. null si no se ha podido dejar guardada en este tick
  private async persistRace(endTime: Date | null): Promise<Race | null> {
    const state = this.liveState!;

    try {
      const existing = await this.raceRepository.findByConferenceRecordName(
        state.conferenceRecordName,
      );
      if (existing) {
        if (existing.startingGrid.length === 0) {
          this.logger.warn(
            `La carrera ${existing.conferenceRecordName} (id ${existing.id}) esta persistida sin parrilla`,
          );
        }
        return existing;
      }

      if (!endTime) {
        this.logger.error(
          `No se puede cerrar la carrera ${state.conferenceRecordName}: sin registro persistido y sin hora de fin`,
        );
        return null;
      }

      const participants = await this.meetProvider.getParticipants(
        state.conferenceRecordName,
      );
      const grid = this.buildStartingGrid.execute({
        participants,
        greenLight: state.greenLight,
      });
      const resolvedGrid = await this.resolveDrivers(grid);

      const savedRace = await this.raceRepository.save(
        new Race(
          '',
          state.conferenceRecordName,
          state.meetingCode,
          state.greenLight,
          endTime,
          RaceStatus.PROCESSED,
          resolvedGrid,
          new Date(),
        ),
      );

      await this.startingGridRepository.saveAll(savedRace.id, resolvedGrid);

      return new Race(
        savedRace.id,
        savedRace.conferenceRecordName,
        savedRace.meetingCode,
        savedRace.greenLight,
        savedRace.endTime,
        savedRace.status,
        resolvedGrid,
        savedRace.processedAt,
      );
    } catch (error) {
      this.logger.error(
        `Fallo al persistir la carrera ${state.conferenceRecordName}: ${error}`,
      );
      return null;
    }
  }

  private async sendFinalMessage(
    messageId: string,
    race: Race,
  ): Promise<boolean> {
    try {
      await this.notification.editLiveRaceMessageAsFinal(messageId, race);
      return true;
    } catch (error) {
      this.logger.error(
        `Fallo al editar el mensaje final de la carrera ${race.conferenceRecordName}: ${error}`,
      );
      return false;
    }
  }

  private async sendChampionship(race: Race): Promise<boolean> {
    try {
      const standings = await this.getChampionship.execute();
      const allRaces = await this.raceRepository.findByDateRange(
        ALL_TIME_START,
        ALL_TIME_END,
      );
      await this.notification.publishChampionshipStandings(standings, allRaces);
      return true;
    } catch (error) {
      this.logger.error(
        `Fallo al publicar el campeonato de la carrera ${race.conferenceRecordName}: ${error}`,
      );
      return false;
    }
  }

  private async resolveDrivers(
    grid: StartingGridEntry[],
  ): Promise<StartingGridEntry[]> {
    return Promise.all(
      grid.map(async (entry) => {
        const savedDriver = await this.driverRepository.upsert(entry.driver);
        return new StartingGridEntry(
          entry.position,
          savedDriver,
          entry.startTime,
          entry.greenLight,
          entry.points,
          entry.isFalseStart,
          entry.isWorstOnGrid,
        );
      }),
    );
  }
}
