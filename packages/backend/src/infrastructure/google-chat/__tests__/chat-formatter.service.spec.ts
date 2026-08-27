import { ChatFormatterService } from '../chat-formatter.service';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';
import { COLOR_HEX } from '../../formatting';
import {
  ChatCard,
  DecoratedText,
  GridWidget,
  Section,
  Widget,
} from '../chat-card.types';

const GREEN_LIGHT = new Date('2026-04-28T07:30:00Z'); // 09:30 Madrid

function makeEntry(
  position: number,
  name: string,
  points: number,
  diffSeconds: number,
  isFalseStart = false,
  isWorstOnGrid = false,
): StartingGridEntry {
  return new StartingGridEntry(
    position,
    new Driver(`d${position}`, `g${position}`, name, null),
    new Date(GREEN_LIGHT.getTime() + diffSeconds * 1000),
    GREEN_LIGHT,
    points,
    isFalseStart,
    isWorstOnGrid,
  );
}

function makeRace(entries: StartingGridEntry[]): Race {
  return new Race(
    'race-1',
    'conf/1',
    'abc-defg-hij',
    GREEN_LIGHT,
    new Date('2026-04-28T07:35:00Z'),
    RaceStatus.PROCESSED,
    entries,
    new Date(),
  );
}

function findSection(card: ChatCard, header: string): Section | undefined {
  return card.sections?.find((s) => s.header === header);
}

function isDecoratedText(w: Widget): w is { decoratedText: DecoratedText } {
  return 'decoratedText' in w;
}

function isGrid(w: Widget): w is { grid: GridWidget } {
  return 'grid' in w;
}

describe('ChatFormatterService', () => {
  let formatter: ChatFormatterService;

  beforeEach(() => {
    formatter = new ChatFormatterService();
  });

  describe('formatLiveRaceMessage', () => {
    it('returns text fallback and cardsV2', () => {
      const grid = [
        makeEntry(1, 'Alice', 25, 1.234),
        makeEntry(2, 'Bob', 18, 3.1),
      ];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);

      expect(message.text).toContain('en directo');
      expect(message.cardsV2).toHaveLength(1);
      expect(message.cardsV2![0].cardId).toMatch(/^live-/);
    });

    it('uses LIVE color in header title', () => {
      const grid = [makeEntry(1, 'Alice', 25, 1.234)];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;

      expect(card.header?.title).toContain(COLOR_HEX.LIVE);
      expect(card.header?.title).toContain('EN DIRECTO');
    });

    it('summary section includes green light, participants, and false starts when present', () => {
      const grid = [
        makeEntry(0, 'Early', -5, -10, true, true),
        makeEntry(1, 'Alice', 25, 1.234),
      ];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const summary = findSection(card, 'RESUMEN')!;

      expect(summary.widgets).toHaveLength(3); // green light + participants + false starts
      const widgets = summary.widgets.filter(isDecoratedText);
      expect(widgets[0].decoratedText.topLabel).toBe('GREEN LIGHT');
      expect(widgets[1].decoratedText.topLabel).toBe('PARTICIPANTES');
      expect(widgets[2].decoratedText.topLabel).toBe('SALIDAS EN FALSO');
    });

    it('summary section has only 2 widgets when no false starts', () => {
      const grid = [makeEntry(1, 'Alice', 25, 1.234)];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const summary = findSection(card, 'RESUMEN')!;

      expect(summary.widgets).toHaveLength(2);
    });

    it('renders a podium grid with up to 3 clean drivers', () => {
      const grid = [
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, 'Bob', 18, 2.0),
        makeEntry(3, 'Charlie', 15, 3.0),
        makeEntry(4, 'Diana', 12, 4.0),
      ];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const podium = findSection(card, 'PODIO')!;

      const gridWidget = podium.widgets.find(isGrid)!;
      expect(gridWidget.grid.columnCount).toBe(3);
      expect(gridWidget.grid.items).toHaveLength(3);
      expect(gridWidget.grid.items[0].title).toContain('Alice');
      expect(gridWidget.grid.items[1].title).toContain('Bob');
      expect(gridWidget.grid.items[2].title).toContain('Charlie');
    });

    it('omits podium section when no clean drivers', () => {
      const grid = [makeEntry(0, 'Early', -5, -10, true, true)];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;

      expect(findSection(card, 'PODIO')).toBeUndefined();
    });

    it('parrilla has one widget per driver and is collapsible when more than 4', () => {
      const grid = Array.from({ length: 8 }, (_, i) => makeEntry(i + 1, `D${i + 1}`, 10, i));
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const parrilla = findSection(card, 'PARRILLA')!;

      expect(parrilla.widgets).toHaveLength(8);
      expect(parrilla.collapsible).toBe(true);
      expect(parrilla.uncollapsibleWidgetsCount).toBe(4);
    });

    it('moves busted to position 4 in the visible parrilla rows', () => {
      const grid = [
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, 'Bob', 18, 2.0),
        makeEntry(3, 'Charlie', 15, 3.0),
        makeEntry(4, 'Diana', 12, 4.0),
        makeEntry(5, 'Eve', 10, 5.0),
        makeEntry(6, 'Frank', 8, 6.0, false, true), // busted
      ];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const parrilla = findSection(card, 'PARRILLA')!;
      const visibleWidgets = parrilla.widgets.slice(0, 4).filter(isDecoratedText);

      // The 4th visible widget should be Frank (busted), not Diana.
      expect(visibleWidgets[3].decoratedText.text).toContain('Frank');
    });

    it('stats section includes busted and pole', () => {
      const grid = [
        makeEntry(1, 'Alice', 25, 1.234),
        makeEntry(0, 'Eve', -5, -15, true, true),
      ];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const stats = findSection(card, 'ESTADISTICAS')!;

      expect(stats.widgets).toHaveLength(2);
      const widgets = stats.widgets.filter(isDecoratedText);
      expect(widgets[0].decoratedText.topLabel).toBe('BUSTED');
      expect(widgets[0].decoratedText.text).toContain('Eve');
      expect(widgets[1].decoratedText.topLabel).toBe('POLE');
      expect(widgets[1].decoratedText.text).toContain('Alice');
    });

    it('omits stats section when no busted nor pole', () => {
      const grid = [makeEntry(0, 'Early', -5, -10, true, false)];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;

      expect(findSection(card, 'ESTADISTICAS')).toBeUndefined();
    });

    it('escapes HTML in driver names', () => {
      const grid = [makeEntry(1, 'Alice <script>', 25, 1.0)];
      const message = formatter.formatLiveRaceMessage(grid, GREEN_LIGHT);
      const card = message.cardsV2![0].card;
      const parrilla = findSection(card, 'PARRILLA')!;
      const row = parrilla.widgets.filter(isDecoratedText)[0];

      expect(row.decoratedText.text).toContain('&lt;script&gt;');
      expect(row.decoratedText.text).not.toContain('<script>');
    });
  });

  describe('formatRaceMessage', () => {
    it('uses RACE color in header title', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.234),
        makeEntry(2, 'Bob', 18, 3.1, false, true),
      ]);
      const message = formatter.formatRaceMessage(race);
      const card = message.cardsV2![0].card;

      expect(card.header?.title).toContain(COLOR_HEX.RACE);
      expect(card.header?.title).toContain('DAILY RACE');
      expect(card.header?.title).not.toContain('EN DIRECTO');
    });

    it('text fallback announces winner', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.234),
        makeEntry(2, 'Bob', 18, 3.1),
      ]);
      const message = formatter.formatRaceMessage(race);

      expect(message.text).toContain('Alice');
      expect(message.text).toContain('25 pts');
    });

    it('cardId references the race id', () => {
      const race = makeRace([makeEntry(1, 'Alice', 25, 1.234)]);
      const message = formatter.formatRaceMessage(race);
      expect(message.cardsV2![0].cardId).toBe('race-race-1');
    });
  });

  describe('formatChampionshipMessages', () => {
    it('returns empty array when no standings', () => {
      expect(formatter.formatChampionshipMessages([], 0)).toEqual([]);
    });

    it('returns one message for small championships', () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Alice', null), 290, 3, 0, 1, 1, 1, 3),
        new ChampionshipStanding(new Driver('d2', 'g2', 'Bob', null), 250, 3, 1, 2, 2, 0, 2),
      ];
      const messages = formatter.formatChampionshipMessages(standings, 3);

      expect(messages).toHaveLength(1);
      expect(messages[0].cardsV2![0].card.header?.title).toContain(COLOR_HEX.CHAMPIONSHIP);
    });

    it('text fallback announces leader', () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Alice', null), 290, 3, 0, 1, 1, 1, 3),
      ];
      const messages = formatter.formatChampionshipMessages(standings, 3);
      expect(messages[0].text).toContain('Alice');
      expect(messages[0].text).toContain('290 pts');
    });

    it('uses singular for 1 race / 1 piloto', () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Solo', null), 25, 1, 0, 1, 1, 1, 1),
      ];
      const messages = formatter.formatChampionshipMessages(standings, 1);
      expect(messages[0].cardsV2![0].card.header?.subtitle).toContain('1 carrera');
      expect(messages[0].cardsV2![0].card.header?.subtitle).toContain('1 piloto');
    });

    it('chunks championships over 50 standings', () => {
      const standings = Array.from(
        { length: 75 },
        (_, i) =>
          new ChampionshipStanding(
            new Driver(`d${i}`, `g${i}`, `Driver ${i}`, null),
            200 - i,
            10,
            0,
            i + 1,
            i + 1,
          ),
      );
      const messages = formatter.formatChampionshipMessages(standings, 10);

      expect(messages.length).toBeGreaterThan(1);
      // First chunk has podium, last has legend
      expect(messages[0].cardsV2![0].card.sections?.some((s) => s.header === 'PODIO')).toBe(true);
      expect(messages[messages.length - 1].cardsV2![0].card.sections?.some((s) => s.header === 'LEYENDA')).toBe(true);
    });

    it('podium grid has top 3 with podium emojis', () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Alice', null), 290, 3, 0, 1, 1, 1, 3),
        new ChampionshipStanding(new Driver('d2', 'g2', 'Bob', null), 250, 3, 1, 2, 2, 0, 2),
        new ChampionshipStanding(new Driver('d3', 'g3', 'Charlie', null), 200, 3, 0, 3, 3, 0, 1),
      ];
      const messages = formatter.formatChampionshipMessages(standings, 3);
      const card = messages[0].cardsV2![0].card;
      const podium = card.sections?.find((s) => s.header === 'PODIO');
      expect(podium).toBeDefined();
      const gridWidget = podium!.widgets.find(isGrid)!;
      expect(gridWidget.grid.items).toHaveLength(3);
    });

    it('legend section is collapsible and hidden by default', () => {
      const standings = [
        new ChampionshipStanding(new Driver('d1', 'g1', 'Alice', null), 290, 3, 0, 1, 1, 1, 3),
      ];
      const messages = formatter.formatChampionshipMessages(standings, 3);
      const legend = messages[0].cardsV2![0].card.sections?.find(
        (s) => s.header === 'LEYENDA',
      );
      expect(legend?.collapsible).toBe(true);
      expect(legend?.uncollapsibleWidgetsCount).toBe(0);
    });
  });
});
