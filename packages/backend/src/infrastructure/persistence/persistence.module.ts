import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RaceOrmEntity } from './typeorm/entities/race.orm-entity';
import { DriverOrmEntity } from './typeorm/entities/driver.orm-entity';
import { StartingGridEntryOrmEntity } from './typeorm/entities/starting-grid-entry.orm-entity';
import { SeasonAnnouncementOrmEntity } from './typeorm/entities/season-announcement.orm-entity';
import { RaceTypeOrmRepository } from './typeorm/repositories/race.typeorm-repository';
import { DriverTypeOrmRepository } from './typeorm/repositories/driver.typeorm-repository';
import { StartingGridTypeOrmRepository } from './typeorm/repositories/starting-grid.typeorm-repository';
import { SeasonAnnouncementTypeOrmRepository } from './typeorm/repositories/season-announcement.typeorm-repository';
import { RACE_REPOSITORY } from '../../core/ports/race.repository.port';
import { DRIVER_REPOSITORY } from '../../core/ports/driver.repository.port';
import { STARTING_GRID_REPOSITORY } from '../../core/ports/starting-grid.repository.port';
import { SEASON_ANNOUNCEMENT_REPOSITORY } from '../../core/ports/season-announcement.repository.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RaceOrmEntity,
      DriverOrmEntity,
      StartingGridEntryOrmEntity,
      SeasonAnnouncementOrmEntity,
    ]),
  ],
  providers: [
    { provide: RACE_REPOSITORY, useClass: RaceTypeOrmRepository },
    { provide: DRIVER_REPOSITORY, useClass: DriverTypeOrmRepository },
    {
      provide: STARTING_GRID_REPOSITORY,
      useClass: StartingGridTypeOrmRepository,
    },
    {
      provide: SEASON_ANNOUNCEMENT_REPOSITORY,
      useClass: SeasonAnnouncementTypeOrmRepository,
    },
  ],
  exports: [
    RACE_REPOSITORY,
    DRIVER_REPOSITORY,
    STARTING_GRID_REPOSITORY,
    SEASON_ANNOUNCEMENT_REPOSITORY,
  ],
})
export class PersistenceModule {}
