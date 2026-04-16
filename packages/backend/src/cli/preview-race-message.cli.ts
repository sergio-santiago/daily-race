import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
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
  const logger = new Logger('preview-race-message');
  const raceIdArg = process.argv[2];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const raceRepository = app.get<RaceRepositoryPort>(RACE_REPOSITORY);
    const notification = app.get<NotificationPort>(NOTIFICATION_PORT);

    let race = null;
    if (raceIdArg) {
      race = await raceRepository.findById(raceIdArg);
      if (!race) {
        logger.error(`Race ${raceIdArg} not found`);
        process.exit(1);
      }
    } else {
      const races = await raceRepository.findByDateRange(
        ALL_TIME_START,
        ALL_TIME_END,
      );
      race = races[0];
      if (!race) {
        logger.error('No races in database');
        process.exit(1);
      }
      logger.log(
        `No raceId argument given, using most recent race: ${race.id} (${race.greenLight.toISOString()})`,
      );
    }

    await notification.publishRaceResults(race);
    logger.log(
      `Published race ${race.id} (${race.startingGrid.length} drivers) to RACE_DAY webhook`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Preview-race-message CLI failed:', error);
  process.exit(1);
});
