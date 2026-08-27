import { Controller, Get, Header } from '@nestjs/common';
import {
  LiveRaceSnapshot,
  MonitorLiveRaceUseCase,
} from '../application/monitor-live-race.use-case';
import { StartingGridEntry } from '../core/entities/starting-grid-entry.entity';
import {
  GridEntryDto,
  LiveRaceSnapshotDto,
} from './live-race.dto';

/**
 * Endpoint REST consumido por el Meet Add-on (frontend).
 *
 * Polling 2-3s desde el side panel y main stage. No requiere auth (cualquier
 * empleado @secture.com con el add-on instalado puede leer el grid en vivo).
 *
 * `Cache-Control: no-store` porque el estado cambia continuamente y no debe
 * cachearse en proxies intermedios. Las best practices de Meet Add-on piden
 * cache HTTP <= 24h para assets, pero este es un endpoint dinamico.
 */
@Controller('api/live-race')
export class LiveRaceController {
  constructor(
    private readonly monitorLiveRace: MonitorLiveRaceUseCase,
  ) {}

  @Get('current')
  @Header('Cache-Control', 'no-store')
  getCurrent(): LiveRaceSnapshotDto {
    const snapshot = this.monitorLiveRace.getLiveSnapshot();
    return this.toDto(snapshot);
  }

  private toDto(snapshot: LiveRaceSnapshot): LiveRaceSnapshotDto {
    return {
      status: snapshot.status,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      meetingCode: snapshot.meetingCode,
      greenLight: snapshot.greenLight ? snapshot.greenLight.toISOString() : null,
      participantCount: snapshot.participantCount,
      grid: snapshot.grid.map((entry) => this.toGridEntryDto(entry)),
      lastUpdatedAt: snapshot.lastUpdatedAt
        ? snapshot.lastUpdatedAt.toISOString()
        : null,
    };
  }

  private toGridEntryDto(entry: StartingGridEntry): GridEntryDto {
    return {
      position: entry.position,
      driver: {
        id: entry.driver.id,
        googleId: entry.driver.googleId,
        displayName: entry.driver.displayName,
        email: entry.driver.email,
      },
      startTime: entry.startTime.toISOString(),
      greenLight: entry.greenLight.toISOString(),
      diffSeconds: entry.diffSeconds,
      points: entry.points,
      isFalseStart: entry.isFalseStart,
      isWorstOnGrid: entry.isWorstOnGrid,
    };
  }
}
