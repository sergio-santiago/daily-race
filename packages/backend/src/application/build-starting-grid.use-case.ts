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

    const lastIndex = sorted.length - 1;
    let gridPosition = 0;

    return sorted.map((p, index) => {
      const driver = new Driver(
        '',
        p.googleParticipantId,
        p.displayName,
        p.email,
      );

      const isFalseStart = p.earliestStartTime.getTime() < greenLight.getTime();
      if (!isFalseStart) gridPosition++;

      const { points } = this.calculatePoints.execute({
        position: isFalseStart ? 0 : gridPosition,
        isFalseStart,
      });

      return new StartingGridEntry(
        isFalseStart ? 0 : gridPosition,
        driver,
        p.earliestStartTime,
        greenLight,
        points,
        isFalseStart,
        index === lastIndex,
      );
    });
  }
}
