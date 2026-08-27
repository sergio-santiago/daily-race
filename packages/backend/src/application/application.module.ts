import { Module } from '@nestjs/common';
import { PersistenceModule } from '../infrastructure/persistence/persistence.module';
import { GoogleModule } from '../infrastructure/google/google.module';
import { NotificationModule } from '../infrastructure/notification/notification.module';
import { CalculatePointsUseCase } from './calculate-points.use-case';
import { BuildStartingGridUseCase } from './build-starting-grid.use-case';
import { ProcessRaceUseCase } from './process-race.use-case';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { FindConferenceRecordService } from './find-conference-record.service';
import { MonitorLiveRaceUseCase } from './monitor-live-race.use-case';

@Module({
  imports: [PersistenceModule, GoogleModule, NotificationModule.forRoot()],
  providers: [
    CalculatePointsUseCase,
    BuildStartingGridUseCase,
    ProcessRaceUseCase,
    GetChampionshipStandingsUseCase,
    FindConferenceRecordService,
    MonitorLiveRaceUseCase,
  ],
  exports: [
    ProcessRaceUseCase,
    MonitorLiveRaceUseCase,
  ],
})
export class ApplicationModule {}
