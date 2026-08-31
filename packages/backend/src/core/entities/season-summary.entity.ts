import { ChampionshipStanding } from './championship-standing.entity';

/**
 * Cierre de una temporada terminada, con lo justo para anunciarla: como se
 * llamaba, cuanto duro y quien subio al podio.
 *
 * El podio son las tres primeras posiciones de la clasificacion, ya ordenadas y
 * con sus desempates resueltos. Puede traer menos de tres si la temporada tuvo
 * menos pilotos, y puede traer mas si alguna posicion del podio esta empatada,
 * porque el ranking comparte posicion entre empatados.
 */
export class SeasonSummary {
  constructor(
    public readonly label: string,
    public readonly racesCount: number,
    public readonly driversCount: number,
    public readonly podium: ChampionshipStanding[],
    public readonly nextLabel: string,
  ) {}
}
