import { DiscordFormatterService } from '../discord-formatter.service';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';

function makeEntry(
  position: number,
  name: string,
  points: number,
  diffSeconds: number,
  isFalseStart = false,
  isLastOnGrid = false,
): StartingGridEntry {
  const gl = new Date('2026-03-27T09:00:00Z');
  return new StartingGridEntry(
    position,
    new Driver('d1', 'g1', name, null),
    new Date(gl.getTime() + diffSeconds * 1000),
    gl,
    points,
    isFalseStart,
    isLastOnGrid,
  );
}

function makeRace(entries: StartingGridEntry[]): Race {
  return new Race(
    'race-1',
    'conf/1',
    'abc-defg-hij',
    new Date('2026-03-27T09:00:00Z'),
    new Date('2026-03-27T09:30:00Z'),
    RaceStatus.PROCESSED,
    entries,
    new Date(),
  );
}

describe('DiscordFormatterService', () => {
  let formatter: DiscordFormatterService;

  beforeEach(() => {
    formatter = new DiscordFormatterService();
  });

  describe('formatRaceEmbeds', () => {
    it('should format a clean race with no false starts', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, 'Bob', 18, 3.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);

      expect(embeds.length).toBeGreaterThanOrEqual(1);
      expect(embeds[0].title).toContain('DAILY RACE');
      expect(embeds[0].description).toContain('Piloto');
      expect(embeds[0].description).toContain('Alice');
      expect(embeds[0].description).toContain('Bob');
    });

    it('should include false start entries and green light marker', () => {
      const race = makeRace([
        makeEntry(0, 'Early', -5, -15, true, true),
        makeEntry(1, 'OnTime', 25, 1.0, false, false),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;

      expect(desc).toContain('Early');
      expect(desc).toContain('OnTime');
      // Green light marker is rendered between false starts and parrilla
      expect(desc).toMatch(/\d{2}:\d{2}/);
    });

    it('should include title with date and summary with time + pilot count', () => {
      const race = makeRace([
        makeEntry(1, 'Winner', 25, 0.5),
        makeEntry(2, 'Last', 1, 10.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);

      expect(embeds[0].title).toContain('DAILY RACE');
      expect(embeds[0].description).toMatch(/\d{2}:\d{2}/);
      expect(embeds[0].description).toMatch(/\*\*2\*\*\s+pilotos/);
    });

    it('should include king of ruina in stats', () => {
      const race = makeRace([
        makeEntry(1, 'Winner', 25, 0.5),
        makeEntry(2, 'Last', 1, 10.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const lastEmbed = embeds[embeds.length - 1];

      expect(lastEmbed.fields).toHaveLength(1);
      const stats = lastEmbed.fields![0].value;
      expect(stats).toContain('Rey de la Ruina');
      expect(stats).toContain('Last');
    });

    it('should mention false starter count in stats', () => {
      const race = makeRace([
        makeEntry(0, 'EarlyBird', -5, -5, true, true),
        makeEntry(1, 'Normal', 25, 3.0, false, false),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const stats = embeds[embeds.length - 1].fields![0].value;
      expect(stats).toContain('Salida en falso');
      expect(stats).toMatch(/Salida en falso: \*?\*?1\*?\*?/);
    });

    it('should have footer and timestamp on last embed', () => {
      const race = makeRace([makeEntry(1, 'Solo', 95.0, 1.5, false, true)]);

      const embeds = formatter.formatRaceEmbeds(race);
      const last = embeds[embeds.length - 1];

      expect(last.footer?.text).toContain('Secture');
      expect(last.timestamp).toBeDefined();
    });
  });

  describe('formatChampionshipEmbeds', () => {
    it('should return empty array for empty standings', () => {
      const result = formatter.formatChampionshipEmbeds([], 0);
      expect(result).toEqual([]);
    });

    it('should format standings with header and rows', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Alice', null),
          290, 3, 0, 1, 1,
        ),
        new ChampionshipStanding(
          new Driver('d2', 'g2', 'Bob', null),
          250, 3, 1, 2, 2,
        ),
      ];

      const embeds = formatter.formatChampionshipEmbeds(standings, 3);

      expect(embeds.length).toBeGreaterThanOrEqual(1);
      expect(embeds[0].title).toContain('CHAMPIONSHIP');
      expect(embeds[0].description).toContain('Piloto');
      expect(embeds[0].description).toContain('Pts');
      expect(embeds[0].description).toContain('GP');
      expect(embeds[0].description).toContain('W');
      expect(embeds[0].description).toContain('PD');
      expect(embeds[0].description).toContain('Alice');
      expect(embeds[0].description).toContain('Bob');
      expect(embeds[0].color).toBe(0xffd700);
    });

    it('should show races and driver counts in description summary', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Leader', null),
          125, 5, 0, 1, 1,
        ),
      ];

      const embeds = formatter.formatChampionshipEmbeds(standings, 5);

      expect(embeds[0].description).toMatch(/\*\*5\*\*\s+carreras/);
      expect(embeds[0].description).toMatch(/\*\*1\*\*\s+piloto/);
      expect(embeds[0].fields).toBeUndefined();
    });

    it('should use singular for 1 race and 1 piloto', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Solo', null),
          100, 1, 0, 1, 1,
        ),
      ];

      const embeds = formatter.formatChampionshipEmbeds(standings, 1);
      expect(embeds[0].description).toMatch(/\*\*1\*\*\s+carrera/);
      expect(embeds[0].description).toMatch(/\*\*1\*\*\s+piloto/);
    });
  });

  describe('formatting utilities', () => {
    it('should format positive diff correctly', () => {
      expect(formatter.formatDiff(5.123).trim()).toBe('+5.123');
      expect(formatter.formatDiff(0.5).trim()).toBe('+0.500');
    });

    it('should format negative diff correctly', () => {
      expect(formatter.formatDiff(-15.5).trim()).toBe('-15.500');
    });

    it('should format diff over 60s as min:sec', () => {
      expect(formatter.formatDiff(90.5).trim()).toBe('+1:30.500');
    });

    it('should truncate long names', () => {
      expect(formatter.truncate('Short', 10)).toBe('Short     ');
      expect(formatter.truncate('Very Long Name Here', 10)).toBe(
        'Very Long\u2026',
      );
    });

    it('should assign correct position labels', () => {
      const e1 = makeEntry(1, 'A', 100, 0);
      const e2 = makeEntry(2, 'B', 90, 1);
      const e3 = makeEntry(3, 'C', 80, 2);
      const e4 = makeEntry(4, 'D', 70, 3);
      const efs = makeEntry(0, 'E', -100, -5, true);
      const elast = makeEntry(5, 'F', 60, 4, false, true);

      expect(formatter.positionLabel(e1)).toContain('\u{1F3C6}');
      expect(formatter.positionLabel(e2)).toContain('\u{1F948}');
      expect(formatter.positionLabel(e3)).toContain('\u{1F949}');
      expect(formatter.positionLabel(e4)).toContain('4');
      expect(formatter.positionLabel(efs)).toContain('\u{26D4}');
      expect(formatter.positionLabel(elast)).toContain('\u{1F451}');
    });

    it('should mark rezagados with turtle emoji', () => {
      const rezagado = makeEntry(5, 'Slow', 10, 90);
      expect(formatter.positionLabel(rezagado)).toContain('\u{1F422}');
    });

    it('should not mark normal entries as rezagados', () => {
      const normal = makeEntry(5, 'Fast', 90, 3);
      expect(formatter.positionLabel(normal)).not.toContain('\u{1F422}');
    });

    it('should chunk text correctly', () => {
      const text = Array(100).fill('Line of text').join('\n');
      const chunks = formatter.chunkText(text, 200);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(200));
    });
  });

  describe('edge cases', () => {
    it('should not render green light marker when there are no false starts', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, 'Bob', 18, 2.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;
      // The clock emoji 🚥 is used by the green light marker; it must NOT appear
      // in the grid body (it IS present in the summary line above the ``` block)
      const gridBody = desc.split('```')[1] ?? '';
      expect(gridBody).not.toContain('\u{1F6A5}');
    });

    it('should render grid even if all entries are false starts', () => {
      const race = makeRace([
        makeEntry(2, 'EarlyEarly', -5, -30, true, true),
        makeEntry(1, 'Early', -5, -5, true, false),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;
      expect(desc).toContain('EarlyEarly');
      expect(desc).toContain('Early');
      // Green light marker still renders (falseStarters.length > 0)
      expect(desc).toContain('\u{1F6A5}');
    });

    it('should stay within Discord description limit for large championships', () => {
      // 60 drivers: realistic upper bound for Secture
      const standings = Array.from(
        { length: 60 },
        (_, i) =>
          new ChampionshipStanding(
            new Driver(`d${i}`, `g${i}`, `Driver Number ${i}`, null),
            200 - i * 3,
            10,
            0,
            i + 1,
            i + 1,
            i < 5 ? 1 : 0,
            i < 10 ? 2 : 0,
          ),
      );

      const embeds = formatter.formatChampionshipEmbeds(standings, 10);

      expect(embeds.length).toBeGreaterThan(0);
      embeds.forEach((embed) => {
        expect(embed.description!.length).toBeLessThanOrEqual(4096);
      });
    });

    it('should include legend only on the last embed of a multi-chunk championship', () => {
      // Force multi-chunk by using many long names
      const standings = Array.from(
        { length: 100 },
        (_, i) =>
          new ChampionshipStanding(
            new Driver(
              `d${i}`,
              `g${i}`,
              `Long Driver Name ${i} Extra Padding`,
              null,
            ),
            100,
            10,
            0,
            i + 1,
            i + 1,
            0,
            0,
          ),
      );

      const embeds = formatter.formatChampionshipEmbeds(standings, 10);
      expect(embeds.length).toBeGreaterThan(1);

      // Only the last embed carries the legend
      const legendText = '**GP** grandes premios';
      const embedsWithLegend = embeds.filter((e) =>
        e.description!.includes(legendText),
      );
      expect(embedsWithLegend).toHaveLength(1);
      expect(
        embeds[embeds.length - 1].description!.includes(legendText),
      ).toBe(true);
    });

    it('should include summary only on the first embed of a multi-chunk race', () => {
      const entries = Array.from({ length: 200 }, (_, i) =>
        makeEntry(
          i + 1,
          `Very Long Driver Name ${i}`,
          i < 10 ? 25 : 1,
          i + 0.5,
        ),
      );
      entries[entries.length - 1] = makeEntry(
        200,
        'LastDriver',
        1,
        199.5,
        false,
        true,
      );
      const race = makeRace(entries);

      const embeds = formatter.formatRaceEmbeds(race);
      expect(embeds.length).toBeGreaterThan(1);

      const summaryText = '**200** pilotos';
      expect(embeds[0].description!).toContain(summaryText);
      // Following embeds should not repeat the summary
      for (let i = 1; i < embeds.length; i++) {
        expect(embeds[i].description!).not.toContain(summaryText);
      }
    });
  });
});
