#!/usr/bin/env python3
"""Regenera src/infrastructure/charts/font-metrics.ts desde los TTF de assets/fonts.

Las graficas necesitan medir texto para colocar etiquetas sin solapes, y resvg no
expone medicion. Requiere fontTools: pip install fonttools
Uso: python3 scripts/extract-font-metrics.py   (desde packages/backend)
"""
from fontTools.ttLib import TTFont

FONTS = {
    'inter-400': 'assets/fonts/Inter-Regular.ttf',
    'inter-600': 'assets/fonts/Inter-SemiBold.ttf',
    'inter-700': 'assets/fonts/Inter-Bold.ttf',
    'titillium-400': 'assets/fonts/TitilliumWeb-Regular.ttf',
    'titillium-700': 'assets/fonts/TitilliumWeb-Bold.ttf',
    'titillium-900': 'assets/fonts/TitilliumWeb-Black.ttf',
}

CODES = (
    list(range(32, 127))
    + list(range(160, 256))
    + [0x2019, 0x2018, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026,
       0x00B7, 0x25B2, 0x25BC, 0x25C4, 0x25BA, 0x25CF]
)

OUT = 'src/infrastructure/charts/font-metrics.ts'
HEADER = """// GENERADO por scripts/extract-font-metrics.py, no editar a mano.
// Anchos de avance por caracter (em) de las fuentes empaquetadas en assets/fonts.
// Permite medir texto exactamente y evitar solapes en el layout de las graficas.
"""


def main() -> None:
    data = {}
    for key, path in FONTS.items():
        font = TTFont(path)
        upm = font['head'].unitsPerEm
        cmap = font.getBestCmap()
        hmtx = font['hmtx']
        widths = {}
        for code in CODES:
            glyph = cmap.get(code)
            if glyph is not None:
                widths[code] = round(hmtx[glyph][0] / upm, 5)
        question = cmap.get(0x3F) or next(iter(cmap.values()))
        data[key] = (round(hmtx[question][0] / upm, 5), widths)

    keys = sorted(data)
    lines = [HEADER, 'export type FontKey =']
    for i, key in enumerate(keys):
        lines.append(f"  | '{key}'" + (';' if i == len(keys) - 1 else ''))
    lines += ['', 'interface FontMetric {', '  fallback: number;',
              '  widths: Record<number, number>;', '}', '',
              'export const FONT_METRICS: Record<FontKey, FontMetric> = {']
    for key in keys:
        fallback, widths = data[key]
        pairs = ','.join(f'{c}:{w}' for c, w in sorted(widths.items()))
        lines.append(f"  '{key}': {{ fallback: {fallback}, widths: {{{pairs}}} }},")
    lines += ['};', '']

    with open(OUT, 'w') as handle:
        handle.write('\n'.join(lines))
    print(f'{OUT} regenerado con {len(keys)} fuentes')


if __name__ == '__main__':
    main()
