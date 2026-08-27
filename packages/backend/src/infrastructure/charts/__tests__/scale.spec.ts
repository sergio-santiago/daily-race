import {
  beeswarm,
  formatDiff,
  formatShort,
  formatTick,
  timeScale,
} from '../scale';

describe('timeScale', () => {
  const axis = { x0: 0, x1: 1000 };

  it('coloca el cero al principio cuando no hay valores negativos', () => {
    const scale = timeScale({ min: 0, max: 100, ...axis });

    expect(scale.zeroX).toBe(0);
    expect(scale.toX(0)).toBe(0);
    expect(scale.toX(100)).toBeCloseTo(1000);
  });

  it('da a los dos primeros segundos alrededor de un tercio del ancho', () => {
    // El 63% de las entradas reales cae ahi: es la razon de ser de la escala
    const scale = timeScale({ min: 0, max: 1920, ...axis });

    expect(scale.toX(2)).toBeGreaterThan(250);
    expect(scale.toX(2)).toBeLessThan(400);
  });

  it('mantiene el orden y es monotona a lo largo de todo el rango', () => {
    const scale = timeScale({ min: -30, max: 1920, ...axis });
    const values = [-30, -5, -0.5, 0, 0.05, 0.5, 5, 60, 600, 1920];
    const xs = values.map((v) => scale.toX(v));

    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('limita el ancho que se lleva el lado de las salidas en falso', () => {
    // Sin tope, una salida en falso de -8 min comprimia a todo el grid limpio
    const scale = timeScale({ min: -484, max: 10, ...axis, negativeShare: 0.16 });

    expect(scale.zeroX).toBeLessThanOrEqual(160);
    expect(scale.toX(-484)).toBeCloseTo(0);
  });

  it('no reserva ancho negativo si nadie se adelanto', () => {
    const scale = timeScale({ min: 0, max: 10, ...axis });

    expect(scale.zeroX).toBe(0);
  });

  it('incluye siempre el cero entre los ticks', () => {
    for (const max of [0.5, 4, 60, 1920]) {
      const scale = timeScale({ min: -3, max, ...axis });
      expect(scale.ticks.some((t) => t.seconds === 0)).toBe(true);
    }
  });

  it('respeta la separacion minima entre ticks', () => {
    const scale = timeScale({ min: -30, max: 1920, ...axis, minTickGap: 60 });

    for (let i = 1; i < scale.ticks.length; i++) {
      expect(scale.ticks[i].x - scale.ticks[i - 1].x).toBeGreaterThanOrEqual(60);
    }
  });

  it('etiqueta el extremo del lado negativo', () => {
    // Con alguien media hora antes, el ultimo tick no puede ser "-1 min"
    const scale = timeScale({ min: -1800, max: 40, ...axis });
    const negatives = scale.ticks.filter((t) => t.seconds < 0);

    expect(Math.min(...negatives.map((t) => t.seconds))).toBeLessThanOrEqual(-1200);
  });

  it('etiqueta el extremo cuando cae justo en el limite', () => {
    // -1800 s exactos es "-30 min": el candidato del extremo tiene que entrar
    // aunque coincida con el limite, si no el eje anuncia -20 min
    const scale = timeScale({ min: -1800, max: 40, ...axis });

    expect(scale.ticks[0].seconds).toBe(-1800);
    expect(scale.ticks[0].label).toBe('-30 min');
    expect(scale.ticks[0].x).toBeCloseTo(scale.toX(-1800));
  });

  it('etiqueta el extremo del lado positivo', () => {
    const scale = timeScale({ min: 0, max: 1941, ...axis });

    expect(Math.max(...scale.ticks.map((t) => t.seconds))).toBeGreaterThanOrEqual(1200);
  });

  it('devuelve los ticks ordenados de izquierda a derecha', () => {
    const scale = timeScale({ min: -10, max: 300, ...axis });
    const xs = scale.ticks.map((t) => t.x);

    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it('no desperdicia ancho cuando toda la carrera baja del segundo', () => {
    const scale = timeScale({ min: 0, max: 0.524, ...axis });

    expect(scale.toX(0.524)).toBeCloseTo(1000);
  });
});

describe('formatos', () => {
  it('formatDiff guarda el milisegundo solo donde se decide la carrera', () => {
    expect(formatDiff(0.072)).toBe('+0.072s');
    expect(formatDiff(-31.905)).toBe('-31.905s');
    // A partir del minuto se recorta a mm:ss, igual que la tabla del embed. El
    // margen del podio se mostraba como "+899.800s" y luego como "+14:59.800",
    // que no coincidia con lo que decia la tabla del mismo mensaje
    expect(formatDiff(65)).toBe('+1:05');
    expect(formatDiff(1069.2)).toBe('+17:49');
    expect(formatDiff(-1830)).toBe('-30:30');
    // El acarreo se arrastra: 119,7 s es 2:00, no 1:60
    expect(formatDiff(119.7)).toBe('+2:00');
    expect(formatDiff(59.999)).toBe('+59.999s');
  });

  it('formatShort compacta para las anotaciones', () => {
    expect(formatShort(4.28)).toBe('4.3s');
    expect(formatShort(45.6)).toBe('46s');
    expect(formatShort(1069.2)).toBe('17:49');
  });

  it('formatShort arrastra el acarreo en vez de inventar el segundo 60', () => {
    expect(formatShort(59.594)).toBe('1:00');
    expect(formatShort(119.7)).toBe('2:00');
    expect(formatShort(-59.594)).toBe('-1:00');
    expect(formatShort(9.96)).toBe('10s');
    expect(formatShort(59.4)).toBe('59s');
    // Por encima de la hora se sigue contando en minutos, sin tramo h:mm:ss
    expect(formatShort(3599.7)).toBe('60:00');
  });

  it('formatTick etiqueta el eje sin ruido', () => {
    expect(formatTick(0)).toBe('0');
    expect(formatTick(0.25)).toBe('0.25s');
    expect(formatTick(30)).toBe('30s');
    expect(formatTick(120)).toBe('2 min');
    expect(formatTick(-1)).toBe('-1s');
  });
});

describe('beeswarm', () => {
  it('reparte en calles distintas los empates exactos', () => {
    // En los datos reales hay hasta ocho pilotos con el mismo timestamp
    const { lanes } = beeswarm([100, 100, 100, 100], 5, 7);

    expect(new Set(lanes).size).toBe(4);
  });

  it('deja en la calle base los puntos suficientemente separados', () => {
    const { lanes } = beeswarm([0, 50, 100, 150], 5, 7);

    expect(lanes).toEqual([0, 0, 0, 0]);
  });

  it('no excede el numero maximo de calles', () => {
    const xs = new Array(30).fill(10);
    const { lanes } = beeswarm(xs, 5, 4);

    expect(Math.max(...lanes)).toBeLessThanOrEqual(3);
  });

  it('devuelve una calle por punto en el orden de entrada', () => {
    const { lanes } = beeswarm([100, 0, 100], 5, 7);

    expect(lanes).toHaveLength(3);
    expect(lanes[1]).toBe(0);
    expect(lanes[0]).not.toBe(lanes[2]);
  });

  it('no declara apilamiento cuando cada punto tiene su sitio', () => {
    expect(beeswarm([100, 100, 100, 100], 5, 7).stacked).toBe(0);
    expect(beeswarm([0, 50, 100, 150], 5, 7).stacked).toBe(0);
  });

  it('cuenta los puntos que se quedan sin calle propia', () => {
    // Nueve empates en cuatro calles: cinco acaban debajo de otro, y quien
    // llama necesita saberlo porque el numero de calles usadas no lo delata
    const swarm = beeswarm(new Array(9).fill(10), 5, 4);

    expect(Math.max(...swarm.lanes)).toBe(3);
    expect(swarm.stacked).toBe(5);
  });
});
