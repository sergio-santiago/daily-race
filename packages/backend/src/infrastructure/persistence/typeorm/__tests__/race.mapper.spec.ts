import { RaceMapper } from '../mappers/race.mapper';
import { StartingGridEntryMapper } from '../mappers/starting-grid-entry.mapper';
import { Race, RaceStatus } from '../../../../core/entities/race.entity';
import { Driver } from '../../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { RaceOrmEntity } from '../entities/race.orm-entity';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';

// Esta es la capa donde un fallo de mapeo corrompe la clasificacion en silencio:
// nadie lanza una excepcion si la parrilla llega desordenada, si los puntos
// vienen como texto o si la penalizacion de -5 pierde el signo.

const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');
const END_TIME = new Date('2026-08-26T07:15:00Z');

const driverRow = (id: string, name: string): DriverOrmEntity =>
  Object.assign(new DriverOrmEntity(), {
    id,
    googleId: `google-${id}`,
    displayName: name,
    email: `${id}@example.test`,
  });

interface EntryRowOptions {
  position: number;
  driverId: string;
  driverName?: string;
  /** en segundos respecto al green light, negativo es salida en falso */
  diffSeconds?: number;
  points?: number | string;
  isFalseStart?: boolean;
  isWorstOnGrid?: boolean;
  withDriverRelation?: boolean;
}

const entryRow = (opts: EntryRowOptions): StartingGridEntryOrmEntity => {
  const {
    position,
    driverId,
    driverName = `Piloto ${driverId}`,
    diffSeconds = position,
    points = 1,
    isFalseStart = false,
    isWorstOnGrid = false,
    withDriverRelation = true,
  } = opts;

  return Object.assign(new StartingGridEntryOrmEntity(), {
    id: `entry-${driverId}`,
    raceId: 'race-1',
    driverId,
    ...(withDriverRelation ? { driver: driverRow(driverId, driverName) } : {}),
    position,
    startTime: new Date(GREEN_LIGHT.getTime() + diffSeconds * 1000),
    greenLight: GREEN_LIGHT,
    points: points as number,
    isFalseStart,
    isWorstOnGrid,
  });
};

const raceRow = (
  startingGrid?: StartingGridEntryOrmEntity[],
): RaceOrmEntity =>
  Object.assign(new RaceOrmEntity(), {
    id: 'race-1',
    conferenceRecordName: 'conferenceRecords/abc',
    meetingCode: 'abc-defg-hij',
    greenLight: GREEN_LIGHT,
    endTime: END_TIME,
    status: 'PROCESSED',
    processedAt: END_TIME,
    createdAt: GREEN_LIGHT,
    ...(startingGrid === undefined ? {} : { startingGrid }),
  });

describe('RaceMapper.toDomain, cabecera de la carrera', () => {
  it('copia los campos de la carrera y castea el status al enum', () => {
    const race = RaceMapper.toDomain(raceRow([]));

    expect(race).toBeInstanceOf(Race);
    expect(race.id).toBe('race-1');
    expect(race.conferenceRecordName).toBe('conferenceRecords/abc');
    expect(race.meetingCode).toBe('abc-defg-hij');
    expect(race.greenLight).toBe(GREEN_LIGHT);
    expect(race.endTime).toBe(END_TIME);
    expect(race.status).toBe(RaceStatus.PROCESSED);
    expect(race.isProcessed).toBe(true);
    expect(race.processedAt).toBe(END_TIME);
  });

  it('conserva processedAt a null en una carrera aun sin cerrar', () => {
    const race = RaceMapper.toDomain(
      Object.assign(raceRow([]), { processedAt: null }),
    );

    expect(race.processedAt).toBeNull();
  });
});

describe('RaceMapper.toDomain, orden de la parrilla', () => {
  // Sin ORDER BY en la consulta, Postgres devuelve las filas hijas en el orden
  // que le apetezca. El mapper es el unico que garantiza la parrilla ordenada.
  it('reordena por posicion una parrilla que llega desordenada de la base', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({ position: 5, driverId: 'e' }),
        entryRow({ position: 1, driverId: 'a' }),
        entryRow({ position: 12, driverId: 'l' }),
        entryRow({ position: 3, driverId: 'c' }),
        entryRow({ position: 2, driverId: 'b' }),
      ]),
    );

    expect(race.startingGrid.map((e) => e.position)).toEqual([1, 2, 3, 5, 12]);
    expect(race.startingGrid.map((e) => e.driver.id)).toEqual([
      'a',
      'b',
      'c',
      'e',
      'l',
    ]);
  });

  it('ordena numericamente, no como cadenas (10 va detras de 9)', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({ position: 10, driverId: 'diez' }),
        entryRow({ position: 9, driverId: 'nueve' }),
        entryRow({ position: 1, driverId: 'uno' }),
      ]),
    );

    expect(race.startingGrid.map((e) => e.position)).toEqual([1, 9, 10]);
  });

  it('deja la parrilla vacia cuando la relacion viene como array vacio', () => {
    expect(RaceMapper.toDomain(raceRow([])).startingGrid).toEqual([]);
  });

  it('no lanza cuando la relacion startingGrid no viene cargada', () => {
    const race = RaceMapper.toDomain(raceRow(undefined));

    expect(race.startingGrid).toEqual([]);
  });

  // Defecto conocido: Array.prototype.sort ordena en sitio, asi que toDomain
  // reordena el array de la propia entidad ORM que recibe. Hoy no rompe nada
  // porque la fila se descarta justo despues, pero es un efecto lateral sobre
  // una entidad que TypeORM puede tener cacheada.
  it.failing('no deberia reordenar el array de la entidad orm recibida', () => {
    const rows = [
      entryRow({ position: 3, driverId: 'c' }),
      entryRow({ position: 1, driverId: 'a' }),
      entryRow({ position: 2, driverId: 'b' }),
    ];
    const orm = raceRow(rows);

    RaceMapper.toDomain(orm);

    expect(orm.startingGrid.map((r) => r.position)).toEqual([3, 1, 2]);
  });
});

describe('RaceMapper.toDomain, puntos', () => {
  it('convierte a number un points que pg devuelve como cadena', () => {
    const race = RaceMapper.toDomain(
      raceRow([entryRow({ position: 1, driverId: 'a', points: '25' })]),
    );

    expect(typeof race.startingGrid[0].points).toBe('number');
    expect(race.startingGrid[0].points).toBe(25);
  });

  it('conserva el signo de la penalizacion cuando llega como cadena', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({
          position: 1,
          driverId: 'a',
          points: '-5',
          isFalseStart: true,
        }),
      ]),
    );

    expect(race.startingGrid[0].points).toBe(-5);
    expect(typeof race.startingGrid[0].points).toBe('number');
  });

  it('conserva la penalizacion de -5 cuando ya llega como numero', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({
          position: 1,
          driverId: 'a',
          points: -5,
          isFalseStart: true,
        }),
      ]),
    );

    expect(race.startingGrid[0].points).toBe(-5);
  });

  it('deja los puntos a 0 sin convertirlos en NaN', () => {
    const race = RaceMapper.toDomain(
      raceRow([entryRow({ position: 1, driverId: 'a', points: 0 })]),
    );

    expect(race.startingGrid[0].points).toBe(0);
    expect(Number.isNaN(race.startingGrid[0].points)).toBe(false);
  });
});

describe('RaceMapper.toDomain, piloto sin relacion cargada', () => {
  it('rellena googleId y displayName vacios y email null sin lanzar', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({ position: 1, driverId: 'huerfano', withDriverRelation: false }),
      ]),
    );

    const driver = race.startingGrid[0].driver;
    expect(driver).toBeInstanceOf(Driver);
    // El id si se conserva: viene de la columna driverId, no de la relacion
    expect(driver.id).toBe('huerfano');
    expect(driver.googleId).toBe('');
    expect(driver.displayName).toBe('');
    expect(driver.email).toBeNull();
  });

  it('normaliza a null un email ausente en la relacion cargada', () => {
    const row = entryRow({ position: 1, driverId: 'a' });
    row.driver.email = null;

    const race = RaceMapper.toDomain(raceRow([row]));

    expect(race.startingGrid[0].driver.email).toBeNull();
    expect(race.startingGrid[0].driver.displayName).toBe('Piloto a');
  });

  it('mezcla entradas con y sin relacion cargada sin perder las buenas', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({ position: 2, driverId: 'b', withDriverRelation: false }),
        entryRow({ position: 1, driverId: 'a', driverName: 'Amaro Cifuentes' }),
      ]),
    );

    expect(race.startingGrid.map((e) => e.driver.displayName)).toEqual([
      'Amaro Cifuentes',
      '',
    ]);
  });
});

describe('RaceMapper.toDomain, tiempos y flags', () => {
  it('conserva startTime, greenLight y el diff que ve el juego', () => {
    const race = RaceMapper.toDomain(
      raceRow([entryRow({ position: 1, driverId: 'a', diffSeconds: -12.5 })]),
    );

    const entry = race.startingGrid[0];
    expect(entry.greenLight).toBe(GREEN_LIGHT);
    expect(entry.startTime.toISOString()).toBe('2026-08-26T06:59:47.500Z');
    expect(entry.diffSeconds).toBe(-12.5);
  });

  it('conserva los flags de salida en falso y de busted', () => {
    const race = RaceMapper.toDomain(
      raceRow([
        entryRow({
          position: 1,
          driverId: 'a',
          isFalseStart: true,
          isWorstOnGrid: false,
        }),
        entryRow({
          position: 2,
          driverId: 'b',
          isFalseStart: false,
          isWorstOnGrid: true,
        }),
      ]),
    );

    expect(race.startingGrid.map((e) => e.isFalseStart)).toEqual([true, false]);
    expect(race.startingGrid.map((e) => e.isWorstOnGrid)).toEqual([false, true]);
  });
});

describe('RaceMapper.toOrm', () => {
  const domainRace = (id: string): Race =>
    new Race(
      id,
      'conferenceRecords/abc',
      'abc-defg-hij',
      GREEN_LIGHT,
      END_TIME,
      RaceStatus.PROCESSED,
      [],
      END_TIME,
    );

  it('incluye el id cuando la carrera ya existe', () => {
    const orm = RaceMapper.toOrm(domainRace('race-1'));

    expect(orm.id).toBe('race-1');
    expect(orm).toEqual({
      id: 'race-1',
      conferenceRecordName: 'conferenceRecords/abc',
      meetingCode: 'abc-defg-hij',
      greenLight: GREEN_LIGHT,
      endTime: END_TIME,
      status: RaceStatus.PROCESSED,
      processedAt: END_TIME,
    });
  });

  it('omite la clave id cuando la carrera es nueva', () => {
    const orm = RaceMapper.toOrm(domainRace(''));

    expect('id' in orm).toBe(false);
    expect(Object.keys(orm).sort()).toEqual([
      'conferenceRecordName',
      'endTime',
      'greenLight',
      'meetingCode',
      'processedAt',
      'status',
    ]);
  });

  it('no manda la parrilla: la persiste su propio repositorio', () => {
    const race = new Race(
      'race-1',
      'conferenceRecords/abc',
      'abc-defg-hij',
      GREEN_LIGHT,
      END_TIME,
      RaceStatus.PROCESSED,
      [
        new StartingGridEntry(
          1,
          new Driver('a', 'google-a', 'Amaro Cifuentes', null),
          GREEN_LIGHT,
          GREEN_LIGHT,
          25,
          false,
          false,
        ),
      ],
      END_TIME,
    );

    expect('startingGrid' in RaceMapper.toOrm(race)).toBe(false);
  });
});

describe('RaceMapper, ida y vuelta', () => {
  it('dominio -> orm -> dominio conserva lo que le importa al juego', () => {
    const grid = [
      new StartingGridEntry(
        1,
        new Driver('a', 'google-a', 'Amaro Cifuentes', 'amaro@example.test'),
        new Date(GREEN_LIGHT.getTime() + 36),
        GREEN_LIGHT,
        25,
        false,
        false,
      ),
      new StartingGridEntry(
        2,
        new Driver('b', 'google-b', 'Nuria Belmonte', null),
        new Date(GREEN_LIGHT.getTime() + 92_000),
        GREEN_LIGHT,
        3,
        false,
        true,
      ),
      new StartingGridEntry(
        3,
        new Driver('c', 'google-c', 'Casilda Merino', 'casilda@example.test'),
        new Date(GREEN_LIGHT.getTime() - 8_000),
        GREEN_LIGHT,
        -5,
        true,
        false,
      ),
    ];
    const original = new Race(
      'race-1',
      'conferenceRecords/abc',
      'abc-defg-hij',
      GREEN_LIGHT,
      END_TIME,
      RaceStatus.PROCESSED,
      grid,
      END_TIME,
    );

    // Se reconstruye la fila como la devolveria la base: cabecera desde toOrm y
    // parrilla desde su mapper, con la relacion driver cargada y desordenada
    const rows = original.startingGrid.map((entry) => {
      const row = Object.assign(
        new StartingGridEntryOrmEntity(),
        StartingGridEntryMapper.toOrm('race-1', entry),
      );
      row.driver = Object.assign(new DriverOrmEntity(), {
        id: entry.driver.id,
        googleId: entry.driver.googleId,
        displayName: entry.driver.displayName,
        email: entry.driver.email,
      });
      return row;
    });
    const ormRow = Object.assign(new RaceOrmEntity(), RaceMapper.toOrm(original), {
      startingGrid: [rows[2], rows[0], rows[1]],
    });

    const round = RaceMapper.toDomain(ormRow);

    expect(round.id).toBe(original.id);
    expect(round.conferenceRecordName).toBe(original.conferenceRecordName);
    expect(round.meetingCode).toBe(original.meetingCode);
    expect(round.greenLight).toEqual(original.greenLight);
    expect(round.endTime).toEqual(original.endTime);
    expect(round.status).toBe(original.status);
    expect(round.processedAt).toEqual(original.processedAt);
    expect(round.startingGrid).toEqual(original.startingGrid);
    expect(round.startingGrid.map((e) => e.diffSeconds)).toEqual(
      original.startingGrid.map((e) => e.diffSeconds),
    );
  });
});

