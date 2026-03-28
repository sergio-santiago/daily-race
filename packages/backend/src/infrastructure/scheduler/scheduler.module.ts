import { Module } from '@nestjs/common';
import { ApplicationModule } from '../../application/application.module';
import { RacePollScheduler } from './race-poll.scheduler';

@Module({
  imports: [ApplicationModule],
  providers: [RacePollScheduler],
})
export class SchedulerModule {}
