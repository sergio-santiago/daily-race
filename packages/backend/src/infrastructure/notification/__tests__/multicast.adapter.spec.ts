import {
  MulticastNotificationAdapter,
  encodeMessageId,
  decodeMessageId,
} from '../multicast.adapter';
import { DiscordWebhookAdapter } from '../../discord/webhook.adapter';
import { ChatAppAdapter } from '../../google-chat/chat-app.adapter';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';

function makeEntry(): StartingGridEntry {
  const gl = new Date('2026-04-28T07:30:00Z');
  return new StartingGridEntry(
    1,
    new Driver('d1', 'g1', 'Alice', null),
    new Date(gl.getTime() + 1000),
    gl,
    25,
    false,
    false,
  );
}

function makeRace(): Race {
  return new Race(
    'race-1',
    'conf/1',
    'abc',
    new Date('2026-04-28T07:30:00Z'),
    new Date('2026-04-28T07:35:00Z'),
    RaceStatus.PROCESSED,
    [makeEntry()],
    new Date(),
  );
}

function makeStanding(): ChampionshipStanding {
  return new ChampionshipStanding(
    new Driver('d1', 'g1', 'Alice', null),
    100,
    1,
    0,
    1,
    1,
    1,
    1,
  );
}

describe('messageId encoding/decoding', () => {
  it('roundtrips both ids', () => {
    const encoded = encodeMessageId({
      discord: '12345',
      google: 'spaces/AAA/messages/BBB.BBB',
    });
    expect(decodeMessageId(encoded)).toEqual({
      discord: '12345',
      google: 'spaces/AAA/messages/BBB.BBB',
    });
  });

  it('roundtrips with one null', () => {
    const encoded = encodeMessageId({ discord: '999', google: null });
    expect(decodeMessageId(encoded)).toEqual({ discord: '999', google: null });
  });

  it('falls back to discord-only for legacy ids', () => {
    expect(decodeMessageId('legacy-discord-id-12345')).toEqual({
      discord: 'legacy-discord-id-12345',
      google: null,
    });
  });
});

describe('MulticastNotificationAdapter', () => {
  let discord: jest.Mocked<DiscordWebhookAdapter>;
  let chat: jest.Mocked<ChatAppAdapter>;
  let adapter: MulticastNotificationAdapter;

  beforeEach(() => {
    discord = {
      publishRaceResults: jest.fn().mockResolvedValue(undefined),
      publishChampionshipStandings: jest.fn().mockResolvedValue(undefined),
      createLiveRaceMessage: jest.fn().mockResolvedValue('discord-msg-1'),
      editLiveRaceMessage: jest.fn().mockResolvedValue(undefined),
      editLiveRaceMessageAsFinal: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DiscordWebhookAdapter>;

    chat = {
      publishRaceResults: jest.fn().mockResolvedValue(undefined),
      publishChampionshipStandings: jest.fn().mockResolvedValue(undefined),
      createLiveRaceMessage: jest.fn().mockResolvedValue('spaces/X/messages/Y.Y'),
      editLiveRaceMessage: jest.fn().mockResolvedValue(undefined),
      editLiveRaceMessageAsFinal: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ChatAppAdapter>;

    adapter = new MulticastNotificationAdapter(discord, chat);
  });

  describe('publishRaceResults', () => {
    it('fans out to both delegates', async () => {
      await adapter.publishRaceResults(makeRace());
      expect(discord.publishRaceResults).toHaveBeenCalledTimes(1);
      expect(chat.publishRaceResults).toHaveBeenCalledTimes(1);
    });

    it('does not throw when one delegate fails', async () => {
      chat.publishRaceResults.mockRejectedValueOnce(new Error('chat down'));
      await expect(adapter.publishRaceResults(makeRace())).resolves.toBeUndefined();
      expect(discord.publishRaceResults).toHaveBeenCalled();
    });
  });

  describe('publishChampionshipStandings', () => {
    it('fans out to both delegates', async () => {
      await adapter.publishChampionshipStandings([makeStanding()], 1);
      expect(discord.publishChampionshipStandings).toHaveBeenCalled();
      expect(chat.publishChampionshipStandings).toHaveBeenCalled();
    });

    it('tolerates failures in either delegate', async () => {
      discord.publishChampionshipStandings.mockRejectedValueOnce(new Error('discord down'));
      await expect(
        adapter.publishChampionshipStandings([makeStanding()], 1),
      ).resolves.toBeUndefined();
    });
  });

  describe('createLiveRaceMessage', () => {
    it('returns composite messageId encoding both delegate ids', async () => {
      const id = await adapter.createLiveRaceMessage([makeEntry()], new Date('2026-04-28T07:30:00Z'));
      const decoded = decodeMessageId(id);
      expect(decoded).toEqual({
        discord: 'discord-msg-1',
        google: 'spaces/X/messages/Y.Y',
      });
    });

    it('returns id with discord:null when chat fails', async () => {
      chat.createLiveRaceMessage.mockRejectedValueOnce(new Error('chat 503'));
      const id = await adapter.createLiveRaceMessage([makeEntry()], new Date('2026-04-28T07:30:00Z'));
      expect(decodeMessageId(id)).toEqual({
        discord: 'discord-msg-1',
        google: null,
      });
    });
  });

  describe('editLiveRaceMessage', () => {
    it('routes to each delegate with its own id', async () => {
      const compositeId = encodeMessageId({
        discord: 'd123',
        google: 'spaces/X/messages/Y.Y',
      });
      await adapter.editLiveRaceMessage(compositeId, [makeEntry()], new Date('2026-04-28T07:30:00Z'));

      expect(discord.editLiveRaceMessage).toHaveBeenCalledWith(
        'd123',
        expect.any(Array),
        expect.any(Date),
      );
      expect(chat.editLiveRaceMessage).toHaveBeenCalledWith(
        'spaces/X/messages/Y.Y',
        expect.any(Array),
        expect.any(Date),
      );
    });

    it('skips a delegate when its id is null', async () => {
      const compositeId = encodeMessageId({ discord: 'd123', google: null });
      await adapter.editLiveRaceMessage(compositeId, [makeEntry()], new Date('2026-04-28T07:30:00Z'));

      expect(discord.editLiveRaceMessage).toHaveBeenCalled();
      expect(chat.editLiveRaceMessage).not.toHaveBeenCalled();
    });

    it('tolerates failure in one delegate', async () => {
      const compositeId = encodeMessageId({
        discord: 'd123',
        google: 'spaces/X/messages/Y.Y',
      });
      chat.editLiveRaceMessage.mockRejectedValueOnce(new Error('chat 503'));
      await expect(
        adapter.editLiveRaceMessage(compositeId, [makeEntry()], new Date('2026-04-28T07:30:00Z')),
      ).resolves.toBeUndefined();
    });
  });

  describe('editLiveRaceMessageAsFinal', () => {
    it('routes finalize to each delegate', async () => {
      const compositeId = encodeMessageId({
        discord: 'd123',
        google: 'spaces/X/messages/Y.Y',
      });
      await adapter.editLiveRaceMessageAsFinal(compositeId, makeRace());

      expect(discord.editLiveRaceMessageAsFinal).toHaveBeenCalledWith('d123', expect.any(Race));
      expect(chat.editLiveRaceMessageAsFinal).toHaveBeenCalledWith(
        'spaces/X/messages/Y.Y',
        expect.any(Race),
      );
    });
  });
});
