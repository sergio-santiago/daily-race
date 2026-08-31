import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProcessRaceUseCase } from '../process-race.use-case';
import { BuildStartingGridUseCase } from '../build-starting-grid.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import { GetChampionshipStandingsUseCase } from '../get-championship-standings.use-case';
import { FindConferenceRecordService } from '../find-conference-record.service';
import { Driver } from '../../core/entities/driver.entity';
import { SEASON_START } from '../../core/constants';
import {
  MEET_PROVIDER,
  MeetProviderPort,
  ConferenceRecordData,
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
import { Race } from '../../core/entities/race.entity';

function mockCalendarEvent(): CalendarEventData {
  return {
    eventId: 'event-1',
    title: 'Secture Daily',
    scheduledStart: new Date('2026-03-27T09:30:00.000Z'),
    scheduledEnd: new Date('2026-03-27T10:00:00.000Z'),
    meetingCode: 'wye-iwfu-jch',
  };
}

function mockConferenceRecord(): ConferenceRecordData {
  return {
    name: 'conferenceRecords/abc123',
    meetingCode: 'wye-iwfu-jch',
    startTime: new Date('2026-03-27T09:30:00.000Z'),
    endTime: new Date('2026-03-27T09:55:00.000Z'),
  };
}

function mockParticipants(): MeetParticipantData[] {
  return [
    {
      googleParticipantId: 'users/1',
      displayName: 'Alice',
      email: null,
      earliestStartTime: new Date('2026-03-27T09:30:01.000Z'),
    },
    {
      googleParticipantId: 'users/2',
      displayName: 'Bob',
      email: null,
      earliestStartTime: new Date('2026-03-27T09:30:05.000Z'),
    },
  ];
}

describe('ProcessRaceUseCase', () => {
  let module: TestingModule;
  let useCase: ProcessRaceUseCase;
  let meetProvider: jest.Mocked<MeetProviderPort>;
  let calendarProvider: jest.Mocked<CalendarProviderPort>;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let driverRepository: jest.Mocked<DriverRepositoryPort>;
  let gridRepository: jest.Mocked<StartingGridRepositoryPort>;
  let notification: jest.Mocked<NotificationPort>;

  beforeEach(async () => {
    meetProvider = {
      getConferenceRecords: jest.fn(),
      getParticipants: jest.fn(),
    };
    calendarProvider = {
      getDailyEvent: jest.fn(),
    };
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest.fn(),
      existsByConferenceRecordName: jest.fn(),
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
      createLiveRaceMessage: jest.fn(),
      editLiveRaceMessage: jest.fn(),
      editLiveRaceMessageAsFinal: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        ProcessRaceUseCase,
        BuildStartingGridUseCase,
        CalculatePointsUseCase,
        {
          provide: GetChampionshipStandingsUseCase,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: FindConferenceRecordService,
          useValue: {
            findForEvent: jest.fn().mockResolvedValue(mockConferenceRecord()),
          },
        },
        { provide: MEET_PROVIDER, useValue: meetProvider },
        { provide: CALENDAR_PROVIDER, useValue: calendarProvider },
        { provide: RACE_REPOSITORY, useValue: raceRepository },
        { provide: DRIVER_REPOSITORY, useValue: driverRepository },
        { provide: STARTING_GRID_REPOSITORY, useValue: gridRepository },
        { provide: NOTIFICATION_PORT, useValue: notification },
        {
          provide: ConfigService,
          useValue: { get: () => 'wye-iwfu-jch' },
        },
      ],
    }).compile();

    useCase = module.get(ProcessRaceUseCase);
  });

  it('should return null when no calendar event found', async () => {
    calendarProvider.getDailyEvent.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result).toBeNull();
  });

  it('should return null when findConferenceRecord returns null', async () => {
    calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
    const findService = module.get(FindConferenceRecordService);
    (findService.findForEvent as jest.Mock).mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result).toBeNull();
  });

  it('should return null when race already processed (idempotency)', async () => {
    calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
    raceRepository.existsByConferenceRecordName.mockResolvedValue(true);

    const result = await useCase.execute();

    expect(result).toBeNull();
    expect(meetProvider.getParticipants).not.toHaveBeenCalled();
  });

  it('should process race end-to-end', async () => {
    calendarProvider.getDailyEvent.mockResolvedValue(
      mockCalendarEvent(),
    );
    meetProvider.getConferenceRecords.mockResolvedValue([
      mockConferenceRecord(),
    ]);
    raceRepository.existsByConferenceRecordName.mockResolvedValue(false);
    meetProvider.getParticipants.mockResolvedValue(mockParticipants());
    let driverCounter = 0;
    driverRepository.upsert.mockImplementation(async (d) => {
      driverCounter++;
      return new Driver(`driver-${driverCounter}`, d.googleId, d.displayName, d.email);
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
    gridRepository.saveAll.mockResolvedValue(undefined);
    raceRepository.findByDateRange.mockResolvedValue([]);
    notification.publishRaceResults.mockResolvedValue(undefined);
    notification.publishChampionshipStandings.mockResolvedValue(undefined);

    const result = await useCase.execute();

    expect(result).not.toBeNull();
    expect(result!.id).toBe('race-1');
    expect(result!.startingGrid).toHaveLength(2);
    expect(result!.startingGrid[0].driver.displayName).toBe('Alice');
    expect(result!.startingGrid[1].driver.displayName).toBe('Bob');
    expect(driverRepository.upsert).toHaveBeenCalledTimes(2);
    expect(raceRepository.save).toHaveBeenCalledTimes(1);
    expect(gridRepository.saveAll).toHaveBeenCalledTimes(1);
    expect(notification.publishRaceResults).toHaveBeenCalledTimes(1);
  });

  it('pide al repositorio solo las carreras de la temporada en curso', async () => {
    // La grafica de evolucion se dibuja con estas carreras y la tabla con el
    // standing. Si aqui se pide "all time" mientras el standing cuenta desde
    // SEASON_START, el embed dice una carrera y la imagen dibuja la temporada
    // pasada entera.
    calendarProvider.getDailyEvent.mockResolvedValue(mockCalendarEvent());
    meetProvider.getConferenceRecords.mockResolvedValue([
      mockConferenceRecord(),
    ]);
    raceRepository.existsByConferenceRecordName.mockResolvedValue(false);
    meetProvider.getParticipants.mockResolvedValue(mockParticipants());
    let counter = 0;
    driverRepository.upsert.mockImplementation(async (d) => {
      counter++;
      return new Driver(`driver-${counter}`, d.googleId, d.displayName, d.email);
    });
    raceRepository.save.mockImplementation(
      async (race) =>
        new Race(
          'race-1',
          race.conferenceRecordName,
          race.meetingCode,
          race.greenLight,
          race.endTime,
          race.status,
          race.startingGrid,
          race.processedAt,
        ),
    );
    gridRepository.saveAll.mockResolvedValue(undefined);
    raceRepository.findByDateRange.mockResolvedValue([]);
    notification.publishRaceResults.mockResolvedValue(undefined);
    notification.publishChampionshipStandings.mockResolvedValue(undefined);

    await useCase.execute();

    expect(raceRepository.findByDateRange).toHaveBeenCalledWith(
      SEASON_START,
      expect.any(Date),
    );
  });

  it('should return null when no participants found', async () => {
    calendarProvider.getDailyEvent.mockResolvedValue(
      mockCalendarEvent(),
    );
    meetProvider.getConferenceRecords.mockResolvedValue([
      mockConferenceRecord(),
    ]);
    raceRepository.existsByConferenceRecordName.mockResolvedValue(false);
    meetProvider.getParticipants.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toBeNull();
  });
});
