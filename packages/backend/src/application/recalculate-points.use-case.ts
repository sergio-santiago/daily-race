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

      let gridPosition = 0;
      const updates = sorted.map((entry) => {
        const isFalseStart =
          entry.startTime.getTime() < entry.greenLight.getTime();
        if (!isFalseStart) gridPosition++;
        const position = isFalseStart ? 0 : gridPosition;
        const { points } = this.calculatePoints.execute({
          position,
          isFalseStart,
        });
        return {
          raceId: race.id,
          driverId: entry.driver.id,
          position,
          points,
        };
      });

      await this.gridRepository.updatePointsAndPosition(updates);
      entriesUpdated += updates.length;

      this.logger.log(
        `Recalculated race ${race.id}: ${updates.length} entries`,
      );
    }

    return { racesUpdated: races.length, entriesUpdated };
  }
}
