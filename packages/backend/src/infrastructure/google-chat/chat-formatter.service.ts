import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { Driver } from '../../core/entities/driver.entity';
import {
  COLOR_HEX,
  formatDiffShort,
  formatRaceDate,
  formatRaceTime,
  GRID_EMOJI,
  PODIUM_EMOJI,
  gridEntryVisualRole,
  isRezagado,
  truncateName,
} from '../formatting';
import {
  ChatCard,
  ChatMessage,
  DecoratedText,
  GridItem,
  Section,
  Widget,
} from './chat-card.types';

/** Maximo de caracteres para nombres en cards (no monoespaciado, mas holgura que Discord). */
const NAME_MAX_LEN = 30;

/** Cap de widgets por card (Google: 100). Margen de seguridad. */
const WIDGETS_PER_CARD_LIMIT = 80;

/** Maximo de standings por card. Si excede, partir en cards separadas. */
const CHAMPIONSHIP_PER_CARD = 50;

/** Numero de widgets visibles en parrilla colapsada antes del "Show more". */
const PARRILLA_UNCOLLAPSED = 4; // top 3 + busted

/**
 * Formatea entidades del dominio en mensajes Google Chat (Cards V2).
 *
 * Diseño coordinado con docs/ux-design-google.md.
 * Siempre incluye un `text` plano de fallback para clientes que no soporten
 * cards (notification previews, smartwatch).
 */
@Injectable()
export class ChatFormatterService {
  // ── Race finalizada ────────────────────────────────────────

  formatRaceMessage(race: Race): ChatMessage {
    const grid = race.startingGrid;
    const dateStr = formatRaceDate(race.greenLight);
    const winner = grid.find((e) => !e.isFalseStart && e.position === 1);

    const text = winner
      ? `🏁 Daily Race del ${dateStr}: ${winner.driver.displayName} gana con ${winner.points} pts.`
      : `🏁 Daily Race del ${dateStr}.`;

    const card = this.buildRaceCard(race, /* isLive */ false);

    return {
      text,
      cardsV2: [{ cardId: `race-${race.id}`, card }],
    };
  }

  // ── Live race ──────────────────────────────────────────────

  formatLiveRaceMessage(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): ChatMessage {
    const dateStr = formatRaceDate(greenLight);
    const text = `🔴 Daily Race en directo · ${dateStr} · ${grid.length} pilotos`;

    const card = this.buildLiveCard(grid, greenLight);

    return {
      text,
      cardsV2: [{ cardId: `live-${greenLight.getTime()}`, card }],
    };
  }

  // ── Championship ───────────────────────────────────────────

  formatChampionshipMessages(
    standings: ChampionshipStanding[],
    racesCount: number,
  ): ChatMessage[] {
    if (standings.length === 0) return [];

    const dateStr = formatRaceDate(new Date());
    const racesLabel = racesCount === 1 ? 'carrera' : 'carreras';
    const driversLabel = standings.length === 1 ? 'piloto' : 'pilotos';

    const fallbackText =
      standings[0]
        ? `🏆 Championship del ${dateStr}: lidera ${standings[0].driver.displayName} con ${standings[0].totalPoints} pts. (${racesCount} ${racesLabel} · ${standings.length} ${driversLabel})`
        : `🏆 Championship del ${dateStr}.`;

    const chunks = this.chunkStandings(standings);
    return chunks.map((chunk, i) => {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;
      const card = this.buildChampionshipCard(
        chunk,
        racesCount,
        standings.length,
        { isFirst, isLast, partIndex: i, totalParts: chunks.length },
      );
      return {
        text: isFirst ? fallbackText : undefined,
        cardsV2: [{ cardId: `champ-${i}-${Date.now()}`, card }],
      };
    });
  }

  // ── Card builders ──────────────────────────────────────────

  private buildLiveCard(
    grid: StartingGridEntry[],
    greenLight: Date,
  ): ChatCard {
    const dateStr = formatRaceDate(greenLight);
    const greenLightStr = formatRaceTime(greenLight);

    return {
      header: {
        title: `<font color="${COLOR_HEX.LIVE}"><b>EN DIRECTO</b></font> · Daily Race`,
        subtitle: dateStr,
      },
      sectionDividerStyle: 'SOLID_DIVIDER',
      sections: [
        this.summarySection(grid, greenLightStr, /* live */ true),
        ...this.podiumSection(grid),
        this.parrillaSection(grid, /* live */ true),
        ...this.statsSection(grid, greenLight),
        this.footerSection(/* live */ true),
      ].filter(Boolean) as Section[],
    };
  }

  private buildRaceCard(race: Race, _isLive: boolean): ChatCard {
    const grid = race.startingGrid;
    const dateStr = formatRaceDate(race.greenLight);
    const greenLightStr = formatRaceTime(race.greenLight);

    return {
      header: {
        title: `<font color="${COLOR_HEX.RACE}"><b>DAILY RACE</b></font>`,
        subtitle: dateStr,
      },
      sectionDividerStyle: 'SOLID_DIVIDER',
      sections: [
        this.summarySection(grid, greenLightStr, /* live */ false),
        ...this.podiumSection(grid),
        this.parrillaSection(grid, /* live */ false),
        ...this.statsSection(grid, race.greenLight),
        this.footerSection(/* live */ false),
      ],
    };
  }

  private buildChampionshipCard(
    standings: ChampionshipStanding[],
    racesCount: number,
    totalDrivers: number,
    meta: { isFirst: boolean; isLast: boolean; partIndex: number; totalParts: number },
  ): ChatCard {
    const dateStr = formatRaceDate(new Date());
    const racesLabel = racesCount === 1 ? 'carrera' : 'carreras';
    const driversLabel = totalDrivers === 1 ? 'piloto' : 'pilotos';
    const subtitleBase = `${dateStr} · ${racesCount} ${racesLabel} · ${totalDrivers} ${driversLabel}`;
    const subtitle =
      meta.totalParts > 1
        ? `${subtitleBase} · parte ${meta.partIndex + 1}/${meta.totalParts}`
        : subtitleBase;

    const sections: Section[] = [];

    if (meta.isFirst) {
      sections.push(...this.championshipPodiumSection(standings));
    }

    sections.push(this.championshipStandingsSection(standings, meta.isFirst));

    if (meta.isLast) {
      sections.push(this.championshipLegendSection());
      sections.push(this.footerSection(false, /* championship */ true));
    }

    return {
      header: {
        title: `<font color="${COLOR_HEX.CHAMPIONSHIP}"><b>CHAMPIONSHIP</b></font>`,
        subtitle,
      },
      sectionDividerStyle: 'SOLID_DIVIDER',
      sections,
    };
  }

  // ── Section builders ───────────────────────────────────────

  private summarySection(
    grid: StartingGridEntry[],
    greenLightStr: string,
    live: boolean,
  ): Section {
    const driversLabel = grid.length === 1 ? 'piloto' : 'pilotos';
    const falseStarters = grid.filter((e) => e.isFalseStart);

    const widgets: Widget[] = [
      {
        decoratedText: {
          startIcon: { materialIcon: { name: 'traffic', weight: 500 } },
          topLabel: 'GREEN LIGHT',
          text: `<b>${greenLightStr}</b>`,
        },
      },
      {
        decoratedText: {
          startIcon: { materialIcon: { name: 'directions_car', weight: 500 } },
          topLabel: 'PARTICIPANTES',
          text: `<b>${grid.length}</b> ${driversLabel}`,
        },
      },
    ];

    if (falseStarters.length > 0) {
      const fsLabel = falseStarters.length === 1 ? 'salida en falso' : 'salidas en falso';
      widgets.push({
        decoratedText: {
          startIcon: { materialIcon: { name: 'warning', weight: 500 } },
          topLabel: 'SALIDAS EN FALSO',
          text: `<b><font color="${COLOR_HEX.FALSE_START}">${falseStarters.length}</font></b> ${fsLabel}`,
        },
      });
    }

    return {
      header: live ? 'RESUMEN' : undefined,
      widgets,
    };
  }

  private podiumSection(grid: StartingGridEntry[]): Section[] {
    const cleanGrid = grid.filter((e) => !e.isFalseStart);
    const top3 = cleanGrid.filter((e) => e.position <= 3).sort((a, b) => a.position - b.position);
    if (top3.length === 0) return [];

    const items: GridItem[] = top3.map((entry) => {
      const emoji = entry.position === 1 ? PODIUM_EMOJI.GOLD : entry.position === 2 ? PODIUM_EMOJI.SILVER : PODIUM_EMOJI.BRONZE;
      return {
        title: `${emoji} ${truncateName(entry.driver.displayName, 16)}`,
        subtitle: `${entry.points} pts · ${formatDiffShort(entry.diffSeconds)}`,
        layout: 'TEXT_BELOW',
      };
    });

    return [
      {
        header: 'PODIO',
        widgets: [
          {
            grid: {
              columnCount: top3.length,
              borderStyle: { type: 'NO_BORDER' },
              items,
            },
          },
        ],
      },
    ];
  }

  private parrillaSection(grid: StartingGridEntry[], _live: boolean): Section {
    const cleanGrid = grid.filter((e) => !e.isFalseStart).sort((a, b) => a.position - b.position);
    const falseStarters = grid.filter((e) => e.isFalseStart).sort((a, b) => b.position - a.position);

    const cleanGridSize = cleanGrid.length;
    // Order: clean grid (sorted by position), then false starters (worst first).
    const ordered = [...cleanGrid, ...falseStarters];

    // Para que busted siempre sea visible al colapsar, lo movemos a la posicion #4 si no esta ya en top3.
    const bustedIdx = ordered.findIndex((e) => e.isWorstOnGrid);
    if (bustedIdx > 3) {
      const [busted] = ordered.splice(bustedIdx, 1);
      ordered.splice(3, 0, busted);
    }

    const widgets: Widget[] = ordered.map((entry) =>
      this.gridRowWidget(entry, cleanGridSize),
    );

    const collapsible = widgets.length > PARRILLA_UNCOLLAPSED;

    return {
      header: 'PARRILLA',
      widgets: widgets.slice(0, WIDGETS_PER_CARD_LIMIT),
      collapsible,
      uncollapsibleWidgetsCount: collapsible ? PARRILLA_UNCOLLAPSED : undefined,
    };
  }

  private gridRowWidget(entry: StartingGridEntry, cleanGridSize: number): Widget {
    const role = gridEntryVisualRole({
      position: entry.position,
      isFalseStart: entry.isFalseStart,
      isWorstOnGrid: entry.isWorstOnGrid,
      cleanGridSize,
    });
    const startIcon = this.positionIcon(entry, role, cleanGridSize);
    const name = truncateName(entry.driver.displayName, NAME_MAX_LEN);
    const ptsColor = entry.points >= 0 ? COLOR_HEX.POINTS_POSITIVE : COLOR_HEX.POINTS_NEGATIVE;
    const ptsSign = entry.points > 0 ? '+' : '';
    const diffColor = this.diffColor(entry, role);
    const diffStr = formatDiffShort(entry.diffSeconds);

    const decoratedText: DecoratedText = {
      startIcon,
      topLabel: `<font color="${ptsColor}"><b>${ptsSign}${entry.points} pts</b></font>`,
      text: `<b>${this.escapeHtml(name)}</b>`,
      bottomLabel: `<font color="${diffColor}">${diffStr}</font>${entry.isFalseStart ? ' · false start' : ''}`,
      wrapText: false,
    };

    return { decoratedText };
  }

  private positionIcon(
    entry: StartingGridEntry,
    role: ReturnType<typeof gridEntryVisualRole>,
    _cleanGridSize: number,
  ) {
    // Para podio usamos emoji como parte del topLabel/text, e icono Material para el resto.
    // Como Cards V2 no permite mezclar emoji + materialIcon en startIcon, optamos por
    // usar siempre materialIcon para la posicion (consistencia visual) y el emoji
    // F1 lo embebemos en el text/topLabel via HTML cuando aporta.
    switch (role) {
      case 'podium-gold':
        return { materialIcon: { name: 'emoji_events', weight: 700, fill: 1 } };
      case 'podium-silver':
        return { materialIcon: { name: 'military_tech', weight: 600, fill: 1 } };
      case 'podium-bronze':
        return { materialIcon: { name: 'workspace_premium', weight: 600, fill: 1 } };
      case 'busted-clean':
      case 'busted-false-start':
        return { materialIcon: { name: 'sentiment_very_dissatisfied', weight: 500 } };
      case 'false-start':
        return { materialIcon: { name: 'block', weight: 500 } };
      case 'rezagado':
        return { materialIcon: { name: 'pets', weight: 500 } }; // tortuga via pets como aproximacion; alternativa: 'hourglass_bottom'
      default:
        return { materialIcon: { name: this.materialIconForPosition(entry.position) } };
    }
  }

  private materialIconForPosition(position: number): string {
    // Material Icons "looks_one"..."looks_6" + "filter_7"..."filter_9", fallback "tag" para 10+.
    if (position <= 0) return 'tag';
    const map: Record<number, string> = {
      1: 'looks_one',
      2: 'looks_two',
      3: 'looks_3',
      4: 'looks_4',
      5: 'looks_5',
      6: 'looks_6',
      7: 'filter_7',
      8: 'filter_8',
      9: 'filter_9',
    };
    return map[position] ?? 'tag';
  }

  private diffColor(
    entry: StartingGridEntry,
    role: ReturnType<typeof gridEntryVisualRole>,
  ): string {
    if (entry.isFalseStart) return COLOR_HEX.DIFF_FALSE_START;
    if (role === 'busted-clean' || role === 'rezagado') return COLOR_HEX.DIFF_LATE;
    return COLOR_HEX.TEXT_SECONDARY;
  }

  private statsSection(
    grid: StartingGridEntry[],
    _greenLight: Date,
  ): Section[] {
    const busted = grid.find((e) => e.isWorstOnGrid);
    const pole = grid.find((e) => !e.isFalseStart && e.position === 1);

    const widgets: Widget[] = [];

    if (busted) {
      widgets.push({
        decoratedText: {
          startIcon: { materialIcon: { name: 'sentiment_very_dissatisfied', weight: 500 } },
          topLabel: 'BUSTED',
          text: `<b>${this.escapeHtml(busted.driver.displayName)}</b>`,
          bottomLabel: `${formatDiffShort(busted.diffSeconds)}${busted.isFalseStart ? ' · false start' : ' · ultimo en pista'}`,
        },
      });
    }

    if (pole) {
      widgets.push({
        decoratedText: {
          startIcon: { materialIcon: { name: 'bolt', weight: 600, fill: 1 } },
          topLabel: 'POLE',
          text: `<b>${this.escapeHtml(pole.driver.displayName)}</b>`,
          bottomLabel: `${formatDiffShort(pole.diffSeconds)} · puntual`,
        },
      });
    }

    if (widgets.length === 0) return [];
    return [{ header: 'ESTADISTICAS', widgets }];
  }

  private footerSection(live: boolean, championship = false): Section {
    const tag = championship
      ? 'Daily Race · Secture · Championship'
      : live
        ? `Daily Race · Secture · Actualizado ${formatRaceTime(new Date())} ${GRID_EMOJI.LIVE} EN DIRECTO`
        : `Daily Race · Secture · ${GRID_EMOJI.CHECKERED} Carrera finalizada`;

    return {
      widgets: [
        {
          textParagraph: {
            text: `<font color="${COLOR_HEX.TEXT_TERTIARY}">${tag}</font>`,
          },
        },
      ],
    };
  }

  // ── Championship sections ──────────────────────────────────

  private championshipPodiumSection(standings: ChampionshipStanding[]): Section[] {
    const top3 = standings.filter((s) => s.rank <= 3).sort((a, b) => a.rank - b.rank);
    if (top3.length === 0) return [];

    const items: GridItem[] = top3.map((s) => {
      const emoji = s.rank === 1 ? PODIUM_EMOJI.GOLD : s.rank === 2 ? PODIUM_EMOJI.SILVER : PODIUM_EMOJI.BRONZE;
      return {
        title: `${emoji} ${truncateName(s.driver.displayName, 16)}`,
        subtitle: `${s.totalPoints} pts · ${s.wins}W · ${s.podiums}🥉`,
        layout: 'TEXT_BELOW',
      };
    });

    return [
      {
        header: 'PODIO',
        widgets: [
          {
            grid: {
              columnCount: top3.length,
              borderStyle: { type: 'NO_BORDER' },
              items,
            },
          },
        ],
      },
    ];
  }

  private championshipStandingsSection(
    standings: ChampionshipStanding[],
    isFirstChunk: boolean,
  ): Section {
    const widgets: Widget[] = standings.map((s) => this.standingsRowWidget(s));
    const collapsible = isFirstChunk && widgets.length > 5;
    return {
      header: 'CLASIFICACION',
      widgets: widgets.slice(0, WIDGETS_PER_CARD_LIMIT),
      collapsible,
      uncollapsibleWidgetsCount: collapsible ? 5 : undefined,
    };
  }

  private standingsRowWidget(s: ChampionshipStanding): Widget {
    const podiumIcon = this.standingPositionIcon(s.rank);
    const name = truncateName(s.driver.displayName, NAME_MAX_LEN);
    const ptsColor = s.totalPoints >= 0 ? COLOR_HEX.POINTS_POSITIVE : COLOR_HEX.POINTS_NEGATIVE;

    return {
      decoratedText: {
        startIcon: podiumIcon,
        topLabel: `<font color="${ptsColor}"><b>${s.totalPoints} pts</b></font>`,
        text: `<b>${this.escapeHtml(name)}</b>`,
        bottomLabel: `${s.racesAttended} GP · ${s.wins} W · ${s.podiums} PD${s.falseStarts > 0 ? ` · ${s.falseStarts} FS` : ''}`,
      },
    };
  }

  private standingPositionIcon(rank: number) {
    if (rank === 1) return { materialIcon: { name: 'emoji_events', weight: 700, fill: 1 } };
    if (rank === 2) return { materialIcon: { name: 'military_tech', weight: 600, fill: 1 } };
    if (rank === 3) return { materialIcon: { name: 'workspace_premium', weight: 600, fill: 1 } };
    return { materialIcon: { name: this.materialIconForPosition(rank) } };
  }

  private championshipLegendSection(): Section {
    return {
      header: 'LEYENDA',
      collapsible: true,
      uncollapsibleWidgetsCount: 0,
      widgets: [
        {
          textParagraph: {
            text: `<font color="${COLOR_HEX.TEXT_SECONDARY}"><b>GP</b> grandes premios · <b>W</b> victorias · <b>PD</b> podios · <b>FS</b> false starts</font>`,
          },
        },
      ],
    };
  }

  // ── Utilities ──────────────────────────────────────────────

  private chunkStandings(
    standings: ChampionshipStanding[],
  ): ChampionshipStanding[][] {
    if (standings.length <= CHAMPIONSHIP_PER_CARD) return [standings];

    const chunks: ChampionshipStanding[][] = [];
    for (let i = 0; i < standings.length; i += CHAMPIONSHIP_PER_CARD) {
      chunks.push(standings.slice(i, i + CHAMPIONSHIP_PER_CARD));
    }
    return chunks;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Test seam ──────────────────────────────────────────────
  // expuesto solo para tests; uso interno con `_` como convencion
  _isRezagadoForTest(position: number, gridSize: number): boolean {
    return isRezagado(position, gridSize);
  }
  _driverDisplay(driver: Driver): string {
    return truncateName(driver.displayName, NAME_MAX_LEN);
  }
}
