import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MonitorLiveRaceUseCase } from '../../application/monitor-live-race.use-case';

@Injectable()
export class RacePollScheduler {
  private readonly logger = new Logger(RacePollScheduler.name);

  constructor(private readonly monitorLiveRace: MonitorLiveRaceUseCase) {}

  @Cron('*/5 * 9-11 * * 1-5')
  async pollForRace(): Promise<void> {
    this.logger.debug('Polling for daily race...');
    try {
      await this.monitorLiveRace.execute();
    } catch (error) {
      this.logger.error(`Live race monitoring failed: ${error}`);
    }
  }
}
