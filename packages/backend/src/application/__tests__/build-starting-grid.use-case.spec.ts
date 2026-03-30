import { BuildStartingGridUseCase } from '../build-starting-grid.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import { MeetParticipantData } from '../../core/ports/meet.provider.port';
import { DECAY_FACTOR, MAX_POINTS, MIN_POINTS } from '../../core/constants';

function pts(diffSeconds: number): number {
  return Math.max(MAX_POINTS * Math.exp(-diffSeconds / DECAY_FACTOR), MIN_POINTS);
}

describe('BuildStartingGridUseCase', () => {
  let useCase: BuildStartingGridUseCase;

  beforeEach(() => {
    useCase = new BuildStartingGridUseCase(new CalculatePointsUseCase());
  });

  const greenLight = new Date('2026-03-27T09:30:00.000Z');

  function participant(
    name: string,
    offsetMs: number,
  ): MeetParticipantData {
    return {
      googleParticipantId: `users/${name.toLowerCase().replace(' ', '-')}`,
      displayName: name,
      email: null,
      earliestStartTime: new Date(greenLight.getTime() + offsetMs),
    };
  }

  it('should sort participants by entry time and assign positions', () => {
    const participants = [
      participant('Charlie', 5000),
      participant('Alice', 1000),
      participant('Bob', 3000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid).toHaveLength(3);
    expect(grid[0].position).toBe(1);
    expect(grid[0].driver.displayName).toBe('Alice');
    expect(grid[1].position).toBe(2);
    expect(grid[1].driver.displayName).toBe('Bob');
    expect(grid[2].position).toBe(3);
    expect(grid[2].driver.displayName).toBe('Charlie');
  });

  it('should mark only the last participant as isLastOnGrid', () => {
    const participants = [
      participant('Alice', 1000),
      participant('Bob', 3000),
      participant('Charlie', 5000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].isLastOnGrid).toBe(false);
    expect(grid[1].isLastOnGrid).toBe(false);
    expect(grid[2].isLastOnGrid).toBe(true);
  });

  it('should mark early entries as false start', () => {
    const participants = [
      participant('Early', -5000),
      participant('OnTime', 1000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].driver.displayName).toBe('Early');
    expect(grid[0].isFalseStart).toBe(true);
    expect(grid[0].position).toBe(0);
    expect(grid[0].points).toBeCloseTo(-100);

    expect(grid[1].driver.displayName).toBe('OnTime');
    expect(grid[1].isFalseStart).toBe(false);
    expect(grid[1].position).toBe(1);
    expect(grid[1].points).toBeGreaterThan(0);
  });

  it('should calculate correct points for each position', () => {
    const participants = [
      participant('P1', 994),
      participant('P2', 3027),
      participant('P3', 86683),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].points).toBeCloseTo(pts(0.994), 1);
    expect(grid[1].points).toBeCloseTo(pts(3.027), 1);
    expect(grid[2].points).toBeCloseTo(pts(86.683), 1);
  });

  it('should handle single participant', () => {
    const participants = [participant('Solo', 2000)];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid).toHaveLength(1);
    expect(grid[0].position).toBe(1);
    expect(grid[0].isLastOnGrid).toBe(true);
  });

  it('should handle empty participants', () => {
    const grid = useCase.execute({ participants: [], greenLight });
    expect(grid).toHaveLength(0);
  });

  it('should not mutate the original participants array', () => {
    const participants = [
      participant('Bob', 3000),
      participant('Alice', 1000),
    ];
    const original = [...participants];

    useCase.execute({ participants, greenLight });

    expect(participants[0].displayName).toBe(original[0].displayName);
    expect(participants[1].displayName).toBe(original[1].displayName);
  });
});
