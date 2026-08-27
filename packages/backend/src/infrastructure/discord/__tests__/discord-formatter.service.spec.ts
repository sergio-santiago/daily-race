import { DiscordFormatterService } from '../discord-formatter.service';
import { Race, RaceStatus } from '../../../core/entities/race.entity';
import { Driver } from '../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../core/entities/starting-grid-entry.entity';
import { ChampionshipStanding } from '../../../core/entities/championship-standing.entity';
import { formatDiff as formatDiffGrafica } from '../../charts/scale';

function makeEntry(
  position: number,
  name: string,
  points: number,
  diffSeconds: number,
  isFalseStart = false,
  isWorstOnGrid = false,
): StartingGridEntry {
  const gl = new Date('2026-03-27T09:00:00Z');
  return new StartingGridEntry(
    position,
    new Driver('d1', 'g1', name, null),
    new Date(gl.getTime() + diffSeconds * 1000),
    gl,
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

    it('should include busted in stats', () => {
      const race = makeRace([
        makeEntry(1, 'Winner', 25, 0.5),
        makeEntry(2, 'Last', 1, 10.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const lastEmbed = embeds[embeds.length - 1];

      expect(lastEmbed.fields).toHaveLength(1);
      const stats = lastEmbed.fields![0].value;
      expect(stats).toContain('Busted');
      expect(stats).toContain('Last');
    });

    it('should mention false starter count in summary', () => {
      const race = makeRace([
        makeEntry(0, 'EarlyBird', -5, -5, true, true),
        makeEntry(1, 'Normal', 25, 3.0, false, false),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;
      expect(desc).toContain('salida en falso');
      expect(desc).toMatch(/\*\*1\*\*\s+salida en falso/);
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
      // Por encima del minuto el milisegundo se pierde a proposito: "+1:30.500"
      // son 9 celdas en una columna de 7 y rompia la fila. 90,5 s redondea a 91
      expect(formatter.formatDiff(90.5).trim()).toBe('+1:31');
      expect(formatter.formatDiff(1941.8).trim()).toBe('+32:22');
      expect(formatter.formatDiff(-1941).trim()).toBe('-32:21');
      // El total se redondea entero, no cada parte: 119,7 s no puede dar "1:60"
      expect(formatter.formatDiff(119.7).trim()).toBe('+2:00');
      // Justo por debajo del minuto los milisegundos siguen ahi
      expect(formatter.formatDiff(59.999).trim()).toBe('+59.999');
    });

    it('recorta en seco por encima de los 999 minutos antes que desbordar', () => {
      // Dato imposible en una daily de quince minutos, pero la columna son 7
      // celdas y no puede crecer por un valor roto
      expect(formatter.formatDiff(60_000)).toHaveLength(7);
      expect(formatter.visualWidth(formatter.formatDiff(60_000))).toBe(7);
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
      expect(formatter.positionLabel(elast)).toContain('\u{1F480}');
    });

    it('should mark rezagados in bottom 10% with turtle emoji', () => {
      // Position 19 out of 20 clean drivers → in bottom 10%
      const rezagado = makeEntry(19, 'Slow', 1, 90);
      expect(formatter.positionLabel(rezagado, 20)).toContain('\u{1F422}');
    });

    it('should not mark entries outside bottom 10% as rezagados', () => {
      // Position 5 out of 20 clean drivers → not in bottom 10%
      const normal = makeEntry(5, 'Fast', 90, 3);
      expect(formatter.positionLabel(normal, 20)).not.toContain('\u{1F422}');
    });

    it('should chunk text correctly', () => {
      const text = Array(100).fill('Line of text').join('\n');
      const chunks = formatter.chunkText(text, 200);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(200));
    });
  });

  describe('edge cases', () => {
    it('should always render green light marker in grid', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, 'Bob', 18, 2.0, false, true),
      ]);

      const embeds = formatter.formatRaceEmbeds(race);
      const desc = embeds[0].description!;
      const gridBody = desc.split('```')[1] ?? '';
      expect(gridBody).toContain('\u{1F6A5}');
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
        { length: 300 },
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
      const legendText = '**W** victorias';
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

  describe('formatLiveRaceEmbeds', () => {
    // Es el mensaje que se reescribe en CADA entrada de piloto y no tenia ni un
    // test, asi que espeja lo que ya se le exige al mensaje final.

    const liveGrid = [
      makeEntry(1, 'Alice', 25, 1.0),
      makeEntry(2, 'Bob', 18, 3.0, false, true),
    ];
    const GREEN_LIGHT = new Date('2026-03-27T09:00:00Z');

    it('se anuncia como en directo en el titulo, el color y el pie', () => {
      const embeds = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);
      const last = embeds[embeds.length - 1];

      expect(embeds[0].title).toContain('EN DIRECTO');
      expect(embeds[0].color).toBe(0xe74c3c);
      expect(last.footer?.text).toContain('EN DIRECTO');
      expect(last.footer?.text).toContain('Secture');
      expect(last.timestamp).toBeDefined();
    });

    it('no se confunde con el mensaje de resultados', () => {
      const live = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);
      const final = formatter.formatRaceEmbeds(makeRace(liveGrid));

      expect(final[0].title).not.toContain('EN DIRECTO');
      expect(final[0].color).not.toBe(live[0].color);
      expect(final[final.length - 1].footer?.text).not.toContain('EN DIRECTO');
    });

    it('concuerda el singular y el plural de piloto', () => {
      const one = formatter.formatLiveRaceEmbeds(
        [makeEntry(1, 'Solo', 25, 1.0)],
        GREEN_LIGHT,
      );
      const two = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);

      expect(one[0].description!).toMatch(/\*\*1\*\*\s+piloto(?!s)/);
      expect(two[0].description!).toMatch(/\*\*2\*\*\s+pilotos/);
    });

    it('concuerda el singular y el plural de salida en falso', () => {
      const one = formatter.formatLiveRaceEmbeds(
        [makeEntry(0, 'Early', -5, -15, true, true), makeEntry(1, 'OnTime', 25, 1)],
        GREEN_LIGHT,
      );
      const two = formatter.formatLiveRaceEmbeds(
        [
          makeEntry(0, 'Early', -5, -15, true, true),
          makeEntry(0, 'Earlier', -5, -30, true),
          makeEntry(1, 'OnTime', 25, 1),
        ],
        GREEN_LIGHT,
      );

      expect(one[0].description!).toMatch(/\*\*1\*\*\s+salida en falso/);
      expect(two[0].description!).toMatch(/\*\*2\*\*\s+salidas en falso/);
    });

    it('no menciona salidas en falso cuando no hay ninguna', () => {
      const embeds = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);

      expect(embeds[0].description!).not.toContain('en falso');
    });

    it('pone el marcador del semaforo dentro del bloque de codigo', () => {
      const embeds = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);
      const body = embeds[0].description!.split('```')[1];

      expect(body).toContain('\u{1F6A5}');
      expect(body).toContain('Alice');
      expect(body).toContain('Bob');
      // El marcador lleva la hora del semaforo, no la del piloto
      expect(body).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('anade el chip de busted cuando ya hay un ultimo de la clase', () => {
      const embeds = formatter.formatLiveRaceEmbeds(liveGrid, GREEN_LIGHT);
      const last = embeds[embeds.length - 1];

      expect(last.fields).toHaveLength(1);
      expect(last.fields![0].value).toContain('Busted');
      expect(last.fields![0].value).toContain('Bob');
      expect(last.fields![0].value).toContain('+3.000');
    });

    it('se queda sin estadisticas mientras no haya busted', () => {
      const embeds = formatter.formatLiveRaceEmbeds(
        [makeEntry(1, 'Alice', 25, 1.0), makeEntry(2, 'Bob', 18, 3.0)],
        GREEN_LIGHT,
      );
      const last = embeds[embeds.length - 1];

      expect(last.fields).toBeUndefined();
      expect(last.footer?.text).toContain('EN DIRECTO');
    });

    it('trocea la parrilla en varios embeds con muchisimos pilotos', () => {
      const many = Array.from({ length: 200 }, (_, i) =>
        makeEntry(i + 1, `Very Long Driver Name ${i}`, i < 10 ? 25 : 1, i + 0.5),
      );
      many[many.length - 1] = makeEntry(200, 'LastDriver', 1, 199.5, false, true);

      const embeds = formatter.formatLiveRaceEmbeds(many, GREEN_LIGHT);

      expect(embeds.length).toBeGreaterThan(1);
      // El resumen solo en el primero y el pie solo en el ultimo
      expect(embeds[0].description!).toContain('**200** pilotos');
      expect(embeds[0].title).toContain('EN DIRECTO');
      for (let i = 1; i < embeds.length; i++) {
        expect(embeds[i].description!).not.toContain('**200** pilotos');
        expect(embeds[i].title).toBeUndefined();
      }
      const withFooter = embeds.filter((e) => e.footer != null);
      expect(withFooter).toHaveLength(1);
      expect(embeds[embeds.length - 1].fields).toHaveLength(1);
      embeds.forEach((embed) =>
        expect(embed.description!.length).toBeLessThanOrEqual(4096),
      );
    });
  });

  describe('ancho de las filas', () => {
    // Presupuesto duro: 33 celdas. Discord parte la linea en cuanto se pasa, y
    // una fila partida descuadra la tabla entera del embed.
    const BUDGET = 33;
    const DIFFS = [0.5, 60, 600, 1941, 1941.8, -0.5, -60, -1941];

    it('ninguna fila de la parrilla pasa de las 33 celdas', () => {
      for (const diff of DIFFS) {
        const rows = [
          formatter.formatGridRow(makeEntry(1, 'Alice', 25, diff), 20),
          formatter.formatGridRow(makeEntry(2, 'Bob', 18, diff), 20),
          formatter.formatGridRow(makeEntry(3, 'Carla', 15, diff), 20),
          formatter.formatGridRow(
            makeEntry(4, 'Enrique Caballero Domínguez', 12, diff),
            20,
          ),
          formatter.formatGridRow(makeEntry(19, 'Rezagado', 1, diff), 20),
          formatter.formatGridRow(
            makeEntry(20, 'Ultimo', 1, diff, false, true),
            20,
          ),
          formatter.formatGridRow(makeEntry(0, 'Early', -5, diff, true), 20),
          formatter.formatGridRow(
            makeEntry(0, 'Earliest', -5, diff, true, true),
            20,
          ),
        ];
        for (const row of rows) {
          expect(formatter.visualWidth(row)).toBe(BUDGET);
        }
      }
    });

    it('la cabecera y el marcador del semaforo miden lo mismo que las filas', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 0.5),
        makeEntry(2, 'Bob', 18, 1941, false, true),
      ]);
      const body = formatter.formatRaceEmbeds(race)[0].description!.split('```')[1];

      for (const line of body.split('\n')) {
        if (line.trim() === '') continue;
        expect(formatter.visualWidth(line)).toBeLessThanOrEqual(BUDGET);
      }
    });

    it('cuenta el emoji como dos celdas al recortar el nombre', () => {
      // Un emoji ocupa dos celdas y contar caracteres desbordaba la columna: un
      // nombre con una familia unida por ZWJ llegaba a 34 celdas
      const hostile = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466} Familia Muy Larga';
      const row = formatter.formatGridRow(makeEntry(7, hostile, 1, 1941), 20);

      expect(formatter.visualWidth(row)).toBe(BUDGET);
    });

    it('no parte un par surrogate al recortar', () => {
      // Un surrogate huerfano hace que Discord conteste 400
      const emojis = '\u{1F3CE}\u{1F3CE}\u{1F3CE}\u{1F3CE}\u{1F3CE}\u{1F3CE}\u{1F3CE}\u{1F3CE}';
      const truncated = formatter.truncate(emojis, 13);

      expect(formatter.visualWidth(truncated)).toBe(13);
      expect(truncated).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(truncated).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    });

    it('ninguna fila del campeonato pasa de las 33 celdas', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', 'Enrique Caballero Domínguez', null),
          1223, 89, 0, 1, 1, 21, 43,
        ),
        new ChampionshipStanding(
          new Driver('d2', 'g2', '\u{1F3CE}\u{FE0F} Bob', null),
          -5, 1, 0, 65, 65, 0, 0,
        ),
      ];
      const body = formatter
        .formatChampionshipEmbeds(standings, 89)[0]
        .description!.split('```')[1];

      for (const line of body.split('\n')) {
        if (line.trim() === '') continue;
        expect(formatter.visualWidth(line)).toBeLessThanOrEqual(BUDGET);
      }
    });
  });

  describe('nombres hostiles', () => {
    it('un displayName con backticks no puede cerrar el bloque de codigo', () => {
      const race = makeRace([
        makeEntry(1, '```', 25, 1.0),
        makeEntry(2, '``` \nrm -rf', 18, 2.0, false, true),
      ]);

      const desc = formatter.formatRaceEmbeds(race)[0].description!;
      const fences = desc.split('```').length - 1;

      // Exactamente los dos del bloque, el de apertura y el de cierre
      expect(fences).toBe(2);
      const body = desc.split('```')[1];
      expect(body).not.toContain('`');
    });

    it('tampoco lo cierra en la tabla del campeonato', () => {
      const standings = [
        new ChampionshipStanding(
          new Driver('d1', 'g1', '``` fuera', null),
          100, 1, 0, 1, 1, 0, 0,
        ),
      ];

      const desc = formatter.formatChampionshipEmbeds(standings, 1)[0].description!;

      expect(desc.split('```').length - 1).toBe(2);
      expect(desc.split('```')[1]).not.toContain('`');
    });

    it('sustituye el nombre que el saneado se come entero', () => {
      expect(formatter.sanitizeName('```')).toBe('?');
      expect(formatter.sanitizeName('')).toBe('?');
      expect(formatter.sanitizeName(null)).toBe('?');
    });

    it('no pega dos palabras al quitar un salto de linea', () => {
      expect(formatter.sanitizeName('Ana\nMaria')).toBe('Ana Maria');
      expect(formatter.sanitizeName('Ana\tMaria')).toBe('Ana Maria');
      expect(formatter.sanitizeName('  Ana   Maria  ')).toBe('Ana Maria');
    });

    it('quita el override bidi que daria la vuelta a la fila', () => {
      expect(formatter.sanitizeName('Ana\u202EairaM')).toBe('AnaairaM');
    });

    it('conserva el ZWJ que compone un emoji', () => {
      const family = '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}';

      expect(formatter.sanitizeName(family)).toBe(family);
    });

    it('escapa el markdown del chip de busted, que va fuera del bloque', () => {
      const race = makeRace([
        makeEntry(1, 'Alice', 25, 1.0),
        makeEntry(2, '**Bob** _el_ [malo](x)', 18, 2.0, false, true),
      ]);

      const stats = formatter.formatRaceEmbeds(race).at(-1)!.fields![0].value;

      // El nombre del piloto no puede poner en negrita el resto del chip
      expect(stats).toContain('\\*\\*Bob\\*\\*');
      expect(stats).toContain('\\_el\\_');
      expect(stats).toContain('\\[malo\\]\\(x\\)');
    });
  });
});

describe('coherencia entre la tabla y la grafica', () => {
  // La tabla del embed y la grafica adjunta viajan en el MISMO mensaje de
  // Discord, asi que el mismo piloto no puede salir con dos cifras distintas.
  // Paso: la tabla se recorto a mm:ss para no romper la linea en clientes
  // estrechos y la grafica se quedo en milisegundos, con lo que 65,6 s daba
  // "+1:06" arriba y "+1:05.600" abajo, que ni se leen como el mismo minuto.
  const formatter = new DiscordFormatterService();

  it('dan la misma cifra por encima del minuto', () => {
    for (const segundos of [60, 65.4, 65.6, 90.5, 119.7, 900, 1069.2, 1830, 1941.8]) {
      const tabla = formatter.formatDiff(segundos).trim();
      const grafica = formatDiffGrafica(segundos);

      expect(grafica).toBe(tabla);
    }
  });

  it('por debajo del minuto la grafica anade la unidad y conserva el milisegundo', () => {
    for (const segundos of [0.072, 12.5, 59.999]) {
      const tabla = formatter.formatDiff(segundos).trim();
      const grafica = formatDiffGrafica(segundos);

      // La grafica tiene sitio para la "s", la columna de la tabla no
      expect(grafica).toBe(`${tabla}s`);
    }
  });
});
