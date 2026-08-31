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
import { seasonStart } from '../../core/constants';

const HOY = new Date(2027, 8, 15, 10, 0, 0);

function race(): Race {
  return new Race(
    'race-1',
    'record-1',
    'code',
    HOY,
    new Date(HOY.getTime() + 900000),
    RaceStatus.PROCESSED,
    [],
    new Date(),
  );
}

describe('PublishChampionshipUseCase', () => {
  let useCase: PublishChampionshipUseCase;
  let raceRepository: jest.Mocked<RaceRepositoryPort>;
  let notification: jest.Mocked<NotificationPort>;
  let getChampionship: { execute: jest.Mock };

  beforeEach(async () => {
    raceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByConferenceRecordName: jest.fn(),
      findByDateRange: jest.fn().mockResolvedValue([race(), race()]),
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
    await useCase.execute(HOY);

    expect(getChampionship.execute).toHaveBeenCalledWith(seasonStart(HOY));
    expect(raceRepository.findByDateRange).toHaveBeenCalledWith(
      seasonStart(HOY),
      expect.any(Date),
    );
  });

  it('publica la clasificacion con las carreras de la temporada', async () => {
    await useCase.execute(HOY);

    expect(notification.publishChampionshipStandings).toHaveBeenCalledWith(
      [],
      [expect.any(Race), expect.any(Race)],
    );
  });

  it('no anuncia el relevo, de eso se encarga el anuncio de temporada', async () => {
    // El relevo sale al principio de la jornada, no al cerrar una carrera, asi
    // que este camino no debe tocarlo ni en la primera carrera del ano
    raceRepository.findByDateRange.mockResolvedValue([race()]);

    await useCase.execute(HOY);

    expect(notification.publishSeasonChange).not.toHaveBeenCalled();
  });
});
