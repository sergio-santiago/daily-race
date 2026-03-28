import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationPort } from '../../core/ports/notification.port';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { WINDOW_SECONDS } from '@daily-race/shared';

@Injectable()
export class DiscordWebhookAdapter implements NotificationPort {
  private readonly logger = new Logger(DiscordWebhookAdapter.name);
  private readonly raceDayWebhook: string;
  private readonly championshipWebhook: string;

  constructor(config: ConfigService) {
    this.raceDayWebhook = config.getOrThrow('DISCORD_WEBHOOK_RACE_DAY');
    this.championshipWebhook = config.getOrThrow('DISCORD_WEBHOOK_CHAMPIONSHIP');
  }

  // ── Race Results ───────────────────────────────────────────

  async publishRaceResults(race: Race): Promise<void> {
    const grid = race.startingGrid;
    const dateStr = race.greenLight.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Madrid',
    });
    const timeStr = race.greenLight.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    });

    const falseStarters = grid.filter((e) => e.isFalseStart);
    const cleanGrid = grid.filter((e) => !e.isFalseStart);
    const lateCount = grid.filter((e) => e.diffSeconds > WINDOW_SECONDS).length;
    const bestDriver = cleanGrid[0];
    const lastDriver = grid[grid.length - 1];

    // Build grid text
    const sections: string[] = [];

    if (falseStarters.length > 0) {
      sections.push('SALIDA EN FALSO');
      sections.push('\u2500'.repeat(46));
      for (const e of falseStarters) sections.push(this.formatRow(e));
      sections.push('');
    }

    sections.push('PARRILLA DE SALIDA');
    sections.push('\u2500'.repeat(46));
    for (const e of cleanGrid) sections.push(this.formatRow(e));

    const gridText = sections.join('\n');
    const chunks = this.chunkText(gridText, 4000);

    // Build stats
    const statsLines: string[] = [];
    statsLines.push(
      `\u{1F7E2} Green Light: **${timeStr}** \u{00B7} **${grid.length}** pilotos`,
    );
    if (bestDriver) {
      statsLines.push(
        `\u{1F3C6} **${bestDriver.driver.displayName}** \u{2014} ${bestDriver.points.toFixed(2)} pts`,
      );
    }
    if (lastDriver) {
      statsLines.push(
        `\u{1F4A3} **${lastDriver.driver.displayName}** \u{2014} ${this.formatDiff(lastDriver.diffSeconds).trim()}`,
      );
    }
    if (falseStarters.length > 0) {
      const fsNames = falseStarters.map((e) => e.driver.displayName).join(', ');
      statsLines.push(`\u{26D4} ${falseStarters.length === 1 ? 'Salida en falso' : 'Salidas en falso'}: ${fsNames}`);
    }
    if (lateCount > 0) {
      statsLines.push(`\u{1F40C} **${lateCount}** fuera de ventana`);
    }

    // Send
    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;

      const embed: Record<string, unknown> = {
        color: 0x3498db,
        description: `\`\`\`\n${chunks[i]}\n\`\`\``,
      };

      if (isFirst) {
        embed.title = `\u{1F3C1} DAILY RACE \u{2014} ${dateStr}`;
      }
      if (isLast) {
        embed.fields = [{ name: '', value: statsLines.join('\n'), inline: false }];
        embed.footer = { text: 'Daily Race \u{2014} Secture' };
        embed.timestamp = new Date().toISOString();
      }

      await this.sendWebhook({ username: 'Daily Race', embeds: [embed] });
      if (!isLast) await this.sleep(500);
    }
  }

  // ── Championship ───────────────────────────────────────────

  async publishChampionshipStandings(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): Promise<void> {
    if (standings.length === 0) return;

    const top = standings.slice(0, 20);

    const rows = top.map((s) => {
      const pos = this.podiumLabel(s.rank);
      const name = this.truncate(s.driver.displayName, 22);
      const pts = s.totalPoints.toFixed(2).padStart(8);
      const races = String(s.racesAttended).padStart(2);
      const avg = (s.totalPoints / s.racesAttended).toFixed(2).padStart(7);
      return `${pos} ${name} ${pts} ${races} ${avg}`;
    });

    const header =
      '     ' +
      'Piloto'.padEnd(22) +
      ' ' +
      'Total'.padStart(8) +
      ' ' +
      'GP'.padStart(2) +
      ' ' +
      'Media'.padStart(7);
    const separator = '\u2500'.repeat(header.length);
    const gridText = [header, separator, ...rows].join('\n');

    const raceWord = racesCount === 1 ? 'carrera disputada' : 'carreras disputadas';

    const embed: Record<string, unknown> = {
      title: '\u{1F3C6} CHAMPIONSHIP \u{2014} Clasificaci\u00f3n general',
      color: 0xffd700,
      description: `\`\`\`\n${gridText}\n\`\`\``,
      fields: [{
        name: '',
        value: `\u{1F3CE}\u{FE0F} **${racesCount}** ${raceWord} \u{00B7} \u{1F465} **${standings.length}** pilotos`,
        inline: false,
      }],
      footer: { text: 'Daily Race \u{2014} Secture' },
      timestamp: new Date().toISOString(),
    };

    await this.sendWebhook(
      { username: 'Daily Race', embeds: [embed] },
      this.championshipWebhook,
    );
  }

  // ── Formatting helpers ─────────────────────────────────────

  private formatRow(entry: StartingGridEntry): string {
    const pos = this.positionLabel(entry);
    const name = this.truncate(entry.driver.displayName, 24);
    const pts = entry.points.toFixed(2).padStart(8);
    const diff = this.formatDiff(entry.diffSeconds);

    return `${pos} ${name} ${pts} ${diff}`;
  }

  private positionLabel(entry: StartingGridEntry): string {
    if (entry.isFalseStart) return '  \u{26D4}';
    const n = entry.position;
    if (n === 1) return ' 1\u{1F947}';
    if (n === 2) return ' 2\u{1F948}';
    if (n === 3) return ' 3\u{1F949}';
    if (entry.isLastOnGrid) return String(n).padStart(2) + '\u{1F4A3}';
    return String(n).padStart(2) + '  ';
  }

  private podiumLabel(rank: number): string {
    if (rank === 1) return ' 1\u{1F947}';
    if (rank === 2) return ' 2\u{1F948}';
    if (rank === 3) return ' 3\u{1F949}';
    return String(rank).padStart(2) + '  ';
  }

  private truncate(str: string, max: number): string {
    if (str.length <= max) return str.padEnd(max);
    return str.slice(0, max - 1) + '.';
  }

  private formatDiff(diffSeconds: number): string {
    const abs = Math.abs(diffSeconds);
    const sign = diffSeconds < 0 ? '-' : '+';

    if (abs < 60) {
      return `${sign}${abs.toFixed(3)}s`.padStart(11);
    }
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    return `${sign}${min}:${sec.toFixed(3).padStart(6, '0')}`.padStart(11);
  }

  // ── Infra ──────────────────────────────────────────────────

  private chunkText(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];

    const lines = text.split('\n');
    const chunks: string[] = [];
    let current = '';

    for (const line of lines) {
      if (current.length + line.length + 1 > maxChars && current.length > 0) {
        chunks.push(current);
        current = '';
      }
      current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);

    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private async sendWebhook(
    body: Record<string, unknown>,
    webhookUrl?: string,
  ): Promise<void> {
    const url = webhookUrl ?? this.raceDayWebhook;
    const response = await fetch(url, {
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
