import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { GetChampionshipStandingsUseCase } from '../application/get-championship-standings.use-case';
import { PublishChampionshipUseCase } from '../application/publish-championship.use-case';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import { ALL_TIME_END, seasonStart } from '../core/constants';

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
    // Se publica por el mismo caso de uso que produccion, para que el preview
    // sea la clasificacion de verdad y no una version aparte. El relevo de
    // temporada NO sale por aqui: vive en AnnounceSeasonUseCase, que lo dispara
    // el monitor al abrir la jornada
    const publishChampionship = app.get(PublishChampionshipUseCase);
    const getChampionship = app.get(GetChampionshipStandingsUseCase);
    const raceRepository = app.get<RaceRepositoryPort>(RACE_REPOSITORY);

    await publishChampionship.execute();

    const standings = await getChampionship.execute();
    const races = await raceRepository.findByDateRange(
      seasonStart(),
      ALL_TIME_END,
    );
    logger.log(
      `Published championship with ${standings.length} drivers across ${races.length} races`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Republish-championship CLI failed:', error);
  process.exit(1);
});
