import { Injectable } from '@nestjs/common';
import { Driver } from '../core/entities/driver.entity';
import { StartingGridEntry } from '../core/entities/starting-grid-entry.entity';
import { MeetParticipantData } from '../core/ports/meet.provider.port';
import { CalculatePointsUseCase } from './calculate-points.use-case';

export interface BuildStartingGridInput {
  participants: MeetParticipantData[];
  greenLight: Date;
}

@Injectable()
export class BuildStartingGridUseCase {
  constructor(private readonly calculatePoints: CalculatePointsUseCase) {}

  execute(input: BuildStartingGridInput): StartingGridEntry[] {
    const { participants, greenLight } = input;

    const sorted = [...participants].sort(
      (a, b) =>
        a.earliestStartTime.getTime() - b.earliestStartTime.getTime(),
    );

    // Entrar en el mismo instante es un empate genuinamente indecidible, asi
    // que se comparte la posicion y sus puntos, como en cualquier deporte: dos
    // a la vez son los dos P1 y el siguiente es P3. Antes lo decidia el orden
    // en que Google Meet devolvia los participantes, que no esta especificado
    // en ninguna parte: en la temporada medida eso reparte 73 puntos a dedo, y
    // tres veces decidio quien se llevaba 25 y quien 18.
    //
    // Pasa en 37 de las 89 carreras, casi siempre porque quien ya esta en la
    // sala cuando arranca la reunion recibe todo el grupo el mismo timestamp.
    const groups = groupByInstant(sorted);

    // Busted: el mas adelantado si hay salidas en falso, sino el ultimo. Si el
    // extremo esta empatado, la calavera es de todos los empatados: a igualdad
    // de culpa no hay motivo para senalar a uno solo
    const hasFalseStart =
      sorted.length > 0 &&
      sorted[0].earliestStartTime.getTime() < greenLight.getTime();
    const bustedGroup = hasFalseStart ? groups[0] : groups[groups.length - 1];

    // Las salidas en falso van a las ultimas posiciones, y cuanto mas temprana
    // la entrada peor la posicion. Con 4 en falso y 14 a la hora:
    //   el mas madrugador  -> pos 18
    //   el siguiente       -> pos 17
    //   ...                -> pos 15
    //   el primero limpio  -> pos 1
    //   ...                -> pos 14
    const totalCount = sorted.length;
    let cleanPosition = 0;
    let falseStartCount = 0;
    const entries: StartingGridEntry[] = [];

    for (const group of groups) {
      const isFalseStart =
        group[0].earliestStartTime.getTime() < greenLight.getTime();

      // La posicion del grupo entero es la que le tocaria a su primer miembro,
      // y el grupo siguiente arranca despues de todos ellos
      let position: number;
      if (isFalseStart) {
        position = totalCount - falseStartCount - (group.length - 1);
        falseStartCount += group.length;
      } else {
        position = cleanPosition + 1;
        cleanPosition += group.length;
      }

      const { points } = this.calculatePoints.execute({
        position,
        isFalseStart,
      });
      const isBusted = group === bustedGroup;

      for (const p of group) {
        entries.push(
          new StartingGridEntry(
            position,
            new Driver('', p.googleParticipantId, p.displayName, p.email),
            p.earliestStartTime,
            greenLight,
            points,
            isFalseStart,
            isBusted,
          ),
        );
      }
    }

    return entries;
  }
}

/**
 * Agrupa las entradas que comparten instante exacto, conservando el orden. La
 * lista tiene que llegar ya ordenada por hora de entrada.
 */
function groupByInstant(
  sorted: MeetParticipantData[],
): MeetParticipantData[][] {
  const groups: MeetParticipantData[][] = [];
  for (const participant of sorted) {
    const last = groups[groups.length - 1];
    if (
      last != null &&
      last[0].earliestStartTime.getTime() ===
        participant.earliestStartTime.getTime()
    ) {
      last.push(participant);
    } else {
      groups.push([participant]);
    }
  }
  return groups;
}
