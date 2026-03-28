import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ApiModule } from './api/api.module';
import { SchedulerModule } from './infrastructure/scheduler/scheduler.module';
import { RaceOrmEntity } from './infrastructure/persistence/typeorm/entities/race.orm-entity';
import { DriverOrmEntity } from './infrastructure/persistence/typeorm/entities/driver.orm-entity';
import { StartingGridEntryOrmEntity } from './infrastructure/persistence/typeorm/entities/starting-grid-entry.orm-entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get('POSTGRES_USER', 'dailyrace'),
        password: config.get('POSTGRES_PASSWORD', 'dailyrace_dev'),
        database: config.get('POSTGRES_DB', 'dailyrace'),
        entities: [RaceOrmEntity, DriverOrmEntity, StartingGridEntryOrmEntity],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        migrationsRun: true,
        migrations: ['dist/infrastructure/persistence/typeorm/migrations/*.js'],
      }),
    }),
    ScheduleModule.forRoot(),
    ApiModule,
    SchedulerModule,
  ],
})
export class AppModule {}
