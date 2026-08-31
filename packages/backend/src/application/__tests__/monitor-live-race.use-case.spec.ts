import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonitorLiveRaceUseCase } from '../monitor-live-race.use-case';
import { BuildStartingGridUseCase } from '../build-starting-grid.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import { GetChampionshipStandingsUseCase } from '../get-championship-standings.use-case';
import { FindConferenceRecordService } from '../find-conference-record.service';
import { Driver } from '../../core/entities/driver.entity';
import { Race } from '../../core/entities/race.entity';
import { SEASON_START } from '../../core/constants';
import {
  MEET_PROVIDER,
  MeetProviderPort,
  MeetParticipantData,
} from '../../core/ports/meet.provider.port';
import {
  CALENDAR_PROVIDER,
  CalendarProviderPort,
  CalendarEventData,
} from '../../core/ports/calendar.provider.port';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../../core/ports/race.repository.port';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../../core/ports/starting-grid.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../../core/ports/notification.port';

function mockCalendarEvent(): CalendarEventData {
  return {
    eventId: 'event-1',
    title: 'Secture Daily',
    scheduledStart: new Date('2026-03-27T09:30:00.000Z'),
    scheduledEnd: new Date('2026-03-27T10:00:00.000Z'),
    meetingCode: 'wye-iwfu-jch',
  };
}

function mockParticipants(count = 2): MeetParticipantData[] {
  const base = new Date('2026-03-27T09:30:00.000Z');
  return Array.from({ length: count }, (_, i) => ({
    googleParticipantId: `users/${i + 1}`,
    displayName: `Driver${i + 1}`,
    email: null,
    earliestStartTime: new Date(base.getTime() + (i + 1) * 1000),
  }));
}

describe('MonitorLiveRaceUseCase', () => {
  let useCase: MonitorLiveRaceUseCase;
  let calendarProvider: jest.Mocked<CalendarProviderPort>;
  let meetProvider: jest.Mocked<MeetProviderPort>;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let driverRepository: jest.Mocked<DriverRepositoryPort>;
  let gridRepository: jest.Mocked<StartingGridRepositoryPort>;
  let notification: jest.Mocked<NotificationPort>;
  let findConferenceRecord: jest.Mocked<
    Pick<FindConferenceRecordService, 'findActiveForEvent' | 'findForEvent' | 'findByName'>
  >;

  beforeEach(async () => {
    calendarProvider = { getDailyEvent: jest.fn() };
    meetProvider = {
      getConferenceRecords: jest.fn(),
      getParticipants: jest.fn(),
    };
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest.fn().mockResolvedValue([]),
      existsByConferenceRecordName: jest.fn().mockResolvedValue(false),
      existsProcessedRaceForSchedule: jest.fn().mockResolvedValue(false),
    };
    driverRepository = {
      save: jest.fn(),
      findByGoogleId: jest.fn(),
      findAll: jest.fn(),
      upsert: jest.fn(),
    };
    gridRepository = {
      saveAll: jest.fn(),
      findByRaceId: jest.fn(),
      findByDriverInDateRange: jest.fn(),
      updateEntries: jest.fn(),
    };
    notification = {
      publishRaceResults: jest.fn(),
      publishChampionshipStandings: jest.fn(),
      createLiveRaceMessage: jest.fn().mockResolvedValue('msg-123'),
      editLiveRaceMessage: jest.fn(),
      editLiveRaceMessageAsFinal: jest.fn(),
    };
    findConferenceRecord = {
      findForEvent: jest.fn(),
      findActiveForEvent: jest.fn(),
      findByName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorLiveRaceUseCase,
        BuildStartingGridUseCase,
        CalculatePointsUseCase,
        {
          provide: GetChampionshipStandingsUseCase,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: FindConferenceRecordService,
          useValue: findConferenceRecord,
        },
        { provide: MEET_PROVIDER, useValue: meetProvider },
        { provide: CALENDAR_PROVIDER, useValue: calendarProvider },
        { provide: RACE_REPOSITORY, useValue: raceRepository },
        { provide: DRIVER_REPOSITORY, useValue: driverRepository },
        { provide: STARTING_GRID_REPOSITORY, useValue: gridRepository },
        { provide: NOTIFICATION_PORT, useValue: notification },
        { provide: ConfigService, useValue: { get: () => 'wye-iwfu-jch' } },
      ],
    }).compile();

    useCase = module.get(MonitorLiveRaceUseCase);
  });

  describe('no active meeting', () => {
    it('should no-op when no calendar event found', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(null);

      await useCase.execute();

      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('should no-op when no active conference record', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue(null);

      await useCase.execute();

      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('should no-op when active conference has 0 participants', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue([]);

      await useCase.execute();

      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('should skip if race already persisted', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      raceRepository.existsByConferenceRecordName.mockResolvedValue(true);

      await useCase.execute();

      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('should skip when daily already processed (reopen after meeting ended)', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/reopen',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:57:00.000Z'),
        endTime: null,
      });
      raceRepository.existsByConferenceRecordName.mockResolvedValue(false);
      raceRepository.existsProcessedRaceForSchedule.mockResolvedValue(true);

      await useCase.execute();

      expect(
        raceRepository.existsProcessedRaceForSchedule,
      ).toHaveBeenCalledWith(
        'wye-iwfu-jch',
        new Date('2026-03-27T09:30:00.000Z'),
      );
      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
      expect(meetProvider.getParticipants).not.toHaveBeenCalled();
    });

    it('should still start tracking when a spurious pre-daily race exists', async () => {
      // Existing race with endTime before scheduledStart must not block
      // detection. The adapter filters those out via endTime > greenLight,
      // so the port returns false here.
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/real',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      raceRepository.existsByConferenceRecordName.mockResolvedValue(false);
      raceRepository.existsProcessedRaceForSchedule.mockResolvedValue(false);
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(3));

      await useCase.execute();

      expect(notification.createLiveRaceMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('start live tracking', () => {
    it('should create a live message when active meeting with participants is found', async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(3));

      await useCase.execute();

      expect(notification.createLiveRaceMessage).toHaveBeenCalledTimes(1);
      const [grid, greenLight] =
        notification.createLiveRaceMessage.mock.calls[0];
      expect(grid).toHaveLength(3);
      expect(greenLight).toEqual(new Date('2026-03-27T09:30:00.000Z'));
    });
  });

  describe('live updates', () => {
    beforeEach(async () => {
      // Start tracking
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      await useCase.execute();
      jest.clearAllMocks();
    });

    it('should skip edit when participant count unchanged', async () => {
      findConferenceRecord.findByName.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));

      await useCase.execute();

      expect(notification.editLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('should edit message when new participant joins', async () => {
      findConferenceRecord.findByName.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(5));

      await useCase.execute();

      expect(notification.editLiveRaceMessage).toHaveBeenCalledTimes(1);
      const [messageId, grid] =
        notification.editLiveRaceMessage.mock.calls[0];
      expect(messageId).toBe('msg-123');
      expect(grid).toHaveLength(5);
    });
  });

  describe('finalization', () => {
    beforeEach(async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      await useCase.execute();
      jest.clearAllMocks();
    });

    it('should persist to DB and edit message as final when meeting ends', async () => {
      findConferenceRecord.findByName.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: new Date('2026-03-27T09:55:00.000Z'),
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      let driverCounter = 0;
      driverRepository.upsert.mockImplementation(async (d) => {
        driverCounter++;
        return new Driver(
          `driver-${driverCounter}`,
          d.googleId,
          d.displayName,
          d.email,
        );
      });
      raceRepository.save.mockImplementation(async (race) => {
        return new Race(
          'race-1',
          race.conferenceRecordName,
          race.meetingCode,
          race.greenLight,
          race.endTime,
          race.status,
          race.startingGrid,
          race.processedAt,
        );
      });

      await useCase.execute();

      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(gridRepository.saveAll).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);
      // Este es el camino que corre cada dia: las carreras que alimentan la
      // grafica se piden desde el arranque de temporada, igual que el standing
      expect(raceRepository.findByDateRange).toHaveBeenCalledWith(
        SEASON_START,
        expect.any(Date),
      );
    });

    it('should clear state after finalization', async () => {
      findConferenceRecord.findByName.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: new Date('2026-03-27T09:55:00.000Z'),
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      driverRepository.upsert.mockImplementation(async (d) =>
        new Driver('d1', d.googleId, d.displayName, d.email),
      );
      raceRepository.save.mockImplementation(async (race) =>
        new Race('r1', race.conferenceRecordName, race.meetingCode, race.greenLight, race.endTime, race.status, race.startingGrid, race.processedAt),
      );

      await useCase.execute();
      jest.clearAllMocks();

      // Next tick should try to detect a new meeting (no state)
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();

      expect(calendarProvider.getDailyEvent).toHaveBeenCalled();
      expect(findConferenceRecord.findByName).not.toHaveBeenCalled();
    });

    it('should clear state if conference record disappears', async () => {
      findConferenceRecord.findByName.mockResolvedValue(null);

      await useCase.execute();

      // State cleared, next tick goes to detect mode
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();
      expect(calendarProvider.getDailyEvent).toHaveBeenCalled();
    });

    it('no abre un segundo mensaje en directo cuando la consulta a Meet falla', async () => {
      // Un 429 o un timeout consultando los conference records solia llegar
      // disfrazado de [] y por tanto de ausencia, lo que tiraba el estado y hacia
      // que el tick siguiente creara OTRO mensaje en directo del mismo dia. Ahora
      // el adaptador propaga el error, el tick se cae y el estado sobrevive
      findConferenceRecord.findByName.mockRejectedValue(
        new Error('429 Too Many Requests'),
      );

      await expect(useCase.execute()).rejects.toThrow('429');

      // El estado sigue en pie: el tick siguiente vuelve a la misma carrera en vez
      // de salir a detectar una nueva, y no se crea un segundo mensaje
      jest.clearAllMocks();
      findConferenceRecord.findByName.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(3));

      await useCase.execute();

      expect(findConferenceRecord.findByName).toHaveBeenCalled();
      expect(calendarProvider.getDailyEvent).not.toHaveBeenCalled();
      expect(notification.createLiveRaceMessage).not.toHaveBeenCalled();
      expect(notification.editLiveRaceMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('finalization failure paths', () => {
    const endedRecord = {
      name: 'conf/1',
      meetingCode: 'wye-iwfu-jch',
      startTime: new Date('2026-03-27T09:30:00.000Z'),
      endTime: new Date('2026-03-27T09:55:00.000Z'),
    };
    let storedRace: Race | null = null;

    beforeEach(async () => {
      calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
      findConferenceRecord.findActiveForEvent.mockResolvedValue({
        name: 'conf/1',
        meetingCode: 'wye-iwfu-jch',
        startTime: new Date('2026-03-27T09:30:00.000Z'),
        endTime: null,
      });
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      await useCase.execute();
      jest.clearAllMocks();

      // A partir de aqui el meeting ya ha terminado
      findConferenceRecord.findByName.mockResolvedValue(endedRecord);
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      driverRepository.upsert.mockImplementation(
        async (d) => new Driver('d1', d.googleId, d.displayName, d.email),
      );

      // BD en memoria: la carrera guardada se recupera en los reintentos
      storedRace = null;
      raceRepository.save.mockImplementation(async (race) => {
        storedRace = new Race(
          'race-1',
          race.conferenceRecordName,
          race.meetingCode,
          race.greenLight,
          race.endTime,
          race.status,
          race.startingGrid,
          race.processedAt,
        );
        return storedRace;
      });
      raceRepository.findByConferenceRecordName.mockImplementation(
        async () => storedRace,
      );
    });

    it('reintenta la parrilla cuando la carrera quedo guardada sin ella', async () => {
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      // save() cuela y saveAll() falla: la carrera queda en base sin parrilla, que
      // es el estado que dejan dos escrituras sin transaccion comun
      gridRepository.saveAll.mockRejectedValueOnce(new Error('unique violation'));
      await useCase.execute();

      expect(notification.editLiveRaceMessageAsFinal).not.toHaveBeenCalled();

      // La carrera ya esta persistida, pero vacia. El tick siguiente no puede
      // publicarla como esta: tiene que reescribir la parrilla que falto
      storedRace = new Race(
        'race-1',
        'conf/1',
        'wye-iwfu-jch',
        new Date('2026-03-27T09:30:00.000Z'),
        endedRecord.endTime,
        storedRace!.status,
        [],
        storedRace!.processedAt,
      );
      jest.clearAllMocks();
      findConferenceRecord.findByName.mockResolvedValue(endedRecord);
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      driverRepository.upsert.mockImplementation(
        async (d) => new Driver('d1', d.googleId, d.displayName, d.email),
      );
      raceRepository.findByConferenceRecordName.mockImplementation(
        async () => storedRace,
      );

      await useCase.execute();

      expect(gridRepository.saveAll).toHaveBeenCalledWith('race-1', expect.any(Array));
      expect(gridRepository.saveAll.mock.calls[0][1]).toHaveLength(2);
      // Y el mensaje final sale con pilotos, no con la tabla vacia
      const publicada = notification.editLiveRaceMessageAsFinal.mock.calls[0][1];
      expect(publicada.startingGrid).toHaveLength(2);
      warnSpy.mockRestore();
    });

    it('no cierra la carrera si Meet no devuelve participantes', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      meetProvider.getParticipants.mockResolvedValue([]);

      await useCase.execute();

      // Nada escrito y nada publicado: grabarla PROCESSED con cero entradas
      // enseñaba una tabla vacia y sumaba una carrera de cero puntos al campeonato
      expect(raceRepository.save).not.toHaveBeenCalled();
      expect(gridRepository.saveAll).not.toHaveBeenCalled();
      expect(notification.editLiveRaceMessageAsFinal).not.toHaveBeenCalled();
      expect(notification.publishChampionshipStandings).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      // Y el dia no se pierde: en cuanto Meet responde, se cierra
      jest.clearAllMocks();
      meetProvider.getParticipants.mockResolvedValue(mockParticipants(2));
      await useCase.execute();

      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it('should keep the happy path intact: one notification each and state cleared', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await useCase.execute();

      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(gridRepository.saveAll).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();

      jest.clearAllMocks();
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();

      expect(findConferenceRecord.findByName).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should retry the final edit on the next tick when it fails once', async () => {
      notification.editLiveRaceMessageAsFinal.mockRejectedValueOnce(
        new Error('429 rate limited'),
      );

      await useCase.execute();

      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      // Un fallo del mensaje final no impide publicar el campeonato
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);

      await useCase.execute();

      // La carrera no se vuelve a guardar, se recupera de la BD
      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(gridRepository.saveAll).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(2);
      // El campeonato ya salio, no se repite
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);

      const [messageId, race] =
        notification.editLiveRaceMessageAsFinal.mock.calls[1];
      expect(messageId).toBe('msg-123');
      expect(race.id).toBe('race-1');
      expect(race.startingGrid).toHaveLength(2);

      jest.clearAllMocks();
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();

      expect(findConferenceRecord.findByName).not.toHaveBeenCalled();
    });

    it('should retry the championship on the next tick when it fails once', async () => {
      notification.publishChampionshipStandings.mockRejectedValueOnce(
        new Error('500 internal error'),
      );

      await useCase.execute();

      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);

      await useCase.execute();

      // El mensaje final ya estaba bien, no se vuelve a editar
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(2);
      expect(raceRepository.save).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();

      expect(findConferenceRecord.findByName).not.toHaveBeenCalled();
    });

    it('should retry persistence when the DB fails and notify nothing meanwhile', async () => {
      raceRepository.findByConferenceRecordName.mockRejectedValueOnce(
        new Error('ECONNRESET'),
      );

      await useCase.execute();

      expect(raceRepository.save).not.toHaveBeenCalled();
      expect(notification.editLiveRaceMessageAsFinal).not.toHaveBeenCalled();
      expect(notification.publishChampionshipStandings).not.toHaveBeenCalled();

      await useCase.execute();

      expect(raceRepository.save).toHaveBeenCalledTimes(1);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);
    });

    it('should retry pending notifications even if the conference record disappears', async () => {
      notification.editLiveRaceMessageAsFinal.mockRejectedValueOnce(
        new Error('503 service unavailable'),
      );

      await useCase.execute();
      findConferenceRecord.findByName.mockResolvedValue(null);

      await useCase.execute();

      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(2);
      expect(raceRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should give up after the retry cap and log the pending championship', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      notification.publishChampionshipStandings.mockRejectedValue(
        new Error('500 internal error'),
      );

      await useCase.execute();
      await useCase.execute();
      await useCase.execute();

      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(3);
      expect(notification.editLiveRaceMessageAsFinal).toHaveBeenCalledTimes(1);

      const logged = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(
        logged.some((line) =>
          line.includes('Campeonato no publicado para la carrera conf/1'),
        ),
      ).toBe(true);

      // Estado limpio: no se reintenta un cuarto tick
      jest.clearAllMocks();
      calendarProvider.getDailyEvent.mockResolvedValue(null);
      await useCase.execute();

      expect(findConferenceRecord.findByName).not.toHaveBeenCalled();
      expect(notification.publishChampionshipStandings).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
