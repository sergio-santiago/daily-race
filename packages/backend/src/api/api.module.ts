import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { GoogleModule } from '../infrastructure/google/google.module';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    ApplicationModule,
    GoogleModule, // AUTH_PROVIDER for AuthController and HealthController
  ],
  controllers: [HealthController, AuthController],
})
export class ApiModule {}
