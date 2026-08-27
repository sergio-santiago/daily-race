import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort } from '../../core/ports/notification.port';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { ChatFormatterService } from './chat-formatter.service';
import { ChatApiClient, CHAT_CLIENT } from './chat-api.client';

/** Delay entre mensajes consecutivos al mismo space (Google Chat limit: 1 req/s/space). */
const MULTI_MESSAGE_DELAY_MS = 1100;

/**
 * Adapter de NotificationPort para Google Chat App (Service Account + chat.bot scope).
 *
 * Soporta el patron live-edit completo: createMessage devuelve el resource name,
 * editLiveRaceMessage hace PATCH con updateMask=cardsV2,text.
 */
@Injectable()
export class ChatAppAdapter implements NotificationPort {
  private readonly logger = new Logger(ChatAppAdapter.name);
  private readonly raceDaySpace: string;
  private readonly championshipSpace: string;

  constructor(
    config: ConfigService,
    @Inject(CHAT_CLIENT) private readonly chat: ChatApiClient,
    private readonly formatter: ChatFormatterService,
  ) {
    this.raceDaySpace = config.getOrThrow('GOOGLE_CHAT_SPACE_RACE_DAY');
    this.championshipSpace = config.getOrThrow('GOOGLE_CHAT_SPACE_CHAMPIONSHIP');
  }

  async publishRaceResults(race: Race): Promise<void> {
    const message = this.formatter.formatRaceMessage(race);
    try {
      await this.chat.createMessage(this.raceDaySpace, message);
    } catch (error) {
      this.logger.error(`Failed to publish race results to Google Chat: ${error}`);
      throw error;
    }
  }

  async publishChampionshipStandings(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): Promise<void> {
    const messages = this.formatter.formatChampionshipMessages(standings, racesCount);
    if (messages.length === 0) return;

    for (let i = 0; i < messages.length; i++) {
      try {
        await this.chat.createMessage(this.championshipSpace, messages[i]);
      } catch (error) {
        this.logger.error(`Failed to publish championship part ${i + 1} to Google Chat: ${error}`);
        throw error;
      }
      if (i < messages.length - 1) {
        await this.sleep(MULTI_MESSAGE_DELAY_MS);
      }
    }
  }

  async createLiveRaceMessage(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<string> {
    const message = this.formatter.formatLiveRaceMessage(grid, greenLight);
    try {
      return await this.chat.createMessage(this.raceDaySpace, message);
    } catch (error) {
      this.logger.error(`Failed to create live race message in Google Chat: ${error}`);
      throw error;
    }
  }

  async editLiveRaceMessage(
    messageId: string,
    grid: StartingGridEntry[],
    greenLight: Date,
  ): Promise<void> {
    const message = this.formatter.formatLiveRaceMessage(grid, greenLight);
    try {
      await this.chat.patchMessage(messageId, 'cardsV2,text', message);
    } catch (error) {
      this.logger.error(`Failed to edit live race message in Google Chat: ${error}`);
      throw error;
    }
  }

  async editLiveRaceMessageAsFinal(
    messageId: string,
    race: Race,
  ): Promise<void> {
    const message = this.formatter.formatRaceMessage(race);
    try {
      await this.chat.patchMessage(messageId, 'cardsV2,text', message);
    } catch (error) {
      this.logger.error(`Failed to finalize live race message in Google Chat: ${error}`);
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
