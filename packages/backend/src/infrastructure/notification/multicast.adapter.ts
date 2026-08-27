import { Injectable, Logger } from '@nestjs/common';
import { NotificationPort } from '../../core/ports/notification.port';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { DiscordWebhookAdapter } from '../discord/webhook.adapter';
import { ChatAppAdapter } from '../google-chat/chat-app.adapter';

interface CompositeMessageId {
  discord: string | null;
  google: string | null;
}

/** Encoding/decoding del messageId compuesto durante el periodo de dual-write. */
export function encodeMessageId(parts: CompositeMessageId): string {
  return Buffer.from(JSON.stringify(parts)).toString('base64url');
}

export function decodeMessageId(encoded: string): CompositeMessageId {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8'),
    );
    if (
      parsed &&
      typeof parsed === 'object' &&
      ('discord' in parsed || 'google' in parsed)
    ) {
      return {
        discord: typeof parsed.discord === 'string' ? parsed.discord : null,
        google: typeof parsed.google === 'string' ? parsed.google : null,
      };
    }
  } catch {
    // Fallthrough: legacy id puro (Discord pre-multicast).
  }
  // Legacy fallback: un id puro proveniente de antes del multicast.
  return { discord: encoded, google: null };
}

/**
 * Fan-out a Discord + Google Chat durante la transicion.
 * Tolerante a fallos: un delegate roto no rompe al otro.
 *
 * Para los metodos live (create/edit), retorna un messageId compuesto opaco
 * que codifica los ids de cada delegate. Los use-cases lo guardan tal cual y
 * lo devuelven en los edit posteriores; el adapter lo decodifica internamente.
 */
@Injectable()
export class MulticastNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(MulticastNotificationAdapter.name);

  constructor(
    private readonly discord: DiscordWebhookAdapter,
    private readonly chat: ChatAppAdapter,
  ) {}

  async publishRaceResults(race: Race): Promise<void> {
    const results = await Promise.allSettled([
      this.discord.publishRaceResults(race),
      this.chat.publishRaceResults(race),
    ]);
    this.logRejections('publishRaceResults', results);
  }

  async publishChampionshipStandings(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.discord.publishChampionshipStandings(standings, racesCount),
      this.chat.publishChampionshipStandings(standings, racesCount),
    ]);
    this.logRejections('publishChampionshipStandings', results);
  }

  async createLiveRaceMessage(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<string> {
    const [discordRes, chatRes] = await Promise.allSettled([
      this.discord.createLiveRaceMessage(grid, greenLight),
      this.chat.createLiveRaceMessage(grid, greenLight),
    ]);

    if (discordRes.status === 'rejected') {
      this.logger.warn(`Discord createLiveRaceMessage failed: ${discordRes.reason}`);
    }
    if (chatRes.status === 'rejected') {
      this.logger.warn(`Chat createLiveRaceMessage failed: ${chatRes.reason}`);
    }

    return encodeMessageId({
      discord: discordRes.status === 'fulfilled' ? discordRes.value : null,
      google: chatRes.status === 'fulfilled' ? chatRes.value : null,
    });
  }

  async editLiveRaceMessage(
    messageId: string,
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<void> {
    const ids = decodeMessageId(messageId);
    const ops: Promise<void>[] = [];
    if (ids.discord) {
      ops.push(this.discord.editLiveRaceMessage(ids.discord, grid, greenLight));
    }
    if (ids.google) {
      ops.push(this.chat.editLiveRaceMessage(ids.google, grid, greenLight));
    }
    const results = await Promise.allSettled(ops);
    this.logRejections('editLiveRaceMessage', results);
  }

  async editLiveRaceMessageAsFinal(
    messageId: string,
    race: Race,
  ): Promise<void> {
    const ids = decodeMessageId(messageId);
    const ops: Promise<void>[] = [];
    if (ids.discord) {
      ops.push(this.discord.editLiveRaceMessageAsFinal(ids.discord, race));
    }
    if (ids.google) {
      ops.push(this.chat.editLiveRaceMessageAsFinal(ids.google, race));
    }
    const results = await Promise.allSettled(ops);
    this.logRejections('editLiveRaceMessageAsFinal', results);
  }

  private logRejections(
    operation: string,
    results: PromiseSettledResult<unknown>[],
  ): void {
    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.warn(`${operation} failed in one delegate: ${r.reason}`);
      }
    }
  }
}
