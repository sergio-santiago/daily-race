import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { GetChampionshipStandingsUseCase } from '../application/get-championship-standings.use-case';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import { ALL_TIME_START, ALL_TIME_END } from '../core/constants';

async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.error('dev:preview-championship is disabled in production');
    process.exit(1);
  }

  const logger = new Logger('dev:preview-championship');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const getChampionship = app.get(GetChampionshipStandingsUseCase);
    const raceRepository = app.get<RaceRepositoryPort>(RACE_REPOSITORY);
    const notification = app.get<NotificationPort>(NOTIFICATION_PORT);

    const standings = await getChampionship.execute();
    const allRaces = await raceRepository.findByDateRange(
      ALL_TIME_START,
      ALL_TIME_END,
    );

    await notification.publishChampionshipStandings(standings, allRaces.length);

    logger.log(
      `Published championship with ${standings.length} drivers across ${allRaces.length} races`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Republish-championship CLI failed:', error);
  process.exit(1);
});
