import * as zlib from 'zlib';

// Medida de tinta para los tests de rasterizado.
//
// Comprobar los cuatro bytes de la firma PNG no dice nada: una grafica
// completamente en blanco, porque la imagen de produccion no ha encontrado
// ninguna fuente, tambien empieza por 89 50 4E 47. Con los pixeles delante se
// puede exigir que haya tinta de verdad donde tiene que haberla.

export interface Raster {
  width: number;
  height: number;
  /** RGBA de 8 bits, cuatro bytes por pixel, sin filtrar */
  pixels: Buffer;
}

const BYTES_PER_PIXEL = 4;

/** Decodifica el PNG RGBA de 8 bits que emite resvg */
export function decodePng(png: Buffer): Raster {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];

  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) {
        throw new Error(`PNG inesperado: profundidad ${data[8]}, tipo ${data[9]}`);
      }
    }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    offset += length + 12;
  }
  if (width === 0 || idat.length === 0) throw new Error('PNG sin IHDR o sin IDAT');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let i = 0; i < stride; i++) {
      const left = i >= BYTES_PER_PIXEL ? pixels[y * stride + i - BYTES_PER_PIXEL] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upLeft =
        i >= BYTES_PER_PIXEL && y > 0
          ? pixels[(y - 1) * stride + i - BYTES_PER_PIXEL]
          : 0;
      const value = raw[rowStart + 1 + i];
      pixels[y * stride + i] =
        (value + unfilter(filter, left, up, upLeft)) & 0xff;
    }
  }
  return { width, height, pixels };
}

function unfilter(
  filter: number,
  left: number,
  up: number,
  upLeft: number,
): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4: {
      // Paeth: se queda con el vecino mas cercano a la prediccion
      const predicted = left + up - upLeft;
      const dLeft = Math.abs(predicted - left);
      const dUp = Math.abs(predicted - up);
      const dUpLeft = Math.abs(predicted - upLeft);
      if (dLeft <= dUp && dLeft <= dUpLeft) return left;
      return dUp <= dUpLeft ? up : upLeft;
    }
    default:
      throw new Error(`Filtro PNG desconocido: ${filter}`);
  }
}

/** Pixeles que se separan del color de fondo, con un margen para el antialias */
export function inkPixels(
  png: Buffer,
  background: [number, number, number],
  tolerance = 12,
): number {
  const { pixels } = decodePng(png);
  let count = 0;
  for (let i = 0; i < pixels.length; i += BYTES_PER_PIXEL) {
    const off =
      Math.abs(pixels[i] - background[0]) > tolerance ||
      Math.abs(pixels[i + 1] - background[1]) > tolerance ||
      Math.abs(pixels[i + 2] - background[2]) > tolerance;
    if (off) count += 1;
  }
  return count;
}

/**
 * Tinta de un recorte, en fraccion de sus pixeles. Sirve para exigir que una
 * franja concreta de la grafica (la cinta, la fila de metricas) no salga vacia.
 */
export function inkRatioInBand(
  png: Buffer,
  band: { top: number; bottom: number },
  background: [number, number, number],
  tolerance = 12,
): number {
  const { width, pixels } = decodePng(png);
  let count = 0;
  let total = 0;
  for (let y = band.top; y < band.bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * BYTES_PER_PIXEL;
      total += 1;
      const off =
        Math.abs(pixels[i] - background[0]) > tolerance ||
        Math.abs(pixels[i + 1] - background[1]) > tolerance ||
        Math.abs(pixels[i + 2] - background[2]) > tolerance;
      if (off) count += 1;
    }
  }
  return total === 0 ? 0 : count / total;
}
