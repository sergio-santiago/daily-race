import { Injectable } from '@nestjs/common';
import { Race } from '../../core/entities/race.entity';
import { ChampionshipStanding } from '../../core/entities/championship-standing.entity';
import { T, metalFor, metalId, rgba } from './theme';
import { hexagon } from './brand';
import { formatDayMonth, formatDayMonthName } from './dates';
import { ellipsize, n, text, textWidth } from './text';
import {
  buildEvolution,
  packMedian,
  medianIsLegible,
  niceScale,
  EvolutionSeries,
} from './championship-series';
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

// Se dibujan una a una solo las lineas del top, y el resto de la parrilla (que
// en la temporada medida son 83 pilotos) se resume en la mediana del grupo. Una
// linea por piloto formaba un borron gris ilegible, y la franja entre cuartiles
// que se probo antes bajaba del cero con pocas carreras, porque el cuartil
// inferior son los que llevan una salida en falso: el area se leia como un fallo
// de render y no como un dato.
//
// Las etiquetas finales resuelven colisiones entre ellas y con la del grupo, de
// modo que ninguna se solapa aunque tres pilotos empaten a puntos.

const TOP_COLORED = 6;
const HEIGHT = 470;
const PLOT_TOP = HEADER_H + 26;
const PLOT_BOTTOM = HEIGHT - 74;
// Suelo del eje: con totales de dos o tres cifras manda este, con cuatro o mas
// manda la anchura medida de la etiqueta mas larga
const AXIS_X_MIN = PAD + 26;
const AXIS_LABEL = { size: 10.5, fill: '' } as const;
const GUTTER_MIN = 168;
const TAG_GAP = 27;

@Injectable()
export class ChampionshipEvolutionChartService {
  constructor(private readonly svgToPng: SvgToPngService) {}

  /** Devuelve null si aun no hay carreras suficientes para que una linea diga algo */
  renderPng(
    standings: ChampionshipStanding[],
    races: Race[],
  ): Buffer | null {
    const svg = this.buildSvg(standings, races);
    return svg ? this.svgToPng.toPng(svg, OUTPUT_WIDTH) : null;
  }

  buildSvg(standings: ChampionshipStanding[], races: Race[]): string | null {
    if (standings.length === 0 || races.length < MIN_RACES) return null;

    return buildChampionshipSvg(standings, races);
  }
}

/**
 * La grafica sale desde la primera carrera de la temporada: la linea arranca en
 * el origen, con todo el mundo a cero, asi que ya con una jornada hay algo que
 * dibujar y el mensaje de campeonato no cambia de forma segun la semana.
 */
export const MIN_RACES = 1;

function buildChampionshipSvg(
  standings: ChampionshipStanding[],
  races: Race[],
): string {

  const { series, raceDates } = buildEvolution(standings, races);
  const colored = series.slice(0, TOP_COLORED);
  const pack = series.slice(TOP_COLORED);
  // Un punto mas que carreras: el primero es el arranque de temporada
  const n_ = raceDates.length + 1;

  const packLine = pack.length > 0 ? packMedian(pack) : null;

  const maxPoints = Math.max(1, ...series.map((s) => s.cumulative[n_ - 1]));
  // El suelo se mide solo sobre lo que se dibuja de verdad, las lineas del top y
  // la mediana del peloton: un piloto suelto en negativo que no se pinta no debe
  // reservar espacio en el eje
  const minPoints = Math.min(
    0,
    ...colored.flatMap((s) => s.cumulative),
    ...(packLine ?? []),
  );
  const { step, niceMax, niceMin } = niceScale(maxPoints, minPoints);

  // Rejilla: las divisiones parten del cero y crecen en los dos sentidos, para
  // que la linea de referencia este siempre aunque el suelo del eje sea negativo
  const gridValues: number[] = [];
  for (let value = 0; value <= niceMax; value += step) gridValues.push(value);
  for (let value = -step; value >= niceMin; value -= step) gridValues.push(value);
  // Si el suelo es negativo pero el paso no llega a el, se marca aparte: las
  // lineas bajaban del cero sin ninguna referencia numerica debajo
  if (niceMin < 0 && !gridValues.includes(niceMin)) gridValues.push(niceMin);

  // El eje se aparta lo que ocupe de verdad su etiqueta mas larga: con un margen
  // fijo, los totales de cuatro cifras de la temporada actual se salian del
  // lienzo por la izquierda. Se redondea al pixel entero para que la hairline
  // caiga limpia y para que el borde del numero no se quede un decimal por fuera
  const axisX = Math.max(
    AXIS_X_MIN,
    Math.ceil(PAD + 8 + Math.max(...gridValues.map((v) => textWidth(String(v), AXIS_LABEL)))),
  );

  const y = (points: number): number => {
    // Se recorta al rango del eje: cuando el suelo se queda en cero por ser el
    // negativo irrelevante, ninguna serie debe desbordar por abajo
    const clamped = Math.min(niceMax, Math.max(niceMin, points));
    return (
      PLOT_BOTTOM -
      ((clamped - niceMin) / (niceMax - niceMin)) * (PLOT_BOTTOM - PLOT_TOP)
    );
  };

  // La mediana solo se dibuja si su trazo se distingue del cero. Si no, su cifra
  // pasa al canal derecho, que es donde el dato se puede leer de verdad
  const packDrawn =
    packLine != null &&
    medianIsLegible(
      packLine,
      y,
      colored.map((s) => s.cumulative),
    );
  const packLabel =
    packLine == null
      ? null
      : packDrawn
        ? `+${pack.length} pilotos`
        : `+${pack.length} pilotos · mediana ${Math.round(packLine[n_ - 1])}`;

  // El canal derecho se dimensiona con el texto real de las etiquetas
  const labels = colored.map((s) => s.label);
  const gutter = Math.min(
    260,
    Math.max(
      GUTTER_MIN,
      ...colored.map((s, i) => {
        const nameW = textWidth(labels[i], { size: 12, family: 'name', weight: 600, fill: '' });
        const ptsW = textWidth(String(s.cumulative[n_ - 1]), { size: 13, weight: 700, fill: '' });
        return 47 + nameW + 10 + ptsW + PAD + 2;
      }),
      ...(packLabel
        ? [
            47 +
              textWidth(packLabel, { size: 12, family: 'name', weight: 600, fill: '' }) +
              10 +
              PAD +
              2,
          ]
        : []),
    ),
  );

  const plotRight = W - gutter;
  const x = (i: number): number =>
    axisX + (n_ === 1 ? 0 : (i / (n_ - 1)) * (plotRight - axisX));

  const parts: string[] = [
    svgOpen(HEIGHT),
    defs(
      `<linearGradient id="lead" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${T.series[0]}" stop-opacity="0.16"/>` +
        `<stop offset="1" stop-color="${T.series[0]}" stop-opacity="0"/>` +
        `</linearGradient>`,
    ),
    surface(HEIGHT),
    header(
      'Campeonato',
      `Clasificación general · ${raceDates.length} ${raceDates.length === 1 ? 'carrera' : 'carreras'}`,
      { label: formatDayMonthName(raceDates[raceDates.length - 1]) },
    ),
  ];

  // Rejilla y etiquetas del eje de puntos
  for (const value of gridValues) {
    const gy = y(value);
    parts.push(
      `<line x1="${n(axisX)}" y1="${n(gy)}" x2="${n(plotRight)}" y2="${n(gy)}" stroke="${value === 0 ? T.hairline : T.hairlineSoft}" stroke-width="1"/>`,
      text(String(value), axisX - 8, gy + 3.5, {
        ...AXIS_LABEL,
        fill: value === 0 ? T.ink3 : T.ink4,
        anchor: 'end',
      }),
    );
  }

  // Fechas: el indice 0 es el arranque de temporada y no tiene carrera detras
  for (const i of tickIndexes(n_)) {
    parts.push(
      text(i === 0 ? 'inicio' : formatDayMonth(raceDates[i - 1]), x(i), PLOT_BOTTOM + 20, {
        size: 10.5,
        fill: T.ink4,
        anchor: i === 0 ? 'start' : i === n_ - 1 ? 'end' : 'middle',
      }),
    );
  }

  // Area bajo el lider y lineas, de peor a mejor para que el lider quede arriba
  parts.push(area(colored[0].cumulative, x, y, y(0)));
  for (let i = colored.length - 1; i >= 0; i--) {
    parts.push(
      line(colored[i].cumulative, x, y, T.series[i], i === 0 ? 2.4 : 1.8),
    );
  }

  // Mediana del peloton: discontinua, explicada en el pie, y por encima de las
  // solidas. Dibujada antes desaparecia justo donde coincidia con una serie, que
  // es el caso en el que el lector mas la busca
  if (packDrawn && packLine) {
    const d = packLine
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${n(x(i))} ${n(y(v))}`)
      .join(' ');
    parts.push(
      `<path d="${d}" fill="none" stroke="${rgba(T.ink2, 0.34)}" stroke-width="1.2" stroke-dasharray="4 3"/>`,
    );
  }

  parts.push(tags(colored, packLine, packLabel, packDrawn, x(n_ - 1), y, n_));
  parts.push(
    footer(
      HEIGHT - 20,
      packDrawn ? 'la línea discontinua es la mediana del resto del grid' : undefined,
    ),
  );
  parts.push('</svg>');
  return parts.join('\n');
}

// ── Etiquetas ───────────────────────────────────────────────

function tags(
  colored: EvolutionSeries[],
  packLine: number[] | null,
  packLabel: string | null,
  packDrawn: boolean,
  xEnd: number,
  y: (points: number) => number,
  n_: number,
): string {
  interface Tag {
    endY: number;
    tagY: number;
    label: string;
    value: string;
    rank: number | null;
    color: string;
    muted: boolean;
    /** si tiene una linea dibujada de la que colgar el punto y el conector */
    anchored: boolean;
  }

  const tagList: Tag[] = colored.map((s, i) => ({
    endY: y(s.cumulative[n_ - 1]),
    tagY: y(s.cumulative[n_ - 1]),
    label: s.label,
    value: String(s.cumulative[n_ - 1]),
    rank: i + 1,
    color: T.series[i],
    muted: false,
    anchored: true,
  }));

  // El grupo entra en la misma resolucion de colisiones que los demas: antes
  // se dibujaba en su punto exacto y se pisaba con la etiqueta del sexto
  if (packLine && packLabel) {
    const endY = y(packLine[n_ - 1]);
    tagList.push({
      endY,
      tagY: endY,
      label: packLabel,
      value: '',
      rank: null,
      color: rgba(T.ink2, 0.45),
      muted: true,
      // Cuando la mediana no se dibuja por no distinguirse, su cifra va en la
      // etiqueta y no queda linea de la que colgar: un punto suelto sobre el
      // area de trazado se lee como un fallo de render
      anchored: packDrawn,
    });
  }

  spread(tagList, PLOT_TOP + 6, PLOT_BOTTOM);

  const parts: string[] = [];
  for (const tag of tagList) {
    if (tag.anchored) {
      parts.push(
        tag.muted
          ? `<circle cx="${n(xEnd)}" cy="${n(tag.endY)}" r="2.6" fill="${rgba(T.ink2, 0.5)}"/>`
          : `<circle cx="${n(xEnd)}" cy="${n(tag.endY)}" r="3.4" fill="${tag.color}" stroke="${T.bgBottom}" stroke-width="1.4"/>`,
      );
    }
    // El grupo entra sangrado 26 px, lo que ocupa el badge de los demas, para
    // que su texto quede alineado con los nombres
    const contentX = xEnd + 21 + (tag.muted ? 26 : 0);
    if (tag.anchored && Math.abs(tag.tagY - tag.endY) > 3) {
      // El conector muere justo antes del contenido de su propia etiqueta: con un
      // destino fijo la raya del grupo se quedaba a 31 px, apuntando al vacio
      parts.push(
        `<path d="M${n(xEnd + 5)} ${n(tag.endY)} L${n(contentX - 5)} ${n(tag.tagY)}" stroke="${rgba(T.ink2, 0.22)}" stroke-width="1" fill="none"/>`,
      );
    }

    let cursor = contentX;

    const metal = tag.rank != null ? metalFor(tag.rank) : null;
    if (metal) {
      parts.push(
        hexagon(cursor + 10, tag.tagY, 10.5, `url(#${metalId(tag.rank!)})`),
        text(String(tag.rank), cursor + 10, tag.tagY + 4, {
          size: 11,
          weight: 900,
          fill: metal.ink,
          anchor: 'middle',
        }),
      );
      cursor += 26;
    } else if (tag.rank != null) {
      parts.push(
        hexagon(cursor + 10, tag.tagY, 10.5, rgba(tag.color, 0.18), `stroke="${tag.color}" stroke-width="1.2"`),
        text(String(tag.rank), cursor + 10, tag.tagY + 4, {
          size: 11,
          weight: 700,
          fill: tag.color,
          anchor: 'middle',
        }),
      );
      cursor += 26;
    }

    const valueO = {
      size: 13,
      weight: 700 as const,
      fill: tag.muted ? T.ink4 : T.ink,
    };
    const valueW = tag.value ? textWidth(tag.value, valueO) : 0;
    const nameMax = W - PAD - cursor - valueW - 10;
    // gutter reserva 47 + nombre + 10 + puntos + PAD, de modo que nameMax >= nombre
    parts.push(
      text(
        ellipsize(tag.label, nameMax, 12, 'name', tag.rank === 1 ? 700 : 600),
        cursor,
        tag.tagY + 4,
        {
          size: 12,
          family: 'name',
          weight: tag.rank === 1 ? 700 : 600,
          fill: tag.muted ? T.ink4 : tag.rank === 1 ? T.ink : T.ink2,
        },
      ),
    );
    if (tag.value) {
      parts.push(text(tag.value, W - PAD, tag.tagY + 4, { ...valueO, anchor: 'end' }));
    }
  }
  return parts.join('');
}

function spread(
  tags: { endY: number; tagY: number }[],
  top: number,
  bottom: number,
): void {
  const sorted = [...tags].sort((a, b) => a.endY - b.endY);
  for (let i = 0; i < sorted.length; i++) {
    const min = i === 0 ? top : sorted[i - 1].tagY + TAG_GAP;
    sorted[i].tagY = Math.max(sorted[i].tagY, min);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const max = i === sorted.length - 1 ? bottom : sorted[i + 1].tagY - TAG_GAP;
    sorted[i].tagY = Math.min(sorted[i].tagY, max);
  }
}

// ── Trazos ──────────────────────────────────────────────────

function line(
  values: number[],
  x: (i: number) => number,
  y: (v: number) => number,
  color: string,
  width: number,
): string {
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${n(x(i))} ${n(y(v))}`)
    .join(' ');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function area(
  values: number[],
  x: (i: number) => number,
  y: (v: number) => number,
  baseline: number,
): string {
  const top = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${n(x(i))} ${n(y(v))}`)
    .join(' ');
  return `<path d="${top} L${n(x(values.length - 1))} ${n(baseline)} L${n(x(0))} ${n(baseline)} Z" fill="url(#lead)"/>`;
}

function tickIndexes(count: number): number[] {
  const max = 6;
  if (count <= max) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (max - 1));
  const out: number[] = [];
  for (let i = 0; i < count - 1; i += step) out.push(i);
  if (count - 1 - out[out.length - 1] < step / 2) out.pop();
  out.push(count - 1);
  return out;
}
