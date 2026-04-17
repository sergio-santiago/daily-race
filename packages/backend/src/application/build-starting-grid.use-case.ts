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

    // Busted: el mas adelantado si hay false starts, sino el ultimo
    // (sorted ascending: [0] = more negative if any false start, [last] = latest)
    const hasFalseStart =
      sorted.length > 0 &&
      sorted[0].earliestStartTime.getTime() < greenLight.getTime();
    const bustedIndex = hasFalseStart ? 0 : sorted.length - 1;

    // False starters get the last positions in the ranking (the more early the
    // entry, the worse the position). For 4 false starts + 14 on-time:
    //   falseStarters[0] (most early) -> pos 18
    //   falseStarters[1]              -> pos 17
    //   ...                           -> pos 15
    //   cleanGrid[0]                  -> pos 1
    //   ...                           -> pos 14
    const totalCount = sorted.length;
    let gridPosition = 0;
    let falseStartIndex = 0;

    return sorted.map((p, index) => {
      const driver = new Driver(
        '',
        p.googleParticipantId,
        p.displayName,
        p.email,
      );

      const isFalseStart = p.earliestStartTime.getTime() < greenLight.getTime();
      let position: number;
      if (isFalseStart) {
        position = totalCount - falseStartIndex;
        falseStartIndex++;
      } else {
        gridPosition++;
        position = gridPosition;
      }

      const { points } = this.calculatePoints.execute({
        position,
        isFalseStart,
      });

      return new StartingGridEntry(
        position,
        driver,
        p.earliestStartTime,
        greenLight,
        points,
        isFalseStart,
        index === bustedIndex,
      );
    });
  }
}
