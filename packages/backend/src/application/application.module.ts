import { Module } from '@nestjs/common';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { GoogleModule } from '../infrastructure/google/google.module';
import { DiscordModule } from '../infrastructure/discord/discord.module';
import { CalculatePointsUseCase } from './calculate-points.use-case';
import { BuildStartingGridUseCase } from './build-starting-grid.use-case';
import { ProcessRaceUseCase } from './process-race.use-case';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { FindConferenceRecordService } from './find-conference-record.service';

@Module({
  imports: [PersistenceModule, GoogleModule, DiscordModule],
  providers: [
    CalculatePointsUseCase,
    BuildStartingGridUseCase,
    ProcessRaceUseCase,
    GetChampionshipStandingsUseCase,
    FindConferenceRecordService,
  ],
  exports: [ProcessRaceUseCase],
})
export class ApplicationModule {}
