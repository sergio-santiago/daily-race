import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { SeasonSummary } from '../../core/entities/season-summary.entity';
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
const ZWJ = '\u200d';
const nbspify = (s: string): string => s.replace(/ /g, NBSP);

// Nombre de recambio cuando el saneado se lo come entero (por ejemplo un
// displayName que solo son backticks)
const UNKNOWN_NAME = '?';

// Tope del nombre en el chip de Busted, que va fuera del bloque de codigo
const BUSTED_NAME_MAX = 40;

// Medida de ancho en celdas. Sin esto un nombre con emoji cuenta como un
// caracter pero se dibuja como dos celdas y desborda la columna.
const GRAPHEME_SEGMENTER = new Intl.Segmenter('es', {
  granularity: 'grapheme',
});
// Formato invisible, marcas combinantes y selectores de variacion: 0 celdas
const ZERO_WIDTH_RE = /^[\p{Cf}\p{Mn}\p{Me}\u{FE00}-\u{FE0F}]$/u;
// Emoji, simbolos y bloques CJK: 2 celdas
const WIDE_RE =
  /^[\u{1100}-\u{115F}\u{2600}-\u{27BF}\u{2E80}-\u{A4CF}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FF00}-\u{FF60}\u{1F000}-\u{1FAFF}]$/u;

// Discord hard-caps embed description at 4096 chars. We chunk the monospace
// table body with a safety margin to leave room for the summary line on the
// first embed and the legend on the last one.
const DESCRIPTION_CHUNK_LIMIT = 3800;

// Column widths sized to fit in <=33 visual cells per row.
// Emojis in positionLabel count as 2 visual cells; WJ is zero-width.
const COL_POS = 4;
const COL_NAME = 13;
const COL_GAP = '  ';

// Daily race grid columns, total row: 4+2+13+2+3+2+7 = 33 cells
const COL_GRID_PTS = 3;
const COL_GRID_TIME = 7;

// Championship table columns, total row: 4+2+13+2+4+1+3+1+3 = 33 cells
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
  image?: { url: string };
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

  // ── Cambio de temporada ────────────────────────────────────

  /**
   * El relevo entre temporadas. Sale una vez al ano, la manana del primer dia
   * que de verdad hay daily, antes de que la mayoria entre a la sala, para que
   * nadie se encuentre la tabla a cero sin explicacion.
   *
   * Nombra a los tres del podio y no solo al campeon: el segundo y el tercero
   * tambien se han pasado un curso entero madrugando, y la foto de un podio se
   * lee mejor que un solo nombre. Si una posicion esta empatada salen todos los
   * empatados, por lo mismo que la calavera es compartida.
   */
  formatSeasonChangeEmbed(summary: SeasonSummary): DiscordEmbed {
    const racesLabel = summary.racesCount === 1 ? 'daily' : 'dailies';
    const driversLabel = summary.driversCount === 1 ? 'piloto' : 'pilotos';

    // Una linea por POSICION del podio y no por piloto, igual que el panel del
    // podio de la grafica: si algun dia el campeonato comparte posicion como la
    // hace la parrilla, la linea nombra al grupo en vez de dejar a uno fuera
    const byRank = new Map<number, ChampionshipStanding[]>();
    for (const s of summary.podium) {
      byRank.set(s.rank, [...(byRank.get(s.rank) ?? []), s]);
    }

    const lines = [...byRank.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([rank, tied]) => {
        const medal = this.medalFor(rank);
        const names = this.joinNames(tied);
        const stats = this.seasonStats(tied[0]);
        return [
          `${medal}  **${names}** ${this.podiumPhrase(rank, tied.length)}`,
          `-# ${stats}`,
        ];
      });

    return {
      title: `\u{1F3C1}  SE ACABA LA TEMPORADA ${summary.label}`,
      color: 0xffd700,
      description:
        `**${summary.racesCount}** ${racesLabel}  \u{B7}  **${summary.driversCount}** ${driversLabel}\n\n` +
        `Este es el podio final:\n\n` +
        `${lines.join('\n')}\n\n` +
        `\u{1F6A6}  **Y ahora lo bueno: arranca la ${summary.nextLabel}.**\n` +
        `El campeón y el último de la tabla salen hoy desde la misma casilla.`,
      footer: { text: 'Daily Race \u{2014} Secture' },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Solo el metal, sin el numero de posicion: aqui la medalla ya dice el cajon y
   * el numero delante era ruido. En la tabla del campeonato si va el numero,
   * porque ahi es la columna Pos y llega hasta la posicion ochenta y tantos.
   */
  private medalFor(rank: number): string {
    if (rank === 1) return '\u{1F3C6}';
    if (rank === 2) return '\u{1F948}';
    if (rank === 3) return '\u{1F949}';
    return '\u{1F3CE}\u{FE0F}';
  }

  /**
   * Lo que se dice de cada cajon. El tercero cierra el podio, el segundo lo
   * aguanta y el primero se lo lleva: tres frases distintas para que la lista no
   * suene a volcado de la tabla, que ya va justo debajo en el mismo canal.
   */
  private podiumPhrase(rank: number, tied: number): string {
    const plural = tied > 1;
    if (rank === 1) return plural ? 'comparten el título' : 'se lleva el título';
    if (rank === 2) {
      return plural
        ? 'aguantan el segundo cajón'
        : 'aguanta el segundo cajón';
    }
    if (rank === 3) return plural ? 'cierran el podio' : 'cierra el podio';
    return plural ? 'también suben' : 'también sube';
  }

  /** Puntos y victorias del cajon. Sin victorias no se menciona el cero */
  private seasonStats(standing: ChampionshipStanding): string {
    const pts = `${standing.totalPoints} pts`;
    if (standing.wins === 0) return pts;
    const winsLabel = standing.wins === 1 ? 'victoria' : 'victorias';
    return `${pts}  \u{B7}  ${standing.wins} ${winsLabel}`;
  }

  /** Nombres de un cajon compartido, saneados y con el markdown escapado */
  private joinNames(tied: ChampionshipStanding[]): string {
    const names = tied.map((s) =>
      this.escapeMarkdown(
        this.truncate(
          this.sanitizeName(s.driver.displayName),
          BUSTED_NAME_MAX,
        ).trimEnd(),
      ),
    );
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names[0]} y ${names.length - 1} más`;
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
    return this.bustedChip(grid.filter((e) => e.isWorstOnGrid));
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
      const name = this.safeName(s.driver.displayName, COL_NAME);
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
    return this.bustedChip(race.startingGrid.filter((e) => e.isWorstOnGrid));
  }

  // ── Row formatting ─────────────────────────────────────────

  formatGridRow(
    entry: StartingGridEntry,
    cleanGridSize?: number,
  ): string {
    const pos = this.positionLabel(entry, cleanGridSize);
    const name = this.safeName(entry.driver.displayName, COL_NAME);
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

  // ── Sanitizing ─────────────────────────────────────────────

  /**
   * Un displayName con tres backticks cierra el bloque de codigo y corrompe el
   * resto de la tabla, un salto de linea descuadra la parrilla y un override
   * bidi (U+202E) da la vuelta a la fila entera. Se sanea una sola vez al
   * entrar, antes de medir el ancho de columna.
   */
  sanitizeName(name: string | null | undefined): string {
    const cleaned = (name ?? '')
      .replace(/`/g, '')
      // Controles (incluye \n, \r, \t) a espacio, para no pegar dos palabras
      .replace(/\p{Cc}/gu, ' ')
      // Formato invisible fuera, salvo el ZWJ que compone emojis compuestos
      .replace(/\p{Cf}/gu, (c) => (c === ZWJ ? c : ''))
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length > 0 ? cleaned : UNKNOWN_NAME;
  }

  /**
   * Para el texto que va FUERA del bloque de codigo (el chip de Busted), donde
   * Discord si interpreta markdown.
   */
  escapeMarkdown(text: string): string {
    return text.replace(/[\\`*_~|[\]()]/g, (c) => `\\${c}`);
  }

  private safeName(name: string | null | undefined, max: number): string {
    return this.truncate(this.sanitizeName(name), max);
  }

  /**
   * La calavera puede ser compartida: si el extremo esta empatado al instante, es
   * de todos los empatados, que por definicion tienen el mismo tiempo. De tres en
   * adelante se cuenta el resto en vez de enumerarlo, igual que en la grafica,
   * para que el mensaje y la imagen digan lo mismo.
   */
  private bustedChip(busted: StartingGridEntry[]): string {
    if (busted.length === 0) return '';

    // El chip va fuera del bloque de codigo, asi que no lo ata la columna de 13,
    // pero se acota igual: el campo del embed tiene un tope de 1024 caracteres y
    // escapar markdown puede duplicar cada caracter
    const nombre = (entry: StartingGridEntry): string =>
      this.escapeMarkdown(
        this.truncate(
          this.sanitizeName(entry.driver.displayName),
          BUSTED_NAME_MAX,
        ).trimEnd(),
      );

    let label: string;
    if (busted.length === 1) {
      label = `**${nombre(busted[0])}**`;
    } else if (busted.length === 2) {
      label = `**${nombre(busted[0])}** y **${nombre(busted[1])}**`;
    } else {
      label = `**${nombre(busted[0])}** y ${busted.length - 1} más`;
    }

    const time = this.formatDiff(busted[0].diffSeconds).trim();
    return `\u{1F480}  Busted: ${label} (${time})`;
  }

  // ── Utilities ──────────────────────────────────────────────

  /**
   * Por debajo del minuto se conservan los milisegundos, que es donde se decide
   * la carrera. A partir de un minuto se recorta a mm:ss: el milisegundo ya no
   * aporta nada y "+1:00.500" (9 celdas) desbordaba la columna de 7, lo que
   * rompia la linea en clientes estrechos. "+32:21" cabe de sobra.
   */
  formatDiff(diffSeconds: number): string {
    const abs = Math.abs(diffSeconds);
    const sign = diffSeconds < 0 ? '-' : '+';
    const body = abs < 60 ? abs.toFixed(3) : this.formatMinutesSeconds(abs);
    const text = `${sign}${body}`;

    // Red de seguridad: por encima de 999 minutos (datos imposibles en una
    // daily) se recorta en seco antes que desbordar la columna.
    return (
      text.length > COL_GRID_TIME ? text.slice(0, COL_GRID_TIME) : text
    ).padStart(COL_GRID_TIME);
  }

  private formatMinutesSeconds(abs: number): string {
    // Se redondea el total en segundos, no cada parte, para que 119,7 s de
    // 2:00 y no de 1:60
    const totalSeconds = Math.round(abs);
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  /**
   * Recorta y rellena a `max` CELDAS, no a `max` caracteres. Un emoji en el
   * nombre ocupa dos celdas, asi que contar caracteres desbordaba la columna y
   * con ella el presupuesto de 33 de la fila. Se corta por grafema para no
   * partir un par surrogate (un surrogate huerfano hace que Discord conteste
   * 400) ni una secuencia de emoji unida por ZWJ.
   */
  truncate(str: string, max: number): string {
    const clusters = this.graphemes(str);
    const total = clusters.reduce((sum, g) => sum + this.clusterCells(g), 0);
    if (total <= max) return str + ' '.repeat(max - total);

    // Se reserva 1 celda para los puntos suspensivos
    let width = 0;
    const kept: string[] = [];
    for (const cluster of clusters) {
      const cells = this.clusterCells(cluster);
      if (width + cells > max - 1) break;
      width += cells;
      kept.push(cluster);
    }
    return (
      kept.join('') + ELLIPSIS + ' '.repeat(Math.max(0, max - width - 1))
    );
  }

  /** Ancho en celdas de la fuente monoespaciada de un bloque de codigo */
  visualWidth(text: string): number {
    return this.graphemes(text).reduce(
      (sum, cluster) => sum + this.clusterCells(cluster),
      0,
    );
  }

  private graphemes(str: string): string[] {
    return [...GRAPHEME_SEGMENTER.segment(str)].map((s) => s.segment);
  }

  private clusterCells(cluster: string): number {
    // Se suma cada punto de codigo del grafema en vez de quedarse con el mas
    // ancho: un cliente que no compone la secuencia ZWJ dibuja los tres emojis
    // de una familia por separado (6 celdas). Pasarse de ancho deja la fila mas
    // estrecha de lo necesario, quedarse corto le rompe la linea.
    let width = 0;
    for (const char of cluster) {
      width += this.charCells(char);
    }
    return width;
  }

  private charCells(char: string): number {
    if (ZERO_WIDTH_RE.test(char)) return 0;
    return WIDE_RE.test(char) ? 2 : 1;
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
