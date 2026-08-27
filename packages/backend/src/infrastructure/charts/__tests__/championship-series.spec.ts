import {
  buildEvolution,
  packMedian,
  niceScale,
  medianIsLegible,
} from '../championship-series';
import { scoredRace, standing } from './fixtures';

const day = (n: number): Date => new Date(`2026-09-0${n}T07:00:00Z`);

describe('buildEvolution', () => {
  const races = [
    scoredRace('r2', day(2), ['Beatriz Nadal', 'Silvia Merino']),
    scoredRace('r1', day(1), ['Silvia Merino']),
  ];
  const standings = [
    standing('Silvia Merino', 43, 1),
    standing('Beatriz Nadal', 25, 2),
  ];

  it('ordena cronologicamente aunque las carreras lleguen al reves', () => {
    const { raceDates } = buildEvolution(standings, races);

    expect(raceDates.map((d) => d.toISOString())).toEqual([
      '2026-09-01T07:00:00.000Z',
      '2026-09-02T07:00:00.000Z',
    ]);
  });

  it('arranca en cero, antes de la primera carrera', () => {
    // El cero de salida es lo que permite dibujar lineas ya con una jornada
    const { series, raceDates } = buildEvolution(standings, races);

    expect(series[0].cumulative[0]).toBe(0);
    expect(series[0].cumulative).toHaveLength(raceDates.length + 1);
  });

  it('acumula los puntos jornada a jornada', () => {
    const { series } = buildEvolution(standings, races);

    expect(series[0].cumulative).toEqual([0, 25, 43]);
  });

  it('arrastra el acumulado en las carreras a las que no se asiste', () => {
    const { series } = buildEvolution(standings, races);

    expect(series[1].cumulative).toEqual([0, 0, 25]);
  });

  it('calcula la posicion en cada jornada', () => {
    const { series } = buildEvolution(standings, races);

    expect(series[0].positions).toEqual([1, 1, 1]);
    expect(series[1].positions).toEqual([2, 2, 2]);
  });
});

describe('packMedian', () => {
  const series = (points: number[][]) =>
    points.map((cumulative, i) => ({
      driverId: `d${i}`,
      label: `P${i}`,
      cumulative,
      positions: [],
      rank: i + 1,
      standing: standing(`P${i}`, cumulative[cumulative.length - 1], i + 1),
    }));

  it('devuelve la mediana del grupo en cada jornada', () => {
    const result = packMedian(series([[0, 10], [0, 20], [0, 30], [0, 40], [0, 50]]))!;

    expect(result).toEqual([0, 30]);
  });

  it('interpola con un numero par de pilotos', () => {
    const result = packMedian(series([[0, 10], [0, 20]]))!;

    expect(result).toEqual([0, 15]);
  });

  it('devuelve null sin series', () => {
    expect(packMedian([])).toBeNull();
  });
});

describe('niceScale', () => {
  it('elige un techo redondo cerca del maximo', () => {
    expect(niceScale(1223)).toEqual({ step: 250, niceMax: 1250, niceMin: 0 });
    expect(niceScale(68)).toEqual({ step: 20, niceMax: 80, niceMin: 0 });
    expect(niceScale(25)).toEqual({ step: 5, niceMax: 25, niceMin: 0 });
  });

  it('no deja el techo por debajo del maximo', () => {
    for (const max of [1, 7, 43, 96, 350, 1223, 4000]) {
      expect(niceScale(max).niceMax).toBeGreaterThanOrEqual(max);
    }
  });

  it('baja el suelo cuando el negativo pesa en el eje', () => {
    // -5 sobre 25 es un quinto del recorrido: hay que verlo
    const scale = niceScale(25, -5);

    expect(scale.niceMin).toBe(-5);
    expect(scale.niceMax).toBeGreaterThanOrEqual(25);
  });

  it('ignora el negativo cuando es irrelevante frente al total', () => {
    // -5 sobre 1223 no merece un tercio del lienzo
    expect(niceScale(1223, -5).niceMin).toBe(0);
  });

  it('deja el suelo en cero si nadie esta en negativo', () => {
    expect(niceScale(100, 0).niceMin).toBe(0);
  });
});

describe('niceScale con totales grandes', () => {
  it('mantiene la rejilla en seis lineas con cinco cifras', () => {
    // La tabla de pasos se cortaba en 1000, asi que con 43210 puntos el paso se
    // quedaba en 1000 y la rejilla pasaba de seis lineas a cuarenta y cinco
    for (const max of [4321, 43210, 432100]) {
      const { step, niceMax } = niceScale(max);

      expect(niceMax).toBeGreaterThanOrEqual(max);
      expect(Math.ceil(niceMax / step)).toBeLessThanOrEqual(6);
    }
  });
});

describe('medianIsLegible', () => {
  // Escala de juguete: 100 puntos en 300 px, o sea 3 px por punto
  const y = (points: number): number => 300 - points * 3;

  it('descarta la mediana pegada al cero', () => {
    expect(medianIsLegible([0, 0.5, 1, 1.2], y)).toBe(false);
  });

  it('acepta la mediana con recorrido propio', () => {
    expect(medianIsLegible([0, 10, 20, 30], y)).toBe(true);
  });

  it('descarta la mediana que va pegada a una serie de color', () => {
    // El trazo se distingue del cero, pero cae encima de la linea de un piloto:
    // esta dibujado y nadie lo separa de la serie que tiene debajo. Pasa en las
    // primeras jornadas, cuando media parrilla empata a puntos con el peloton
    const median = [0, -5, -10, -15];
    const series = [
      [0, 25, 50, 75],
      [0, -5, -10, -15],
    ];

    expect(medianIsLegible(median, y)).toBe(true);
    expect(medianIsLegible(median, y, series)).toBe(false);
  });

  it('acepta la mediana que corre separada de todas las series', () => {
    const median = [0, 10, 20, 30];
    const series = [
      [0, 25, 50, 75],
      [0, 20, 40, 60],
    ];

    expect(medianIsLegible(median, y, series)).toBe(true);
  });
});
