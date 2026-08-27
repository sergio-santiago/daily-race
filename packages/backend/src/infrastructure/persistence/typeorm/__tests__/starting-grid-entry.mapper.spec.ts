import { StartingGridEntryMapper } from '../mappers/starting-grid-entry.mapper';
import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { Driver } from '../../../../core/entities/driver.entity';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';

// Este mapper es el que usan findByRaceId y findByDriverInDateRange, o sea que
// alimenta las graficas y el campeonato sin pasar por RaceMapper.

const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');

const row = (
  over: Partial<StartingGridEntryOrmEntity> = {},
): StartingGridEntryOrmEntity =>
  Object.assign(new StartingGridEntryOrmEntity(), {
    id: 'entry-1',
    raceId: 'race-1',
    driverId: 'drv-1',
    driver: Object.assign(new DriverOrmEntity(), {
      id: 'drv-1',
      googleId: 'google-1',
      displayName: 'Amaro Cifuentes',
      email: 'amaro@example.test',
    }),
    position: 1,
    startTime: new Date(GREEN_LIGHT.getTime() + 36),
    greenLight: GREEN_LIGHT,
    points: 25,
    isFalseStart: false,
    isWorstOnGrid: false,
    ...over,
  });

describe('StartingGridEntryMapper.toDomain', () => {
  it('mapea la entrada completa con su piloto', () => {
    const domain = StartingGridEntryMapper.toDomain(row());

    expect(domain).toBeInstanceOf(StartingGridEntry);
    expect(domain.position).toBe(1);
    expect(domain.driver).toBeInstanceOf(Driver);
    expect(domain.driver.id).toBe('drv-1');
    expect(domain.driver.displayName).toBe('Amaro Cifuentes');
    expect(domain.driver.email).toBe('amaro@example.test');
    expect(domain.points).toBe(25);
    expect(domain.isFalseStart).toBe(false);
    expect(domain.isWorstOnGrid).toBe(false);
    expect(domain.diffSeconds).toBe(0.036);
  });

  it('rellena los defaults del piloto cuando la relacion no viene cargada', () => {
    const orphan = row();
    delete (orphan as Partial<StartingGridEntryOrmEntity>).driver;

    const domain = StartingGridEntryMapper.toDomain(orphan);

    expect(domain.driver.id).toBe('drv-1');
    expect(domain.driver.googleId).toBe('');
    expect(domain.driver.displayName).toBe('');
    expect(domain.driver.email).toBeNull();
    // El resto de la entrada no se ve afectado
    expect(domain.position).toBe(1);
    expect(domain.points).toBe(25);
  });

  it('normaliza a null un email ausente en el piloto cargado', () => {
    const withoutEmail = row();
    withoutEmail.driver.email = null;

    expect(StartingGridEntryMapper.toDomain(withoutEmail).driver.email).toBeNull();
  });

  it('conserva la penalizacion de -5 y el flag de salida en falso', () => {
    const domain = StartingGridEntryMapper.toDomain(
      row({
        position: 9,
        points: -5,
        isFalseStart: true,
        startTime: new Date(GREEN_LIGHT.getTime() - 8_000),
      }),
    );

    expect(domain.points).toBe(-5);
    expect(domain.isFalseStart).toBe(true);
    expect(domain.diffSeconds).toBe(-8);
  });

  it('conserva el flag de busted', () => {
    expect(
      StartingGridEntryMapper.toDomain(row({ isWorstOnGrid: true })).isWorstOnGrid,
    ).toBe(true);
  });

  // Defecto conocido: RaceMapper protege los puntos con Number(entry.points) y
  // este mapper no. Con la columna integer actual pg ya devuelve number, asi
  // que no hay bug hoy, pero pasar la columna a numeric o bigint haria que los
  // puntos llegasen como cadena solo por este camino.
  it.failing('deberia castear a number un points que llegue como cadena', () => {
    const domain = StartingGridEntryMapper.toDomain(
      row({ points: '25' as unknown as number }),
    );

    expect(typeof domain.points).toBe('number');
  });
});

describe('StartingGridEntryMapper.toOrm', () => {
  const entry = new StartingGridEntry(
    4,
    new Driver('drv-4', 'google-4', 'Nuria Belmonte', 'nuria@example.test'),
    new Date(GREEN_LIGHT.getTime() + 92_000),
    GREEN_LIGHT,
    3,
    false,
    true,
  );

  it('aplana el piloto a driverId y le pega el raceId recibido', () => {
    const orm = StartingGridEntryMapper.toOrm('race-42', entry);

    expect(orm).toEqual({
      raceId: 'race-42',
      driverId: 'drv-4',
      position: 4,
      startTime: new Date(GREEN_LIGHT.getTime() + 92_000),
      greenLight: GREEN_LIGHT,
      points: 3,
      isFalseStart: false,
      isWorstOnGrid: true,
    });
  });

  it('no manda la relacion driver ni un id de fila inventado', () => {
    const orm = StartingGridEntryMapper.toOrm('race-42', entry);

    expect('driver' in orm).toBe(false);
    expect('id' in orm).toBe(false);
  });

  it('ida y vuelta: dominio -> orm -> dominio conserva la entrada', () => {
    const penalized = new StartingGridEntry(
      12,
      new Driver('drv-12', 'google-12', 'Casilda Merino', null),
      new Date(GREEN_LIGHT.getTime() - 15_500),
      GREEN_LIGHT,
      -5,
      true,
      false,
    );

    const ormRow = Object.assign(
      new StartingGridEntryOrmEntity(),
      StartingGridEntryMapper.toOrm('race-42', penalized),
      {
        driver: Object.assign(new DriverOrmEntity(), {
          id: 'drv-12',
          googleId: 'google-12',
          displayName: 'Casilda Merino',
          email: null,
        }),
      },
    );

    const round = StartingGridEntryMapper.toDomain(ormRow);

    expect(round).toEqual(penalized);
    expect(round.diffSeconds).toBe(penalized.diffSeconds);
  });
});
