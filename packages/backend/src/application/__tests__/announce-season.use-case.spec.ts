import { Test } from '@nestjs/testing';
import { AnnounceSeasonUseCase } from '../announce-season.use-case';
import { GetChampionshipStandingsUseCase } from '../get-championship-standings.use-case';
import {
  RACE_REPOSITORY,
  RaceRepositoryPort,
} from '../../core/ports/race.repository.port';
import {
  NOTIFICATION_PORT,
  NotificationPort,
} from '../../core/ports/notification.port';
import {
  SEASON_ANNOUNCEMENT_REPOSITORY,
  SeasonAnnouncementRepositoryPort,
} from '../../core/ports/season-announcement.repository.port';
import { Race, RaceStatus } from '../../core/entities/race.entity';
import { Driver } from '../../core/entities/driver.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { previousSeasonStart } from '../../core/constants';

// La manana del primer dia laborable de la temporada 2027-2028
const PRIMER_DIA = new Date(2027, 8, 1, 8, 0, 0);

function race(greenLight = new Date(2027, 2, 1)): Race {
  return new Race(
    'r',
    'record',
    'code',
    greenLight,
    new Date(greenLight.getTime() + 900000),
    RaceStatus.PROCESSED,
    [],
    new Date(),
  );
}

function standing(name: string, rank: number): ChampionshipStanding {
  return new ChampionshipStanding(
    new Driver(`d-${name}`, `g-${name}`, name, null),
    1000 - rank * 100,
    80,
    0,
    1,
    rank,
    10 - rank,
    20,
  );
}

describe('AnnounceSeasonUseCase', () => {
  let useCase: AnnounceSeasonUseCase;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let notification: jest.Mocked<NotificationPort>;
  let announcements: jest.Mocked<SeasonAnnouncementRepositoryPort>;
  let getChampionship: { execute: jest.Mock };

  beforeEach(async () => {
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest
        .fn()
        .mockResolvedValue(Array.from({ length: 89 }, () => race())),
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
    announcements = { claim: jest.fn().mockResolvedValue(true) };
    getChampionship = {
      execute: jest
        .fn()
        .mockResolvedValue([
          standing('Campeon', 1),
          standing('Segunda', 2),
          standing('Tercero', 3),
          standing('Cuarto', 4),
        ]),
    };

    const module = await Test.createTestingModule({
      providers: [
        AnnounceSeasonUseCase,
        { provide: RACE_REPOSITORY, useValue: raceRepository },
        { provide: NOTIFICATION_PORT, useValue: notification },
        {
          provide: SEASON_ANNOUNCEMENT_REPOSITORY,
          useValue: announcements,
        },
        {
          provide: GetChampionshipStandingsUseCase,
          useValue: getChampionship,
        },
      ],
    }).compile();

    useCase = module.get(AnnounceSeasonUseCase);
  });

  it('anuncia el relevo cerrando la temporada anterior', async () => {
    await useCase.execute(PRIMER_DIA);

    const summary = notification.publishSeasonChange.mock.calls[0][0];
    expect(summary.label).toBe('2026-2027');
    expect(summary.nextLabel).toBe('2027-2028');
    expect(summary.racesCount).toBe(89);
    expect(summary.driversCount).toBe(4);
    expect(summary.podium.map((s) => s.driver.displayName)).toEqual([
      'Campeon',
      'Segunda',
      'Tercero',
    ]);
  });

  it('pide la clasificacion de la temporada que se cierra', async () => {
    await useCase.execute(PRIMER_DIA);

    expect(getChampionship.execute).toHaveBeenCalledWith(
      previousSeasonStart(PRIMER_DIA),
      expect.any(Date),
    );
  });

  it('reserva el anuncio con la etiqueta de la temporada que empieza', async () => {
    await useCase.execute(PRIMER_DIA);

    expect(announcements.claim).toHaveBeenCalledWith('2027-2028');
  });

  it('no publica si otro tick se llevo el anuncio', async () => {
    // Dos ticks del cron pueden solaparse, y el que pierde el claim se calla
    announcements.claim.mockResolvedValue(false);

    await useCase.execute(PRIMER_DIA);

    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });

  it('reserva antes de publicar, no despues', async () => {
    // El orden es la red de seguridad: si se publicase primero, un fallo al
    // registrar dejaria al cron republicando cada cinco segundos
    const order: string[] = [];
    announcements.claim.mockImplementation(async () => {
      order.push('claim');
      return true;
    });
    notification.publishSeasonChange.mockImplementation(async () => {
      order.push('publish');
    });

    await useCase.execute(PRIMER_DIA);

    expect(order).toEqual(['claim', 'publish']);
  });

  it('no gasta la reserva cuando no hay temporada anterior', async () => {
    // En la primerisima temporada no hay nada que cerrar, y el anuncio no debe
    // quedar marcado: el ano que viene si habra algo que decir
    raceRepository.findByDateRange.mockResolvedValue([]);

    await useCase.execute(PRIMER_DIA);

    expect(announcements.claim).not.toHaveBeenCalled();
    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });

  it('no anuncia si la temporada anterior no tuvo pilotos', async () => {
    getChampionship.execute.mockResolvedValue([]);

    await useCase.execute(PRIMER_DIA);

    expect(announcements.claim).not.toHaveBeenCalled();
    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });

  it('deja de recalcular la temporada en cuanto sabe que ya esta resuelta', async () => {
    // Sin esto, cada tick reconstruye la temporada anterior completa solo para
    // descubrir que ya se anuncio, 2880 veces al dia durante todo el ano
    await useCase.execute(PRIMER_DIA);
    const consultasTrasElPrimerTick = raceRepository.findByDateRange.mock.calls.length;

    for (let i = 0; i < 50; i++) await useCase.execute(PRIMER_DIA);

    expect(raceRepository.findByDateRange.mock.calls.length).toBe(
      consultasTrasElPrimerTick,
    );
    expect(notification.publishSeasonChange).toHaveBeenCalledTimes(1);
  });

  it('tambien corta el trabajo cuando el anuncio se lo llevo otro proceso', async () => {
    announcements.claim.mockResolvedValue(false);

    await useCase.execute(PRIMER_DIA);
    const consultas = raceRepository.findByDateRange.mock.calls.length;
    for (let i = 0; i < 20; i++) await useCase.execute(PRIMER_DIA);

    expect(raceRepository.findByDateRange.mock.calls.length).toBe(consultas);
    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });

  it('vuelve a mirar cuando cambia la temporada', async () => {
    // El atajo es por etiqueta, no un booleano: un proceso que siga vivo el
    // septiembre siguiente tiene que anunciar la temporada nueva
    await useCase.execute(PRIMER_DIA);
    expect(notification.publishSeasonChange).toHaveBeenCalledTimes(1);

    await useCase.execute(new Date(2028, 8, 1, 8, 0, 0));

    expect(announcements.claim).toHaveBeenLastCalledWith('2028-2029');
    expect(notification.publishSeasonChange).toHaveBeenCalledTimes(2);
  });

  it('lleva las carreras del ano para poder dibujar su grafica', async () => {
    await useCase.execute(PRIMER_DIA);

    const summary = notification.publishSeasonChange.mock.calls[0][0];
    expect(summary.races).toHaveLength(89);
    expect(summary.standings).toHaveLength(4);
  });
});
