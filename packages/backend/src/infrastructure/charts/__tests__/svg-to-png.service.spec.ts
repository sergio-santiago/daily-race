import * as fs from 'fs';
import * as path from 'path';
import { SvgToPngService } from '../svg-to-png.service';
import { text } from '../text';
import { inkPixels } from './png';

// La imagen de produccion es Alpine y no tiene fuentes de sistema: los TTF van
// empaquetados en assets/fonts y se cargan por ruta. Si ese COPY se rompe o la
// profundidad de la ruta cambia, resvg no falla, simplemente no dibuja ni un
// glifo y la grafica sale en blanco. Comprobar la firma PNG no lo detecta,
// porque un lienzo vacio tambien empieza por 89 50 4E 47.

const FONTS_DIR = path.resolve(__dirname, '../../../../assets/fonts');
const SERVICE_SOURCE = path.resolve(__dirname, '../svg-to-png.service.ts');
const BG: [number, number, number] = [0x11, 0x11, 0x11];

const canvas = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" viewBox="0 0 300 80">` +
  `<rect width="300" height="80" fill="#111111"/>${body}</svg>`;

describe('SvgToPngService', () => {
  const service = new SvgToPngService();

  const render = (body: string): Buffer => service.toPng(canvas(body), 600);
  const label = (opts: Parameters<typeof text>[3]): string =>
    text('Sánchez 0.072s', 10, 45, opts);

  describe('fuentes empaquetadas', () => {
    it('todas las fuentes declaradas existen en disco', () => {
      const source = fs.readFileSync(SERVICE_SOURCE, 'utf8');
      const declared = [...source.matchAll(/'([\w-]+\.ttf)'/g)].map((m) => m[1]);

      // Si el regex deja de encontrar la lista, el test no puede pasar en vacio
      expect(declared.length).toBeGreaterThanOrEqual(6);
      for (const file of declared) {
        const full = path.join(FONTS_DIR, file);
        expect(fs.existsSync(full)).toBe(true);
        expect(fs.statSync(full).size).toBeGreaterThan(10_000);
      }
    });

    it('no deja ficheros de fuente sin declarar en assets/fonts', () => {
      const source = fs.readFileSync(SERVICE_SOURCE, 'utf8');
      const declared = new Set(
        [...source.matchAll(/'([\w-]+\.ttf)'/g)].map((m) => m[1]),
      );
      const onDisk = fs
        .readdirSync(FONTS_DIR)
        .filter((file) => file.endsWith('.ttf'));

      // Un TTF que nadie declara es peso muerto en la imagen, y uno declarado
      // que no esta en disco deja el texto sin dibujar
      expect([...onDisk].sort()).toEqual([...declared].sort());
    });
  });

  describe('tinta', () => {
    it('el lienzo sin texto no tiene ni un pixel de tinta', () => {
      // Referencia de la medida: sin esto, "hay tinta" no significaria nada
      expect(inkPixels(render(''), BG)).toBe(0);
    });

    it('un texto rasterizado deja tinta de verdad, no solo la firma PNG', () => {
      const blank = render('');
      const withText = render(
        label({ size: 22, family: 'name', weight: 600, fill: '#ffffff' }),
      );

      expect(withText.equals(blank)).toBe(false);
      expect(inkPixels(withText, BG)).toBeGreaterThan(1000);
    });

    it('dibuja los acentos, que es lo que se pierde con una fuente incompleta', () => {
      const plain = render(
        text('Sanchez', 10, 45, { size: 22, family: 'name', fill: '#ffffff' }),
      );
      const accented = render(
        text('Sánchez', 10, 45, { size: 22, family: 'name', fill: '#ffffff' }),
      );

      expect(accented.equals(plain)).toBe(false);
      expect(inkPixels(accented, BG)).toBeGreaterThan(inkPixels(plain, BG));
    });

    it('carga las dos familias y sus pesos por separado', () => {
      // Si solo entrase un TTF, resvg caeria al mismo fallback para todo y
      // varios de estos rasterizados saldrian identicos
      const variants: [string, Buffer][] = [
        ['inter-400', render(label({ size: 22, family: 'name', fill: '#ffffff' }))],
        ['inter-600', render(label({ size: 22, family: 'name', weight: 600, fill: '#ffffff' }))],
        ['inter-700', render(label({ size: 22, family: 'name', weight: 700, fill: '#ffffff' }))],
        ['titillium-400', render(label({ size: 22, family: 'num', fill: '#ffffff' }))],
        ['titillium-700', render(label({ size: 22, family: 'num', weight: 700, fill: '#ffffff' }))],
        ['titillium-900', render(label({ size: 22, family: 'display', weight: 900, fill: '#ffffff' }))],
      ];

      for (const [name, png] of variants) {
        expect(inkPixels(png, BG)).toBeGreaterThan(1000);
        expect(name).toBeTruthy();
      }
      const duplicates: string[] = [];
      for (let i = 0; i < variants.length; i++) {
        for (let j = i + 1; j < variants.length; j++) {
          if (variants[i][1].equals(variants[j][1])) {
            duplicates.push(`${variants[i][0]} = ${variants[j][0]}`);
          }
        }
      }
      expect(duplicates).toEqual([]);
    });
  });

  describe('lienzo', () => {
    it('rasteriza al ancho pedido conservando la proporcion', () => {
      const png = render('');
      // IHDR: ancho y alto en los bytes 16..24 del fichero
      expect(png.readUInt32BE(16)).toBe(600);
      expect(png.readUInt32BE(20)).toBe(160);
    });
  });
});
