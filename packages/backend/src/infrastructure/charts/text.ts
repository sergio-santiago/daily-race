import { FONT_METRICS, FontKey } from './font-metrics';
import { T } from './theme';

export type Family = 'num' | 'name' | 'display';
export type Weight = 400 | 600 | 700 | 900;

const FAMILY_FONT: Record<Family, string> = {
  num: 'titillium',
  name: 'inter',
  display: 'titillium',
};

// Pesos realmente empaquetados por familia. Se redondea al mas cercano
// disponible para que la medida coincida con lo que rasteriza resvg.
const AVAILABLE: Record<Family, Weight[]> = {
  num: [400, 700, 900],
  name: [400, 600, 700],
  display: [400, 700, 900],
};

function metricKey(family: Family, weight: Weight): FontKey {
  const options = AVAILABLE[family];
  const closest = options.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
  return `${FAMILY_FONT[family]}-${closest}` as FontKey;
}

/** Anchura exacta del texto en px, medida con las metricas del TTF */
export function measure(
  content: string,
  size: number,
  family: Family = 'num',
  weight: Weight = 400,
  letterSpacing = 0,
): number {
  const metric = FONT_METRICS[metricKey(family, weight)];
  let em = 0;
  for (const char of content) {
    const code = char.codePointAt(0)!;
    em += metric.widths[code] ?? metric.fallback;
  }
  const chars = [...content].length;
  return em * size + Math.max(0, chars - 1) * letterSpacing;
}

/** Recorta con elipsis para que quepa en maxWidth px */
export function ellipsize(
  content: string,
  maxWidth: number,
  size: number,
  family: Family = 'name',
  weight: Weight = 400,
  letterSpacing = 0,
): string {
  if (measure(content, size, family, weight, letterSpacing) <= maxWidth) {
    return content;
  }
  const chars = [...content];
  let result = chars;
  while (result.length > 1) {
    result = result.slice(0, -1);
    const candidate = result.join('').trimEnd() + '…';
    if (measure(candidate, size, family, weight, letterSpacing) <= maxWidth) {
      return candidate;
    }
  }
  return '…';
}

export function escapeXml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function n(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export interface TextOpts {
  size: number;
  fill: string;
  family?: Family;
  weight?: Weight;
  anchor?: 'start' | 'middle' | 'end';
  spacing?: number;
  opacity?: number;
}

export function text(
  content: string,
  x: number,
  y: number,
  o: TextOpts,
): string {
  const family = T.font[o.family ?? 'num'];
  const parts = [
    `x="${n(x)}"`,
    `y="${n(y)}"`,
    `font-family="${family}"`,
    `font-size="${o.size}"`,
    `fill="${o.fill}"`,
  ];
  if (o.weight && o.weight !== 400) parts.push(`font-weight="${o.weight}"`);
  if (o.anchor) parts.push(`text-anchor="${o.anchor}"`);
  if (o.spacing) parts.push(`letter-spacing="${o.spacing}"`);
  if (o.opacity != null && o.opacity < 1) {
    parts.push(`fill-opacity="${o.opacity}"`);
  }
  return `<text ${parts.join(' ')}>${escapeXml(content)}</text>`;
}

/** Anchura de un texto ya descrito con TextOpts */
export function textWidth(content: string, o: TextOpts): number {
  return measure(content, o.size, o.family ?? 'num', o.weight ?? 400, o.spacing ?? 0);
}
