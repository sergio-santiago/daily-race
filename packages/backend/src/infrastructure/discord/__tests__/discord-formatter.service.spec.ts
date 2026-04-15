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
        makeEntry(1, 'Alice', 96.74, 1.0),
        makeEntry(2, 'Bob', 90.40, 3.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);

      expect(embeds.length).toBeGreaterThanOrEqual(1);
      expect(embeds[0].title).toContain('DAILY RACE');
      expect(embeds[0].description).toContain('PARRILLA DE SALIDA');
      expect(embeds[0].description).not.toContain('SALIDA EN FALSO');
      expect(embeds[0].description).toContain('Alice');
      expect(embeds[0].description).toContain('Bob');
    });

    it('should include false start section when present', () => {
      const race = makeRace([
        makeEntry(0, 'Early', -300, -15, true),
        makeEntry(1, 'OnTime', 96.74, 1.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;

      expect(desc).toContain('SALIDA EN FALSO');
      expect(desc).toContain('PARRILLA DE SALIDA');
      expect(desc).toContain('Early');
    });

    it('should include stats with green light, winner, and last', () => {
      const race = makeRace([
        makeEntry(1, 'Winner', 98.0, 0.5),
        makeEntry(2, 'Last', 50.0, 10.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const lastEmbed = embeds[embeds.length - 1];

      expect(lastEmbed.fields).toHaveLength(1);
      const stats = lastEmbed.fields![0].value;
      expect(stats).toContain('Green Light');
      expect(stats).toContain('Winner');
      expect(stats).toContain('Last');
      expect(stats).toContain('2');
    });

    it('should mention false starters in stats', () => {
      const race = makeRace([
        makeEntry(0, 'EarlyBird', -100, -5, true),
        makeEntry(1, 'Normal', 90.0, 3.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const stats = embeds[embeds.length - 1].fields![0].value;
      expect(stats).toContain('Salida en falso');
      expect(stats).toContain('EarlyBird');
    });

    it('should have footer and timestamp on last embed', () => {
      const race = makeRace([makeEntry(1, 'Solo', 95.0, 1.5, false, true)]);

      const embeds = formatter.formatRaceEmbeds(race);
      const last = embeds[embeds.length - 1];

      expect(last.footer?.text).toContain('Secture');
      expect(last.timestamp).toBeDefined();
    });
  });

  describe('formatChampionshipEmbed', () => {
    it('should return null for empty standings', () => {
      const result = formatter.formatChampionshipEmbed([], 0);
      expect(result).toBeNull();
    });

    it('should format standings with header and rows', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Alice', null),
          290.5, 3, 0, 1, 1,
        ),
        new ChampionshipStanding(
          new Driver('d2', 'g2', 'Bob', null),
          250.3, 3, 1, 2, 2,
        ),
      ];

      const result = formatter.formatChampionshipEmbed(standings, 3);

      expect(result).not.toBeNull();
      expect(result!.title).toContain('CHAMPIONSHIP');
      expect(result!.description).toContain('Piloto');
      expect(result!.description).toContain('Total');
      expect(result!.description).toContain('Alice');
      expect(result!.description).toContain('Bob');
      expect(result!.color).toBe(0xffd700);
    });

    it('should show leader in stats', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Leader', null),
          125, 5, 0, 1, 1,
        ),
      ];

      const result = formatter.formatChampionshipEmbed(standings, 5);
      const stats = result!.fields![0].value;

      expect(stats).toContain('L\u00edder');
      expect(stats).toContain('Leader');
      expect(stats).toContain('125');
      expect(stats).toContain('5');
    });

    it('should use singular for 1 race', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Solo', null),
          100.0, 1, 0, 1, 1,
        ),
      ];

      const result = formatter.formatChampionshipEmbed(standings, 1);
      expect(result!.fields![0].value).toContain('Carreras disputadas: **1**');
    });
  });

  describe('formatting utilities', () => {
    it('should format positive diff correctly', () => {
      expect(formatter.formatDiff(5.123).trim()).toBe('+5.123s');
      expect(formatter.formatDiff(0.5).trim()).toBe('+0.500s');
    });

    it('should format negative diff correctly', () => {
      expect(formatter.formatDiff(-15.5).trim()).toBe('-15.500s');
    });

    it('should format diff over 60s as min:sec', () => {
      expect(formatter.formatDiff(90.5).trim()).toBe('+1:30.500');
    });

    it('should truncate long names', () => {
      expect(formatter.truncate('Short', 10)).toBe('Short     ');
      expect(formatter.truncate('Very Long Name Here', 10)).toBe('Very Long.');
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
});
