import { LiveRaceController } from '../live-race.controller';
import {
  LiveRaceSnapshot,
  MonitorLiveRaceUseCase,
} from '../../application/monitor-live-race.use-case';
import { Driver } from '../../core/entities/driver.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';

function buildMonitorStub(snapshot: LiveRaceSnapshot): MonitorLiveRaceUseCase {
  return {
    getLiveSnapshot: () => snapshot,
  } as unknown as MonitorLiveRaceUseCase;
}

describe('LiveRaceController', () => {
  describe('IDLE state', () => {
    it('returns IDLE snapshot serialized', () => {
      const fetchedAt = new Date('2026-04-28T10:00:00Z');
      const monitor = buildMonitorStub({
        status: 'IDLE',
        fetchedAt,
        meetingCode: null,
        greenLight: null,
        participantCount: 0,
        grid: [],
        lastUpdatedAt: null,
      });
      const controller = new LiveRaceController(monitor);

      const result = controller.getCurrent();

      expect(result.status).toBe('IDLE');
      expect(result.fetchedAt).toBe(fetchedAt.toISOString());
      expect(result.meetingCode).toBeNull();
      expect(result.greenLight).toBeNull();
      expect(result.participantCount).toBe(0);
      expect(result.grid).toEqual([]);
      expect(result.lastUpdatedAt).toBeNull();
    });
  });

  describe('LIVE state', () => {
    it('returns LIVE snapshot with serialized grid', () => {
      const greenLight = new Date('2026-04-28T07:30:00Z');
      const startTime = new Date('2026-04-28T07:30:01Z');
      const fetchedAt = new Date('2026-04-28T07:31:00Z');
      const lastUpdatedAt = new Date('2026-04-28T07:30:55Z');

      const grid: StartingGridEntry[] = [
        new StartingGridEntry(
          1,
          new Driver('d1', 'g1', 'Alice', 'alice@secture.com'),
          startTime,
          greenLight,
          25,
          false,
          false,
        ),
      ];

      const monitor = buildMonitorStub({
        status: 'LIVE',
        fetchedAt,
        meetingCode: 'wye-iwfu-jch',
        greenLight,
        participantCount: 1,
        grid,
        lastUpdatedAt,
      });
      const controller = new LiveRaceController(monitor);

      const result = controller.getCurrent();

      expect(result.status).toBe('LIVE');
      expect(result.meetingCode).toBe('wye-iwfu-jch');
      expect(result.greenLight).toBe(greenLight.toISOString());
      expect(result.lastUpdatedAt).toBe(lastUpdatedAt.toISOString());
      expect(result.participantCount).toBe(1);
      expect(result.grid).toHaveLength(1);

      const entry = result.grid[0];
      expect(entry.position).toBe(1);
      expect(entry.driver).toEqual({
        id: 'd1',
        googleId: 'g1',
        displayName: 'Alice',
        email: 'alice@secture.com',
      });
      expect(entry.startTime).toBe(startTime.toISOString());
      expect(entry.greenLight).toBe(greenLight.toISOString());
      expect(entry.diffSeconds).toBe(1);
      expect(entry.points).toBe(25);
      expect(entry.isFalseStart).toBe(false);
      expect(entry.isWorstOnGrid).toBe(false);
    });
  });
});
