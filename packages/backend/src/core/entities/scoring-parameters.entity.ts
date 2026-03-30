import {
  DECAY_FACTOR,
  FALSE_START_MULTIPLIER,
  WINDOW_SECONDS,
  MIN_POINTS,
  MAX_POINTS,
} from '../constants';

export class ScoringParameters {
  constructor(
    public readonly decayFactor: number = DECAY_FACTOR,
    public readonly falseStartMultiplier: number = FALSE_START_MULTIPLIER,
    public readonly windowSeconds: number = WINDOW_SECONDS,
    public readonly minPoints: number = MIN_POINTS,
    public readonly maxPoints: number = MAX_POINTS,
  ) {}
}
