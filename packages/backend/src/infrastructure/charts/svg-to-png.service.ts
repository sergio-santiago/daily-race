import { Injectable } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import * as path from 'path';

// Alpine no trae fuentes de sistema, asi que los TTF se empaquetan en
// assets/fonts. La ruta resuelve igual desde src/ (dev) y dist/ (build) porque
// ambos cuelgan de packages/backend a la misma profundidad.
//
// Cada familia tiene su papel: Titillium para numeros y titulares (es la unica
// con cifras tabulares, ademas de ser la tipografia de la F1) e Inter para los
// nombres. Ambas son OFL.
const FONTS_DIR = path.resolve(__dirname, '../../../assets/fonts');

const FONT_FILES = [
  'Inter-Regular.ttf',
  'Inter-SemiBold.ttf',
  'Inter-Bold.ttf',
  'TitilliumWeb-Regular.ttf',
  'TitilliumWeb-Bold.ttf',
  'TitilliumWeb-Black.ttf',
];

@Injectable()
export class SvgToPngService {
  toPng(svg: string, outputWidth: number): Buffer {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: outputWidth },
      font: {
        fontFiles: FONT_FILES.map((file) => path.join(FONTS_DIR, file)),
        loadSystemFonts: false,
        defaultFontFamily: 'Inter',
      },
    });
    return resvg.render().asPng();
  }
}
