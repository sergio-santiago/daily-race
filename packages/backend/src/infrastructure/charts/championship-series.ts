import { Race } from '../../core/entities/race.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';

export interface EvolutionSeries {
  driverId: string;
  label: string;
  /**
   * Puntos acumulados en orden cronologico. El primer valor es siempre 0: es el
   * arranque de temporada, antes de la primera carrera. Asi la linea sale del
   * origen y la grafica ya cuenta algo desde la carrera numero uno.
   */
  cumulative: number[];
  /** Posicion en la clasificacion tras cada carrera */
  positions: number[];
  rank: number;
  standing: ChampionshipStanding;
}

export interface Evolution {
  series: EvolutionSeries[];
  /** Fechas de las carreras. Hay una menos que puntos en `cumulative` */
  raceDates: Date[];
}

export function buildEvolution(
  standings: ChampionshipStanding[],
  races: Race[],
): Evolution {
  const ordered = [...races].sort(
    (a, b) => a.greenLight.getTime() - b.greenLight.getTime(),
  );
  const pointsByRace = ordered.map((race) => {
    const map = new Map<string, number>();
    for (const entry of race.startingGrid) {
      map.set(entry.driver.id, entry.points);
    }
    return map;
  });

  const series: EvolutionSeries[] = standings.map((standing) => {
    let total = 0;
    const cumulative = [
      0,
      ...pointsByRace.map((racePoints) => {
        total += racePoints.get(standing.driver.id) ?? 0;
        return total;
      }),
    ];
    return {
      driverId: standing.driver.id,
      label: standing.driver.displayName,
      cumulative,
      positions: [],
      rank: standing.rank,
      standing,
    };
  });

  // Posicion en cada jornada, para poder dibujar la evolucion del orden
  for (let i = 0; i < ordered.length + 1; i++) {
    const snapshot = series
      .map((s) => ({ id: s.driverId, points: s.cumulative[i] }))
      .sort((a, b) => b.points - a.points);
    const rankById = new Map(snapshot.map((s, idx) => [s.id, idx + 1]));
    for (const s of series) {
      s.positions.push(rankById.get(s.driverId) ?? series.length);
    }
  }

  return { series, raceDates: ordered.map((r) => r.greenLight) };
}

/**
 * Mediana del peloton en cada jornada: por donde va el grueso de la parrilla.
 *
 * Antes se dibujaba la franja entre cuartiles, pero con pocas carreras el
 * cuartil inferior son los que llevan una salida en falso, o sea puntos
 * negativos, y el area resultante bajaba del cero formando un triangulo que
 * parecia un fallo de render en lugar de un dato. Una linea sola se entiende.
 */
export function packMedian(series: EvolutionSeries[]): number[] | null {
  if (series.length === 0) return null;
  const length = series[0].cumulative.length;
  const median: number[] = [];
  for (let i = 0; i < length; i++) {
    const values = series.map((s) => s.cumulative[i]).sort((a, b) => a - b);
    median.push(quantile(values, 0.5));
  }
  return median;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next != null ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

/**
 * Techo y suelo redondos para el eje de puntos.
 *
 * El suelo baja del cero solo cuando el negativo pesa de verdad: la penalizacion
 * por salida en falso resta cinco puntos, asi que quien empieza la temporada con
 * una se va a -5. En una jornada eso es un quinto del eje y hay que mostrarlo,
 * pero en una temporada de mil doscientos puntos es ruido, y reservarle sitio
 * dejaba un tercio del lienzo vacio.
 */
// Pasos de rejilla, en la escalera 1-2-2,5-5 de cada potencia de diez. Se genera
// en vez de tabularse porque una tabla siempre tiene techo: la anterior se cortaba
// en 1000 y con totales de cinco cifras el paso se quedaba corto y la rejilla
// pasaba de seis lineas a cuarenta y cinco
const STEPS = [1, 2, 2.5, 5]
  .flatMap((base) => [0, 1, 2, 3, 4, 5].map((exp) => base * 10 ** exp))
  .filter((value) => Number.isInteger(value))
  .sort((a, b) => a - b);
const NEGATIVE_THRESHOLD = 0.08;

export function niceScale(
  max: number,
  min = 0,
): { step: number; niceMax: number; niceMin: number } {
  const negative = -Math.min(0, min);
  const significant = negative > max * NEGATIVE_THRESHOLD;
  const span = max + (significant ? negative : 0);
  const step =
    STEPS.find((candidate) => Math.ceil(span / candidate) <= 6) ??
    STEPS[STEPS.length - 1];

  if (!significant) {
    return { step, niceMax: step * Math.ceil(max / step), niceMin: 0 };
  }

  // El lado negativo se redondea con su propio paso, para no reservarle mas
  // sitio del que necesita
  const negativeStep =
    STEPS.find((candidate) => candidate >= negative) ?? step;
  return {
    step,
    niceMax: step * Math.ceil(max / step),
    niceMin: -negativeStep,
  };
}

/**
 * Umbrales en px del trazo de la mediana del peloton.
 *
 * En una temporada larga la mediana acaba pegada al cero: con el lider en 1223
 * puntos y un eje que llega a 1250, una mediana de 14 puntos recorre tres pixeles
 * y queda indistinguible de la linea de referencia del cero, con el pie
 * prometiendole al lector una discontinua que no puede encontrar. Cuando el
 * trazo no llega a estos minimos la cifra se cuenta en el canal derecho, que
 * dice lo mismo y se lee.
 */
export const MEDIAN_MIN_TRAVEL_PX = 8;
export const MEDIAN_MIN_ZERO_GAP_PX = 4;
export const MEDIAN_MIN_SERIES_GAP_PX = 4;

/**
 * Decide si la mediana merece un trazo, midiendo en pixeles y no por existencia.
 *
 * Pide dos cosas: que la linea recorra algo en vertical y que en algun punto se
 * separe de la linea del cero. `y` es la misma proyeccion que usa la grafica,
 * asi que la decision se toma sobre los pixeles que se van a dibujar de verdad.
 */
export function medianIsLegible(
  median: number[],
  y: (points: number) => number,
  series: number[][] = [],
): boolean {
  if (median.length < 2) return false;
  const pixels = median.map(y);
  const travel = Math.max(...pixels) - Math.min(...pixels);
  const zero = y(0);
  const zeroGap = Math.max(...pixels.map((p) => Math.abs(p - zero)));
  if (travel < MEDIAN_MIN_TRAVEL_PX || zeroGap < MEDIAN_MIN_ZERO_GAP_PX) {
    return false;
  }

  // Tampoco vale que se distinga del cero si va pegada a una linea de color: el
  // trazo esta ahi pero nadie lo separa de la serie que tiene debajo. Pasa en las
  // primeras jornadas, cuando media parrilla empata a puntos con el peloton
  if (series.length === 0) return true;
  const seriesGap = Math.max(
    ...pixels.map((p, i) =>
      Math.min(...series.map((s) => Math.abs(p - y(s[i] ?? 0)))),
    ),
  );
  return seriesGap >= MEDIAN_MIN_SERIES_GAP_PX;
}
