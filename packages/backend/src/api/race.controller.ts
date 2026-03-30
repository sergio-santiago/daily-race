import { Controller, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ProcessRaceUseCase } from '../application/process-race.use-case';

@Controller('races')
export class RaceController {
  constructor(private readonly processRace: ProcessRaceUseCase) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async triggerProcessRace(@Query('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : undefined;
    const result = await this.processRace.execute(date);
    if (!result) {
      return { message: 'No race to process', race: null };
    }
    return {
      message: 'Race processed',
      race: {
        id: result.id,
        greenLight: result.greenLight,
        driversCount: result.startingGrid.length,
        winner: result.startingGrid[0]?.driver.displayName,
      },
    };
  }
}
