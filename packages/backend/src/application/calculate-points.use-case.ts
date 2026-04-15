import { Injectable } from '@nestjs/common';
import {
  F1_POINTS,
  ATTENDANCE_POINTS,
  FALSE_START_PENALTY,
  NO_ATTENDANCE_POINTS,
} from '../core/constants';

export interface CalculatePointsInput {
  position: number;
  isFalseStart: boolean;
}

export interface CalculatePointsResult {
  points: number;
}

@Injectable()
export class CalculatePointsUseCase {
  execute(input: CalculatePointsInput): CalculatePointsResult {
    if (input.isFalseStart) {
      return { points: FALSE_START_PENALTY };
    }

    if (input.position >= 1 && input.position <= F1_POINTS.length) {
      return { points: F1_POINTS[input.position - 1] };
    }

    return { points: ATTENDANCE_POINTS };
  }

  noAttendance(): CalculatePointsResult {
    return { points: NO_ATTENDANCE_POINTS };
  }
}
