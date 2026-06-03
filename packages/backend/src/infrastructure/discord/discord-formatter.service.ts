import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { DEFAULT_TIMEZONE } from '../../core/constants';

const SEP = '\u2500';
const HEAVY_SEP = '\u2550';
const ELLIPSIS = '\u2026';
const REZAGADO_RATIO = 0.1;

// Discord embed code blocks have an effective rendering width of ~33 visual
// cells in narrow client views and they soft-break at:
//   - every regular space (word-wrap)
//   - the boundary between adjacent characters from different scripts
//     (notably ASCII digit/letter \u2192 emoji)
// Mitigations applied per row:
//   - NBSP (U+00A0) instead of every regular space, so word-wrap can't trigger
//   - WJ (U+2060, Word Joiner, zero-width) glued before each emoji, so the
//     digit\u2192emoji boundary is no longer a valid break opportunity
//   - total row width <=33 cells so character-wrap doesn't trigger either
const NBSP = '\u00a0';
const WJ = '\u2060';
const nbspify = (s: string): string => s.replace(/ /g, NBSP);

// Discord hard-caps embed description at 4096 chars. We chunk the monospace
// table body with a safety margin to leave room for the summary line on the
// first embed and the legend on the last one.
const DESCRIPTION_CHUNK_LIMIT = 3800;

// Column widths sized to fit in <=33 visual cells per row.
// Emojis in positionLabel count as 2 visual cells; WJ is zero-width.
const COL_POS = 4;
const COL_NAME = 13;
const COL_GAP = '  ';

// Daily race grid columns — total row: 4+2+13+2+3+2+7 = 33 cells
const COL_GRID_PTS = 3;
const COL_GRID_TIME = 7;

// Championship table columns — total row: 4+2+13+2+4+1+3+1+3 = 33 cells
// GP column dropped: it equals races attended (already in the summary line)
// and is ≈uniform across drivers, so it adds little signal at this width.
const COL_CHAMP_PTS = 4;
const COL_CHAMP_W = 3;
const COL_CHAMP_PODIUM = 3;
const COL_CHAMP_INNER_GAP = ' ';

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
    const timeStr = this.formatTime(race.greenLight);
    const driversLabel = grid.length === 1 ? 'piloto' : 'pilotos';
    const falseStarters = grid.filter((e) => e.isFalseStart);
    let summary = `\u{1F6A5}  **${timeStr}**  \u{B7}  \u{1F3CE}\u{FE0F}  **${grid.length}** ${driversLabel}`;
    if (falseStarters.length > 0) {
      const fsLabel = falseStarters.length === 1 ? 'salida en falso' : 'salidas en falso';
      summary += `  \u{B7}  \u{1F6A8}  **${falseStarters.length}** ${fsLabel}`;
    }

    const gridText = this.buildGridText(grid, race.greenLight);
    const stats = this.buildRaceStats(race);

    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const embed: DiscordEmbed = {
        color: 0x3498db,
        description:
          i === 0
            ? `${summary}\n\`\`\`\n${chunk}\n\`\`\``
            : `\`\`\`\n${chunk}\n\`\`\``,
      };

      if (i === 0) {
        embed.title = `\u{1F3C1}  DAILY RACE  \u{2014}  \u{1F5D3}\u{FE0F}  ${dateStr}`;
      }
      if (i === chunks.length - 1 && stats) {
        embed.fields = [{ name: '', value: stats, inline: false }];
        embed.footer = { text: 'Daily Race \u{2014} Secture' };
        embed.timestamp = new Date().toISOString();
      } else if (i === chunks.length - 1) {
        embed.footer = { text: 'Daily Race \u{2014} Secture' };
        embed.timestamp = new Date().toISOString();
      }

      return embed;
    });
  }

  // ── Championship ───────────────────────────────────────────

  formatChampionshipEmbeds(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): DiscordEmbed[] {
    if (standings.length === 0) return [];

    const gridText = this.buildChampionshipTable(standings);
    const racesLabel = racesCount === 1 ? 'carrera' : 'carreras';
    const driversLabel = standings.length === 1 ? 'piloto' : 'pilotos';
    const dateStr = this.formatDate(new Date());
    const summary = `\u{1F3C1}  **${racesCount}** ${racesLabel}  \u{B7}  \u{1F3CE}\u{FE0F}  **${standings.length}** ${driversLabel}`;
    const legend = '-# **W** victorias  \u{B7}  **PD** podios';
    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;
      const body = `\`\`\`\n${chunk}\n\`\`\``;
      const embed: DiscordEmbed = {
        color: 0xffd700,
        description:
          (isFirst ? `${summary}\n` : '') +
          body +
          (isLast ? `\n${legend}` : ''),
      };
      if (isFirst) {
        embed.title = `\u{1F3C6}  CHAMPIONSHIP  \u{2014}  \u{1F5D3}\u{FE0F}  ${dateStr}`;
      }
      if (isLast) {
        embed.footer = { text: 'Daily Race \u{2014} Secture' };
        embed.timestamp = new Date().toISOString();
      }
      return embed;
    });
  }

  // ── Live Race ──────────────────────────────────────────────

  formatLiveRaceEmbeds(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): DiscordEmbed[] {
    const dateStr = this.formatDate(greenLight);
    const timeStr = this.formatTime(greenLight);
    const driversLabel = grid.length === 1 ? 'piloto' : 'pilotos';
    const falseStarters = grid.filter((e) => e.isFalseStart);
    let summary = `\u{1F6A5}  **${timeStr}**  \u{B7}  \u{1F3CE}\u{FE0F}  **${grid.length}** ${driversLabel}`;
    if (falseStarters.length > 0) {
      const fsLabel = falseStarters.length === 1 ? 'salida en falso' : 'salidas en falso';
      summary += `  \u{B7}  \u{1F6A8}  **${falseStarters.length}** ${fsLabel}`;
    }
    const gridText = this.buildGridText(grid, greenLight);
    const stats = this.buildLiveStats(grid);
    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const embed: DiscordEmbed = {
        color: 0xe74c3c,
        description:
          i === 0
            ? `${summary}\n\`\`\`\n${chunk}\n\`\`\``
            : `\`\`\`\n${chunk}\n\`\`\``,
      };

      if (i === 0) {
        embed.title = `\u{1F534}  EN DIRECTO  \u{2014}  \u{1F5D3}\u{FE0F}  ${dateStr}`;
      }
      if (i === chunks.length - 1 && stats) {
        embed.fields = [{ name: '', value: stats, inline: false }];
        embed.footer = { text: 'Daily Race \u{2014} Secture \u{2014} EN DIRECTO' };
        embed.timestamp = new Date().toISOString();
      } else if (i === chunks.length - 1) {
        embed.footer = { text: 'Daily Race \u{2014} Secture \u{2014} EN DIRECTO' };
        embed.timestamp = new Date().toISOString();
      }

      return embed;
    });
  }

  private buildLiveStats(grid: StartingGridEntry[]): string {
    const busted = grid.find((e) => e.isWorstOnGrid);
    if (!busted) return '';

    return `\u{1F480}  Busted: **${busted.driver.displayName}** (${this.formatDiff(busted.diffSeconds).trim()})`;
  }

  // ── Grid building ──────────────────────────────────────────

  private buildGridText(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): string {
    // False starters: peor posicion primero (Busted con calavera arriba)
    const falseStarters = grid
      .filter((e) => e.isFalseStart)
      .sort((a, b) => b.position - a.position);
    const cleanGrid = grid.filter((e) => !e.isFalseStart);

    const sections: string[] = [];

    const header = this.buildGridHeader();
    sections.push(header);
    sections.push(HEAVY_SEP.repeat(header.length));
    sections.push('');

    if (falseStarters.length > 0) {
      for (const e of falseStarters) sections.push(this.formatGridRow(e));
      sections.push('');
    }

    sections.push(this.buildGreenLightMarker(greenLight, header.length));
    sections.push('');

    for (const e of cleanGrid)
      sections.push(this.formatGridRow(e, cleanGrid.length));

    return sections.join('\n');
  }

  private buildGridHeader(): string {
    return nbspify(
      'Pos'.padEnd(COL_POS) +
        COL_GAP +
        'Piloto'.padEnd(COL_NAME) +
        COL_GAP +
        'Pts'.padStart(COL_GRID_PTS) +
        COL_GAP +
        'Tiempo'.padStart(COL_GRID_TIME),
    );
  }

  private buildGreenLightMarker(greenLight: Date, width: number): string {
    const timeStr = this.formatTime(greenLight);
    const label = ` \u{1F6A5}  ${timeStr}  `;
    const sideLen = Math.floor((width - label.length) / 2);
    return nbspify(
      SEP.repeat(sideLen) +
        label +
        SEP.repeat(Math.max(0, width - sideLen - label.length)),
    );
  }

  private buildChampionshipTable(standings: ChampionshipStanding[]): string {
    const rows = standings.map((s) => {
      const pos = this.championshipPosLabel(s.rank);
      const name = this.truncate(s.driver.displayName, COL_NAME);
      const pts = String(s.totalPoints).padStart(COL_CHAMP_PTS);
      const wins = String(s.wins).padStart(COL_CHAMP_W);
      const podiums = String(s.podiums).padStart(COL_CHAMP_PODIUM);
      return (
        pos +
        COL_GAP +
        name +
        COL_GAP +
        pts +
        COL_CHAMP_INNER_GAP +
        wins +
        COL_CHAMP_INNER_GAP +
        podiums
      );
    });

    const header = nbspify(
      'Pos'.padEnd(COL_POS) +
        COL_GAP +
        'Piloto'.padEnd(COL_NAME) +
        COL_GAP +
        'Pts'.padStart(COL_CHAMP_PTS) +
        COL_CHAMP_INNER_GAP +
        'W'.padStart(COL_CHAMP_W) +
        COL_CHAMP_INNER_GAP +
        'PD'.padStart(COL_CHAMP_PODIUM),
    );

    return [header, HEAVY_SEP.repeat(header.length), '', ...rows.map(nbspify)].join('\n');
  }

  // ── Stats building ─────────────────────────────────────────

  private buildRaceStats(race: Race): string {
    const busted = race.startingGrid.find((e) => e.isWorstOnGrid);
    if (!busted) return '';

    return `\u{1F480}  Busted: **${busted.driver.displayName}** (${this.formatDiff(busted.diffSeconds).trim()})`;
  }

  // ── Row formatting ─────────────────────────────────────────

  formatGridRow(
    entry: StartingGridEntry,
    cleanGridSize?: number,
  ): string {
    const pos = this.positionLabel(entry, cleanGridSize);
    const name = this.truncate(entry.driver.displayName, COL_NAME);
    const pts = String(entry.points).padStart(COL_GRID_PTS);
    const diff = this.formatDiff(entry.diffSeconds);

    return nbspify(pos + COL_GAP + name + COL_GAP + pts + COL_GAP + diff);
  }

  positionLabel(entry: StartingGridEntry, cleanGridSize?: number): string {
    const numStr = String(entry.position).padStart(2);

    if (entry.isFalseStart) {
      return numStr + WJ + (entry.isWorstOnGrid ? '\u{1F480}' : '\u{26D4}');
    }

    const n = entry.position;
    if (n === 1) return ' 1' + WJ + '\u{1F3C6}';
    if (n === 2) return ' 2' + WJ + '\u{1F948}';
    if (n === 3) return ' 3' + WJ + '\u{1F949}';
    if (entry.isWorstOnGrid) return numStr + WJ + '\u{1F480}';
    if (
      cleanGridSize &&
      n > cleanGridSize - Math.floor(cleanGridSize * REZAGADO_RATIO)
    ) {
      return numStr + WJ + '\u{1F422}';
    }
    return numStr + '  ';
  }

  championshipPosLabel(rank: number): string {
    if (rank === 1) return ' 1' + WJ + '\u{1F3C6}';
    if (rank === 2) return ' 2' + WJ + '\u{1F948}';
    if (rank === 3) return ' 3' + WJ + '\u{1F949}';
    return String(rank).padStart(2) + '  ';
  }

  // ── Utilities ──────────────────────────────────────────────

  formatDiff(diffSeconds: number): string {
    const abs = Math.abs(diffSeconds);
    const sign = diffSeconds < 0 ? '-' : '+';

    if (abs < 60) {
      return `${sign}${abs.toFixed(3)}`.padStart(COL_GRID_TIME);
    }
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    return `${sign}${min}:${sec.toFixed(3).padStart(6, '0')}`.padStart(COL_GRID_TIME);
  }

  truncate(str: string, max: number): string {
    if (str.length <= max) return str.padEnd(max);
    return str.slice(0, max - 1) + ELLIPSIS;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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
