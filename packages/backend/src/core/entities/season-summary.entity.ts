import { ChampionshipStanding } from './championship-standing.entity';
import { Race } from './race.entity';

/** Cuantas posiciones se cuentan como podio al cerrar una temporada */
export const PODIUM_SIZE = 3;

/**
 * Cierre de una temporada terminada: como se llamaba, que se corrio y como
 * quedo la clasificacion.
 *
 * Lleva las carreras y la clasificacion completas, no un resumen ya masticado,
 * porque el mensaje solo necesita el podio pero la grafica de la temporada
 * necesita a todo el mundo para dibujar la mediana del peloton.
 */
export class SeasonSummary {
  constructor(
    public readonly label: string,
    public readonly nextLabel: string,
    public readonly races: Race[],
    public readonly standings: ChampionshipStanding[],
  ) {}

  get racesCount(): number {
    return this.races.length;
  }

  get driversCount(): number {
    return this.standings.length;
  }

  /**
   * Las tres primeras POSICIONES, que no siempre son tres pilotos: hoy el
   * campeonato da rangos unicos, pero si algun dia comparte posicion como la
   * parrilla, aqui salen todos los empatados en vez de cortar por el tercero.
   */
  get podium(): ChampionshipStanding[] {
    return this.standings.filter((s) => s.rank <= PODIUM_SIZE);
  }
}
