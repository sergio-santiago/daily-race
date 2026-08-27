import { ChampionshipEvolutionChartService } from '../championship-evolution-chart.service';
import { SvgToPngService } from '../svg-to-png.service';
import { pointsRace, scoredRace, standing } from './fixtures';
import { textWidth } from '../text';
import { OUTPUT_WIDTH, PAD } from '../frame';
import { inkPixels } from './png';

const day = (n: number): Date => new Date(`2026-09-${String(n).padStart(2, '0')}T07:00:00Z`);

describe('ChampionshipEvolutionChartService', () => {
  const service = new ChampionshipEvolutionChartService(new SvgToPngService());

  const races = [
    scoredRace('r1', day(1), ['Silvia Merino', 'Beatriz Nadal', 'Paula Rueda']),
    scoredRace('r2', day(2), ['Beatriz Nadal', 'Silvia Merino']),
    scoredRace('r3', day(3), ['Silvia Merino', 'Paula Rueda', 'Beatriz Nadal']),
  ];
  const standings = [
    standing('Silvia Merino', 68, 1, { races: 3, wins: 2, podiums: 3 }),
    standing('Beatriz Nadal', 58, 2, { races: 3, wins: 1, podiums: 3 }),
    standing('Paula Rueda', 33, 3, { races: 2, podiums: 2 }),
  ];

  it('devuelve null sin clasificacion', () => {
    expect(service.buildSvg([], races)).toBeNull();
  });

  it('devuelve null sin carreras', () => {
    expect(service.buildSvg(standings, [])).toBeNull();
  });

  it('dibuja ya con la primera carrera de la temporada', () => {
    // La linea sale del cero de salida, asi que con una jornada ya hay trazo
    const svg = service.buildSvg(standings, races.slice(0, 1));

    expect(svg).not.toBeNull();
    expect(svg).toContain('1 CARRERA');
    expect(svg).toContain('inicio');
  });

  it('concuerda el singular y el plural de las carreras', () => {
    expect(service.buildSvg(standings, races.slice(0, 2))).toContain('2 CARRERAS');
  });

  it('etiqueta a cada piloto con su nombre y su total acumulado', () => {
    const svg = service.buildSvg(standings, races)!;

    expect(svg).toContain('Silvia Merino');
    expect(svg).toContain('>68<');
    expect(svg).toContain('Beatriz Nadal');
    expect(svg).toContain('>58<');
  });

  it('ordena las carreras por fecha aunque lleguen desordenadas', () => {
    const shuffled = [races[2], races[0], races[1]];
    const svg = service.buildSvg(standings, shuffled)!;

    // El primer tick del eje es el dia de la carrera mas antigua
    expect(svg).toContain('01/09');
  });

  it('agrupa en una sola etiqueta a los pilotos fuera del top', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      standing(`Piloto ${i + 1}`, 100 - i * 5, i + 1, { races: 3 }),
    );
    const bigRaces = [
      scoredRace('a', day(1), many.map((s) => s.driver.displayName)),
      scoredRace('b', day(2), many.map((s) => s.driver.displayName)),
    ];
    const svg = service.buildSvg(many, bigRaces)!;

    expect(svg).toContain('+6 pilotos');
  });

  it('escapa los caracteres que romperian el SVG', () => {
    const evil = [standing('<b>Ana</b> & Co', 50, 1, { races: 2 })];
    const evilRaces = [
      scoredRace('a', day(1), ['<b>Ana</b> & Co']),
      scoredRace('b', day(2), ['<b>Ana</b> & Co']),
    ];
    const svg = service.buildSvg(evil, evilRaces)!;

    expect(svg).not.toContain('<b>Ana</b>');
    expect(svg).toContain('&amp;');
  });

  describe('puntuacion negativa', () => {
    // Toda esta rama se cubria sola: la penalizacion de -5 por salida en falso
    // es el unico camino a un acumulado negativo y ningun test lo recorria.

    /** Etiquetas numericas del eje de puntos, con la y a la que se dibujan */
    const axisLabels = (svg: string): { value: number; y: number }[] =>
      [...svg.matchAll(/<text ([^>]*)>(-?\d+)<\/text>/g)]
        .filter(
          (m) =>
            m[1].includes('font-size="10.5"') &&
            m[1].includes('text-anchor="end"'),
        )
        .map((m) => ({
          value: Number(m[2]),
          y: Number(/y="([-\d.]+)"/.exec(m[1])![1]),
        }));

    /** Solo los trazos de datos: area del lider, lineas del top y mediana */
    const seriesPathYs = (svg: string): number[] =>
      [...svg.matchAll(/<path ([^>]*)\/>/g)]
        .filter(
          (m) =>
            m[1].includes('url(#lead)') ||
            // El orden de los dos atributos distingue la linea de una serie de
            // los trazos del isotipo del pie, que los declara al reves
            m[1].includes('stroke-linejoin="round" stroke-linecap="round"') ||
            m[1].includes('stroke-dasharray'),
        )
        .flatMap((m) =>
          [...(/d="([^"]+)"/.exec(m[1])![1]).matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(
            (point) => Number(point[2]),
          ),
        );

    const day2 = (n: number): Date =>
      new Date(`2026-09-${String(n).padStart(2, '0')}T07:00:00Z`);

    it('baja la rejilla por debajo del cero cuando alguien empieza en negativo', () => {
      // Un piloto que abre la temporada con salida en falso se va a -5, y con el
      // lider en 60 puntos eso es un doceavo del eje: si el suelo no baja, su
      // linea se dibuja por debajo del area sin ninguna referencia numerica
      const negativeRaces = [
        pointsRace('n1', day2(1), [
          ['Silvia Merino', 25],
          ['Beatriz Nadal', -5],
        ]),
        pointsRace('n2', day2(2), [['Silvia Merino', 25]]),
        pointsRace('n3', day2(3), [['Silvia Merino', 10]]),
      ];
      const negativeStandings = [
        standing('Silvia Merino', 60, 1, { races: 3, wins: 3 }),
        standing('Beatriz Nadal', -5, 2, { races: 1 }),
      ];
      const svg = service.buildSvg(negativeStandings, negativeRaces)!;
      const labels = axisLabels(svg);
      const floor = labels.find((l) => l.value === -5);
      const zero = labels.find((l) => l.value === 0)!;

      expect(floor).toBeDefined();
      // El suelo se dibuja por debajo del cero, no al reves
      expect(floor!.y).toBeGreaterThan(zero.y);
      // Y su linea de rejilla esta de verdad, no solo el numero
      expect(svg).toContain(`y1="${floor!.y - 3.5}"`);
      // Ninguna linea de datos se sale por debajo del suelo del eje
      expect(Math.max(...seriesPathYs(svg))).toBeLessThanOrEqual(floor!.y - 3.5);
    });

    it('recorta el negativo irrelevante en vez de reservarle un tercio del eje', () => {
      // Doce pilotos, dos lideres a 1200 puntos y el resto a -5. Los cinco puntos
      // de la penalizacion no son nada frente a 1200, asi que el suelo se queda
      // en cero y las lineas negativas se recortan ahi: sin el recorte bajaban
      // del area de dibujo y se metian entre las fechas del eje
      const leaders: [string, number][] = [
        ['Lider Uno', 600],
        ['Lider Dos', 600],
      ];
      const pack: [string, number][] = Array.from(
        { length: 10 },
        (_, i) => [`Peloton ${i + 1}`, -5],
      );
      const bigRaces = [
        pointsRace('m1', day2(1), [...leaders, ...pack]),
        pointsRace('m2', day2(2), leaders),
      ];
      const bigStandings = [
        standing('Lider Uno', 1200, 1, { races: 2 }),
        standing('Lider Dos', 1200, 2, { races: 2 }),
        ...Array.from({ length: 10 }, (_, i) =>
          standing(`Peloton ${i + 1}`, -5, i + 3, { races: 1 }),
        ),
      ];
      const svg = service.buildSvg(bigStandings, bigRaces)!;
      const labels = axisLabels(svg);
      const zero = labels.find((l) => l.value === 0)!;

      expect(Math.min(...labels.map((l) => l.value))).toBe(0);
      // El suelo del eje es el cero, y ni un trazo baja de ahi
      expect(Math.max(...seriesPathYs(svg))).toBeLessThanOrEqual(zero.y - 3.5);
    });

    it('no promete una mediana discontinua que el lector no puede encontrar', () => {
      // La mediana del peloton entero es -5, que recortada al cero recorre cero
      // pixeles: dibujarla es dibujar la linea del cero otra vez. La cifra pasa
      // al canal derecho, y el pie no puede seguir prometiendo la discontinua
      const leaders: [string, number][] = [
        ['Lider Uno', 600],
        ['Lider Dos', 600],
      ];
      const pack: [string, number][] = Array.from(
        { length: 10 },
        (_, i) => [`Peloton ${i + 1}`, -5],
      );
      const bigRaces = [
        pointsRace('m1', day2(1), [...leaders, ...pack]),
        pointsRace('m2', day2(2), leaders),
      ];
      const bigStandings = [
        standing('Lider Uno', 1200, 1, { races: 2 }),
        standing('Lider Dos', 1200, 2, { races: 2 }),
        ...Array.from({ length: 10 }, (_, i) =>
          standing(`Peloton ${i + 1}`, -5, i + 3, { races: 1 }),
        ),
      ];
      const svg = service.buildSvg(bigStandings, bigRaces)!;

      expect(svg).not.toContain('stroke-dasharray');
      expect(svg).not.toContain('discontinua');
      expect(svg).toContain('+6 pilotos · mediana -5');
      // Sin linea no hay de donde colgar el punto: un circulo suelto sobre el
      // area de trazado se lee como un fallo de render
      expect(svg).not.toMatch(/<circle[^>]*fill="rgba\(218,218,218,0\.5\)"/);
    });

    it('no dibuja la mediana que iria pegada a la linea de un piloto', () => {
      // El trazo se distinguiria del cero, pero cae encima de la serie de los
      // pilotos que empatan con el peloton: dibujado esta y nadie lo separa de la
      // linea que tiene debajo. Es el caso de las primeras jornadas
      const lider: [string, number][] = [['Silvia Merino', 75]];
      const empatados: [string, number][] = Array.from(
        { length: 7 },
        (_, i) => [`Piloto ${i + 1}`, -15],
      );
      const races = [
        pointsRace('n1', day2(1), [...lider, ...empatados]),
        pointsRace('n2', day2(2), lider),
      ];
      const standings = [
        standing('Silvia Merino', 75, 1, { races: 2 }),
        ...Array.from({ length: 7 }, (_, i) =>
          standing(`Piloto ${i + 1}`, -15, i + 2, { races: 1 }),
        ),
      ];
      const svg = service.buildSvg(standings, races)!;

      expect(svg).not.toContain('stroke-dasharray');
      expect(svg).not.toContain('discontinua');
      expect(svg).toContain('pilotos · mediana -15');
    });

    it('si dibuja la mediana, la explica en el pie', () => {
      // Contraprueba de la decision anterior: cuando el trazo si se distingue del
      // cero, la discontinua se pinta y la nota del pie vuelve
      const many = Array.from({ length: 12 }, (_, i) =>
        standing(`Piloto ${i + 1}`, 100 - i * 5, i + 1, { races: 3 }),
      );
      const bigRaces = [
        scoredRace('a', day2(1), many.map((s) => s.driver.displayName)),
        scoredRace('b', day2(2), many.map((s) => s.driver.displayName)),
      ];
      const svg = service.buildSvg(many, bigRaces)!;

      expect(svg).toContain('stroke-dasharray');
      expect(svg).toContain('discontinua');
      // Con trazo, la etiqueta del grupo no repite la cifra
      expect(svg).toContain('+6 pilotos');
      expect(svg).not.toContain('pilotos · mediana');
    });

    it('pinta la mediana por encima de las lineas solidas', () => {
      // Trazada antes, desaparecia justo donde coincidia con una serie, que es
      // donde el lector mas la busca
      const many = Array.from({ length: 12 }, (_, i) =>
        standing(`Piloto ${i + 1}`, 100 - i * 5, i + 1, { races: 3 }),
      );
      const bigRaces = [
        scoredRace('a', day2(1), many.map((s) => s.driver.displayName)),
        scoredRace('b', day2(2), many.map((s) => s.driver.displayName)),
      ];
      const svg = service.buildSvg(many, bigRaces)!;

      expect(svg.indexOf('stroke-dasharray')).toBeGreaterThan(
        svg.lastIndexOf('url(#lead)'),
      );
      expect(svg.indexOf('stroke-dasharray')).toBeGreaterThan(
        svg.lastIndexOf('stroke-linejoin="round" stroke-linecap="round"'),
      );
    });

    it('aparta el eje lo que ocupa una etiqueta de cuatro cifras', () => {
      // Con el margen fijo de 26 px, los totales de cuatro cifras de la
      // temporada real se salian del lienzo por la izquierda
      const wideRaces = [pointsRace('w1', day2(1), [['Lider Uno', 1223]])];
      const wideStandings = [standing('Lider Uno', 1223, 1, { races: 1 })];
      const svg = service.buildSvg(wideStandings, wideRaces)!;
      const labels = [
        ...svg.matchAll(/<text x="([-\d.]+)" y="[-\d.]+"([^>]*)>(-?\d+)<\/text>/g),
      ].filter(
        (m) =>
          m[2].includes('font-size="10.5"') && m[2].includes('text-anchor="end"'),
      );
      const widest = labels
        .map((m) => m[3])
        .reduce((best, value) => (value.length > best.length ? value : best), '');

      expect(widest.length).toBeGreaterThanOrEqual(4);
      for (const match of labels) {
        const right = Number(match[1]);
        const left = right - textWidth(match[3], { size: 10.5, fill: '' });
        expect(left).toBeGreaterThanOrEqual(PAD - 1);
      }
    });
  });

  it('adelgaza las fechas del eje en una temporada larga', () => {
    // Con 89 carreras en base no caben 90 etiquetas: se dejan seis, la primera
    // es siempre "inicio" y la ultima siempre la carrera mas reciente
    const day3 = (i: number): Date =>
      new Date(new Date('2026-09-01T07:00:00Z').getTime() + i * 86_400_000);
    const names = ['Silvia Merino', 'Beatriz Nadal', 'Paula Rueda'];
    const longSeason = Array.from({ length: 20 }, (_, i) =>
      scoredRace(`s${i}`, day3(i), names),
    );
    const longStandings = names.map((name, i) =>
      standing(name, 400 - i * 50, i + 1, { races: 20 }),
    );
    const svg = service.buildSvg(longStandings, longSeason)!;
    const dates = [...svg.matchAll(/>(inicio|\d{2}\/\d{2})</g)].map((m) => m[1]);

    expect(dates.length).toBeLessThanOrEqual(6);
    expect(dates[0]).toBe('inicio');
    // 20 carreras desde el 1 de septiembre: la ultima es el 20
    expect(dates[dates.length - 1]).toBe('20/09');
  });

  it('genera un PNG con la tinta de los glifos, no solo con la firma', () => {
    // Sin fuentes la grafica sale sin una sola letra y la firma PNG es la misma,
    // asi que se aisla lo que aporta el texto: el mismo SVG sin los <text> tiene
    // que dejar bastante menos tinta que el completo
    const rasterizer = new SvgToPngService();
    const svg = service.buildSvg(standings, races)!;
    const png = service.renderPng(standings, races)!;
    const withoutText = rasterizer.toPng(
      svg.replace(/<text\b[^>]*>[^<]*<\/text>/g, ''),
      OUTPUT_WIDTH,
    );
    const bg: [number, number, number] = [0x0c, 0x0c, 0x0e];

    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(inkPixels(png, bg, 24) - inkPixels(withoutText, bg, 24)).toBeGreaterThan(
      5_000,
    );
  });

  it('no devuelve PNG cuando no hay grafica que dibujar', () => {
    expect(service.renderPng(standings, [])).toBeNull();
    expect(service.renderPng([], races)).toBeNull();
  });
});
