import { Module } from '@nestjs/common';
import { SvgToPngService } from './svg-to-png.service';
import { ChampionshipEvolutionChartService } from './championship-evolution-chart.service';
import { RaceGapChartService } from './race-gap-chart.service';

@Module({
  providers: [
    SvgToPngService,
    ChampionshipEvolutionChartService,
    RaceGapChartService,
  ],
  exports: [ChampionshipEvolutionChartService, RaceGapChartService],
})
export class ChartsModule {}
