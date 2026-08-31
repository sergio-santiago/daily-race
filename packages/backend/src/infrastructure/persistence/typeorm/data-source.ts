import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RaceOrmEntity } from './entities/race.orm-entity';
import { DriverOrmEntity } from './entities/driver.orm-entity';
import { StartingGridEntryOrmEntity } from './entities/starting-grid-entry.orm-entity';
import { SeasonAnnouncementOrmEntity } from './entities/season-announcement.orm-entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'dailyrace',
  password: process.env.POSTGRES_PASSWORD || 'dailyrace_dev',
  database: process.env.POSTGRES_DB || 'dailyrace',
  namingStrategy: new SnakeNamingStrategy(),
  entities: [
    RaceOrmEntity,
    DriverOrmEntity,
    StartingGridEntryOrmEntity,
    SeasonAnnouncementOrmEntity,
  ],
  migrations: [
    'src/infrastructure/persistence/typeorm/migrations/*.ts',
  ],
});
