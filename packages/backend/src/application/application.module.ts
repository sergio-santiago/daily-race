import { Module } from '@nestjs/common';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { GoogleModule } from '../infrastructure/google/google.module';
import { DiscordModule } from '../infrastructure/discord/discord.module';
import { CalculatePointsUseCase } from './calculate-points.use-case';
import { BuildStartingGridUseCase } from './build-starting-grid.use-case';
import { ProcessRaceUseCase } from './process-race.use-case';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { FindConferenceRecordService } from './find-conference-record.service';
import { MonitorLiveRaceUseCase } from './monitor-live-race.use-case';
import { PublishChampionshipUseCase } from './publish-championship.use-case';
import { AnnounceSeasonUseCase } from './announce-season.use-case';

@Module({
  imports: [PersistenceModule, GoogleModule, DiscordModule],
  providers: [
    CalculatePointsUseCase,
    BuildStartingGridUseCase,
    ProcessRaceUseCase,
    GetChampionshipStandingsUseCase,
    PublishChampionshipUseCase,
    AnnounceSeasonUseCase,
    FindConferenceRecordService,
    MonitorLiveRaceUseCase,
  ],
  exports: [
    ProcessRaceUseCase,
    MonitorLiveRaceUseCase,
  ],
})
export class ApplicationModule {}
