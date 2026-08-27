import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';

export const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');

export const driver = (name: string, id = name): Driver =>
  new Driver(`d-${id}`, `g-${id}`, name, null);

export interface EntrySpec {
  name: string;
  diff: number;
  position?: number;
  points?: number;
  falseStart?: boolean;
  worst?: boolean;
}

export const entry = (spec: EntrySpec, index = 0): StartingGridEntry =>
  new StartingGridEntry(
    spec.position ?? index + 1,
    driver(spec.name),
    new Date(GREEN_LIGHT.getTime() + spec.diff * 1000),
    GREEN_LIGHT,
    spec.points ?? 0,
    spec.falseStart ?? false,
    spec.worst ?? false,
  );

export const grid = (specs: EntrySpec[]): StartingGridEntry[] =>
  specs.map((spec, i) => entry(spec, i));

export const race = (
  id: string,
  greenLight: Date,
  entries: StartingGridEntry[],
): Race =>
  new Race(
    id,
    `conferenceRecords/${id}`,
    'abc-defg-hij',
    greenLight,
    new Date(greenLight.getTime() + 15 * 60 * 1000),
    RaceStatus.PROCESSED,
    entries,
    greenLight,
  );

/** Carrera con puntos F1 para los diez primeros y uno por asistir al resto */
export const scoredRace = (
  id: string,
  greenLight: Date,
  names: string[],
): Race => {
  const points = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return race(
    id,
    greenLight,
    names.map(
      (name, i) =>
        new StartingGridEntry(
          i + 1,
          driver(name),
          new Date(greenLight.getTime() + (i + 1) * 1000),
          greenLight,
          points[i] ?? 1,
          false,
          false,
        ),
    ),
  );
};

/**
 * Carrera con los puntos que se le pasen, para montar temporadas que la tabla
 * F1 de scoredRace no puede describir: penalizaciones de -5 por salida en falso,
 * lideres a cuatro cifras o pilotos que solo aparecen en una jornada.
 */
export const pointsRace = (
  id: string,
  greenLight: Date,
  entries: [string, number][],
): Race =>
  race(
    id,
    greenLight,
    entries.map(
      ([name, points], i) =>
        new StartingGridEntry(
          i + 1,
          driver(name),
          new Date(greenLight.getTime() + (i + 1) * 1000),
          greenLight,
          points,
          points < 0,
          false,
        ),
    ),
  );

export const standing = (
  name: string,
  totalPoints: number,
  rank: number,
  extra: { races?: number; wins?: number; podiums?: number } = {},
): ChampionshipStanding =>
  new ChampionshipStanding(
    driver(name),
    totalPoints,
    extra.races ?? 1,
    0,
    1,
    rank,
    extra.wins ?? 0,
    extra.podiums ?? 0,
  );

/**
 * Los tres nombres mas largos de la base de produccion, medidos en px con las
 * metricas del TTF y no en caracteres: el primero ocupa 207.89 px a 14.5 px de
 * cuerpo sobre un hueco de tarjeta de 210.67 px, asi que es el que delata
 * cualquier estrechamiento del limite del ellipsize.
 */
export const LONGEST_NAMES = [
  'Enrique Caballero Domínguez',
  'Quique Navarrete Trujillo',
  'Gonzalo Lastra Domínguez',
];

/**
 * La carrera real del 2026-06-19: 62 pilotos y ocho exactamente empatados al
 * milisegundo (21.135 s), que es el peor caso medido en produccion. Sirve para
 * comprobar que el reparto en calles no esconde a nadie.
 */
export const REAL_RACE_62: EntrySpec[] = [
  { name: 'Pilar Hidalgo', diff: 0.036, points: 25 },
  { name: 'Yaiza Moreno Lozano', diff: 0.046, points: 18 },
  { name: 'Luis Gimeno', diff: 0.104, points: 15 },
  { name: 'Jaime Navarrete', diff: 0.114, points: 12 },
  { name: 'Unai Bermúdez Trujillo', diff: 0.194, points: 10 },
  { name: 'Gema Muñoz', diff: 0.198, points: 8 },
  { name: 'Iker Segura', diff: 0.239, points: 6 },
  { name: 'Fátima Bravo', diff: 0.303, points: 4 },
  { name: 'Ramón Segura', diff: 0.476, points: 2 },
  { name: 'Gonzalo Lastra Domínguez', diff: 0.525, points: 1 },
  { name: 'Diego Sarmiento Cano', diff: 0.55, points: 1 },
  { name: 'Izan Ramírez Ureña', diff: 0.56, points: 1 },
  { name: 'Julia Gimeno', diff: 0.608, points: 1 },
  { name: 'Óscar Domínguez', diff: 0.618, points: 1 },
  { name: 'Ainhoa Vidal', diff: 0.685, points: 1 },
  { name: 'Joel Hidalgo', diff: 0.787, points: 1 },
  { name: 'Bruno Santamaría', diff: 0.79, points: 1 },
  { name: 'Aitor Sepúlveda', diff: 0.922, points: 1 },
  { name: 'Pilar Mena', diff: 0.939, points: 1 },
  { name: 'Sandra Calvo', diff: 1.025, points: 1 },
  { name: 'Ainhoa Vidal Prieto', diff: 1.153, points: 1 },
  { name: 'Julia Izaguirre', diff: 1.172, points: 1 },
  { name: 'Bruno Roldán Vela', diff: 1.188, points: 1 },
  { name: 'Teo Ordóñez', diff: 1.457, points: 1 },
  { name: 'Enrique Pereira', diff: 1.874, points: 1 },
  { name: 'Jesús Peña Delgado', diff: 2.229, points: 1 },
  { name: 'Ximo Cano', diff: 2.315, points: 1 },
  { name: 'Candela Pastor Peña', diff: 3.469, points: 1 },
  { name: 'Jesús Céspedes Serrano', diff: 5.512, points: 1 },
  { name: 'Inés Ventura', diff: 6.649, points: 1 },
  { name: 'Beatriz Aguilar Benítez', diff: 12.664, points: 1 },
  { name: 'Olalla Acosta', diff: 15.394, points: 1 },
  { name: 'Guillem Prieto Bautista', diff: 18.194, points: 1 },
  { name: 'Elena Merino Gimeno', diff: 19.716, points: 1 },
  { name: 'Ale Gimeno', diff: 20.175, points: 1 },
  // Los ocho del empate exacto
  { name: 'Nuria Durán', diff: 21.135, points: 1 },
  { name: 'Pablo Pardo Lamela', diff: 21.135, points: 1 },
  { name: 'Quique Navarrete Trujillo', diff: 21.135, points: 1 },
  { name: 'Víctor Escudero', diff: 21.135, points: 1 },
  { name: 'Leire Vargas Núñez', diff: 21.135, points: 1 },
  { name: 'Andrés Abad Olmedo', diff: 21.135, points: 1 },
  { name: 'Zoe Mora', diff: 21.135, points: 1 },
  { name: 'Alba Tejedor', diff: 21.135, points: 1 },
  { name: 'Ramón Villalba', diff: 21.523, points: 1 },
  { name: 'Silvia Benítez Mena', diff: 23.015, points: 1 },
  { name: 'Vicente Ordóñez', diff: 24.272, points: 1 },
  { name: 'Fátima Fábregas', diff: 24.467, points: 1 },
  { name: 'Hugo Alonso', diff: 24.783, points: 1 },
  { name: 'Manu Roldán Blanco', diff: 25.247, points: 1 },
  { name: 'Hugo Tejedor', diff: 37.297, points: 1 },
  { name: 'Carmen Escudero', diff: 37.36, points: 1 },
  { name: 'Julia Cano', diff: 61.001, points: 1 },
  { name: 'Víctor Pardo Mora', diff: 68.224, points: 1 },
  { name: 'Rodrigo Pardo', diff: 95.127, points: 1 },
  { name: 'Vega Zamora', diff: 122.852, points: 1 },
  { name: 'Quique Montero', diff: 126.595, points: 1 },
  { name: 'Vicente Sepúlveda', diff: 303.254, points: 1 },
  { name: 'Diego Durán', diff: 312.649, points: 1 },
  { name: 'Pilar Valcárcel', diff: 366.223, points: 1 },
  { name: 'Unai Robledo', diff: 650.331, points: 1 },
  { name: 'Diego Bermúdez', diff: 774.28, points: 1 },
  { name: 'Zoe Reyes', diff: 835.343, points: 1, worst: true },
];
