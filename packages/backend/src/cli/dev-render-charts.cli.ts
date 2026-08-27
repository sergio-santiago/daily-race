import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../core/ports/race.repository.port';
import { GetChampionshipStandingsUseCase } from '../application/get-championship-standings.use-case';
import { RaceGapChartService } from '../infrastructure/charts/race-gap-chart.service';
import { ChampionshipEvolutionChartService } from '../infrastructure/charts/championship-evolution-chart.service';
import { Race, RaceStatus } from '../core/entities/race.entity';
import { ChampionshipStanding } from '../core/entities/championship-standing.entity';
import { StartingGridEntry } from '../core/entities/starting-grid-entry.entity';
import { Driver } from '../core/entities/driver.entity';
import { ALL_TIME_START, ALL_TIME_END } from '../core/constants';

/**
 * Renderiza las graficas a PNG en disco, sin publicar nada en Discord, usando
 * los datos que haya en la base. Escoge los escenarios extremos de la propia
 * base (la carrera con mas pilotos, la mas apretada, la de mas salidas en
 * falso...) porque son los que rompen el diseno. Probar solo con la ultima
 * carrera esconde justo los casos que importan.
 *
 * Ademas de los escenarios reales, renderiza casos limite construidos a mano:
 * hay situaciones que van a pasar y que la base todavia no contiene, como una
 * entrada media hora antes del semaforo o un campeonato con puntuaciones
 * negativas de quien solo aparece de vez en cuando.
 *
 * Uso: make dev-render-charts [DIR=charts-preview]
 */
async function run() {
  if (process.env.NODE_ENV === 'production') {
    console.error('dev:render-charts is disabled in production');
    process.exit(1);
  }

  const logger = new Logger('dev:render-charts');
  const outDir = path.resolve(process.argv[2] ?? 'charts-preview');
  fs.mkdirSync(outDir, { recursive: true });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  try {
    const raceRepository = app.get<RaceRepositoryPort>(RACE_REPOSITORY);
    const getChampionship = app.get(GetChampionshipStandingsUseCase);
    const raceChart = app.get(RaceGapChartService, { strict: false });
    const championshipChart = app.get(ChampionshipEvolutionChartService, {
      strict: false,
    });

    const races = await raceRepository.findByDateRange(
      ALL_TIME_START,
      ALL_TIME_END,
    );
    if (races.length === 0) {
      logger.error('No races in database');
      process.exit(1);
    }
    const standings = await getChampionship.execute();

    const write = (name: string, png: Buffer | null): void => {
      if (!png) {
        logger.warn(`${name}: sin grafica (datos insuficientes)`);
        return;
      }
      const file = path.join(outDir, `${name}.png`);
      fs.writeFileSync(file, png);
      logger.log(`${file} · ${(png.length / 1024).toFixed(0)} KB`);
    };

    const best = (score: (race: Race) => number): Race =>
      races.reduce((a, b) => (score(b) > score(a) ? b : a), races[0]);
    const gaps = (race: Race): number[] =>
      race.startingGrid.filter((e) => !e.isFalseStart).map((e) => e.diffSeconds);
    const spread = (race: Race): number => {
      const values = gaps(race);
      return values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
    };
    const enoughDrivers = (race: Race): boolean => race.startingGrid.length >= 2;

    const scenarios: [string, Race][] = [
      ['race-reciente', races[0]],
      ['race-mas-pilotos', best((r) => r.startingGrid.length)],
      ['race-menos-pilotos', best((r) => (enoughDrivers(r) ? -r.startingGrid.length : -Infinity))],
      ['race-mas-false-starts', best((r) => r.startingGrid.filter((e) => e.isFalseStart).length)],
      ['race-gap-extremo', best((r) => Math.max(0, ...gaps(r)))],
      ['race-mas-apretada', best((r) => (r.startingGrid.length >= 8 ? -spread(r) : -Infinity))],
      ['race-nombre-largo', best((r) => Math.max(...r.startingGrid.map((e) => e.driver.displayName.length)))],
    ];

    const seen = new Set<string>();
    for (const [name, race] of scenarios) {
      if (!race || seen.has(race.id)) continue;
      seen.add(race.id);
      const falseStarts = race.startingGrid.filter((e) => e.isFalseStart).length;
      logger.log(
        `${name}: ${race.greenLight.toISOString().slice(0, 10)} · ${race.startingGrid.length} pilotos · ${falseStarts} en falso`,
      );
      write(name, raceChart.renderPng(race.startingGrid, race.greenLight));
    }

    // El campeonato se prueba tambien con pocas carreras: al reiniciar la
    // temporada es el estado en el que va a vivir las primeras semanas
    const slices: [string, number][] = [
      ['championship-completo', races.length],
      ['championship-media-temporada', Math.ceil(races.length / 2)],
      ['championship-tres-carreras', 3],
      ['championship-dos-carreras', 2],
      ['championship-una-carrera', 1],
    ];
    for (const [name, count] of slices) {
      if (count > races.length) continue;
      const subset = races.slice(0, count);
      logger.log(`${name}: ${subset.length} carreras`);
      write(name, championshipChart.renderPng(recompute(standings, subset), subset));
    }

    // ── Casos limite sinteticos ──────────────────────────────
    const greenLight = races[0].greenLight;
    for (const [name, grid] of limitRaces(greenLight)) {
      logger.log(`${name}: ${grid.length} pilotos`);
      write(name, raceChart.renderPng(grid, greenLight));
    }
    for (const [name, entry] of limitChampionships(greenLight)) {
      logger.log(`${name}: ${entry.standings.length} pilotos, ${entry.races.length} carreras`);
      write(name, championshipChart.renderPng(entry.standings, entry.races));
    }
  } finally {
    await app.close();
  }
}

// ── Casos limite ────────────────────────────────────────────

const driver = (name: string): Driver =>
  new Driver(`x-${name}`, `g-${name}`, name, null);

const entryAt = (
  name: string,
  position: number,
  diffSeconds: number,
  greenLight: Date,
  options: { points?: number; falseStart?: boolean; worst?: boolean } = {},
): StartingGridEntry =>
  new StartingGridEntry(
    position,
    driver(name),
    new Date(greenLight.getTime() + diffSeconds * 1000),
    greenLight,
    options.points ?? 0,
    options.falseStart ?? false,
    options.worst ?? false,
  );

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function limitRaces(greenLight: Date): [string, StartingGridEntry[]][] {
  const clean = (names: string[], diffs: number[]): StartingGridEntry[] =>
    names.map((name, i) =>
      entryAt(name, i + 1, diffs[i], greenLight, { points: F1_POINTS[i] ?? 1 }),
    );

  return [
    // Alguien entra media hora antes de la hora de la daily
    [
      'limite-media-hora-antes',
      [
        ...clean(
          ['Silvia Merino', 'Beatriz Nadal', 'Mireia Solana', 'Paula Rueda', 'Aitor Abad'],
          [0.08, 0.31, 0.94, 2.4, 38],
        ),
        entryAt('Quique Muñiz', 6, -1800, greenLight, { falseStart: true, worst: true }),
        entryAt('Rocío Vargas', 7, -0.4, greenLight, { falseStart: true }),
      ],
    ],
    // Media hora antes y media hora despues a la vez
    [
      'limite-ambos-extremos',
      [
        ...clean(['Silvia Merino', 'Beatriz Nadal', 'Mireia Solana'], [0.05, 0.4, 1830]),
        entryAt('Quique Muñiz', 4, -1800, greenLight, { falseStart: true, worst: true }),
      ],
    ],
    // Toda la parrilla se adelanta al semaforo
    [
      'limite-todos-en-falso',
      ['Silvia Merino', 'Beatriz Nadal', 'Mireia Solana', 'Paula Rueda'].map((name, i) =>
        entryAt(name, i + 1, -(i + 1) * 12, greenLight, {
          falseStart: true,
          worst: i === 3,
        }),
      ),
    ],
    // Empate exacto de toda la parrilla: entran en bloque al admitirlos
    [
      'limite-empate-absoluto',
      Array.from({ length: 9 }, (_, i) =>
        entryAt(`Piloto ${i + 1}`, i + 1, 3.5, greenLight, { points: F1_POINTS[i] ?? 1 }),
      ),
    ],
    // Solo dos pilotos, el minimo para que la grafica tenga sentido
    ['limite-dos-pilotos', clean(['Silvia Merino', 'Beatriz Nadal'], [0.2, 900])],
  ];
}

interface ChampionshipCase {
  standings: ChampionshipStanding[];
  races: Race[];
}

function limitChampionships(greenLight: Date): [string, ChampionshipCase][] {
  const day = (offset: number): Date =>
    new Date(greenLight.getTime() + offset * 86400000);

  const makeRace = (
    id: string,
    date: Date,
    entries: StartingGridEntry[],
  ): Race =>
    new Race(
      id,
      `conferenceRecords/${id}`,
      'abc-defg-hij',
      date,
      new Date(date.getTime() + 900000),
      RaceStatus.PROCESSED,
      entries,
      date,
    );

  // Quien solo aparece de vez en cuando y encima se adelanta acumula negativo
  const casual = ['Ocasional Uno', 'Ocasional Dos', 'Ocasional Tres'];
  const regular = ['Silvia Merino', 'Beatriz Nadal', 'Mireia Solana'];
  const negativeRaces: Race[] = [];
  for (let r = 0; r < 4; r++) {
    const entries: StartingGridEntry[] = regular.map((name, i) =>
      entryAt(name, i + 1, i + 1, day(r), { points: F1_POINTS[i] }),
    );
    // En cada jornada un ocasional entra antes de hora y se lleva la penalizacion
    const who = casual[r % casual.length];
    entries.push(
      entryAt(who, regular.length + 1, -20, day(r), {
        points: -5,
        falseStart: true,
        worst: true,
      }),
    );
    negativeRaces.push(makeRace(`neg-${r}`, day(r), entries));
  }
  const negativeTotals = new Map<string, number>();
  for (const race of negativeRaces) {
    for (const e of race.startingGrid) {
      negativeTotals.set(
        e.driver.displayName,
        (negativeTotals.get(e.driver.displayName) ?? 0) + e.points,
      );
    }
  }
  const negativeStandings = [...negativeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, points], i) =>
        new ChampionshipStanding(driver(name), points, 1, 0, 1, i + 1, 0, 0),
    );

  // Caso extremo: casi toda la parrilla en negativo
  const allNegative: Race[] = [];
  for (let r = 0; r < 3; r++) {
    const entries = [
      entryAt('Silvia Merino', 1, 0.5, day(r), { points: 25 }),
      ...['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete'].map((name, i) =>
        entryAt(name, i + 2, -15, day(r), { points: -5, falseStart: true }),
      ),
    ];
    allNegative.push(makeRace(`allneg-${r}`, day(r), entries));
  }
  const allNegativeTotals = new Map<string, number>();
  for (const race of allNegative) {
    for (const e of race.startingGrid) {
      allNegativeTotals.set(
        e.driver.displayName,
        (allNegativeTotals.get(e.driver.displayName) ?? 0) + e.points,
      );
    }
  }
  const allNegativeStandings = [...allNegativeTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, points], i) =>
        new ChampionshipStanding(driver(name), points, 1, 0, 1, i + 1, 0, 0),
    );

  return [
    ['limite-champ-negativos', { standings: negativeStandings, races: negativeRaces }],
    ['limite-champ-casi-todo-negativo', { standings: allNegativeStandings, races: allNegative }],
  ];
}

/** Recalcula la clasificacion limitandola al subconjunto de carreras dado */
function recompute(
  standings: ChampionshipStanding[],
  races: Race[],
): ChampionshipStanding[] {
  interface Acc {
    points: number;
    races: number;
    wins: number;
    podiums: number;
    falseStarts: number;
    best: number;
  }
  const totals = new Map<string, Acc>();

  for (const race of races) {
    for (const entry of race.startingGrid) {
      const acc: Acc = totals.get(entry.driver.id) ?? {
        points: 0,
        races: 0,
        wins: 0,
        podiums: 0,
        falseStarts: 0,
        best: 0,
      };
      acc.points += entry.points;
      acc.races += 1;
      if (entry.isFalseStart) {
        acc.falseStarts += 1;
      } else {
        if (entry.position === 1) acc.wins += 1;
        if (entry.position <= 3) acc.podiums += 1;
        acc.best = acc.best === 0 ? entry.position : Math.min(acc.best, entry.position);
      }
      totals.set(entry.driver.id, acc);
    }
  }

  return standings
    .filter((s) => totals.has(s.driver.id))
    .map((s) => {
      const acc = totals.get(s.driver.id)!;
      return new ChampionshipStanding(
        s.driver,
        acc.points,
        acc.races,
        acc.falseStarts,
        acc.best,
        0,
        acc.wins,
        acc.podiums,
      );
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map(
      (s, i) =>
        new ChampionshipStanding(
          s.driver,
          s.totalPoints,
          s.racesAttended,
          s.falseStarts,
          s.bestFinish,
          i + 1,
          s.wins,
          s.podiums,
        ),
    );
}

run().catch((error) => {
  console.error('dev:render-charts CLI failed:', error);
  process.exit(1);
});
