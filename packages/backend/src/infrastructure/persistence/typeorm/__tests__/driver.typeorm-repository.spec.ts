import type { Repository } from 'typeorm';
import { DriverTypeOrmRepository } from '../repositories/driver.typeorm-repository';
import { DriverOrmEntity } from '../entities/driver.orm-entity';
import { Driver } from '../../../../core/entities/driver.entity';

// Sin base de datos delante, lo que se puede fijar aqui es el contrato con
// TypeORM: que la consulta que se construye es la correcta y que el resultado
// sale del mapper y no del objeto que entro.

const row = (over: Partial<DriverOrmEntity> = {}): DriverOrmEntity =>
  Object.assign(new DriverOrmEntity(), {
    id: 'drv-1',
    googleId: 'google-1',
    displayName: 'Amaro Cifuentes',
    email: 'amaro@example.test',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  });

interface RepoMock {
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findOneOrFail: jest.Mock;
}

describe('DriverTypeOrmRepository', () => {
  let repo: RepoMock;
  let sut: DriverTypeOrmRepository;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
    };
    sut = new DriverTypeOrmRepository(
      repo as unknown as Repository<DriverOrmEntity>,
    );
  });

  describe('save', () => {
    it('guarda sin id un piloto nuevo y devuelve la fila releida', async () => {
      repo.save.mockResolvedValue({ id: 'drv-generado' });
      repo.findOneOrFail.mockResolvedValue(
        row({ id: 'drv-generado', displayName: 'Nombre canonico de la base' }),
      );

      const result = await sut.save(
        new Driver('', 'google-1', 'Nombre que entro', null),
      );

      const [sent] = repo.save.mock.calls[0];
      expect('id' in sent).toBe(false);
      expect(sent).toEqual({
        googleId: 'google-1',
        displayName: 'Nombre que entro',
        email: null,
      });
      // El id generado se relee: lo que vuelve es la fila, no el argumento
      expect(repo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'drv-generado' },
      });
      expect(result).toEqual(
        new Driver(
          'drv-generado',
          'google-1',
          'Nombre canonico de la base',
          'amaro@example.test',
        ),
      );
    });

    it('manda el id cuando el piloto ya existia', async () => {
      repo.save.mockResolvedValue({ id: 'drv-1' });
      repo.findOneOrFail.mockResolvedValue(row());

      await sut.save(
        new Driver('drv-1', 'google-1', 'Amaro Cifuentes', 'amaro@example.test'),
      );

      expect(repo.save.mock.calls[0][0].id).toBe('drv-1');
    });
  });

  describe('findByGoogleId', () => {
    it('busca por googleId y devuelve el dominio', async () => {
      repo.findOne.mockResolvedValue(row());

      const result = await sut.findByGoogleId('google-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { googleId: 'google-1' },
      });
      expect(result).toBeInstanceOf(Driver);
      expect(result?.displayName).toBe('Amaro Cifuentes');
    });

    it('devuelve null cuando no hay fila, sin pasar por el mapper', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(sut.findByGoogleId('desconocido')).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    it('pide los pilotos ordenados por nombre ascendente', async () => {
      repo.find.mockResolvedValue([
        row({ id: 'a', displayName: 'Amaro Cifuentes' }),
        row({ id: 'b', displayName: 'Nuria Belmonte' }),
      ]);

      const result = await sut.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { displayName: 'ASC' } });
      expect(result.map((d) => d.displayName)).toEqual([
        'Amaro Cifuentes',
        'Nuria Belmonte',
      ]);
      expect(result[0]).toBeInstanceOf(Driver);
    });

    it('devuelve lista vacia sin tocar el mapper', async () => {
      repo.find.mockResolvedValue([]);

      await expect(sut.findAll()).resolves.toEqual([]);
    });
  });

  describe('upsert', () => {
    it('actualiza el nombre del piloto existente y no crea una fila nueva', async () => {
      const existing = row({ displayName: 'Nombre viejo' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((entity: DriverOrmEntity) =>
        Promise.resolve(entity),
      );

      const result = await sut.upsert(
        new Driver('', 'google-1', 'Nombre nuevo', 'amaro@example.test'),
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { googleId: 'google-1' },
      });
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.save.mock.calls[0][0]).toBe(existing);
      expect(existing.displayName).toBe('Nombre nuevo');
      expect(result.displayName).toBe('Nombre nuevo');
      // No relee: se devuelve la entidad guardada directamente
      expect(repo.findOneOrFail).not.toHaveBeenCalled();
    });

    it('no borra el email guardado cuando el que llega es null', async () => {
      const existing = row({ email: 'amaro@example.test' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((entity: DriverOrmEntity) =>
        Promise.resolve(entity),
      );

      const result = await sut.upsert(
        new Driver('', 'google-1', 'Amaro Cifuentes', null),
      );

      expect(existing.email).toBe('amaro@example.test');
      expect(result.email).toBe('amaro@example.test');
    });

    it('sobreescribe el email cuando el que llega trae valor', async () => {
      const existing = row({ email: 'viejo@example.test' });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((entity: DriverOrmEntity) =>
        Promise.resolve(entity),
      );

      const result = await sut.upsert(
        new Driver('', 'google-1', 'Amaro Cifuentes', 'nuevo@example.test'),
      );

      expect(result.email).toBe('nuevo@example.test');
    });

    it('inserta cuando no hay piloto con ese googleId', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockResolvedValue({ id: 'drv-generado' });
      repo.findOneOrFail.mockResolvedValue(
        row({ id: 'drv-generado', googleId: 'google-nuevo' }),
      );

      const result = await sut.upsert(
        new Driver('', 'google-nuevo', 'Casilda Merino', null),
      );

      expect(repo.save.mock.calls[0][0]).toEqual({
        googleId: 'google-nuevo',
        displayName: 'Casilda Merino',
        email: null,
      });
      expect(result.id).toBe('drv-generado');
    });
  });
});
