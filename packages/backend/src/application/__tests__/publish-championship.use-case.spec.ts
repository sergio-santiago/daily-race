import { Test } from '@nestjs/testing';
import { PublishChampionshipUseCase } from '../publish-championship.use-case';
import { GetChampionshipStandingsUseCase } from '../get-championship-standings.use-case';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../../core/ports/notification.port';
import { Race, RaceStatus } from '../../core/entities/race.entity';
import { Driver } from '../../core/entities/driver.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import {
  previousSeasonStart,
  seasonStart,
} from '../../core/constants';

// Un martes de septiembre, la primera daily de la temporada 2027-2028
const OPENING_DAY = new Date(2027, 8, 1, 10, 0, 0);

function race(greenLight: Date): Race {
  return new Race(
    'race-1',
    'record-1',
    'code',
    greenLight,
    new Date(greenLight.getTime() + 900000),
    RaceStatus.PROCESSED,
    [],
    new Date(),
  );
}

function standing(
  name: string,
  rank: number,
  points: number,
  wins = 0,
): ChampionshipStanding {
  return new ChampionshipStanding(
    new Driver(`d-${name}`, `g-${name}`, name, null),
    points,
    10,
    0,
    1,
    rank,
    wins,
    3,
  );
}

describe('PublishChampionshipUseCase', () => {
  let useCase: PublishChampionshipUseCase;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let notification: jest.Mocked<NotificationPort>;
  let getChampionship: { execute: jest.Mock };

  const seasonRaces = (count: number): Race[] =>
    Array.from({ length: count }, () => race(OPENING_DAY));

  beforeEach(async () => {
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest.fn().mockResolvedValue([]),
      existsByConferenceRecordName: jest.fn(),
      existsProcessedRaceForSchedule: jest.fn(),
    };
    notification = {
      publishRaceResults: jest.fn(),
      publishChampionshipStandings: jest.fn(),
      publishSeasonChange: jest.fn(),
      createLiveRaceMessage: jest.fn(),
      editLiveRaceMessage: jest.fn(),
      editLiveRaceMessageAsFinal: jest.fn(),
    };
    getChampionship = { execute: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        PublishChampionshipUseCase,
        { provide: RACE_REPOSITORY, useValue: raceRepository },
        { provide: NOTIFICATION_PORT, useValue: notification },
        {
          provide: GetChampionshipStandingsUseCase,
          useValue: getChampionship,
        },
      ],
    }).compile();

    useCase = module.get(PublishChampionshipUseCase);
  });

  it('cuenta la temporada desde su arranque, no desde el principio', async () => {
    raceRepository.findByDateRange.mockResolvedValue(seasonRaces(5));

    await useCase.execute(OPENING_DAY);

    expect(getChampionship.execute).toHaveBeenCalledWith(
      seasonStart(OPENING_DAY),
    );
    expect(raceRepository.findByDateRange).toHaveBeenCalledWith(
      seasonStart(OPENING_DAY),
      expect.any(Date),
    );
  });

  it('publica el campeonato sin anunciar nada en un dia normal', async () => {
    raceRepository.findByDateRange.mockResolvedValue(seasonRaces(5));

    await useCase.execute(OPENING_DAY);

    expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);
    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });

  describe('cuando es la primera carrera de la temporada', () => {
    beforeEach(() => {
      // La temporada nueva tiene una carrera, la anterior tuvo 89
      raceRepository.findByDateRange.mockImplementation(async (from) =>
        from.getTime() === seasonStart(OPENING_DAY).getTime()
          ? seasonRaces(1)
          : Array.from({ length: 89 }, () => race(new Date(2027, 2, 1))),
      );
      getChampionship.execute.mockImplementation(async (from: Date) =>
        from.getTime() === seasonStart(OPENING_DAY).getTime()
          ? [standing('Novato', 1, 25, 1)]
          : [
              standing('Campeon', 1, 1223, 20),
              standing('Segundo', 2, 900, 8),
              standing('Tercero', 3, 850, 5),
              standing('Cuarto', 4, 700, 2),
            ],
      );
    });

    it('anuncia el relevo antes de publicar la clasificacion nueva', async () => {
      const order: string[] = [];
      notification.publishSeasonChange.mockImplementation(async () => {
        order.push('relevo');
      });
      notification.publishChampionshipStandings.mockImplementation(async () => {
        order.push('clasificacion');
      });

      await useCase.execute(OPENING_DAY);

      // El orden importa: quien lee el canal ve primero por que la tabla esta
      // a cero y despues la tabla
      expect(order).toEqual(['relevo', 'clasificacion']);
    });

    it('cierra la temporada anterior con su podio de tres', async () => {
      await useCase.execute(OPENING_DAY);

      const summary = notification.publishSeasonChange.mock.calls[0][0];
      expect(summary.label).toBe('2026-2027');
      expect(summary.nextLabel).toBe('2027-2028');
      expect(summary.racesCount).toBe(89);
      expect(summary.driversCount).toBe(4);
      expect(summary.podium.map((s) => s.driver.displayName)).toEqual([
        'Campeon',
        'Segundo',
        'Tercero',
      ]);
    });

    it('pide la clasificacion de la temporada que se cierra, no la de siempre', async () => {
      await useCase.execute(OPENING_DAY);

      expect(getChampionship.execute).toHaveBeenCalledWith(
        previousSeasonStart(OPENING_DAY),
        expect.any(Date),
      );
    });

    it('no repite el anuncio cuando se reintenta la publicacion', async () => {
      // El monitor reintenta el campeonato hasta tres veces si Discord falla, y
      // la temporada sigue teniendo una sola carrera en cada reintento
      await useCase.execute(OPENING_DAY);
      await useCase.execute(OPENING_DAY);
      await useCase.execute(OPENING_DAY);

      expect(notification.publishSeasonChange).toHaveBeenCalledTimes(1);
      expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(3);
    });

    it('nombra a todos los empatados en una posicion del podio', async () => {
      getChampionship.execute.mockImplementation(async (from: Date) =>
        from.getTime() === seasonStart(OPENING_DAY).getTime()
          ? [standing('Novato', 1, 25, 1)]
          : [
              standing('Campeon', 1, 1223, 20),
              standing('Empatada', 2, 900, 8),
              standing('Empatado', 2, 900, 8),
              standing('Cuarto', 4, 700, 2),
            ],
      );

      await useCase.execute(OPENING_DAY);

      const summary = notification.publishSeasonChange.mock.calls[0][0];
      expect(summary.podium.map((s) => s.driver.displayName)).toEqual([
        'Campeon',
        'Empatada',
        'Empatado',
      ]);
    });
  });

  it('no anuncia relevo en la primerisima temporada, no hay nada que cerrar', async () => {
    raceRepository.findByDateRange.mockImplementation(async (from) =>
      from.getTime() === seasonStart(OPENING_DAY).getTime()
        ? seasonRaces(1)
        : [],
    );

    await useCase.execute(OPENING_DAY);

    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
    expect(notification.publishChampionshipStandings).toHaveBeenCalledTimes(1);
  });
});
