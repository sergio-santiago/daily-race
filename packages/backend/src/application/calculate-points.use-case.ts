import { Injectable } from '@nestjs/common';
import { ScoringParameters } from '../core/entities/scoring-parameters.entity';

export interface CalculatePointsInput {
  entryTime: Date;
  scheduledTime: Date;
}

export interface CalculatePointsResult {
  points: number;
  diffSeconds: number;
  isFalseStart: boolean;
}

@Injectable()
export class CalculatePointsUseCase {
  private readonly params = new ScoringParameters();

  execute(input: CalculatePointsInput): CalculatePointsResult {
    const diffSeconds =
      (input.entryTime.getTime() - input.scheduledTime.getTime()) / 1000;

    if (diffSeconds < 0) {
      return {
        points: diffSeconds * this.params.falseStartMultiplier,
        diffSeconds,
        isFalseStart: true,
      };
    }

    if (diffSeconds <= this.params.windowSeconds) {
      const raw =
        this.params.maxPoints *
        Math.exp(-diffSeconds / this.params.decayFactor);
      return {
        points: Math.max(raw, this.params.minPoints),
        diffSeconds,
        isFalseStart: false,
      };
    }

    return {
      points: this.params.minPoints,
      diffSeconds,
      isFalseStart: false,
    };
  }

  noAttendance(): CalculatePointsResult {
    return { points: 0.0, diffSeconds: Infinity, isFalseStart: false };
  }
}
