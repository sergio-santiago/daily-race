import { n } from './text';

// Isotipo de Secture reconstruido en vectorial: hexagono exterior, hexagono
// interior y tres brazos en Y que unen el nodo central con tres vertices.
// Vectorial en lugar de bitmap para poder teñirlo y escalarlo sin perdida.

const POINTY_TOP_OFFSET = -90;

function vertex(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const rad = ((degrees + POINTY_TOP_OFFSET) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function polygon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => vertex(cx, cy, r, i * 60))
    .map(([x, y]) => `${n(x)},${n(y)}`)
    .join(' ');
}

export interface IsotypeOpts {
  cx: number;
  cy: number;
  /** radio del hexagono exterior */
  r: number;
  color: string;
  width?: number;
  opacity?: number;
}

export function isotype(o: IsotypeOpts): string {
  const { cx, cy, r, color } = o;
  const stroke = o.width ?? Math.max(1, r * 0.068);
  const inner = r * 0.36;
  const line = (d: string, cap = 'round'): string =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(stroke)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`;

  const parts: string[] = [
    `<polygon points="${polygon(cx, cy, r)}" fill="none" stroke="${color}" stroke-width="${n(stroke)}" stroke-linejoin="round"/>`,
    `<polygon points="${polygon(cx, cy, inner)}" fill="none" stroke="${color}" stroke-width="${n(stroke)}" stroke-linejoin="round"/>`,
  ];

  // Tres brazos en Y: el tronco apunta al vertice exterior y del punto de
  // bifurcacion salen dos ramas hacia dentro, sin llegar a tocar el nodo
  for (const angle of [0, 120, 240]) {
    const [tipX, tipY] = vertex(cx, cy, r, angle);
    const [jx, jy] = vertex(cx, cy, r * 0.56, angle);
    const [lx, ly] = vertex(jx, jy, r * 0.34, angle - 120);
    const [rx, ry] = vertex(jx, jy, r * 0.34, angle + 120);
    parts.push(
      line(`M${n(jx)} ${n(jy)} L${n(tipX)} ${n(tipY)}`),
      line(`M${n(lx)} ${n(ly)} L${n(jx)} ${n(jy)} L${n(rx)} ${n(ry)}`),
    );
  }

  const group = o.opacity != null && o.opacity < 1 ? ` opacity="${o.opacity}"` : '';
  return `<g${group}>${parts.join('')}</g>`;
}

/** Hexagono relleno, la forma de badge que hereda del isotipo */
export function hexagon(
  cx: number,
  cy: number,
  r: number,
  fill: string,
  extra = '',
): string {
  return `<polygon points="${polygon(cx, cy, r)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

/** Hexagono achatado: mas ancho que alto, para badges con texto dentro */
export function hexagonFlat(
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string,
  extra = '',
): string {
  const cut = h / 2;
  const points = [
    [cx - w / 2 + cut, cy - h / 2],
    [cx + w / 2 - cut, cy - h / 2],
    [cx + w / 2, cy],
    [cx + w / 2 - cut, cy + h / 2],
    [cx - w / 2 + cut, cy + h / 2],
    [cx - w / 2, cy],
  ];
  return `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

/** Tramo de bandera de cuadros, el guiño de F1 */
export function checkers(
  x: number,
  y: number,
  cell: number,
  cols: number,
  rows: number,
  color: string,
  opacity = 1,
): string {
  const parts: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if ((c + r) % 2 === 0) continue;
      parts.push(
        `<rect x="${n(x + c * cell)}" y="${n(y + r * cell)}" width="${cell}" height="${cell}" fill="${color}"/>`,
      );
    }
  }
  return `<g opacity="${opacity}">${parts.join('')}</g>`;
}
