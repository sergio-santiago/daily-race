import { BuildStartingGridUseCase } from '../build-starting-grid.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import { MeetParticipantData } from '../../core/ports/meet.provider.port';
import {
  F1_POINTS,
  ATTENDANCE_POINTS,
  FALSE_START_PENALTY,
} from '../../core/constants';

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

  it('should mark early entries as false start with -5 pts', () => {
    const participants = [
      participant('Early', -5000),
      participant('OnTime', 1000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].driver.displayName).toBe('Early');
    expect(grid[0].isFalseStart).toBe(true);
    expect(grid[0].position).toBe(0);
    expect(grid[0].points).toBe(FALSE_START_PENALTY);

    expect(grid[1].driver.displayName).toBe('OnTime');
    expect(grid[1].isFalseStart).toBe(false);
    expect(grid[1].position).toBe(1);
    expect(grid[1].points).toBe(F1_POINTS[0]); // P1 = 25
  });

  it('should give flat -5 pts regardless of how early the false start is', () => {
    const participants = [
      participant('FiveEarly', -5000),
      participant('OneMinEarly', -60000),
      participant('OnTime', 1000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].points).toBe(FALSE_START_PENALTY);
    expect(grid[1].points).toBe(FALSE_START_PENALTY);
    expect(grid[2].points).toBe(F1_POINTS[0]);
  });

  it('should assign F1 points to top 10 clean grid', () => {
    const participants = Array.from({ length: 10 }, (_, i) =>
      participant(`P${i + 1}`, (i + 1) * 1000),
    );

    const grid = useCase.execute({ participants, greenLight });

    grid.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1);
      expect(entry.points).toBe(F1_POINTS[i]);
    });
  });

  it('should give 1 pt (attendance) to positions beyond top 10', () => {
    const participants = Array.from({ length: 15 }, (_, i) =>
      participant(`P${i + 1}`, (i + 1) * 1000),
    );

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[9].position).toBe(10);
    expect(grid[9].points).toBe(F1_POINTS[9]); // P10 = 1 (matches attendance)
    expect(grid[10].position).toBe(11);
    expect(grid[10].points).toBe(ATTENDANCE_POINTS);
    expect(grid[14].position).toBe(15);
    expect(grid[14].points).toBe(ATTENDANCE_POINTS);
  });

  it('should skip false starts when counting positions', () => {
    const participants = [
      participant('FalseA', -3000),
      participant('FalseB', -1000),
      participant('P1Real', 500),
      participant('P2Real', 1500),
      participant('P3Real', 3000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    // Sorted: FalseA, FalseB, P1Real, P2Real, P3Real
    expect(grid[0].isFalseStart).toBe(true);
    expect(grid[0].position).toBe(0);
    expect(grid[1].isFalseStart).toBe(true);
    expect(grid[1].position).toBe(0);
    expect(grid[2].position).toBe(1);
    expect(grid[2].points).toBe(F1_POINTS[0]); // 25
    expect(grid[3].position).toBe(2);
    expect(grid[3].points).toBe(F1_POINTS[1]); // 18
    expect(grid[4].position).toBe(3);
    expect(grid[4].points).toBe(F1_POINTS[2]); // 15
  });

  it('should handle single participant', () => {
    const participants = [participant('Solo', 2000)];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid).toHaveLength(1);
    expect(grid[0].position).toBe(1);
    expect(grid[0].isLastOnGrid).toBe(true);
    expect(grid[0].points).toBe(F1_POINTS[0]);
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
