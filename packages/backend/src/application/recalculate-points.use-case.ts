import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../core/ports/starting-grid.repository.port';
import { CalculatePointsUseCase } from './calculate-points.use-case';
import { ALL_TIME_START, ALL_TIME_END } from '../core/constants';

export interface RecalculatePointsResult {
  racesUpdated: number;
  entriesUpdated: number;
}

@Injectable()
export class RecalculatePointsUseCase {
  private readonly logger = new Logger(RecalculatePointsUseCase.name);

  constructor(
    @Inject(RACE_REPOSITORY)
    private readonly raceRepository: RaceRepositoryPort,
    @Inject(STARTING_GRID_REPOSITORY)
    private readonly gridRepository: StartingGridRepositoryPort,
    private readonly calculatePoints: CalculatePointsUseCase,
  ) {}

  async execute(): Promise<RecalculatePointsResult> {
    const races = await this.raceRepository.findByDateRange(
      ALL_TIME_START,
      ALL_TIME_END,
    );

    let entriesUpdated = 0;

    for (const race of races) {
      const entries = await this.gridRepository.findByRaceId(race.id);

      const sorted = [...entries].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime(),
      );

      // King of Ruina: first in sorted list if any false start, else last
      const hasFalseStart =
        sorted.length > 0 &&
        sorted[0].startTime.getTime() < sorted[0].greenLight.getTime();
      const kingIndex = hasFalseStart ? 0 : sorted.length - 1;

      // False starters get the last positions in the ranking (see
      // BuildStartingGridUseCase for rationale).
      const totalCount = sorted.length;
      let gridPosition = 0;
      let falseStartIndex = 0;

      const updates = sorted.map((entry, index) => {
        const isFalseStart =
          entry.startTime.getTime() < entry.greenLight.getTime();
        let position: number;
        if (isFalseStart) {
          position = totalCount - falseStartIndex;
          falseStartIndex++;
        } else {
          gridPosition++;
          position = gridPosition;
        }
        const { points } = this.calculatePoints.execute({
          position,
          isFalseStart,
        });
        return {
          raceId: race.id,
          driverId: entry.driver.id,
          position,
          points,
          isLastOnGrid: index === kingIndex,
        };
      });

      await this.gridRepository.updateEntries(updates);
      entriesUpdated += updates.length;

      this.logger.log(
        `Recalculated race ${race.id}: ${updates.length} entries`,
      );
    }

    return { racesUpdated: races.length, entriesUpdated };
  }
}
