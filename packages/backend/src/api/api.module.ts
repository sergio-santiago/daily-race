import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { GoogleModule } from '../infrastructure/google/google.module';
import { RaceController } from './race.controller';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';

@Module({
  imports: [ApplicationModule, GoogleModule],
  controllers: [RaceController, HealthController, AuthController],
})
export class ApiModule {}
