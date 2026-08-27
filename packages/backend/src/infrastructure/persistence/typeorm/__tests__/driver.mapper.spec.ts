import { DriverMapper } from '../mappers/driver.mapper';
import { Driver } from '../../../../core/entities/driver.entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';

// El mapper de pilotos es la frontera entre la fila de la tabla y el dominio.
// Aqui se fija que el email nullable viaja tal cual y que el id solo se manda a
// la base cuando ya existe, porque un id vacio rompe el insert de uuid.

const ormRow = (over: Partial<DriverOrmEntity> = {}): DriverOrmEntity =>
  Object.assign(new DriverOrmEntity(), {
    id: 'drv-1',
    googleId: 'google-1',
    displayName: 'Pilar Hidalgo',
    email: 'pilar.hidalgo@example.test',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  });

describe('DriverMapper.toDomain', () => {
  it('copia los cuatro campos del dominio desde la fila', () => {
    const domain = DriverMapper.toDomain(ormRow());

    expect(domain).toBeInstanceOf(Driver);
    expect(domain.id).toBe('drv-1');
    expect(domain.googleId).toBe('google-1');
    expect(domain.displayName).toBe('Pilar Hidalgo');
    expect(domain.email).toBe('pilar.hidalgo@example.test');
  });

  it('conserva el email a null cuando la columna esta vacia', () => {
    const domain = DriverMapper.toDomain(ormRow({ email: null }));

    expect(domain.email).toBeNull();
  });

  it('no arrastra las columnas de auditoria al dominio', () => {
    const domain = DriverMapper.toDomain(ormRow());

    expect(Object.keys(domain).sort()).toEqual([
      'displayName',
      'email',
      'googleId',
      'id',
    ]);
  });
});

describe('DriverMapper.toOrm', () => {
  it('incluye el id cuando el piloto ya existe', () => {
    const orm = DriverMapper.toOrm(
      new Driver('drv-9', 'google-9', 'Nuria Belmonte', 'nuria@example.test'),
    );

    expect(orm).toEqual({
      id: 'drv-9',
      googleId: 'google-9',
      displayName: 'Nuria Belmonte',
      email: 'nuria@example.test',
    });
  });

  it('omite la clave id cuando el piloto es nuevo', () => {
    const orm = DriverMapper.toOrm(
      new Driver('', 'google-nuevo', 'Ruben Alcazar', null),
    );

    // Tiene que faltar la clave, no valer undefined: TypeORM trataria un
    // id presente como update de una fila que no existe
    expect('id' in orm).toBe(false);
    expect(Object.keys(orm).sort()).toEqual([
      'displayName',
      'email',
      'googleId',
    ]);
    expect(orm.email).toBeNull();
  });

  it('ida y vuelta: dominio -> orm -> dominio conserva los campos', () => {
    const original = new Driver(
      'drv-7',
      'google-7',
      'Casilda Merino',
      'casilda@example.test',
    );

    const round = DriverMapper.toDomain(
      Object.assign(new DriverOrmEntity(), DriverMapper.toOrm(original)),
    );

    expect(round).toEqual(original);
  });
});
