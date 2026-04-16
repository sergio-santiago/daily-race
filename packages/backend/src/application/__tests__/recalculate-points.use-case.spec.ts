import { Test } from '@nestjs/testing';
import { RecalculatePointsUseCase } from '../recalculate-points.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../../core/ports/race.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../../core/ports/starting-grid.repository.port';
import { Race, RaceStatus } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { Driver } from '../../core/entities/driver.entity';
import {
  F1_POINTS,
  ATTENDANCE_POINTS,
  FALSE_START_PENALTY,
} from '../../core/constants';

const GREEN_LIGHT = new Date('2026-04-15T08:00:00.000Z');

function makeRace(id: string): Race {
  return new Race(
    id,
    `conf/${id}`,
    'wye-iwfu-jch',
    GREEN_LIGHT,
    new Date(GREEN_LIGHT.getTime() + 20 * 60 * 1000),
    RaceStatus.PROCESSED,
    [],
    new Date(),
  );
}

function makeEntry(driverId: string, offsetMs: number): StartingGridEntry {
  return new StartingGridEntry(
    0,
    new Driver(driverId, `google/${driverId}`, `Driver-${driverId}`, null),
    new Date(GREEN_LIGHT.getTime() + offsetMs),
    GREEN_LIGHT,
    0,
    offsetMs < 0,
    false,
  );
}

describe('RecalculatePointsUseCase', () => {
  let useCase: RecalculatePointsUseCase;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let gridRepository: jest.Mocked<StartingGridRepositoryPort>;

  beforeEach(async () => {
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest.fn(),
      existsByConferenceRecordName: jest.fn(),
      existsProcessedRaceForSchedule: jest.fn(),
    };
    gridRepository = {
      saveAll: jest.fn(),
      findByRaceId: jest.fn(),
      findByDriverInDateRange: jest.fn(),
      updateEntries: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RecalculatePointsUseCase,
        CalculatePointsUseCase,
        { provide: RACE_REPOSITORY, useValue: raceRepository },
        { provide: STARTING_GRID_REPOSITORY, useValue: gridRepository },
      ],
    }).compile();

    useCase = module.get(RecalculatePointsUseCase);
  });

  it('should return zero updates when no races exist', async () => {
    raceRepository.findByDateRange.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result).toEqual({ racesUpdated: 0, entriesUpdated: 0 });
    expect(gridRepository.updateEntries).not.toHaveBeenCalled();
  });

  it('should handle race with no entries', async () => {
    raceRepository.findByDateRange.mockResolvedValue([makeRace('r1')]);
    gridRepository.findByRaceId.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.racesUpdated).toBe(1);
    expect(result.entriesUpdated).toBe(0);
    // Empty updates still trigger the call (no-op for the repo)
    expect(gridRepository.updateEntries).toHaveBeenCalledWith([]);
  });

  it('should assign F1 points and positions to a clean grid', async () => {
    raceRepository.findByDateRange.mockResolvedValue([makeRace('r1')]);
    gridRepository.findByRaceId.mockResolvedValue([
      makeEntry('d1', 500),
      makeEntry('d2', 1000),
      makeEntry('d3', 2000),
    ]);

    await useCase.execute();

    const updates = gridRepository.updateEntries.mock.calls[0][0];
    expect(updates).toHaveLength(3);
    expect(updates[0]).toMatchObject({
      driverId: 'd1',
      position: 1,
      points: F1_POINTS[0], // 25
      isLastOnGrid: false,
    });
    expect(updates[1]).toMatchObject({
      driverId: 'd2',
      position: 2,
      points: F1_POINTS[1], // 18
    });
    expect(updates[2]).toMatchObject({
      driverId: 'd3',
      position: 3,
      points: F1_POINTS[2], // 15
      isLastOnGrid: true, // last on clean grid -> king
    });
  });

  it('should assign attendance (1 pt) beyond top 10', async () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      makeEntry(`d${i + 1}`, (i + 1) * 100),
    );
    raceRepository.findByDateRange.mockResolvedValue([makeRace('r1')]);
    gridRepository.findByRaceId.mockResolvedValue(entries);

    await useCase.execute();

    const updates = gridRepository.updateEntries.mock.calls[0][0];
    expect(updates[9]).toMatchObject({ position: 10, points: F1_POINTS[9] });
    expect(updates[10]).toMatchObject({
      position: 11,
      points: ATTENDANCE_POINTS,
    });
    expect(updates[11]).toMatchObject({
      position: 12,
      points: ATTENDANCE_POINTS,
      isLastOnGrid: true,
    });
  });

  it('should put false starts at last positions and crown the most early', async () => {
    // 5 total: 2 false starts + 3 on-time.
    //   sorted: EarlyEarly(-30s) Early(-5s) OnTime1(+1s) OnTime2(+2s) OnTime3(+3s)
    //   positions: EarlyEarly=5 (king), Early=4, OnTime1=1, OnTime2=2, OnTime3=3
    raceRepository.findByDateRange.mockResolvedValue([makeRace('r1')]);
    gridRepository.findByRaceId.mockResolvedValue([
      makeEntry('dEarlyEarly', -30000),
      makeEntry('dEarly', -5000),
      makeEntry('dOnTime1', 1000),
      makeEntry('dOnTime2', 2000),
      makeEntry('dOnTime3', 3000),
    ]);

    await useCase.execute();

    const updates = gridRepository.updateEntries.mock.calls[0][0];
    expect(updates[0]).toMatchObject({
      driverId: 'dEarlyEarly',
      position: 5,
      points: FALSE_START_PENALTY,
      isLastOnGrid: true,
    });
    expect(updates[1]).toMatchObject({
      driverId: 'dEarly',
      position: 4,
      points: FALSE_START_PENALTY,
      isLastOnGrid: false,
    });
    expect(updates[2]).toMatchObject({
      driverId: 'dOnTime1',
      position: 1,
      points: F1_POINTS[0],
    });
    expect(updates[3]).toMatchObject({ driverId: 'dOnTime2', position: 2 });
    expect(updates[4]).toMatchObject({ driverId: 'dOnTime3', position: 3 });
  });

  it('should handle a race where everyone is a false start', async () => {
    raceRepository.findByDateRange.mockResolvedValue([makeRace('r1')]);
    gridRepository.findByRaceId.mockResolvedValue([
      makeEntry('d1', -20000),
      makeEntry('d2', -10000),
    ]);

    await useCase.execute();

    const updates = gridRepository.updateEntries.mock.calls[0][0];
    expect(updates[0]).toMatchObject({
      driverId: 'd1',
      position: 2,
      points: FALSE_START_PENALTY,
      isLastOnGrid: true, // most early -> king
    });
    expect(updates[1]).toMatchObject({
      driverId: 'd2',
      position: 1,
      points: FALSE_START_PENALTY,
      isLastOnGrid: false,
    });
  });

  it('should process multiple races independently', async () => {
    raceRepository.findByDateRange.mockResolvedValue([
      makeRace('r1'),
      makeRace('r2'),
    ]);
    gridRepository.findByRaceId
      .mockResolvedValueOnce([makeEntry('a', 1000), makeEntry('b', 2000)])
      .mockResolvedValueOnce([makeEntry('c', 3000)]);

    const result = await useCase.execute();

    expect(result.racesUpdated).toBe(2);
    expect(result.entriesUpdated).toBe(3);
    expect(gridRepository.updateEntries).toHaveBeenCalledTimes(2);
  });
});
