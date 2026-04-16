import { Test } from '@nestjs/testing';
import { GetChampionshipStandingsUseCase } from '../get-championship-standings.use-case';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../../core/ports/starting-grid.repository.port';
import { Driver } from '../../core/entities/driver.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';

function makeEntry(
  position: number,
  points: number,
  isFalseStart = false,
): StartingGridEntry {
  const gl = new Date('2026-03-27T09:00:00Z');
  return new StartingGridEntry(
    position,
    new Driver('d1', 'g1', 'Test', null),
    new Date(gl.getTime() + 1000),
    gl,
    points,
    isFalseStart,
    false,
  );
}

describe('GetChampionshipStandingsUseCase', () => {
  let useCase: GetChampionshipStandingsUseCase;
  let driverRepository: jest.Mocked<DriverRepositoryPort>;
  let gridRepository: jest.Mocked<StartingGridRepositoryPort>;

  beforeEach(async () => {
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

    const module = await Test.createTestingModule({
      providers: [
        GetChampionshipStandingsUseCase,
        { provide: DRIVER_REPOSITORY, useValue: driverRepository },
        { provide: STARTING_GRID_REPOSITORY, useValue: gridRepository },
      ],
    }).compile();

    useCase = module.get(GetChampionshipStandingsUseCase);
  });

  it('should return empty when no drivers', async () => {
    driverRepository.findAll.mockResolvedValue([]);
    const result = await useCase.execute();
    expect(result).toHaveLength(0);
  });

  it('should rank drivers by total points descending', async () => {
    const alice = new Driver('d1', 'g1', 'Alice', null);
    const bob = new Driver('d2', 'g2', 'Bob', null);

    driverRepository.findAll.mockResolvedValue([alice, bob]);
    gridRepository.findByDriverInDateRange
      .mockResolvedValueOnce([makeEntry(3, 50), makeEntry(2, 60)])
      .mockResolvedValueOnce([makeEntry(1, 90), makeEntry(1, 95)]);

    const result = await useCase.execute();

    expect(result[0].driver.displayName).toBe('Bob');
    expect(result[0].totalPoints).toBe(185);
    expect(result[0].rank).toBe(1);

    expect(result[1].driver.displayName).toBe('Alice');
    expect(result[1].totalPoints).toBe(110);
    expect(result[1].rank).toBe(2);
  });

  it('should ignore false starts when calculating bestFinish', async () => {
    // False starters get last positions in the new model (e.g. pos 18 for 18
    // total with 1 false start). bestFinish must look only at clean entries.
    const driver = new Driver('d1', 'g1', 'Racer', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(18, -5, true),
      makeEntry(5, 10),
      makeEntry(2, 18),
    ]);

    const result = await useCase.execute();

    expect(result[0].bestFinish).toBe(2);
    expect(result[0].falseStarts).toBe(1);
  });

  it('should handle driver with only false starts', async () => {
    const driver = new Driver('d1', 'g1', 'EarlyBird', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(20, -5, true),
      makeEntry(15, -5, true),
    ]);

    const result = await useCase.execute();

    expect(result[0].bestFinish).toBe(0);
    expect(result[0].falseStarts).toBe(2);
    expect(result[0].totalPoints).toBe(-10);
    expect(result[0].wins).toBe(0);
    expect(result[0].podiums).toBe(0);
  });

  it('should count races attended correctly', async () => {
    const driver = new Driver('d1', 'g1', 'Regular', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(1, 25),
      makeEntry(3, 15),
      makeEntry(10, 1),
    ]);

    const result = await useCase.execute();

    expect(result[0].racesAttended).toBe(3);
  });

  it('should count wins (P1 finishes)', async () => {
    const driver = new Driver('d1', 'g1', 'Winner', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(1, 25),
      makeEntry(1, 25),
      makeEntry(3, 15),
      makeEntry(4, 12),
    ]);

    const result = await useCase.execute();

    expect(result[0].wins).toBe(2);
  });

  it('should count podiums (P1, P2 or P3 finishes)', async () => {
    const driver = new Driver('d1', 'g1', 'Podium', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(1, 25),
      makeEntry(2, 18),
      makeEntry(3, 15),
      makeEntry(4, 12),
      makeEntry(10, 1),
    ]);

    const result = await useCase.execute();

    expect(result[0].podiums).toBe(3);
    expect(result[0].wins).toBe(1);
  });

  it('should not count false starts in wins or podiums even if position <= 3', async () => {
    // Defensive: BuildStartingGrid never assigns P1-3 to false starts, but
    // cleanEntries filter uses isFalseStart to be safe.
    const driver = new Driver('d1', 'g1', 'Defensive', null);

    driverRepository.findAll.mockResolvedValue([driver]);
    gridRepository.findByDriverInDateRange.mockResolvedValue([
      makeEntry(1, -5, true), // imposible en prod, pero defensive
      makeEntry(2, -5, true),
      makeEntry(5, 10),
    ]);

    const result = await useCase.execute();

    expect(result[0].wins).toBe(0);
    expect(result[0].podiums).toBe(0);
  });
});
