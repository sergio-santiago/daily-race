import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../core/ports/notification.port';
import {
  SEASON_ANNOUNCEMENT_REPOSITORY,
  SeasonAnnouncementRepositoryPort,
} from '../core/ports/season-announcement.repository.port';
import { GetChampionshipStandingsUseCase } from './get-championship-standings.use-case';
import { SeasonSummary } from '../core/entities/season-summary.entity';
import {
  previousSeasonEnd,
  previousSeasonStart,
  seasonLabel,
} from '../core/constants';

/**
 * Anuncia el relevo de temporada al principio de la jornada, antes de que nadie
 * entre a la sala.
 *
 * Lo llama el scheduler en cada tick, y el tick ya viene filtrado por el cron a
 * dias laborables entre las 8:00 y las 11:59, asi que el primer tick que
 * encuentre la temporada sin anunciar cae por construccion la manana del primer
 * dia laborable de la temporada. No hace falta ninguna logica de calendario, ni
 * tratar los 1 de septiembre que caen en sabado.
 *
 * A proposito no se dispara al arrancar el proceso: el contenedor arranca en
 * cada deploy y a cualquier hora, y el relevo es un evento del calendario, no de
 * la infraestructura.
 */
@Injectable()
export class AnnounceSeasonUseCase {
  private readonly logger = new Logger(AnnounceSeasonUseCase.name);

  constructor(
    @Inject(RACE_REPOSITORY)
    private readonly raceRepository: RaceRepositoryPort,
    @Inject(NOTIFICATION_PORT)
    private readonly notification: NotificationPort,
    @Inject(SEASON_ANNOUNCEMENT_REPOSITORY)
    private readonly announcements: SeasonAnnouncementRepositoryPort,
    private readonly getChampionship: GetChampionshipStandingsUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<void> {
    const label = seasonLabel(now);
    const summary = await this.buildPreviousSeason(now, label);
    if (!summary) return;

    // Se reserva el anuncio ANTES de publicarlo, y el orden es deliberado. Si se
    // publicase primero, un fallo al registrarlo dejaria al cron reintentando
    // cada cinco segundos y el canal se llenaria. Al reservar primero, el peor
    // caso es que el mensaje no salga y se publique a mano, que no molesta a
    // nadie.
    const isMine = await this.announcements.claim(label);
    if (!isMine) return;

    await this.notification.publishSeasonChange(summary);
    this.logger.log(
      `Temporada ${label} anunciada, cerrando ${summary.label} con ${summary.racesCount} carreras`,
    );
  }

  /**
   * Devuelve null cuando no hay nada que cerrar: la primerisima temporada, o una
   * temporada anterior sin carreras. Se comprueba antes de reservar el anuncio
   * para no quemar la marca de una temporada que todavia no puede anunciarse.
   */
  private async buildPreviousSeason(
    now: Date,
    nextLabel: string,
  ): Promise<SeasonSummary | null> {
    const from = previousSeasonStart(now);
    const to = previousSeasonEnd(now);
    const races = await this.raceRepository.findByDateRange(from, to);
    if (races.length === 0) return null;

    const standings = await this.getChampionship.execute(from, to);
    if (standings.length === 0) return null;

    return new SeasonSummary(
      seasonLabel(from),
      nextLabel,
      races,
      standings,
    );
  }
}
