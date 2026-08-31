import { Injectable, Inject } from '@nestjs/common';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { ALL_TIME_END, seasonStart } from '../core/constants';

/**
 * Publica la clasificacion del campeonato de la temporada en curso.
 *
 * Existe para que los dos caminos que cierran una carrera (el monitor en
 * directo y el proceso a posteriori) publiquen exactamente lo mismo. Antes cada
 * uno leia el standing y las carreras por su cuenta, y el rango de fechas habia
 * que acordarse de cambiarlo en los dos.
 *
 * El relevo de temporada no se anuncia aqui: sale al principio de la jornada,
 * y de eso se encarga AnnounceSeasonUseCase.
 */
@Injectable()
export class PublishChampionshipUseCase {
  constructor(
    @Inject(RACE_REPOSITORY)
    private readonly raceRepository: RaceRepositoryPort,
    @Inject(NOTIFICATION_PORT)
    private readonly notification: NotificationPort,
    private readonly getChampionship: GetChampionshipStandingsUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<void> {
    const from = seasonStart(now);
    const standings = await this.getChampionship.execute(from);
    const races = await this.raceRepository.findByDateRange(from, ALL_TIME_END);
    await this.notification.publishChampionshipStandings(standings, races);
  }
}
