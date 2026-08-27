import { ellipsize, escapeXml, measure } from '../text';

describe('measure', () => {
  it('mide con las metricas del TTF y no con una estimacion', () => {
    // El "1" de Inter es mucho mas estrecho que el "8": si la medida fuese una
    // aproximacion por numero de caracteres, ambos darian lo mismo
    const one = measure('111', 20, 'name');
    const eight = measure('888', 20, 'name');

    expect(one).toBeLessThan(eight * 0.75);
  });

  it('las cifras de Titillium son tabulares', () => {
    // Por eso los numeros de las graficas van en esta familia y no en Inter
    expect(measure('111', 20, 'num')).toBeCloseTo(measure('888', 20, 'num'));
  });

  it('escala linealmente con el tamano', () => {
    expect(measure('Silvia Merino', 20, 'name')).toBeCloseTo(
      measure('Silvia Merino', 10, 'name') * 2,
    );
  });

  it('tiene en cuenta el letter-spacing', () => {
    const plain = measure('BUSTED', 12, 'name', 700);
    const spaced = measure('BUSTED', 12, 'name', 700, 2);

    expect(spaced - plain).toBeCloseTo(10);
  });

  it('mide los acentos del castellano', () => {
    expect(measure('Enrique Caballero Domínguez', 13, 'name')).toBeGreaterThan(0);
  });
});

describe('ellipsize', () => {
  it('deja intacto lo que cabe', () => {
    expect(ellipsize('Silvia Merino', 500, 14, 'name', 600)).toBe('Silvia Merino');
  });

  it('recorta con elipsis lo que no cabe', () => {
    const result = ellipsize('Enrique Caballero Domínguez', 60, 14, 'name', 600);

    expect(result.endsWith('…')).toBe(true);
    expect(measure(result, 14, 'name', 600)).toBeLessThanOrEqual(60);
  });

  it('no deja espacios colgando antes de la elipsis', () => {
    const result = ellipsize('Silvia Merino Lopez', 44, 14, 'name', 600);

    expect(result).not.toMatch(/ …$/);
  });

  it('aguanta un ancho imposible', () => {
    expect(ellipsize('Sara', 1, 14, 'name', 600)).toBe('…');
  });
});

describe('escapeXml', () => {
  it('escapa lo que romperia el SVG', () => {
    expect(escapeXml('<script> & "x"')).toBe(
      '&lt;script&gt; &amp; &quot;x&quot;',
    );
  });
});
