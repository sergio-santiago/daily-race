import { FindOperator, type Repository } from 'typeorm';
import { StartingGridTypeOrmRepository } from '../repositories/starting-grid.typeorm-repository';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';
import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { Driver } from '../../../../core/entities/driver.entity';

const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');

const domainEntry = (
  position: number,
  driverId: string,
  points: number,
  worst = false,
  falseStart = false,
): StartingGridEntry =>
  new StartingGridEntry(
    position,
    new Driver(driverId, `google-${driverId}`, `Piloto ${driverId}`, null),
    new Date(GREEN_LIGHT.getTime() + position * 1000),
    GREEN_LIGHT,
    points,
    falseStart,
    worst,
  );

const row = (position: number, driverId: string): StartingGridEntryOrmEntity =>
  Object.assign(new StartingGridEntryOrmEntity(), {
    id: `entry-${driverId}`,
    raceId: 'race-1',
    driverId,
    driver: Object.assign(new DriverOrmEntity(), {
      id: driverId,
      googleId: `google-${driverId}`,
      displayName: `Piloto ${driverId}`,
      email: null,
    }),
    position,
    startTime: new Date(GREEN_LIGHT.getTime() + position * 1000),
    greenLight: GREEN_LIGHT,
    points: 26 - position,
    isFalseStart: false,
    isWorstOnGrid: false,
  });

interface RepoMock {
  save: jest.Mock;
  find: jest.Mock;
  update: jest.Mock;
}

describe('StartingGridTypeOrmRepository', () => {
  let repo: RepoMock;
  let sut: StartingGridTypeOrmRepository;

  beforeEach(() => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    sut = new StartingGridTypeOrmRepository(
      repo as unknown as Repository<StartingGridEntryOrmEntity>,
    );
  });

  describe('saveAll', () => {
    it('guarda la parrilla en una sola llamada, con el raceId pegado a cada fila', async () => {
      await sut.saveAll('race-1', [
        domainEntry(1, 'a', 25),
        domainEntry(2, 'b', 18),
      ]);

      expect(repo.save).toHaveBeenCalledTimes(1);
      const sent = repo.save.mock.calls[0][0];
      expect(sent).toHaveLength(2);
      expect(sent.map((r: StartingGridEntryOrmEntity) => r.raceId)).toEqual([
        'race-1',
        'race-1',
      ]);
      expect(sent.map((r: StartingGridEntryOrmEntity) => r.driverId)).toEqual([
        'a',
        'b',
      ]);
      expect(sent[0].points).toBe(25);
    });

    it('conserva la penalizacion de -5 y sus flags al guardar', async () => {
      await sut.saveAll('race-1', [domainEntry(9, 'z', -5, false, true)]);

      const sent = repo.save.mock.calls[0][0][0];
      expect(sent.points).toBe(-5);
      expect(sent.isFalseStart).toBe(true);
    });

    it('acepta una parrilla vacia', async () => {
      await sut.saveAll('race-1', []);

      expect(repo.save).toHaveBeenCalledWith([]);
    });
  });

  describe('findByRaceId', () => {
    it('pide la relacion driver y el orden por posicion ascendente', async () => {
      repo.find.mockResolvedValue([row(1, 'a'), row(2, 'b')]);

      const result = await sut.findByRaceId('race-1');

      expect(repo.find).toHaveBeenCalledWith({
        where: { raceId: 'race-1' },
        relations: ['driver'],
        order: { position: 'ASC' },
      });
      expect(result[0]).toBeInstanceOf(StartingGridEntry);
      expect(result.map((e) => e.driver.displayName)).toEqual([
        'Piloto a',
        'Piloto b',
      ]);
    });

    it('devuelve lista vacia cuando la carrera no tiene parrilla', async () => {
      await expect(sut.findByRaceId('race-vacia')).resolves.toEqual([]);
    });
  });

  describe('findByDriverInDateRange', () => {
    it('filtra por piloto y por startTime entre fechas, ordenado cronologicamente', async () => {
      repo.find.mockResolvedValue([row(1, 'a')]);
      const start = new Date('2026-08-01T00:00:00Z');
      const end = new Date('2026-08-31T23:59:59Z');

      const result = await sut.findByDriverInDateRange('a', start, end);

      const options = repo.find.mock.calls[0][0];
      expect(options.where.driverId).toBe('a');
      const operator = options.where.startTime as FindOperator<Date>;
      expect(operator).toBeInstanceOf(FindOperator);
      expect(operator.type).toBe('between');
      expect(operator.value).toEqual([start, end]);
      expect(options.relations).toEqual(['driver']);
      expect(options.order).toEqual({ startTime: 'ASC' });
      expect(result).toHaveLength(1);
    });
  });

  describe('updateEntries', () => {
    it('actualiza cada entrada por raceId y driverId y solo toca los tres campos recalculados', async () => {
      await sut.updateEntries([
        {
          raceId: 'race-1',
          driverId: 'a',
          position: 3,
          points: 15,
          isWorstOnGrid: false,
        },
        {
          raceId: 'race-1',
          driverId: 'b',
          position: 12,
          points: -5,
          isWorstOnGrid: true,
        },
      ]);

      expect(repo.update).toHaveBeenCalledTimes(2);
      expect(repo.update).toHaveBeenNthCalledWith(
        1,
        { raceId: 'race-1', driverId: 'a' },
        { position: 3, points: 15, isWorstOnGrid: false },
      );
      expect(repo.update).toHaveBeenNthCalledWith(
        2,
        { raceId: 'race-1', driverId: 'b' },
        { position: 12, points: -5, isWorstOnGrid: true },
      );
      // startTime, greenLight e isFalseStart no se reescriben nunca aqui
      const patched = repo.update.mock.calls.flatMap((call) =>
        Object.keys(call[1]),
      );
      expect(new Set(patched)).toEqual(
        new Set(['position', 'points', 'isWorstOnGrid']),
      );
    });

    it('no lanza ni consulta nada con una lista vacia', async () => {
      await expect(sut.updateEntries([])).resolves.toBeUndefined();

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('propaga el fallo de cualquiera de las actualizaciones', async () => {
      repo.update
        .mockResolvedValueOnce({ affected: 1 })
        .mockRejectedValueOnce(new Error('deadlock detected'));

      await expect(
        sut.updateEntries([
          {
            raceId: 'race-1',
            driverId: 'a',
            position: 1,
            points: 25,
            isWorstOnGrid: false,
          },
          {
            raceId: 'race-1',
            driverId: 'b',
            position: 2,
            points: 18,
            isWorstOnGrid: false,
          },
        ]),
      ).rejects.toThrow('deadlock detected');
    });
  });
});
