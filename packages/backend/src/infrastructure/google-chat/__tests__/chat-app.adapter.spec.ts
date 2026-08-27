import { ChatAppAdapter } from '../chat-app.adapter';
import { ChatFormatterService } from '../chat-formatter.service';
import { ChatApiClient } from '../chat-api.client';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';
import { ConfigService } from '@nestjs/config';

const RACE_DAY_SPACE = 'spaces/raceday-test';
const CHAMP_SPACE = 'spaces/champ-test';

function buildConfigStub(): ConfigService {
  const map: Record<string, string> = {
    GOOGLE_CHAT_SPACE_RACE_DAY: RACE_DAY_SPACE,
    GOOGLE_CHAT_SPACE_CHAMPIONSHIP: CHAMP_SPACE,
  };
  return {
    getOrThrow: (key: string) => {
      if (!(key in map)) throw new Error(`Missing config: ${key}`);
      return map[key];
    },
    get: (key: string) => map[key],
  } as unknown as ConfigService;
}

function makeChatClientMock(): jest.Mocked<ChatApiClient> {
  return {
    createMessage: jest.fn().mockResolvedValue('spaces/raceday-test/messages/abc.def'),
    patchMessage: jest.fn().mockResolvedValue(undefined),
  };
}

function makeEntry(
  position: number,
  name: string,
  points: number,
  diffSeconds: number,
  isFalseStart = false,
  isWorstOnGrid = false,
): StartingGridEntry {
  const gl = new Date('2026-04-28T07:30:00Z');
  return new StartingGridEntry(
    position,
    new Driver(`d${position}`, `g${position}`, name, null),
    new Date(gl.getTime() + diffSeconds * 1000),
    gl,
    points,
    isFalseStart,
    isWorstOnGrid,
  );
}

function makeRace(entries: StartingGridEntry[]): Race {
  return new Race(
    'race-x',
    'conf/x',
    'abc-defg-hij',
    new Date('2026-04-28T07:30:00Z'),
    new Date('2026-04-28T07:35:00Z'),
    RaceStatus.PROCESSED,
    entries,
    new Date(),
  );
}

describe('ChatAppAdapter', () => {
  let adapter: ChatAppAdapter;
  let client: jest.Mocked<ChatApiClient>;

  beforeEach(() => {
    client = makeChatClientMock();
    adapter = new ChatAppAdapter(buildConfigStub(), client, new ChatFormatterService());
  });

  describe('publishRaceResults', () => {
    it('posts to the race-day space', async () => {
      const race = makeRace([makeEntry(1, 'Alice', 25, 1.0)]);

      await adapter.publishRaceResults(race);

      expect(client.createMessage).toHaveBeenCalledTimes(1);
      const [parent, body] = client.createMessage.mock.calls[0];
      expect(parent).toBe(RACE_DAY_SPACE);
      expect(body.cardsV2).toHaveLength(1);
      expect(body.cardsV2![0].cardId).toBe('race-race-x');
    });
  });

  describe('publishChampionshipStandings', () => {
    it('returns silently for empty standings', async () => {
      await adapter.publishChampionshipStandings([], 0);
      expect(client.createMessage).not.toHaveBeenCalled();
    });

    it('posts to championship space', async () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Alice', null), 100, 1, 0, 1, 1, 1, 1),
      ];
      await adapter.publishChampionshipStandings(standings, 1);

      expect(client.createMessage).toHaveBeenCalledTimes(1);
      const [parent] = client.createMessage.mock.calls[0];
      expect(parent).toBe(CHAMP_SPACE);
    });

    it('posts multiple messages with delay for large championships', async () => {
      jest.useFakeTimers();
      const standings = Array.from(
        { length: 75 },
        (_, i) =>
          new ChampionshipStanding(
            new Driver(`d${i}`, `g${i}`, `D${i}`, null),
            100 - i,
            10,
            0,
            i + 1,
            i + 1,
          ),
      );
      const promise = adapter.publishChampionshipStandings(standings, 10);
      // First message goes immediately
      await Promise.resolve();
      expect(client.createMessage).toHaveBeenCalledTimes(1);

      // Advance timers for the delays between messages.
      await jest.advanceTimersByTimeAsync(2200);
      await promise;

      expect(client.createMessage).toHaveBeenCalledTimes(2); // 75 / 50 = 2 chunks
      jest.useRealTimers();
    });
  });

  describe('createLiveRaceMessage', () => {
    it('returns the messageId from the API response', async () => {
      const grid = [makeEntry(1, 'Alice', 25, 1.0)];
      client.createMessage.mockResolvedValueOnce('spaces/raceday-test/messages/live.123');

      const id = await adapter.createLiveRaceMessage(grid, new Date('2026-04-28T07:30:00Z'));

      expect(id).toBe('spaces/raceday-test/messages/live.123');
      expect(client.createMessage).toHaveBeenCalledWith(
        RACE_DAY_SPACE,
        expect.objectContaining({ cardsV2: expect.any(Array) }),
      );
    });
  });

  describe('editLiveRaceMessage', () => {
    it('patches with updateMask=cardsV2,text', async () => {
      const grid = [makeEntry(1, 'Alice', 25, 1.0)];
      const messageId = 'spaces/raceday-test/messages/live.123';

      await adapter.editLiveRaceMessage(messageId, grid, new Date('2026-04-28T07:30:00Z'));

      expect(client.patchMessage).toHaveBeenCalledTimes(1);
      const [name, mask, body] = client.patchMessage.mock.calls[0];
      expect(name).toBe(messageId);
      expect(mask).toBe('cardsV2,text');
      expect(body.cardsV2).toBeDefined();
    });
  });

  describe('editLiveRaceMessageAsFinal', () => {
    it('patches with race card body', async () => {
      const race = makeRace([makeEntry(1, 'Alice', 25, 1.0)]);
      const messageId = 'spaces/raceday-test/messages/live.123';

      await adapter.editLiveRaceMessageAsFinal(messageId, race);

      expect(client.patchMessage).toHaveBeenCalledTimes(1);
      const [name, mask, body] = client.patchMessage.mock.calls[0];
      expect(name).toBe(messageId);
      expect(mask).toBe('cardsV2,text');
      // Es la card de race finalizada, NO la de live: titulo no debe contener LIVE
      expect(body.cardsV2![0].cardId).toBe('race-race-x');
    });
  });

  describe('error handling', () => {
    it('propagates createMessage errors after logging', async () => {
      client.createMessage.mockRejectedValueOnce(new Error('boom'));
      const race = makeRace([makeEntry(1, 'Alice', 25, 1.0)]);
      await expect(adapter.publishRaceResults(race)).rejects.toThrow('boom');
    });

    it('propagates patchMessage errors after logging', async () => {
      client.patchMessage.mockRejectedValueOnce(new Error('boom'));
      const grid = [makeEntry(1, 'Alice', 25, 1.0)];
      await expect(
        adapter.editLiveRaceMessage('spaces/x/messages/y', grid, new Date('2026-04-28T07:30:00Z')),
      ).rejects.toThrow('boom');
    });
  });
});
