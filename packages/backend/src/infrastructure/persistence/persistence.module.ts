import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaceOrmEntity } from './typeorm/entities/race.orm-entity';
import { DriverOrmEntity } from './typeorm/entities/driver.orm-entity';
import { StartingGridEntryOrmEntity } from './typeorm/entities/starting-grid-entry.orm-entity';
import { TranscriptEntryOrmEntity } from './typeorm/entities/transcript-entry.orm-entity';
import { RaceTypeOrmRepository } from './typeorm/repositories/race.typeorm-repository';
import { DriverTypeOrmRepository } from './typeorm/repositories/driver.typeorm-repository';
import { StartingGridTypeOrmRepository } from './typeorm/repositories/starting-grid.typeorm-repository';
import { TranscriptTypeOrmRepository } from './typeorm/repositories/transcript.typeorm-repository';
import { RACE_REPOSITORY } from '../../core/ports/race.repository.port';
import { DRIVER_REPOSITORY } from '../../core/ports/driver.repository.port';
import { STARTING_GRID_REPOSITORY } from '../../core/ports/starting-grid.repository.port';
import { TRANSCRIPT_REPOSITORY } from '../../core/ports/transcript.repository.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RaceOrmEntity,
      DriverOrmEntity,
      StartingGridEntryOrmEntity,
      TranscriptEntryOrmEntity,
    ]),
  ],
  providers: [
    { provide: RACE_REPOSITORY, useClass: RaceTypeOrmRepository },
    { provide: DRIVER_REPOSITORY, useClass: DriverTypeOrmRepository },
    {
      provide: STARTING_GRID_REPOSITORY,
      useClass: StartingGridTypeOrmRepository,
    },
    { provide: TRANSCRIPT_REPOSITORY, useClass: TranscriptTypeOrmRepository },
  ],
  exports: [
    RACE_REPOSITORY,
    DRIVER_REPOSITORY,
    STARTING_GRID_REPOSITORY,
    TRANSCRIPT_REPOSITORY,
  ],
})
export class PersistenceModule {}
