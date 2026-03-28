import { CalculatePointsUseCase } from '../calculate-points.use-case';
import {
  DECAY_FACTOR,
  MAX_POINTS,
  MIN_POINTS,
} from '@daily-race/shared';

function pts(diffSeconds: number): number {
  return Math.max(MAX_POINTS * Math.exp(-diffSeconds / DECAY_FACTOR), MIN_POINTS);
}

describe('CalculatePointsUseCase', () => {
  let useCase: CalculatePointsUseCase;

  beforeEach(() => {
    useCase = new CalculatePointsUseCase();
  });

  const greenLight = new Date('2026-03-27T09:00:00.000Z');

  function entryAt(offsetMs: number): Date {
    return new Date(greenLight.getTime() + offsetMs);
  }

  describe('false start (entry before green light)', () => {
    it('should penalize -10 pts for 0.5s early', () => {
      const result = useCase.execute({
        entryTime: entryAt(-500),
        scheduledTime: greenLight,
      });
      expect(result.isFalseStart).toBe(true);
      expect(result.diffSeconds).toBeCloseTo(-0.5);
      expect(result.points).toBeCloseTo(-10);
    });

    it('should penalize -20 pts for 1s early', () => {
      const result = useCase.execute({
        entryTime: entryAt(-1000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(-20);
    });

    it('should penalize -100 pts for 5s early', () => {
      const result = useCase.execute({
        entryTime: entryAt(-5000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(-100);
    });

    it('should penalize -600 pts for 30s early (no cap)', () => {
      const result = useCase.execute({
        entryTime: entryAt(-30000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(-600);
    });

    it('should penalize -1200 pts for 60s early', () => {
      const result = useCase.execute({
        entryTime: entryAt(-60000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(-1200);
    });
  });

  describe('on time (0-300 seconds window)', () => {
    it('should give 100 pts at exactly green light', () => {
      const result = useCase.execute({
        entryTime: greenLight,
        scheduledTime: greenLight,
      });
      expect(result.isFalseStart).toBe(false);
      expect(result.points).toBeCloseTo(100);
    });

    it('should give ~96.72 pts at +0.5s', () => {
      const result = useCase.execute({
        entryTime: entryAt(500),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(0.5), 2);
    });

    it('should give ~93.56 pts at +1s', () => {
      const result = useCase.execute({
        entryTime: entryAt(1000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(1), 2);
    });

    it('should give ~87.53 pts at +2s', () => {
      const result = useCase.execute({
        entryTime: entryAt(2000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(2), 2);
    });

    it('should give ~51.34 pts at +10s', () => {
      const result = useCase.execute({
        entryTime: entryAt(10000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(10), 2);
    });

    it('should give ~13.53 pts at +30s', () => {
      const result = useCase.execute({
        entryTime: entryAt(30000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(30), 2);
    });

    it('should give ~1.83 pts at +60s', () => {
      const result = useCase.execute({
        entryTime: entryAt(60000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBeCloseTo(pts(60), 2);
    });

    it('should give min points at +300s (edge of window, raw < min)', () => {
      const result = useCase.execute({
        entryTime: entryAt(300000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBe(MIN_POINTS);
    });
  });

  describe('late (after 5 min window)', () => {
    it('should give MIN_POINTS at +301s', () => {
      const result = useCase.execute({
        entryTime: entryAt(301000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBe(MIN_POINTS);
      expect(result.isFalseStart).toBe(false);
    });

    it('should give MIN_POINTS at +10 min', () => {
      const result = useCase.execute({
        entryTime: entryAt(600000),
        scheduledTime: greenLight,
      });
      expect(result.points).toBe(MIN_POINTS);
    });
  });

  describe('no attendance', () => {
    it('should give 0 pts', () => {
      const result = useCase.noAttendance();
      expect(result.points).toBe(0);
      expect(result.isFalseStart).toBe(false);
    });
  });

  describe('real data from 27 march daily', () => {
    const dailyGreenLight = new Date('2026-03-27T09:30:00.000Z');

    it('P1 Inma Molina +0.994s', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:30:00.994Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBeCloseTo(pts(0.994), 1);
    });

    it('P10 Ale Ramos +3.027s', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:30:03.027Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBeCloseTo(pts(3.027), 1);
    });

    it('P20 Natalia Alvarez +7.869s', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:30:07.869Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBeCloseTo(pts(7.869), 1);
    });

    it('P30 Alberto Aznar +30.095s', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:30:30.095Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBeCloseTo(pts(30.095), 1);
    });

    it('P40 Sergio Santiago +86.683s', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:31:26.683Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBeCloseTo(pts(86.683), 1);
    });

    it('P46 David Luque +440.555s (fuera de ventana → min pts)', () => {
      const result = useCase.execute({
        entryTime: new Date('2026-03-27T09:37:20.555Z'),
        scheduledTime: dailyGreenLight,
      });
      expect(result.points).toBe(MIN_POINTS);
    });
  });
});
