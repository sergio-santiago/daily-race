import { T, rgba } from './theme';
import { checkers, isotype } from './brand';
import { n, text, textWidth } from './text';
import { hexagonFlat } from './brand';

// Marco comun de todas las graficas.
//
// El lienzo es deliberadamente estrecho: Discord muestra las imagenes de embed
// a unos 550 px de ancho, asi que un canvas de 1200 px reduce un texto de 15 px
// a 7 px reales en el feed. Con 780 px de ancho logico el mismo texto se lee a
// unos 11 px sin abrir la imagen, y el factor de escala 2 (SCALE) mantiene la
// nitidez para quien la abra a tamano completo.
export const W = 780;
export const SCALE = 2;
export const OUTPUT_WIDTH = W * SCALE;

export const PAD = 26;
export const HEADER_H = 72;

export function defs(extra = ''): string {
  const metal = (id: string, i: number): string => {
    const m = T.podium[i];
    return (
      `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">` +
      `<stop offset="0" stop-color="${m.light}"/>` +
      `<stop offset="0.55" stop-color="${m.mid}"/>` +
      `<stop offset="1" stop-color="${m.dark}"/>` +
      `</linearGradient>`
    );
  };

  return (
    '<defs>' +
    `<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">` +
    `<stop offset="0" stop-color="${T.bgTop}"/>` +
    `<stop offset="1" stop-color="${T.bgBottom}"/>` +
    `</linearGradient>` +
    `<radialGradient id="vig" cx="0.5" cy="0.3" r="0.9">` +
    `<stop offset="0.5" stop-color="#000000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.45"/>` +
    `</radialGradient>` +
    // Halo crema muy tenue en la cabecera: la calidez de la identidad Secture
    `<radialGradient id="warm" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${T.cream}" stop-opacity="0.085"/>` +
    `<stop offset="1" stop-color="${T.cream}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${T.cream}" stop-opacity="0.55"/>` +
    `<stop offset="0.65" stop-color="${T.cream}" stop-opacity="0.10"/>` +
    `<stop offset="1" stop-color="${T.cream}" stop-opacity="0"/>` +
    `</linearGradient>` +
    // Textura diagonal de trama fina, apenas perceptible
    `<pattern id="tex" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<line x1="0" y1="0" x2="0" y2="7" stroke="${T.cream}" stroke-width="1" stroke-opacity="0.016"/>` +
    `</pattern>` +
    metal('gold', 0) +
    metal('silver', 1) +
    metal('bronze', 2) +
    `<linearGradient id="creambar" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${rgba(T.cream, 0.5)}"/>` +
    `<stop offset="1" stop-color="${rgba(T.cream, 0.85)}"/>` +
    `</linearGradient>` +
    `<linearGradient id="redbar" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="${T.redDeep}"/>` +
    `<stop offset="1" stop-color="${T.red}"/>` +
    `</linearGradient>` +
    `<filter id="soft" x="-70%" y="-70%" width="240%" height="240%">` +
    `<feGaussianBlur stdDeviation="3" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
    `</filter>` +
    extra +
    '</defs>'
  );
}

export function surface(height: number): string {
  return (
    `<rect width="${W}" height="${height}" fill="url(#bg)"/>` +
    `<rect width="${W}" height="${height}" fill="url(#tex)"/>` +
    `<rect x="${W - 340}" y="-200" width="440" height="440" fill="url(#warm)"/>` +
    `<rect width="${W}" height="${height}" fill="url(#vig)"/>`
  );
}

export interface Chip {
  label: string;
  color?: string;
  dot?: boolean;
}

export function header(title: string, subtitle: string, chip?: Chip): string {
  const parts: string[] = [];
  const isoR = 15;
  const isoCx = PAD + isoR;
  const baseY = 42;

  parts.push(isotype({ cx: isoCx, cy: baseY - 8, r: isoR, color: T.cream, opacity: 0.92 }));

  const titleX = isoCx + isoR + 15;
  const titleOpts = {
    size: 29,
    weight: 900 as const,
    family: 'display' as const,
    fill: T.ink,
    spacing: 0.4,
  };
  parts.push(text(title.toUpperCase(), titleX, baseY, titleOpts));

  const subOpts = {
    size: 10.5,
    weight: 600 as const,
    family: 'name' as const,
    fill: T.ink4,
    spacing: 1.7,
  };
  parts.push(text(subtitle.toUpperCase(), titleX + 1, baseY + 17, subOpts));

  if (chip) parts.push(headerChip(W - PAD, baseY - 8, chip));

  // Regla inferior con el tramo de bandera de cuadros
  const ruleY = HEADER_H;
  parts.push(
    `<rect x="${PAD}" y="${ruleY}" width="${W - PAD * 2}" height="1" fill="url(#rule)"/>`,
    checkers(PAD, ruleY - 2.5, 3, 8, 2, T.cream, 0.75),
  );
  return parts.join('');
}

function headerChip(rightX: number, cy: number, chip: Chip): string {
  const color = chip.color ?? T.cream;
  const label = chip.label.toUpperCase();
  const o = { size: 11.5, weight: 700 as const, family: 'num' as const, fill: color, spacing: 1.1 };
  const dotW = chip.dot ? 15 : 0;
  const padX = 13;
  const w = padX * 2 + dotW + textWidth(label, o);
  const h = 25;
  const cx = rightX - w / 2;
  const parts = [
    hexagonFlat(cx, cy, w, h, rgba(color, 0.08), `stroke="${rgba(color, 0.34)}" stroke-width="1"`),
  ];
  let tx = cx - w / 2 + padX;
  if (chip.dot) {
    parts.push(
      `<circle cx="${n(tx + 4)}" cy="${n(cy)}" r="3.6" fill="${color}" filter="url(#soft)"/>`,
    );
    tx += dotW;
  }
  parts.push(text(label, tx, cy + 4, o));
  return parts.join('');
}

/** Pie: nota a la izquierda y firma a la derecha */
export function footer(y: number, note?: string): string {
  const parts: string[] = [];
  if (note) {
    parts.push(
      text(note, PAD, y, {
        size: 10.5,
        family: 'name',
        weight: 400,
        fill: T.ink4,
      }),
    );
  }
  const label = 'DAILY RACE';
  const o = {
    size: 10,
    weight: 600 as const,
    family: 'name' as const,
    fill: T.ink5,
    spacing: 1.6,
    anchor: 'end' as const,
  };
  parts.push(text(label, W - PAD, y, o));
  const iso = W - PAD - textWidth(label, o) - 16;
  parts.push(isotype({ cx: iso - 6, cy: y - 4, r: 6.5, color: T.ink2, opacity: 0.3 }));
  return parts.join('');
}

export function svgOpen(height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`;
}
