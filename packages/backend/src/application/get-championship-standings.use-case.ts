import { Injectable, Inject } from '@nestjs/common';
import {
  DRIVER_REPOSITORY,
  DriverRepositoryPort,
} from '../core/ports/driver.repository.port';
import {
  STARTING_GRID_REPOSITORY,
  StartingGridRepositoryPort,
} from '../core/ports/starting-grid.repository.port';
import { ChampionshipStanding } from '../core/entities/championship-standing.entity';
import { seasonStart, ALL_TIME_END } from '../core/constants';

@Injectable()
export class GetChampionshipStandingsUseCase {
  constructor(
    @Inject(DRIVER_REPOSITORY)
    private readonly driverRepository: DriverRepositoryPort,
    @Inject(STARTING_GRID_REPOSITORY)
    private readonly startingGridRepository: StartingGridRepositoryPort,
  ) {}

  /**
   * Sin argumentos devuelve la clasificacion de la temporada en curso, que es
   * lo que se publica cada dia. El rango se pasa a mano para cerrar una
   * temporada terminada, que es lo que necesita el mensaje de cambio de
   * temporada: mismo ranking y mismos desempates, otra ventana de fechas.
   */
  async execute(
    from: Date = seasonStart(),
    to: Date = ALL_TIME_END,
  ): Promise<ChampionshipStanding[]> {
    const drivers = await this.driverRepository.findAll();
    const standings: ChampionshipStanding[] = [];

    for (const driver of drivers) {
      const entries =
        await this.startingGridRepository.findByDriverInDateRange(
          driver.id,
          from,
          to,
        );
      if (entries.length === 0) continue;

      const cleanEntries = entries.filter((e) => !e.isFalseStart);
      const bestFinish = cleanEntries.length > 0
        ? Math.min(...cleanEntries.map((e) => e.position))
        : 0;
      const wins = cleanEntries.filter((e) => e.position === 1).length;
      const podiums = cleanEntries.filter(
        (e) => e.position >= 1 && e.position <= 3,
      ).length;

      standings.push(
        new ChampionshipStanding(
          driver,
          entries.reduce((sum, e) => sum + e.points, 0),
          entries.length,
          entries.filter((e) => e.isFalseStart).length,
          bestFinish,
          0,
          wins,
          podiums,
        ),
      );
    }

    // A igualdad de puntos manda la asistencia, y luego la puntualidad. En la F1
    // el desempate es el countback de resultados porque todos corren todos los
    // GP, asi que lo unico que distingue es la calidad del resultado. Aqui la
    // asistencia va de 1 a 82 dailies sobre 89, o sea que es EL dato que
    // distingue, y es justo el que el juego intenta mover.
    //
    // Cierra con el nombre a proposito: sin una clave determinista al final, los
    // 23 empates que quedan con puntos y asistencia identicos caen en el orden
    // que devuelva el repositorio y la tabla baila cada vez que ese orden cambie.
    standings.sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.racesAttended - a.racesAttended ||
        a.falseStarts - b.falseStarts ||
        a.driver.displayName.localeCompare(b.driver.displayName, 'es'),
    );

    return standings.map(
      (s, i) =>
        new ChampionshipStanding(
          s.driver,
          s.totalPoints,
          s.racesAttended,
          s.falseStarts,
          s.bestFinish,
          i + 1,
          s.wins,
          s.podiums,
        ),
    );
  }
}
