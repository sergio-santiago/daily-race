import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import {
  DISCORD_EMBED_COLOR,
  formatDiffShort,
  formatRaceDate,
  formatRaceTime,
  GRID_EMOJI,
  PODIUM_EMOJI,
  gridEntryVisualRole,
  truncateName,
} from '../formatting';

const SEP = '─';
const HEAVY_SEP = '═';

// Discord hard-caps embed description at 4096 chars. We chunk the monospace
// table body with a safety margin to leave room for the summary line on the
// first embed and the legend on the last one.
const DESCRIPTION_CHUNK_LIMIT = 3800;

// Column widths (aligned for monospace rendering in Discord code blocks).
// Emojis in positionLabel count as 2 visual cells but 1 string char, so the
// position column uses a string width of 4 that renders as 4 visual cells
// for numeric labels ("10  ") and ~4 for emoji labels (" 1🏆", "18💀").
const COL_POS = 4;
const COL_NAME = 24;
const COL_GAP = '  ';

// Daily race grid columns — total row: 4+2+24+2+5+2+13 = 52 chars
const COL_GRID_PTS = 5;
const COL_GRID_TIME = 13;

// Championship table columns — total row: 4+2+24+2+5+2+4+2+4+2+4 = 55 chars
const COL_CHAMP_PTS = 5;
const COL_CHAMP_GP = 4;
const COL_CHAMP_W = 4;
const COL_CHAMP_PODIUM = 4;

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
    let summary = `${GRID_EMOJI.GREEN_LIGHT}  **${timeStr}**  \u{B7}  ${GRID_EMOJI.CAR}  **${grid.length}** ${driversLabel}`;
    if (falseStarters.length > 0) {
      const fsLabel = falseStarters.length === 1 ? 'salida en falso' : 'salidas en falso';
      summary += `  \u{B7}  ${GRID_EMOJI.WARNING}  **${falseStarters.length}** ${fsLabel}`;
    }

    const gridText = this.buildGridText(grid, race.greenLight);
    const stats = this.buildRaceStats(race);

    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const embed: DiscordEmbed = {
        color: DISCORD_EMBED_COLOR.RACE,
        description:
          i === 0
            ? `${summary}\n\`\`\`\n${chunk}\n\`\`\``
            : `\`\`\`\n${chunk}\n\`\`\``,
      };

      if (i === 0) {
        embed.title = `${GRID_EMOJI.CHECKERED}  DAILY RACE  \u{2014}  ${GRID_EMOJI.CALENDAR}  ${dateStr}`;
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
    const summary = `${GRID_EMOJI.CHECKERED}  **${racesCount}** ${racesLabel}  \u{B7}  ${GRID_EMOJI.CAR}  **${standings.length}** ${driversLabel}`;
    const legend =
      '-# **GP** grandes premios  \u{B7}  **W** victorias  \u{B7}  **PD** podios';
    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;
      const body = `\`\`\`\n${chunk}\n\`\`\``;
      const embed: DiscordEmbed = {
        color: DISCORD_EMBED_COLOR.CHAMPIONSHIP,
        description:
          (isFirst ? `${summary}\n` : '') +
          body +
          (isLast ? `\n${legend}` : ''),
      };
      if (isFirst) {
        embed.title = `${GRID_EMOJI.TROPHY}  CHAMPIONSHIP  \u{2014}  ${GRID_EMOJI.CALENDAR}  ${dateStr}`;
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
    let summary = `${GRID_EMOJI.GREEN_LIGHT}  **${timeStr}**  \u{B7}  ${GRID_EMOJI.CAR}  **${grid.length}** ${driversLabel}`;
    if (falseStarters.length > 0) {
      const fsLabel = falseStarters.length === 1 ? 'salida en falso' : 'salidas en falso';
      summary += `  \u{B7}  ${GRID_EMOJI.WARNING}  **${falseStarters.length}** ${fsLabel}`;
    }
    const gridText = this.buildGridText(grid, greenLight);
    const stats = this.buildLiveStats(grid);
    const chunks = this.chunkText(gridText, DESCRIPTION_CHUNK_LIMIT);

    return chunks.map((chunk, i) => {
      const embed: DiscordEmbed = {
        color: DISCORD_EMBED_COLOR.LIVE,
        description:
          i === 0
            ? `${summary}\n\`\`\`\n${chunk}\n\`\`\``
            : `\`\`\`\n${chunk}\n\`\`\``,
      };

      if (i === 0) {
        embed.title = `${GRID_EMOJI.LIVE}  EN DIRECTO  \u{2014}  ${GRID_EMOJI.CALENDAR}  ${dateStr}`;
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

    return `${GRID_EMOJI.BUSTED}  Busted: **${busted.driver.displayName}** (${formatDiffShort(busted.diffSeconds)})`;
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
    return (
      'Pos'.padEnd(COL_POS) +
      COL_GAP +
      'Piloto'.padEnd(COL_NAME) +
      COL_GAP +
      'Pts'.padStart(COL_GRID_PTS) +
      COL_GAP +
      'Tiempo'.padStart(COL_GRID_TIME)
    );
  }

  private buildGreenLightMarker(greenLight: Date, width: number): string {
    const timeStr = this.formatTime(greenLight);
    const label = ` ${GRID_EMOJI.GREEN_LIGHT}  ${timeStr}  `;
    const sideLen = Math.floor((width - label.length) / 2);
    return (
      SEP.repeat(sideLen) +
      label +
      SEP.repeat(Math.max(0, width - sideLen - label.length))
    );
  }

  private buildChampionshipTable(standings: ChampionshipStanding[]): string {
    const rows = standings.map((s) => {
      const pos = this.championshipPosLabel(s.rank);
      const name = this.truncate(s.driver.displayName, COL_NAME);
      const pts = String(s.totalPoints).padStart(COL_CHAMP_PTS);
      const races = String(s.racesAttended).padStart(COL_CHAMP_GP);
      const wins = String(s.wins).padStart(COL_CHAMP_W);
      const podiums = String(s.podiums).padStart(COL_CHAMP_PODIUM);
      return (
        pos +
        COL_GAP +
        name +
        COL_GAP +
        pts +
        COL_GAP +
        races +
        COL_GAP +
        wins +
        COL_GAP +
        podiums
      );
    });

    const header =
      'Pos'.padEnd(COL_POS) +
      COL_GAP +
      'Piloto'.padEnd(COL_NAME) +
      COL_GAP +
      'Pts'.padStart(COL_CHAMP_PTS) +
      COL_GAP +
      'GP'.padStart(COL_CHAMP_GP) +
      COL_GAP +
      'W'.padStart(COL_CHAMP_W) +
      COL_GAP +
      'PD'.padStart(COL_CHAMP_PODIUM);

    return [header, HEAVY_SEP.repeat(header.length), '', ...rows].join('\n');
  }

  // ── Stats building ─────────────────────────────────────────

  private buildRaceStats(race: Race): string {
    const busted = race.startingGrid.find((e) => e.isWorstOnGrid);
    if (!busted) return '';

    return `${GRID_EMOJI.BUSTED}  Busted: **${busted.driver.displayName}** (${formatDiffShort(busted.diffSeconds)})`;
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

    return pos + COL_GAP + name + COL_GAP + pts + COL_GAP + diff;
  }

  positionLabel(entry: StartingGridEntry, cleanGridSize?: number): string {
    const numStr = String(entry.position).padStart(2);
    const role = gridEntryVisualRole({
      position: entry.position,
      isFalseStart: entry.isFalseStart,
      isWorstOnGrid: entry.isWorstOnGrid,
      cleanGridSize,
    });

    switch (role) {
      case 'busted-false-start':
        return numStr + GRID_EMOJI.BUSTED;
      case 'false-start':
        return numStr + GRID_EMOJI.FALSE_START;
      case 'podium-gold':
        return ' 1' + PODIUM_EMOJI.GOLD;
      case 'podium-silver':
        return ' 2' + PODIUM_EMOJI.SILVER;
      case 'podium-bronze':
        return ' 3' + PODIUM_EMOJI.BRONZE;
      case 'busted-clean':
        return numStr + GRID_EMOJI.BUSTED;
      case 'rezagado':
        return numStr + GRID_EMOJI.REZAGADO;
      case 'normal':
      default:
        return numStr + '  ';
    }
  }

  championshipPosLabel(rank: number): string {
    if (rank === 1) return ' 1' + PODIUM_EMOJI.GOLD;
    if (rank === 2) return ' 2' + PODIUM_EMOJI.SILVER;
    if (rank === 3) return ' 3' + PODIUM_EMOJI.BRONZE;
    return String(rank).padStart(2) + '  ';
  }

  // ── Utilities ──────────────────────────────────────────────

  formatDiff(diffSeconds: number): string {
    return formatDiffShort(diffSeconds).padStart(COL_GRID_TIME);
  }

  truncate(str: string, max: number): string {
    if (str.length <= max) return str.padEnd(max);
    return truncateName(str, max);
  }

  formatDate(date: Date): string {
    return formatRaceDate(date);
  }

  formatTime(date: Date): string {
    return formatRaceTime(date);
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
