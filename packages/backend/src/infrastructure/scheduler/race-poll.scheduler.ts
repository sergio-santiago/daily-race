import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProcessRaceUseCase } from '../../application/process-race.use-case';

@Injectable()
export class RacePollScheduler {
  private readonly logger = new Logger(RacePollScheduler.name);

  constructor(private readonly processRace: ProcessRaceUseCase) {}

  @Cron('0 * 9-11 * * 1-5')
  async pollForFinishedRace(): Promise<void> {
    this.logger.debug('Polling for finished daily race...');
    try {
      const result = await this.processRace.execute();
      if (result) {
        this.logger.log(
          `Race processed: ${result.startingGrid.length} drivers`,
        );
      }
    } catch (error) {
      this.logger.error(`Race processing failed: ${error}`);
    }
  }
}
