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

interface LiveState {
  conferenceRecordName: string;
  messageId: string;
  greenLight: Date;
  meetingCode: string;
  participantCount: number;
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
      this.logger.warn(
        `Conference record ${state.conferenceRecordName} not found, clearing state`,
      );
      this.liveState = null;
      return;
    }

    if (currentRecord.endTime) {
      await this.finalize(currentRecord);
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

  private async finalize(
    record: { name: string; endTime: Date | null },
  ): Promise<void> {
    const state = this.liveState!;

    const alreadySaved =
      await this.raceRepository.existsByConferenceRecordName(record.name);

    if (!alreadySaved) {
      const participants = await this.meetProvider.getParticipants(record.name);
      const grid = this.buildStartingGrid.execute({
        participants,
        greenLight: state.greenLight,
      });
      const resolvedGrid = await this.resolveDrivers(grid);

      const savedRace = await this.raceRepository.save(
        new Race(
          '',
          record.name,
          state.meetingCode,
          state.greenLight,
          record.endTime!,
          RaceStatus.PROCESSED,
          resolvedGrid,
          new Date(),
        ),
      );

      await this.startingGridRepository.saveAll(savedRace.id, resolvedGrid);

      const race = new Race(
        savedRace.id,
        savedRace.conferenceRecordName,
        savedRace.meetingCode,
        savedRace.greenLight,
        savedRace.endTime,
        savedRace.status,
        resolvedGrid,
        savedRace.processedAt,
      );

      await this.notification.editLiveRaceMessageAsFinal(
        state.messageId,
        race,
      );

      const standings = await this.getChampionship.execute();
      const allRaces = await this.raceRepository.findByDateRange(
        ALL_TIME_START,
        ALL_TIME_END,
      );
      await this.notification.publishChampionshipStandings(
        standings,
        allRaces.length,
      );

      this.logger.log(
        `Race finalized: ${resolvedGrid.length} drivers, P1: ${resolvedGrid[0]?.driver.displayName}`,
      );
    }

    this.liveState = null;
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
