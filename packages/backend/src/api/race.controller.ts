import {
  Controller,
  Post,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProcessRaceUseCase } from '../application/process-race.use-case';
import { GetChampionshipStandingsUseCase } from '../application/get-championship-standings.use-case';

@Controller('races')
export class RaceController {
  constructor(
    private readonly processRace: ProcessRaceUseCase,
    private readonly getChampionship: GetChampionshipStandingsUseCase,
  ) {}

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

  @Get('championship')
  async getChampionshipStandings() {
    const standings = await this.getChampionship.execute();
    return {
      standings: standings.map((s) => ({
        rank: s.rank,
        driver: s.driver.displayName,
        totalPoints: Number(s.totalPoints.toFixed(2)),
        racesAttended: s.racesAttended,
        falseStarts: s.falseStarts,
        bestFinish: s.bestFinish,
      })),
    };
  }
}
