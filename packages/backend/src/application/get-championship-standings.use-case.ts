import { Injectable, Inject } from '@nestjs/common';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../core/ports/starting-grid.repository.port';
import { ChampionshipStanding } from '../core/entities/championship-standing.entity';
import { ALL_TIME_START, ALL_TIME_END } from '@daily-race/shared';

@Injectable()
export class GetChampionshipStandingsUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepositoryPort,
    @Inject(STARTING_GRID_REPOSITORY)
    private readonly startingGridRepository: StartingGridRepositoryPort,
  ) {}

  async execute(): Promise<ChampionshipStanding[]> {
    const drivers = await this.driverRepository.findAll();
    const standings: ChampionshipStanding[] = [];

    for (const driver of drivers) {
      const entries =
        await this.startingGridRepository.findByDriverInDateRange(
          driver.id,
          ALL_TIME_START,
          ALL_TIME_END,
        );
      if (entries.length === 0) continue;

      const cleanEntries = entries.filter((e) => e.position > 0);
      const bestFinish = cleanEntries.length > 0
        ? Math.min(...cleanEntries.map((e) => e.position))
        : 0;

      standings.push(
        new ChampionshipStanding(
          driver,
          entries.reduce((sum, e) => sum + e.points, 0),
          entries.length,
          entries.filter((e) => e.isFalseStart).length,
          bestFinish,
          0,
        ),
      );
    }

    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    return standings.map(
      (s, i) =>
        new ChampionshipStanding(
          s.driver,
          s.totalPoints,
          s.racesAttended,
          s.falseStarts,
          s.bestFinish,
          i + 1,
        ),
    );
  }
}
