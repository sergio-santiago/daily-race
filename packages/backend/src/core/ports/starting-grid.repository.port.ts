import { StartingGridEntry } from '../entities/starting-grid-entry.entity';

export const STARTING_GRID_REPOSITORY = Symbol('STARTING_GRID_REPOSITORY');

export interface StartingGridRepositoryPort {
  saveAll(raceId: string, entries: StartingGridEntry[]): Promise<void>;
  findByRaceId(raceId: string): Promise<StartingGridEntry[]>;
  findByDriverInDateRange(
    driverId: string,
    start: Date,
    end: Date,
  ): Promise<StartingGridEntry[]>;
  updateEntries(
    updates: Array<{
      raceId: string;
      driverId: string;
      position: number;
      points: number;
      isWorstOnGrid: boolean;
    }>,
  ): Promise<void>;
}
