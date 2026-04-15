import { CalculatePointsUseCase } from '../calculate-points.use-case';
import {
  F1_POINTS,
  ATTENDANCE_POINTS,
  FALSE_START_PENALTY,
  NO_ATTENDANCE_POINTS,
} from '../../core/constants';

describe('CalculatePointsUseCase', () => {
  let useCase: CalculatePointsUseCase;

  beforeEach(() => {
    useCase = new CalculatePointsUseCase();
  });

  describe('F1 top 10', () => {
    it.each([
      [1, 25],
      [2, 18],
      [3, 15],
      [4, 12],
      [5, 10],
      [6, 8],
      [7, 6],
      [8, 4],
      [9, 2],
      [10, 1],
    ])('P%i should give %i pts', (position, expected) => {
      const result = useCase.execute({ position, isFalseStart: false });
      expect(result.points).toBe(expected);
    });
  });

  describe('attendance (P11+)', () => {
    it('should give 1 pt at P11', () => {
      const result = useCase.execute({ position: 11, isFalseStart: false });
      expect(result.points).toBe(ATTENDANCE_POINTS);
    });

    it('should give 1 pt at P30', () => {
      const result = useCase.execute({ position: 30, isFalseStart: false });
      expect(result.points).toBe(ATTENDANCE_POINTS);
    });

    it('should give 1 pt at P100', () => {
      const result = useCase.execute({ position: 100, isFalseStart: false });
      expect(result.points).toBe(ATTENDANCE_POINTS);
    });
  });

  describe('false start', () => {
    it('should give -5 pts regardless of position', () => {
      const result = useCase.execute({ position: 0, isFalseStart: true });
      expect(result.points).toBe(FALSE_START_PENALTY);
    });

    it('should give -5 pts even if position has a value', () => {
      // defensive: false start always overrides
      const result = useCase.execute({ position: 1, isFalseStart: true });
      expect(result.points).toBe(FALSE_START_PENALTY);
    });
  });

  describe('no attendance', () => {
    it('should give 0 pts', () => {
      const result = useCase.noAttendance();
      expect(result.points).toBe(NO_ATTENDANCE_POINTS);
      expect(result.points).toBe(0);
    });
  });

  describe('F1_POINTS table integrity', () => {
    it('should have exactly 10 positions', () => {
      expect(F1_POINTS.length).toBe(10);
    });

    it('should be strictly decreasing', () => {
      for (let i = 1; i < F1_POINTS.length; i++) {
        expect(F1_POINTS[i]).toBeLessThan(F1_POINTS[i - 1]);
      }
    });

    it('should end above ATTENDANCE_POINTS (P10 > P11)', () => {
      expect(F1_POINTS[F1_POINTS.length - 1]).toBeGreaterThanOrEqual(
        ATTENDANCE_POINTS,
      );
    });
  });
});
