import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { RecalculatePointsUseCase } from '../application/recalculate-points.use-case';

async function run() {
  const logger = new Logger('recalculate-points');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const useCase = app.get(RecalculatePointsUseCase);
    const result = await useCase.execute();
    logger.log(
      `Done. Races updated: ${result.racesUpdated}, entries updated: ${result.entriesUpdated}`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error('Recalculate-points CLI failed:', error);
  process.exit(1);
});
