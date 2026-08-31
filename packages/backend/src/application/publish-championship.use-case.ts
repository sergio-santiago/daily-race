import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { SeasonSummary } from '../core/entities/season-summary.entity';
import {
  ALL_TIME_END,
  previousSeasonEnd,
  previousSeasonStart,
  seasonLabel,
  seasonStart,
} from '../core/constants';

/** Cuantas posiciones del podio se cuentan al cerrar una temporada */
const PODIUM_SIZE = 3;

/**
 * Publica la clasificacion del campeonato, y en la primera carrera de una
 * temporada nueva anuncia antes el relevo.
 *
 * Existe para que los dos caminos que cierran una carrera (el monitor en
 * directo y el proceso a posteriori) publiquen exactamente lo mismo. Antes cada
 * uno leia el standing y las carreras por su cuenta, y el rango de fechas habia
 * que acordarse de cambiarlo en los dos.
 */
@Injectable()
export class PublishChampionshipUseCase {
  private readonly logger = new Logger(PublishChampionshipUseCase.name);

  /**
   * Temporadas ya anunciadas en este proceso.
   *
   * El anuncio se dispara cuando la temporada tiene una sola carrera, que es
   * una condicion derivada de los datos y por tanto sobrevive a un redeploy sin
   * necesitar tabla de estado. Lo que no cubre por si sola es el reintento: si
   * el anuncio sale bien y falla el embed del campeonato, el monitor vuelve a
   * intentarlo en el siguiente tick y la temporada sigue teniendo una carrera.
   * Este set corta ese duplicado dentro del proceso, que es donde ocurren los
   * reintentos.
   */
  private readonly announced = new Set<string>();

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

    if (this.isSeasonOpener(races.length, now)) {
      const summary = await this.buildPreviousSeason(now);
      if (summary) {
        await this.notification.publishSeasonChange(summary);
        this.announced.add(seasonLabel(now));
        this.logger.log(
          `Temporada ${summary.nextLabel} anunciada, cerrando ${summary.label} con ${summary.racesCount} carreras`,
        );
      }
    }

    await this.notification.publishChampionshipStandings(standings, races);
  }

  private isSeasonOpener(racesInSeason: number, now: Date): boolean {
    return racesInSeason === 1 && !this.announced.has(seasonLabel(now));
  }

  /**
   * Devuelve null cuando no hay nada que cerrar, o sea en la primerisima
   * temporada: sin carreras detras, un mensaje de relevo no dice nada.
   */
  private async buildPreviousSeason(
    now: Date,
  ): Promise<SeasonSummary | null> {
    const from = previousSeasonStart(now);
    const to = previousSeasonEnd(now);
    const races = await this.raceRepository.findByDateRange(from, to);
    if (races.length === 0) return null;

    const standings = await this.getChampionship.execute(from, to);
    if (standings.length === 0) return null;

    const podium = standings.filter((s) => s.rank <= PODIUM_SIZE);
    return new SeasonSummary(
      seasonLabel(from),
      races.length,
      standings.length,
      podium,
      seasonLabel(now),
    );
  }
}
