import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort } from '../../core/ports/notification.port';
import { Race } from '../../core/entities/race.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { DiscordFormatterService } from './discord-formatter.service';

const EMBED_SEND_DELAY_MS = 500;

@Injectable()
export class DiscordWebhookAdapter implements NotificationPort {
  private readonly logger = new Logger(DiscordWebhookAdapter.name);
  private readonly raceDayWebhook: string;
  private readonly championshipWebhook: string;

  constructor(
    config: ConfigService,
    private readonly formatter: DiscordFormatterService,
  ) {
    this.raceDayWebhook = config.getOrThrow('DISCORD_WEBHOOK_RACE_DAY');
    this.championshipWebhook = config.getOrThrow('DISCORD_WEBHOOK_CHAMPIONSHIP');
  }

  async publishRaceResults(race: Race): Promise<void> {
    const embeds = this.formatter.formatRaceEmbeds(race);

    for (let i = 0; i < embeds.length; i++) {
      await this.sendWebhook(
        { username: 'Daily Race', embeds: [embeds[i]] },
        this.raceDayWebhook,
      );
      if (i < embeds.length - 1) await this.sleep(EMBED_SEND_DELAY_MS);
    }
  }

  async publishChampionshipStandings(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): Promise<void> {
    const embed = this.formatter.formatChampionshipEmbed(standings, racesCount);
    if (!embed) return;

    await this.sendWebhook(
      { username: 'Daily Race', embeds: [embed] },
      this.championshipWebhook,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async sendWebhook(
    body: Record<string, unknown>,
    webhookUrl: string,
  ): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.error(
        `Discord webhook failed: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Discord webhook failed: ${response.status}`);
    }
  }
}
