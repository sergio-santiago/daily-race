import { RaceGapChartService } from '../race-gap-chart.service';
import { SvgToPngService } from '../svg-to-png.service';
import { GREEN_LIGHT, LONGEST_NAMES, REAL_RACE_62, grid } from './fixtures';
import { OUTPUT_WIDTH } from '../frame';
import { inkPixels } from './png';
import { textWidth } from '../text';

describe('RaceGapChartService', () => {
  const service = new RaceGapChartService(new SvgToPngService());

  /** Centros de los hexagonos de la cinta, la franja entre el eje y su base */
  const swarmCenters = (svg: string): [number, number][] =>
    [...svg.matchAll(/<polygon points="([^"]+)"/g)]
      .map((m) => m[1].split(' ').map((point) => point.split(',').map(Number)))
      .filter((points) => points.length === 6)
      .map(
        (points): [number, number] => [
          points.reduce((sum, [x]) => sum + x, 0) / 6,
          points.reduce((sum, [, y]) => sum + y, 0) / 6,
        ],
      )
      .filter(([, cy]) => cy > 210 && cy <= 294);

  /** Contadores "xN" de las marcas colapsadas por empate absurdo */
  const collapsedCounters = (svg: string): number[] =>
    [...svg.matchAll(/>x(\d+)<\/text>/g)].map((m) => Number(m[1]));

  /**
   * Pilotos que la cinta da por dibujados: una marca sola cuenta uno y una marca
   * colapsada cuenta su contador. Es el invariante que hay que exigir, porque
   * apilar hexagonos deja la cuenta bien y la imagen mintiendo.
   */
  const accountedPilots = (svg: string): number => {
    const counters = collapsedCounters(svg);
    const total = counters.reduce((sum, count) => sum + count, 0);
    return swarmCenters(svg).length - counters.length + total;
  };

  const distinct = (centers: [number, number][]): number =>
    new Set(centers.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`)).size;

  const typical = grid([
    { name: 'Mireia Solana', diff: 0.072, points: 25 },
    { name: 'Vicente Mena', diff: 0.074, points: 18 },
    { name: 'Paula Rueda', diff: 0.086, points: 15 },
    { name: 'Bruno Amaya', diff: 0.098, points: 12 },
    { name: 'Naiara Robledo', diff: 2.4, points: 10 },
    { name: 'Silvia Merino', diff: 45.2, points: 8 },
    { name: 'Elisa Tirado', diff: 1069.2, points: 6 },
  ]);

  it('devuelve null con menos de dos pilotos', () => {
    expect(service.buildSvg(grid([{ name: 'Silvia Merino', diff: 1 }]), GREEN_LIGHT)).toBeNull();
    expect(service.buildSvg([], GREEN_LIGHT)).toBeNull();
  });

  it('destaca el podio con su nombre y su tiempo exacto', () => {
    const svg = service.buildSvg(typical, GREEN_LIGHT)!;

    expect(svg).toContain('Mireia Solana');
    expect(svg).toContain('+0.072s');
    expect(svg).toContain('Vicente Mena');
    expect(svg).toContain('Paula Rueda');
  });

  it('no repite en la grafica los tiempos que ya lista la tabla', () => {
    const svg = service.buildSvg(typical, GREEN_LIGHT)!;

    // Los que no son podio aparecen como punto, sin etiqueta de tiempo
    expect(svg).not.toContain('+0.098s');
    expect(svg).not.toContain('Bruno Amaya');
  });

  it('resume la salida con metricas que la tabla no calcula', () => {
    const svg = service.buildSvg(typical, GREEN_LIGHT)!;

    expect(svg).toContain('MARGEN DEL PODIO');
    expect(svg).toContain('+0.002s');
    expect(svg).toContain('EN LOS 2 PRIMEROS SEGUNDOS');
    expect(svg).toContain('4 de 7');
  });

  it('marca las salidas en falso y al busted', () => {
    const withFalseStarts = grid([
      { name: 'Silvia Merino', diff: 0.1, position: 1, points: 25 },
      { name: 'Beatriz Nadal', diff: 0.4, position: 2, points: 18 },
      { name: 'Candela Ordóñez', diff: -31.905, position: 3, falseStart: true, worst: true },
      { name: 'Rocío Vargas', diff: -0.101, position: 4, falseStart: true },
    ]);
    const svg = service.buildSvg(withFalseStarts, GREEN_LIGHT)!;

    expect(svg).toContain('2 en falso');
    expect(svg).toContain('BUSTED · CANDELA ORDÓÑEZ · -32S');
    expect(svg).toContain('SALIDAS EN FALSO');
  });

  it('mantiene la altura fija sea el grid de 7 o de 65 pilotos', () => {
    const huge = grid(
      Array.from({ length: 65 }, (_, i) => ({
        name: `Piloto ${i + 1}`,
        diff: 0.2 + i * i * 0.5,
      })),
    );
    const heightOf = (svg: string): string => /height="(\d+)"/.exec(svg)![1];

    expect(heightOf(service.buildSvg(huge, GREEN_LIGHT)!)).toBe(
      heightOf(service.buildSvg(typical, GREEN_LIGHT)!),
    );
  });

  it('aguanta que todos entren en el mismo instante', () => {
    const tie = grid(
      Array.from({ length: 8 }, (_, i) => ({ name: `Piloto ${i + 1}`, diff: 1.5 })),
    );

    expect(() => service.buildSvg(tie, GREEN_LIGHT)).not.toThrow();
    expect(service.buildSvg(tie, GREEN_LIGHT)).toContain('8 pilotos');
  });

  it('escapa los caracteres que romperian el SVG', () => {
    const evil = grid([
      { name: '<script>alert(1)</script>', diff: 1, points: 25 },
      { name: 'Ana & Co', diff: 2, points: 18 },
    ]);
    const svg = service.buildSvg(evil, GREEN_LIGHT)!;

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&amp;');
  });

  it('distingue el mensaje en directo del resultado final', () => {
    const live = service.buildSvg(typical, GREEN_LIGHT, { live: true })!;
    const final = service.buildSvg(typical, GREEN_LIGHT)!;

    expect(live).toContain('EN DIRECTO');
    expect(live).toContain('LA CARRERA ESTÁ EN MARCHA');
    expect(final).not.toContain('EN DIRECTO');
    expect(final).toContain('SALIDA 09:00');
  });

  it('cuenta lo ocurrido cuando nadie espera al semáforo', () => {
    const allFalse = grid([
      { name: 'Silvia Merino', diff: -12, falseStart: true },
      { name: 'Beatriz Nadal', diff: -48, falseStart: true, worst: true },
    ]);
    const svg = service.buildSvg(allFalse, GREEN_LIGHT)!;

    expect(svg).toContain('Nadie esperó al semáforo');
    // Sin grid limpio no hay margen del podio ni mediana que ensenar
    expect(svg).not.toContain('MARGEN DEL PODIO');
    expect(svg).not.toContain('MEDIANA DEL GRID');
  });

  it('no repite en las metricas lo que ya dice el panel de nadie esperó', () => {
    const allFalse = grid([
      { name: 'Silvia Merino', diff: -12, falseStart: true },
      { name: 'Beatriz Nadal', diff: -48, falseStart: true, worst: true },
      { name: 'Rocío Vargas', diff: -95, falseStart: true },
    ]);
    const svg = service.buildSvg(allFalse, GREEN_LIGHT)!;

    // El panel ya da el total y los dos extremos, y la parrilla son las propias
    // salidas en falso: la fila de metricas aporta datos que no estan arriba
    expect(svg).toContain('MEDIANA DEL ADELANTO');
    expect(svg).toContain('MÁS DE UN MINUTO ANTES');
    expect(svg).toContain('1 de 3');
    expect(svg).toContain('VENTANA TOTAL');
    expect(svg).toContain('1:23');
    expect(svg).not.toContain('EL QUE MÁS SE ADELANTÓ');
    expect(svg).not.toContain('EL QUE MENOS');
    expect(svg).not.toContain('PARRILLA');
    // Con la parrilla entera adelantada, el contador de salidas en falso seria el
    // mismo total que ya dan el panel y la cabecera de la cinta: la fila se queda
    // en tres columnas en vez de gastar una en repetirlo
    expect(svg).not.toContain('SALIDAS EN FALSO');
  });

  it('no esconde a ningun piloto con toda la parrilla empatada', () => {
    // Nueve pilotos con el mismo timestamp. El assert de rango que habia aqui
    // pasaba con los puntos apilados unos exactamente debajo de otros, que es
    // como se colaba el bug: la cinta decia "9 pilotos" y se veian seis. Lo que
    // hay que exigir es que cada centro sea distinto de todos los demas
    const tie = grid(
      Array.from({ length: 9 }, (_, i) => ({ name: `Piloto ${i + 1}`, diff: 3.5 })),
    );
    const svg = service.buildSvg(tie, GREEN_LIGHT)!;
    const centers = swarmCenters(svg);
    const height = Number(/height="(\d+)"/.exec(svg)![1]);

    expect(centers).toHaveLength(9);
    expect(distinct(centers)).toBe(9);
    for (const [cx, cy] of centers) {
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(780);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(height);
    }
  });

  it('dibuja los 62 pilotos de la carrera real con ocho empatados al milisegundo', () => {
    // El caso peor medido en produccion (2026-06-19): 62 pilotos y ocho en el
    // mismo instante. El radio base no da calles para los ocho, asi que hay que
    // reducirlo, y ninguno de los 62 puede quedar debajo de otro
    const svg = service.buildSvg(grid(REAL_RACE_62), GREEN_LIGHT)!;
    const centers = swarmCenters(svg);

    expect(svg).toContain('62 pilotos');
    expect(centers).toHaveLength(62);
    expect(distinct(centers)).toBe(62);
    // Ninguno colapsado: con 62 marcas todavia hay sitio para todas
    expect(collapsedCounters(svg)).toEqual([]);
  });

  it('rinde cuentas de los doce pilotos cuando ni el radio minimo da calles', () => {
    // Doce en el mismo milisegundo es un empate absurdo y no cabe ni al radio
    // mas pequeno: el grupo colapsa en una marca con su contador, de modo que la
    // cuenta sigue cuadrando en lugar de esconder a nueve debajo de tres
    const tie = grid(
      Array.from({ length: 12 }, (_, i) => ({ name: `Piloto ${i + 1}`, diff: 3.5 })),
    );
    const svg = service.buildSvg(tie, GREEN_LIGHT)!;

    expect(svg).toContain('12 pilotos');
    expect(distinct(swarmCenters(svg))).toBe(swarmCenters(svg).length);
    expect(accountedPilots(svg)).toBe(12);
  });

  it('reparte en calles la mezcla de empatados y sueltos sin solapar ninguno', () => {
    // Ocho empatados dentro de un grid pequeno: el resto no puede acabar en el
    // mismo centro que ellos por la reduccion de radio
    const mixed = grid([
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Empatado ${i + 1}`,
        diff: 21.135,
      })),
      { name: 'Suelto A', diff: 0.4 },
      { name: 'Suelto B', diff: 2.1 },
      { name: 'Suelto C', diff: 120.5 },
    ]);
    const svg = service.buildSvg(mixed, GREEN_LIGHT)!;

    expect(distinct(swarmCenters(svg))).toBe(11);
    expect(accountedPilots(svg)).toBe(11);
  });

  it('no recorta el nombre mas largo del equipo en la tarjeta del podio', () => {
    // Los tres nombres mas largos de la base de produccion. El mas largo mide
    // 207.89 px sobre un hueco de 210.67 px: con el limite anterior (cardW - 32,
    // 202.67 px) salia con elipsis aunque a su derecha sobrasen 15 px
    const podium = grid(
      LONGEST_NAMES.map((name, i) => ({
        name,
        diff: 0.1 + i * 0.05,
        points: [25, 18, 15][i],
      })),
    );
    const svg = service.buildSvg(podium, GREEN_LIGHT)!;

    for (const name of LONGEST_NAMES) {
      expect(svg).toContain(name);
    }
    expect(svg).not.toContain('…');
  });

  it('lee el margen del podio en minutos cuando pasa del minuto', () => {
    // Con el segundo a quince minutos del ganador, "+899.900s" no es un tiempo
    // que nadie lea: el margen se cuenta en la misma unidad que la tabla
    const wide = grid([
      { name: 'Mireia Solana', diff: 0.1, points: 25 },
      { name: 'Vicente Mena', diff: 900, points: 18 },
      { name: 'Paula Rueda', diff: 1000, points: 15 },
    ]);
    const svg = service.buildSvg(wide, GREEN_LIGHT)!;

    expect(svg).toContain('MARGEN DEL PODIO');
    expect(svg).toContain('+15:00');
    expect(svg).not.toContain('899.900');
  });

  it('no inventa un margen del podio con un solo piloto limpio', () => {
    const alone = grid([
      { name: 'Mireia Solana', diff: 0.1, points: 25 },
      { name: 'Candela Ordóñez', diff: -3.2, falseStart: true, worst: true },
    ]);
    const svg = service.buildSvg(alone, GREEN_LIGHT)!;

    expect(svg).toContain('MARGEN DEL PODIO');
    // Sin segundo clasificado no hay diferencia que medir
    expect(svg).toContain('>—<');
    expect(svg).toContain('1 de 1');
  });

  it('dibuja una marca visible por piloto con toda la parrilla empatada', () => {
    // Nueve pilotos con el mismo timestamp: si el reparto en calles no cabe hay
    // que reducir el radio, porque apilar deja hexagonos exactamente debajo de
    // otros y la cinta dice "9 pilotos" mientras se ven seis
    const tie = grid(
      Array.from({ length: 9 }, (_, i) => ({ name: `Piloto ${i + 1}`, diff: 3.5 })),
    );
    const svg = service.buildSvg(tie, GREEN_LIGHT)!;
    const centers = swarmCenters(svg);

    expect(centers).toHaveLength(9);
    expect(new Set(centers.map(([x, y]) => `${x},${y}`)).size).toBe(9);
  });

  it('pinta los metales del podio por encima del grid neutro', () => {
    // El oro del primero no puede quedar debajo de un hexagono neutro que caiga
    // en su misma calle, asi que los metales se dibujan al final
    const tie = grid(
      Array.from({ length: 8 }, (_, i) => ({ name: `Piloto ${i + 1}`, diff: 3.5 })),
    );
    const svg = service.buildSvg(tie, GREEN_LIGHT)!;

    expect(svg.lastIndexOf('url(#gold)')).toBeGreaterThan(
      svg.lastIndexOf('fill="rgba(234,226,214,0.5)"'),
    );
  });

  it('cuenta las salidas en falso cuando ninguna es la del busted', () => {
    // Pasa cuando el peor del dia no esta marcado en la parrilla: sin chip de
    // busted, la franja de anotaciones tiene que decir al menos cuantas hubo
    const plural = grid([
      { name: 'Ana', diff: 0.1, position: 1, points: 25 },
      { name: 'Bea', diff: 0.2, position: 2, points: 18 },
      { name: 'Cris', diff: -1.4, position: 3, falseStart: true },
      { name: 'Dani', diff: -8.1, position: 4, falseStart: true },
    ]);
    const singular = grid([
      { name: 'Ana', diff: 0.1, position: 1, points: 25 },
      { name: 'Bea', diff: 0.2, position: 2, points: 18 },
      { name: 'Cris', diff: -1.4, position: 3, falseStart: true },
    ]);

    expect(service.buildSvg(plural, GREEN_LIGHT)!).toContain('2 SALIDAS EN FALSO');
    expect(service.buildSvg(singular, GREEN_LIGHT)!).toContain('1 SALIDA EN FALSO');
    expect(service.buildSvg(plural, GREEN_LIGHT)!).not.toContain('BUSTED');
  });

  it('acota el chip de busted para que quepan las dos anotaciones', () => {
    // Con un nombre de ochenta caracteres el chip se comia la franja entera y
    // habia que renunciar a la anotacion de la derecha. Ahora el nombre se acota
    // a su presupuesto y caben las dos, sin tocarse
    const longName =
      'Enrique Caballero Domínguez de la Serna y Montenegro del Valle Inclán Sanchidrián';
    const crowded = grid([
      { name: 'Ana', diff: 0.1, position: 1, points: 25 },
      { name: 'Bea', diff: 0.2, position: 2, points: 18 },
      { name: 'Cris', diff: 0.3, position: 3, points: 15 },
      { name: 'Dani', diff: 0.4, position: 4, points: 12 },
      { name: 'Eva', diff: 90.5, position: 5, points: 10 },
      { name: longName, diff: -12.4, position: 6, falseStart: true, worst: true },
    ]);
    const svg = service.buildSvg(crowded, GREEN_LIGHT)!;

    expect(svg).toContain('BUSTED');
    // El nombre se recorta en vez de estirar el chip
    expect(svg).toMatch(/BUSTED · [^<]*…/);

    // Y las dos anotaciones no se pisan: el hexagono del chip termina antes de
    // donde arranca el texto de la derecha
    const chipEnd = Number(
      /<polygon points="35,341 ([\d.]+),341/.exec(svg)![1],
    );
    const noteAnchor = Number(
      /<text x="([\d.]+)"[^>]*>último en entrar/.exec(svg)![1],
    );
    const noteWidth = textWidth('último en entrar · Eva', {
      size: 10.5,
      family: 'name',
      fill: '',
    });

    expect(noteAnchor - noteWidth).toBeGreaterThan(chipEnd);
  });

  it('genera un PNG con la tinta de los glifos, no solo con la firma', () => {
    // La firma la tiene igual una grafica sin una sola letra por no haber
    // cargado ninguna fuente, que es el riesgo de la imagen Alpine. Y medir la
    // tinta total tampoco basta: el fondo, la vineta y los hexagonos ya pintan
    // decenas de miles de pixeles. Lo que hay que aislar es lo que aporta el
    // texto, comparando contra el mismo SVG con los <text> quitados
    const rasterizer = new SvgToPngService();
    const svg = service.buildSvg(typical, GREEN_LIGHT)!;
    const png = service.renderPng(typical, GREEN_LIGHT)!;
    const withoutText = rasterizer.toPng(
      svg.replace(/<text\b[^>]*>[^<]*<\/text>/g, ''),
      OUTPUT_WIDTH,
    );
    const bg: [number, number, number] = [0x0c, 0x0c, 0x0e];

    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(inkPixels(png, bg, 24) - inkPixels(withoutText, bg, 24)).toBeGreaterThan(
      10_000,
    );
  });

  it('no devuelve PNG cuando no hay grafica que dibujar', () => {
    expect(service.renderPng([], GREEN_LIGHT)).toBeNull();
  });

  describe('empates compartidos', () => {
    it('pinta dos oros y salta la plata cuando se comparte el P1', () => {
      // Con posicion compartida no existe un P2: el siguiente es P3
      const empatados = grid([
        { name: 'Ana', diff: 1.5, position: 1, points: 25 },
        { name: 'Bruno', diff: 1.5, position: 1, points: 25 },
        { name: 'Carla', diff: 4, position: 3, points: 15 },
      ]);
      const svg = service.buildSvg(empatados, GREEN_LIGHT)!;

      expect(svg.match(/url\(#gold\)/g)!.length).toBeGreaterThanOrEqual(2);
      expect(svg).not.toContain('url(#silver)');
      expect(svg).toContain('url(#bronze)');

      // El panel lleva una tarjeta por POSICION y no por piloto, asi que el P1
      // compartido es UNA tarjeta que nombra a los dos, y el P3 es la segunda.
      // Contar personas dejaba fuera del panel a empatados que la cinta si
      // pintaba con su metal
      const tintes = [...svg.matchAll(/height="78" rx="3" fill="rgba\(([^)]+)\)"/g)].map(
        (m) => m[1],
      );
      expect(tintes).toHaveLength(2);
      expect(tintes[1]).not.toBe(tintes[0]);
      expect(svg).toContain('Ana y Bruno');
      // Margen del podio de cero, porque los dos primeros entraron a la vez
      expect(svg).toContain('+0.000s');
    });

    it('nombra a todos los empatados del podio, que la cinta ya pinta con su metal', () => {
      // Cuatro en el podio con dos posiciones compartidas: antes el panel
      // cortaba los tres primeros de la lista y el cuarto desaparecia, elegido
      // por el orden en que Meet devuelve los participantes
      const empatados = grid([
        { name: 'Ana', diff: 1.5, position: 1, points: 25 },
        { name: 'Bruno', diff: 1.5, position: 1, points: 25 },
        { name: 'Carla', diff: 4, position: 3, points: 15 },
        { name: 'Dario', diff: 4, position: 3, points: 15 },
        { name: 'Elena', diff: 9, position: 5, points: 10 },
      ]);
      const svg = service.buildSvg(empatados, GREEN_LIGHT)!;

      const tintes = [...svg.matchAll(/height="78" rx="3" fill="rgba\(([^)]+)\)"/g)].map(
        (m) => m[1],
      );
      expect(tintes).toHaveLength(2);
      expect(svg).toContain('Ana y Bruno');
      expect(svg).toContain('Carla y Dario');
      expect(svg).not.toContain('Elena y');
    });

    it('resume el grupo cuando el podio lo comparten mas de dos', () => {
      const empatados = grid([
        { name: 'Ana', diff: 1.5, position: 1, points: 25 },
        { name: 'Bruno', diff: 1.5, position: 1, points: 25 },
        { name: 'Carla', diff: 1.5, position: 1, points: 25 },
        { name: 'Dario', diff: 1.5, position: 1, points: 25 },
        { name: 'Elena', diff: 9, position: 5, points: 10 },
      ]);
      const svg = service.buildSvg(empatados, GREEN_LIGHT)!;

      // Una sola tarjeta, porque el podio entero es un unico P1
      const tintes = [...svg.matchAll(/height="78" rx="3" fill="rgba\(([^)]+)\)"/g)].map(
        (m) => m[1],
      );
      expect(tintes).toHaveLength(1);
      expect(svg).toContain('Ana y 3 más');
      expect(svg).not.toContain('url(#silver)');
      expect(svg).not.toContain('url(#bronze)');
    });

    it('reparte la calavera entre los dos empatados', () => {
      const empatados = grid([
        { name: 'Ana', diff: 0.5, position: 1, points: 25 },
        { name: 'Tarde A', diff: 42, position: 2, points: 18, worst: true },
        { name: 'Tarde B', diff: 42, position: 2, points: 18, worst: true },
      ]);
      const svg = service.buildSvg(empatados, GREEN_LIGHT)!;

      expect(svg).toContain('BUSTED · TARDE A Y TARDE B · 42S');
    });

    it('cuenta el resto cuando la calavera la comparten mas de dos', () => {
      const empatados = grid([
        { name: 'Ana', diff: 0.5, position: 1, points: 25 },
        { name: 'Tarde A', diff: 42, position: 2, points: 18, worst: true },
        { name: 'Tarde B', diff: 42, position: 2, points: 18, worst: true },
        { name: 'Tarde C', diff: 42, position: 2, points: 18, worst: true },
      ]);
      const svg = service.buildSvg(empatados, GREEN_LIGHT)!;

      expect(svg).toContain('BUSTED · TARDE A Y 2 MÁS · 42S');
    });
  });

});
