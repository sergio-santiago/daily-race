import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { DEFAULT_TIMEZONE } from '../../core/constants';

const SEP = '\u2500';
const CHAMPIONSHIP_TOP_DRIVERS = 20;
const NAME_MAX_GRID = 24;
const NAME_MAX_CHAMPIONSHIP = 22;
const REZAGADO_THRESHOLD = 60;

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

@Injectable()
export class DiscordFormatterService {
  // ── Race Results ───────────────────────────────────────────

  formatRaceEmbeds(race: Race): DiscordEmbed[] {
    const grid = race.startingGrid;
    const dateStr = this.formatDate(race.greenLight);

    const gridText = this.buildGridText(grid);
    const stats = this.buildRaceStats(race);

    const chunks = this.chunkText(gridText, 4000);

    return chunks.map((chunk, i) => {
      const embed: DiscordEmbed = {
        color: 0x3498db,
        description: `\`\`\`\n${chunk}\n\`\`\``,
      };

      if (i === 0) {
        embed.title = `\u{1F3C1}  DAILY RACE  \u{2014}  ${dateStr}`;
      }
      if (i === chunks.length - 1) {
        embed.fields = [{ name: '', value: stats, inline: false }];
        embed.footer = { text: 'Daily Race \u{2014} Secture' };
        embed.timestamp = new Date().toISOString();
      }

      return embed;
    });
  }

  // ── Championship ───────────────────────────────────────────

  formatChampionshipEmbed(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): DiscordEmbed | null {
    if (standings.length === 0) return null;

    const top = standings.slice(0, CHAMPIONSHIP_TOP_DRIVERS);
    const gridText = this.buildChampionshipTable(top);
    const stats = this.buildChampionshipStats(standings, racesCount);

    return {
      title: '\u{1F3C6}  CHAMPIONSHIP  \u{2014}  Clasificaci\u00f3n general',
      color: 0xffd700,
      description: `\`\`\`\n${gridText}\n\`\`\``,
      fields: [{ name: '', value: stats, inline: false }],
      footer: { text: 'Daily Race \u{2014} Secture' },
      timestamp: new Date().toISOString(),
    };
  }

  // ── Grid building ──────────────────────────────────────────

  private buildGridText(grid: StartingGridEntry[]): string {
    const falseStarters = grid.filter((e) => e.isFalseStart);
    const cleanGrid = grid.filter((e) => !e.isFalseStart);

    const sections: string[] = [];

    if (falseStarters.length > 0) {
      sections.push('\u{1F534}  SALIDA EN FALSO');
      sections.push(SEP.repeat(48));
      sections.push('');
      for (const e of falseStarters) sections.push(this.formatGridRow(e));
      sections.push('');
    }

    sections.push('\u{1F7E2}  PARRILLA DE SALIDA');
    sections.push(SEP.repeat(48));
    sections.push('');
    for (const e of cleanGrid) sections.push(this.formatGridRow(e));

    return sections.join('\n');
  }

  private buildChampionshipTable(standings: ChampionshipStanding[]): string {
    const rows = standings.map((s) => {
      const pos = this.championshipPosLabel(s.rank);
      const name = this.truncate(s.driver.displayName, NAME_MAX_CHAMPIONSHIP);
      const pts = s.totalPoints.toFixed(2).padStart(8);
      const races = String(s.racesAttended).padStart(2);
      const avg = (s.totalPoints / s.racesAttended).toFixed(2).padStart(7);
      return `${pos} ${name} ${pts} ${races} ${avg}`;
    });

    const header =
      '     ' +
      'Piloto'.padEnd(NAME_MAX_CHAMPIONSHIP) +
      ' ' +
      'Total'.padStart(8) +
      ' ' +
      'GP'.padStart(2) +
      ' ' +
      'Media'.padStart(7);

    return [header, SEP.repeat(header.length), '', ...rows].join('\n');
  }

  // ── Stats building ─────────────────────────────────────────

  private buildRaceStats(race: Race): string {
    const grid = race.startingGrid;
    const timeStr = this.formatTime(race.greenLight);
    const falseStarters = grid.filter((e) => e.isFalseStart);
    const cleanGrid = grid.filter((e) => !e.isFalseStart);
    const bestDriver = cleanGrid[0];
    const lastDriver = grid[grid.length - 1];

    const lines: string[] = [];

    lines.push(
      `\u{1F6A5}  Green Light: **${timeStr}**`,
    );
    lines.push(
      `\u{1F3CE}\u{FE0F}  Pilotos: **${grid.length}**`,
    );

    if (bestDriver) {
      lines.push(
        `\u{1F3C6}  Pole Position: **${bestDriver.driver.displayName}**  \u{2014}  ${bestDriver.points.toFixed(2)} pts`,
      );
    }

    if (lastDriver) {
      lines.push(
        `\u{1F451}  Rey de la Ruina: **${lastDriver.driver.displayName}**  \u{2014}  ${this.formatDiff(lastDriver.diffSeconds).trim()}`,
      );
    }

    if (falseStarters.length > 0) {
      const fsNames = falseStarters.map((e) => e.driver.displayName).join(', ');
      const fsLabel = falseStarters.length === 1 ? 'Salida en falso' : 'Salidas en falso';
      lines.push(`\u{26D4}  ${fsLabel}: ${fsNames}`);
    }

    return lines.join('\n');
  }

  private buildChampionshipStats(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): string {
    const leader = standings[0];
    const lines: string[] = [];
    lines.push(`\u{1F3C1}  Carreras disputadas: **${racesCount}**`);
    lines.push(`\u{1F3CE}\u{FE0F}  Pilotos: **${standings.length}**`);
    if (leader) {
      lines.push(
        `\u{1F3C6}  L\u{00ED}der: **${leader.driver.displayName}**  \u{2014}  ${leader.totalPoints.toFixed(2)} pts`,
      );
    }

    return lines.join('\n');
  }

  // ── Row formatting ─────────────────────────────────────────

  formatGridRow(entry: StartingGridEntry): string {
    const pos = this.positionLabel(entry);
    const name = this.truncate(entry.driver.displayName, NAME_MAX_GRID);
    const pts = entry.points.toFixed(2).padStart(8);
    const diff = this.formatDiff(entry.diffSeconds);

    return `${pos} ${name} ${pts} ${diff}`;
  }

  positionLabel(entry: StartingGridEntry): string {
    if (entry.isFalseStart) return '  \u{26D4}';
    const n = entry.position;
    if (n === 1) return ' 1\u{1F3C6}';
    if (n === 2) return ' 2\u{1F948}';
    if (n === 3) return ' 3\u{1F949}';
    if (entry.isLastOnGrid) return String(n).padStart(2) + '\u{1F451}';
    if (entry.diffSeconds > REZAGADO_THRESHOLD) return String(n).padStart(2) + '\u{1F422}';
    return String(n).padStart(2) + '  ';
  }

  championshipPosLabel(rank: number): string {
    if (rank === 1) return ' 1\u{1F3C6}';
    if (rank === 2) return ' 2\u{1F948}';
    if (rank === 3) return ' 3\u{1F949}';
    return String(rank).padStart(2) + '  ';
  }

  // ── Utilities ──────────────────────────────────────────────

  formatDiff(diffSeconds: number): string {
    const abs = Math.abs(diffSeconds);
    const sign = diffSeconds < 0 ? '-' : '+';

    if (abs < 60) {
      return `${sign}${abs.toFixed(3)}s`.padStart(11);
    }
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    return `${sign}${min}:${sec.toFixed(3).padStart(6, '0')}`.padStart(11);
  }

  truncate(str: string, max: number): string {
    if (str.length <= max) return str.padEnd(max);
    return str.slice(0, max - 1) + '.';
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: DEFAULT_TIMEZONE,
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: DEFAULT_TIMEZONE,
    });
  }

  chunkText(text: string, maxChars: number): string[] {
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
}
