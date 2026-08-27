import { FindOperator, type Repository } from 'typeorm';
import { RaceTypeOrmRepository } from '../repositories/race.typeorm-repository';
import { RaceOrmEntity } from '../entities/race.orm-entity';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';
import { Race, RaceStatus } from '../../../../core/entities/race.entity';

// Las relaciones de estas consultas son criticas: si falta
// startingGrid.driver el mapper no lanza, rellena los nombres a cadena vacia
// y el mensaje de Discord sale con pilotos sin nombre.

const GRID_RELATIONS = ['startingGrid', 'startingGrid.driver'];
const GREEN_LIGHT = new Date('2026-08-26T07:00:00Z');
const END_TIME = new Date('2026-08-26T07:15:00Z');

const entryRow = (
  position: number,
  driverId: string,
  displayName: string,
): StartingGridEntryOrmEntity =>
  Object.assign(new StartingGridEntryOrmEntity(), {
    id: `entry-${driverId}`,
    raceId: 'race-1',
    driverId,
    driver: Object.assign(new DriverOrmEntity(), {
      id: driverId,
      googleId: `google-${driverId}`,
      displayName,
      email: null,
    }),
    position,
    startTime: new Date(GREEN_LIGHT.getTime() + position * 1000),
    greenLight: GREEN_LIGHT,
    points: 26 - position,
    isFalseStart: false,
    isWorstOnGrid: false,
  });

const row = (over: Partial<RaceOrmEntity> = {}): RaceOrmEntity =>
  Object.assign(new RaceOrmEntity(), {
    id: 'race-1',
    conferenceRecordName: 'conferenceRecords/abc',
    meetingCode: 'abc-defg-hij',
    greenLight: GREEN_LIGHT,
    endTime: END_TIME,
    status: 'PROCESSED',
    processedAt: END_TIME,
    createdAt: GREEN_LIGHT,
    startingGrid: [
      entryRow(2, 'b', 'Nuria Belmonte'),
      entryRow(1, 'a', 'Amaro Cifuentes'),
    ],
    ...over,
  });

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

interface RepoMock {
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findOneOrFail: jest.Mock;
  existsBy: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface QbMock {
  where: jest.Mock;
  andWhere: jest.Mock;
  getExists: jest.Mock;
}

describe('RaceTypeOrmRepository', () => {
  let repo: RepoMock;
  let qb: QbMock;
  let sut: RaceTypeOrmRepository;

  beforeEach(() => {
    qb = {
      where: jest.fn(),
      andWhere: jest.fn(),
      getExists: jest.fn().mockResolvedValue(false),
    };
    qb.where.mockReturnValue(qb);
    qb.andWhere.mockReturnValue(qb);

    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      existsBy: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    sut = new RaceTypeOrmRepository(
      repo as unknown as Repository<RaceOrmEntity>,
    );
  });

  describe('save', () => {
    it('guarda sin id una carrera nueva y relee con la parrilla y sus pilotos', async () => {
      repo.save.mockResolvedValue({ id: 'race-generada' });
      repo.findOneOrFail.mockResolvedValue(row({ id: 'race-generada' }));

      const result = await sut.save(domainRace(''));

      expect('id' in repo.save.mock.calls[0][0]).toBe(false);
      expect('startingGrid' in repo.save.mock.calls[0][0]).toBe(false);
      expect(repo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 'race-generada' },
        relations: GRID_RELATIONS,
      });
      expect(result.id).toBe('race-generada');
      // La relacion cargada llega al dominio con nombres y ordenada
      expect(result.startingGrid.map((e) => e.driver.displayName)).toEqual([
        'Amaro Cifuentes',
        'Nuria Belmonte',
      ]);
    });

    it('manda el id cuando la carrera ya existia', async () => {
      repo.save.mockResolvedValue({ id: 'race-1' });
      repo.findOneOrFail.mockResolvedValue(row());

      await sut.save(domainRace('race-1'));

      expect(repo.save.mock.calls[0][0].id).toBe('race-1');
    });
  });

  describe('findById', () => {
    it('busca por id con la parrilla y sus pilotos', async () => {
      repo.findOne.mockResolvedValue(row());

      const result = await sut.findById('race-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'race-1' },
        relations: GRID_RELATIONS,
      });
      expect(result).toBeInstanceOf(Race);
      expect(result?.startingGrid.map((e) => e.position)).toEqual([1, 2]);
    });

    it('devuelve null cuando no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(sut.findById('fantasma')).resolves.toBeNull();
    });
  });

  describe('findByConferenceRecordName', () => {
    it('busca por el nombre del conference record con las relaciones', async () => {
      repo.findOne.mockResolvedValue(row());

      const result = await sut.findByConferenceRecordName('conferenceRecords/abc');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { conferenceRecordName: 'conferenceRecords/abc' },
        relations: GRID_RELATIONS,
      });
      expect(result?.conferenceRecordName).toBe('conferenceRecords/abc');
    });

    it('devuelve null cuando no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        sut.findByConferenceRecordName('conferenceRecords/nope'),
      ).resolves.toBeNull();
    });
  });

  describe('findByDateRange', () => {
    it('filtra el green light con un BETWEEN y ordena de la mas reciente a la mas vieja', async () => {
      repo.find.mockResolvedValue([row(), row({ id: 'race-2' })]);
      const start = new Date('2026-08-01T00:00:00Z');
      const end = new Date('2026-08-31T23:59:59Z');

      const result = await sut.findByDateRange(start, end);

      const options = repo.find.mock.calls[0][0];
      const operator = options.where.greenLight as FindOperator<Date>;
      expect(operator).toBeInstanceOf(FindOperator);
      expect(operator.type).toBe('between');
      expect(operator.value).toEqual([start, end]);
      expect(options.relations).toEqual(GRID_RELATIONS);
      expect(options.order).toEqual({ greenLight: 'DESC' });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Race);
    });

    it('devuelve lista vacia cuando el rango no tiene carreras', async () => {
      repo.find.mockResolvedValue([]);

      await expect(
        sut.findByDateRange(new Date(0), new Date(1)),
      ).resolves.toEqual([]);
    });
  });

  describe('existsByConferenceRecordName', () => {
    it('delega en existsBy sin traerse la fila', async () => {
      repo.existsBy.mockResolvedValue(true);

      await expect(
        sut.existsByConferenceRecordName('conferenceRecords/abc'),
      ).resolves.toBe(true);
      expect(repo.existsBy).toHaveBeenCalledWith({
        conferenceRecordName: 'conferenceRecords/abc',
      });
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('propaga el false', async () => {
      repo.existsBy.mockResolvedValue(false);

      await expect(
        sut.existsByConferenceRecordName('conferenceRecords/nope'),
      ).resolves.toBe(false);
    });
  });

  describe('existsProcessedRaceForSchedule', () => {
    it('exige codigo de sala, hora exacta y que la carrera tenga duracion', async () => {
      qb.getExists.mockResolvedValue(true);
      const scheduledStart = new Date('2026-08-26T07:00:00Z');

      const result = await sut.existsProcessedRaceForSchedule(
        'abc-defg-hij',
        scheduledStart,
      );

      expect(repo.createQueryBuilder).toHaveBeenCalledWith('race');
      expect(qb.where).toHaveBeenCalledWith('race.meetingCode = :meetingCode', {
        meetingCode: 'abc-defg-hij',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'race.greenLight = :scheduledStart',
        { scheduledStart },
      );
      // Esta condicion es la que descarta las carreras de duracion cero
      expect(qb.andWhere).toHaveBeenCalledWith('race.endTime > race.greenLight');
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it('devuelve false cuando la consulta no encuentra nada', async () => {
      qb.getExists.mockResolvedValue(false);

      await expect(
        sut.existsProcessedRaceForSchedule('abc-defg-hij', GREEN_LIGHT),
      ).resolves.toBe(false);
    });
  });
});
