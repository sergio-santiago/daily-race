import { Injectable } from '@nestjs/common';
import { StartingGridEntry } from '../../core/entities/starting-grid-entry.entity';
import { T, metalFor, metalId, rgba } from './theme';
import { hexagon, hexagonFlat } from './brand';
import { TextOpts, ellipsize, n, text, textWidth } from './text';
import { beeswarm, formatDiff, formatShort, timeScale } from './scale';
import { formatClock } from './dates';
import {
  HEADER_H,
  OUTPUT_WIDTH,
  PAD,
  W,
  defs,
  footer,
  header,
  surface,
  svgOpen,
} from './frame';
import { SvgToPngService } from './svg-to-png.service';

// La tabla del embed ya da todos los tiempos, asi que la grafica no los repite:
// destaca el podio y dedica el resto a lo que una tabla no puede mostrar, la
// forma de la salida. Cada piloto es un punto sobre un eje logaritmico, de modo
// que el 63% que entra en los dos primeros segundos ocupa un tercio del ancho
// en lugar de una decima de porcentaje, y las carreras de 65 pilotos caben en
// la misma altura que las de 11.

const PODIUM_TOP = HEADER_H + 20;
const PODIUM_H = 78;
const CARD_GAP = 12;

const STRIP_TITLE_Y = PODIUM_TOP + PODIUM_H + 32;
const SWARM_BASE = STRIP_TITLE_Y + 92;
const AXIS_LABEL_Y = SWARM_BASE + 30;
const NOTE_Y = AXIS_LABEL_Y + 26;

const KPI_TOP = NOTE_Y + 26;
const HEIGHT = KPI_TOP + 66;

const PUNCTUAL_LIMIT = 2;

export interface RaceChartOptions {
  /**
   * En el mensaje en directo la grafica se regenera en cada edicion, asi que
   * se marca como tal: el resultado todavia puede cambiar.
   */
  live?: boolean;
}

@Injectable()
export class RaceGapChartService {
  constructor(private readonly svgToPng: SvgToPngService) {}

  /** Devuelve null si el grid es demasiado pequeno para que la grafica aporte */
  renderPng(
    grid: StartingGridEntry[],
    greenLight: Date,
    options: RaceChartOptions = {},
  ): Buffer | null {
    const svg = this.buildSvg(grid, greenLight, options);
    return svg ? this.svgToPng.toPng(svg, OUTPUT_WIDTH) : null;
  }

  buildSvg(
    grid: StartingGridEntry[],
    greenLight: Date,
    options: RaceChartOptions = {},
  ): string | null {
    if (grid.length < 2) return null;

    const clean = grid
      .filter((e) => !e.isFalseStart)
      .sort((a, b) => a.position - b.position);
    const falseStarts = grid
      .filter((e) => e.isFalseStart)
      .sort((a, b) => a.diffSeconds - b.diffSeconds);
    // La calavera puede ser compartida: si el extremo esta empatado al instante,
    // es de todos los empatados
    const busted = grid.filter((e) => e.isWorstOnGrid);

    return [
      svgOpen(HEIGHT),
      defs(),
      surface(HEIGHT),
      header(
        'Tiempos de salida',
        options.live ? 'La carrera está en marcha' : 'Diferencia respecto al semáforo',
        options.live
          ? { label: 'en directo', color: T.red, dot: true }
          : { label: `salida ${formatClock(greenLight)}` },
      ),
      podium(clean, falseStarts),
      strip(clean, falseStarts, busted),
      kpis(clean, falseStarts),
      footer(HEIGHT - 20),
      '</svg>',
    ].join('\n');
  }
}

// ── Podio ───────────────────────────────────────────────────
//
// El nombre ocupa una linea entera para que quepan los mas largos del padron
// sin recortes. El mas largo medido, de 27 caracteres con tildes, mide 207.9 px
// a 14.5 px de cuerpo, asi que el hueco util de la tarjeta tiene que llegar a
// cardW - 24 (210.67 px): con cardW - 32 se quedaba en 202.67 px y el nombre
// salia recortado pese a que a su derecha sobraban 15 px. Con cardW - 24 quedan
// 7 px de aire hasta el borde de la tarjeta y 2.8 px de margen sobre el nombre
// mas largo de hoy. A partir de unos 28 caracteres se recorta con elipsis, que
// es el comportamiento previsto y no un fallo.

function podium(
  clean: StartingGridEntry[],
  falseStarts: StartingGridEntry[],
): string {
  const winners = clean.slice(0, 3);
  if (winners.length === 0) return noWinners(falseStarts);

  const cardW = (W - PAD * 2 - CARD_GAP * (winners.length - 1)) / winners.length;
  const parts: string[] = [];

  winners.forEach((entry, i) => {
    const x = PAD + i * (cardW + CARD_GAP);
    const metal = metalFor(entry.position)!;

    parts.push(
      // El tinte va por posicion y no por indice: dos que comparten el P1
      // tienen que verse igual, y por indice el segundo salia mas apagado
      `<rect x="${n(x)}" y="${PODIUM_TOP}" width="${n(cardW)}" height="${PODIUM_H}" rx="3" fill="${rgba(metal.mid, entry.position === 1 ? 0.075 : 0.042)}"/>`,
      `<rect x="${n(x)}" y="${PODIUM_TOP}" width="2.5" height="${PODIUM_H}" fill="url(#${metalId(entry.position)})"/>`,
    );

    const innerX = x + 17;
    const nameSize = 14.5;
    parts.push(
      text(
        ellipsize(entry.driver.displayName, cardW - 24, nameSize, 'name', 600),
        innerX,
        PODIUM_TOP + 25,
        { size: nameSize, weight: 600, family: 'name', fill: T.ink },
      ),
    );

    const hexR = 15;
    const hexCy = PODIUM_TOP + 53;
    parts.push(
      hexagon(innerX + hexR, hexCy, hexR, `url(#${metalId(entry.position)})`),
      text(String(entry.position), innerX + hexR, hexCy + 6, {
        size: 16,
        weight: 900,
        fill: metal.ink,
        anchor: 'middle',
      }),
    );

    parts.push(
      text(formatDiff(entry.diffSeconds), innerX + hexR * 2 + 13, hexCy + 6, {
        size: 17,
        weight: 700,
        fill: metal.mid,
      }),
      text(`${entry.points} pts`, x + cardW - 16, hexCy + 5, {
        size: 10.5,
        weight: 600,
        family: 'name',
        fill: T.ink4,
        anchor: 'end',
        spacing: 0.5,
      }),
    );
  });

  return parts.join('');
}

/**
 * Cuando nadie espera al semaforo no hay podio que ensenar, y dejar el hueco
 * vacio parecia un fallo de render. En su lugar se cuenta lo que ha pasado.
 */
function noWinners(falseStarts: StartingGridEntry[]): string {
  const sorted = [...falseStarts].sort((a, b) => a.diffSeconds - b.diffSeconds);
  const worst = sorted[0];
  const closest = sorted[sorted.length - 1];
  const width = W - PAD * 2;

  const parts: string[] = [
    `<rect x="${PAD}" y="${PODIUM_TOP}" width="${n(width)}" height="${PODIUM_H}" rx="3" fill="${rgba(T.red, 0.05)}"/>`,
    `<rect x="${PAD}" y="${PODIUM_TOP}" width="2.5" height="${PODIUM_H}" fill="url(#redbar)"/>`,
    text('Nadie esperó al semáforo', PAD + 17, PODIUM_TOP + 30, {
      size: 17,
      weight: 600,
      family: 'name',
      fill: T.ink,
    }),
    text(
      `las ${falseStarts.length} entradas del día se adelantaron a la hora`,
      PAD + 17,
      PODIUM_TOP + 52,
      { size: 11.5, family: 'name', fill: T.ink3 },
    ),
  ];

  if (worst && closest) {
    const detail = [
      `el que más, ${formatShort(worst.diffSeconds)}`,
      `el que menos, ${formatShort(closest.diffSeconds)}`,
    ].join('   ·   ');
    parts.push(
      text(detail, W - PAD - 17, PODIUM_TOP + 52, {
        size: 11.5,
        family: 'name',
        fill: T.ink4,
        anchor: 'end',
      }),
    );
  }
  return parts.join('');
}

// ── Cinta de salida ─────────────────────────────────────────

function strip(
  clean: StartingGridEntry[],
  falseStarts: StartingGridEntry[],
  busted: StartingGridEntry[],
): string {
  const parts: string[] = [];
  const x0 = PAD + 6;
  const x1 = W - PAD - 6;

  const maxDiff = clean.length > 0 ? Math.max(...clean.map((e) => e.diffSeconds)) : 0;
  const minDiff = Math.min(0, ...falseStarts.map((e) => e.diffSeconds));
  const points = [...clean, ...falseStarts];
  // El eje se estrecha el radio del hexagono por cada lado, que es justo lo que
  // el punto del extremo necesita para no salirse del lienzo. Sin esa reserva el
  // punto se clampaba hacia dentro y su tick se quedaba fuera de la escala: el
  // que entraba media hora antes acababa dibujado encima del tick de -20 min
  const inset = baseRadius(points.length);
  const scale = timeScale({
    min: minDiff,
    max: maxDiff,
    x0: x0 + inset,
    x1: x1 - inset,
    minTickGap: 52,
  });

  const total = points.length;
  const summary =
    falseStarts.length > 0
      ? `${total} pilotos · ${falseStarts.length} en falso`
      : `${total} pilotos`;
  parts.push(
    text('LA SALIDA', PAD, STRIP_TITLE_Y, {
      size: 10.5,
      weight: 700,
      family: 'name',
      fill: T.ink3,
      spacing: 1.8,
    }),
    text(summary, W - PAD, STRIP_TITLE_Y, {
      size: 10.5,
      family: 'name',
      fill: T.ink4,
      anchor: 'end',
    }),
  );

  // Eje
  const axisTop = STRIP_TITLE_Y + 12;
  for (const tick of scale.ticks) {
    const isZero = tick.seconds === 0;
    const o: TextOpts = {
      size: 10.5,
      fill: isZero ? T.cream : T.ink4,
      weight: isZero ? 700 : 400,
      anchor: 'middle',
    };
    // La linea del tick se queda donde le toca y solo se acota la etiqueta: un
    // tick cerca del borde dejaba parte del texto fuera del margen del lienzo, y
    // pasaba en 19 de las 89 carreras que hay en base
    const half = textWidth(tick.label, o) / 2;
    const labelX = Math.min(W - PAD - half, Math.max(PAD + half, tick.x));
    parts.push(
      `<line x1="${n(tick.x)}" y1="${axisTop}" x2="${n(tick.x)}" y2="${SWARM_BASE + 10}" stroke="${isZero ? rgba(T.cream, 0.5) : T.hairlineSoft}" stroke-width="1"/>`,
      text(tick.label, labelX, AXIS_LABEL_Y, o),
    );
  }
  // Puntos, en calles verticales para que los empates exactos (hasta ocho
  // pilotos con el mismo timestamp) no se dibujen unos sobre otros
  parts.push(swarm(layoutPoints(points, scale, x0, x1)));

  // Anotaciones en su propia franja, nunca sobre los puntos ni sobre el eje
  parts.push(annotations(clean, falseStarts, busted));
  return parts.join('');
}

/** Radio del hexagono de la cinta antes de reducirlo por empates */
function baseRadius(count: number): number {
  return count > 40 ? 4.1 : 4.8;
}

interface Mark {
  x: number;
  lane: number;
  /** el piloto que representa la marca, el mejor del grupo si se ha colapsado */
  entry: StartingGridEntry;
  /** pilotos representados: uno, salvo en el colapso de empates absurdos */
  count: number;
}

interface Swarm {
  radius: number;
  laneStep: number;
  marks: Mark[];
}

/** Orden de pintado: primero el grid neutro, luego el rojo y al final el metal */
function paintRank(entry: StartingGridEntry): number {
  if (entry.isFalseStart) return 1;
  return metalFor(entry.position) ? 2 : 0;
}

/**
 * Coloca los puntos de la cinta. Los hexagonos se mantienen dentro del margen y
 * las calles no pueden pasar del hueco vertical disponible, asi que si hay mas
 * empates que calles se reduce el tamano del punto antes que apilarlos: con ocho
 * pilotos en el mismo instante, que es lo que llega a haber, apilar dejaba ver
 * tres y escondia cinco.
 *
 * La senal de que el reparto ha cabido es que beeswarm no haya apilado ni un
 * punto. Contar calles usadas no servia: nunca llegan al maximo, asi que el
 * reparto siempre parecia bueno y la reduccion de radio no entraba jamas.
 */
function layoutPoints(
  points: StartingGridEntry[],
  scale: { toX: (seconds: number) => number },
  x0: number,
  x1: number,
): Swarm {
  const available = SWARM_BASE - (STRIP_TITLE_Y + 14);
  const base = baseRadius(points.length);
  const lanesFor = (radius: number, laneStep: number): number =>
    Math.max(1, Math.floor((available - radius) / laneStep));

  const fit = (radius: number) => {
    const laneStep = radius * 2 + 1.5;
    const xs = points.map((e) =>
      Math.min(x1 - radius, Math.max(x0 + radius, scale.toX(e.diffSeconds))),
    );
    const { lanes, stacked } = beeswarm(
      xs,
      radius + 0.7,
      lanesFor(radius, laneStep),
    );
    return { radius, laneStep, xs, lanes, stacked };
  };

  // Menos radio da mas calles y exige menos separacion, asi que se baja hasta
  // que no quede nada apilado: nueve pilotos en el mismo instante necesitan
  // 3.39 px de radio y el factor 0.68 ya deja 3.26
  let layout = fit(base);
  for (const factor of [0.82, 0.68, 0.56]) {
    if (layout.stacked === 0) break;
    const candidate = fit(base * factor);
    if (candidate.stacked < layout.stacked) layout = candidate;
  }

  const { radius, laneStep, xs, lanes } = layout;
  if (layout.stacked === 0) {
    return {
      radius,
      laneStep,
      marks: points.map((entry, i) => ({ x: xs[i], lane: lanes[i], entry, count: 1 })),
    };
  }

  // Ultimo recurso para un empate absurdo (veinte o mas en el mismo
  // milisegundo): ni al radio mas pequeno hay calles para todos, y apilar dibuja
  // hexagonos que nadie ve. Cada grupo de x identica pasa a ser una sola marca
  // con su contador al lado, de modo que la cuenta de la cinta sigue cuadrando.
  const groups = new Map<string, number[]>();
  points.forEach((_, i) => {
    const key = xs[i].toFixed(2);
    const group = groups.get(key);
    if (group) group.push(i);
    else groups.set(key, [i]);
  });
  const grouped = [...groups.values()];
  const groupX = grouped.map((group) => xs[group[0]]);
  const groupLanes = beeswarm(
    groupX,
    radius + 0.7,
    lanesFor(radius, laneStep),
  ).lanes;

  return {
    radius,
    laneStep,
    marks: grouped.map((group, g) => ({
      x: groupX[g],
      lane: groupLanes[g],
      // Manda el mejor del grupo: si el ganador esta dentro, la marca es de oro
      entry: points[group.reduce((a, b) => (paintRank(points[b]) > paintRank(points[a]) ? b : a))],
      count: group.length,
    })),
  };
}

/** Pinta las marcas de la cinta */
function swarm({ radius, laneStep, marks }: Swarm): string {
  const parts: string[] = [];
  // Los metales del podio van al final del bucle: si comparten calle con un
  // hexagono neutro, el oro del primero no puede quedar debajo
  const ordered = [...marks].sort(
    (a, b) => paintRank(a.entry) - paintRank(b.entry),
  );

  for (const mark of ordered) {
    const { entry } = mark;
    const cy = SWARM_BASE - radius - mark.lane * laneStep;
    const metal = entry.isFalseStart ? null : metalFor(entry.position);
    const fill = entry.isFalseStart
      ? T.red
      : metal
        ? `url(#${metalId(entry.position)})`
        : rgba(T.cream, 0.5);
    parts.push(hexagon(mark.x, cy, radius, fill));

    if (mark.count > 1) {
      const o: TextOpts = { size: 10, weight: 700, fill: T.ink3 };
      const label = `x${mark.count}`;
      const right = mark.x + radius + 3;
      parts.push(
        right + textWidth(label, o) <= W - PAD
          ? text(label, right, cy + 3.5, o)
          : text(label, mark.x - radius - 3, cy + 3.5, { ...o, anchor: 'end' }),
      );
    }
  }
  return parts.join('');
}

function annotations(
  clean: StartingGridEntry[],
  falseStarts: StartingGridEntry[],
  busted: StartingGridEntry[],
): string {
  const parts: string[] = [];
  let leftEdge = PAD;

  const last = clean[clean.length - 1];
  const bustedIsLast = last != null && busted.includes(last);

  if (busted.length > 0) {
    // El chip crece con la etiqueta y no recorta solo, asi que los nombres se
    // acotan antes: con la calavera compartida son dos y podrian salirse
    const time = formatShort(busted[0].diffSeconds);
    const fixed = `busted ·  · ${time}`;
    const budget =
      (W - PAD * 2) * 0.62 -
      24 -
      textWidth(fixed.toUpperCase(), CHIP_LABEL);
    const names = ellipsize(
      bustedNames(busted),
      Math.max(40, budget),
      CHIP_LABEL.size,
      'name',
      700,
    );
    const width = chip(
      PAD,
      NOTE_Y,
      `busted · ${names} · ${time}`,
      T.red,
      parts,
    );
    leftEdge = PAD + width + 14;
  }

  if (last && !bustedIsLast && clean.length > 3) {
    const prefix = 'último en entrar · ';
    const o = { size: 10.5, family: 'name' as const, fill: T.ink4 };
    const valueO = { size: 10.5, weight: 700 as const, fill: T.ink2 };
    const value = formatShort(last.diffSeconds);
    const valueW = textWidth(value, valueO);
    const available = W - PAD - leftEdge - valueW - 8;
    if (available > 60) {
      const name = ellipsize(
        `${prefix}${last.driver.displayName}`,
        available,
        o.size,
        'name',
        400,
      );
      parts.push(
        text(value, W - PAD, NOTE_Y + 3.5, { ...valueO, anchor: 'end' }),
        text(name, W - PAD - valueW - 8, NOTE_Y + 3.5, { ...o, anchor: 'end' }),
      );
    }
  }

  if (falseStarts.length > 0 && busted.length === 0) {
    chip(
      PAD,
      NOTE_Y,
      `${falseStarts.length} salida${falseStarts.length > 1 ? 's' : ''} en falso`,
      T.red,
      parts,
    );
  }
  return parts.join('');
}

/** Pinta un chip hexagonal y devuelve su anchura */
/**
 * Nombres de la calavera. A igualdad de culpa la comparten todos los empatados,
 * pero la etiqueta tiene que seguir cabiendo, asi que de tres en adelante se
 * cuenta el resto en vez de enumerarlo.
 */
function bustedNames(busted: StartingGridEntry[]): string {
  const names = busted.map((e) => e.driver.displayName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]} y ${names.length - 1} más`;
}

const CHIP_LABEL = {
  size: 10,
  weight: 700 as const,
  family: 'name' as const,
  fill: '',
  spacing: 0.9,
};

function chip(
  x: number,
  cy: number,
  label: string,
  color: string,
  out: string[],
): number {
  const o = { ...CHIP_LABEL, fill: color };
  const upper = label.toUpperCase();
  const width = textWidth(upper, o) + 24;
  out.push(
    hexagonFlat(
      x + width / 2,
      cy,
      width,
      18,
      rgba(color, 0.12),
      `stroke="${rgba(color, 0.42)}" stroke-width="1"`,
    ),
    text(upper, x + 12, cy + 3.4, o),
  );
  return width;
}

// ── Metricas ────────────────────────────────────────────────

function kpis(
  clean: StartingGridEntry[],
  falseStarts: StartingGridEntry[],
): string {
  const diffs = clean.map((e) => e.diffSeconds).sort((a, b) => a - b);
  const median = diffs.length ? diffs[Math.floor((diffs.length - 1) / 2)] : 0;
  const punctual = diffs.filter((d) => d < PUNCTUAL_LIMIT).length;

  if (clean.length === 0) {
    // Sin nadie tras el semaforo no hay mediana del grid ni margen del podio, y
    // aqui falseStarts.length ES la parrilla, asi que el contador de salidas en
    // falso repetiria el total que ya dan el panel de arriba y la cabecera de la
    // cinta. La fila se queda en tres columnas con lo que no sale en ningun otro
    // sitio, y columns() reparte el ancho solo.
    const early = falseStarts
      .map((e) => Math.abs(e.diffSeconds))
      .sort((a, b) => a - b);
    const window = early.length > 0 ? early[early.length - 1] - early[0] : 0;
    return columns([
      [
        'MEDIANA DEL ADELANTO',
        early.length > 0 ? formatShort(early[Math.floor((early.length - 1) / 2)]) : '—',
      ],
      [
        'MÁS DE UN MINUTO ANTES',
        `${early.filter((s) => s > 60).length} de ${early.length}`,
      ],
      ['VENTANA TOTAL', formatShort(window)],
    ]);
  }

  const margin =
    clean.length >= 2 ? clean[1].diffSeconds - clean[0].diffSeconds : null;
  const items: [string, string][] = [
    ['EN LOS 2 PRIMEROS SEGUNDOS', `${punctual} de ${clean.length}`],
    ['MARGEN DEL PODIO', margin != null ? formatDiff(margin) : '—'],
    ['MEDIANA DEL GRID', formatShort(median)],
    ['SALIDAS EN FALSO', String(falseStarts.length)],
  ];

  return columns(items);
}

function columns(items: [string, string][]): string {
  const parts: string[] = [
    `<line x1="${PAD}" y1="${KPI_TOP - 18}" x2="${W - PAD}" y2="${KPI_TOP - 18}" stroke="${T.hairlineSoft}" stroke-width="1"/>`,
  ];
  const colW = (W - PAD * 2) / items.length;
  items.forEach(([label, value], i) => {
    const x = PAD + i * colW;
    if (i > 0) {
      parts.push(
        `<line x1="${n(x - 8)}" y1="${KPI_TOP - 2}" x2="${n(x - 8)}" y2="${KPI_TOP + 30}" stroke="${T.hairlineSoft}" stroke-width="1"/>`,
      );
    }
    parts.push(
      // El cuerpo no baja de 10 px, que es el suelo de la pieza, y la letra se
      // aprieta a 0.5 para que la etiqueta mas larga ("EN LOS 2 PRIMEROS
      // SEGUNDOS", 170.4 px) siga cabiendo en los 174 px de la columna
      text(label, x, KPI_TOP + 6, {
        size: 10,
        weight: 600,
        family: 'name',
        fill: T.ink4,
        spacing: 0.5,
      }),
      text(value, x, KPI_TOP + 30, { size: 21, weight: 700, fill: T.cream }),
    );
  });
  return parts.join('');
}
