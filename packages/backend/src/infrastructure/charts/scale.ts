// Escala de tiempos de las graficas de carrera.
//
// Los datos reales estan extremadamente sesgados: el 63% de las entradas cae
// en los dos primeros segundos y la cola llega a 32 minutos. Una escala lineal
// dedica una decima de porcentaje del ancho a la zona donde vive la mayoria de
// los datos, asi que se usa una escala logaritmica simetrica (symlog):
//
//   f(t) = sign(t) · log10(1 + |t| / K)
//
// Es continua, pasa por el cero y admite negativos (salidas en falso), de modo
// que el mismo eje sirve para ambos lados del semaforo. Con K = 0.1 s el tramo
// [0, 2s] se queda con cerca de un tercio del ancho disponible.

export const SYMLOG_K = 0.1;

function forward(seconds: number): number {
  const sign = seconds < 0 ? -1 : 1;
  return sign * Math.log10(1 + Math.abs(seconds) / SYMLOG_K);
}


export interface TimeScale {
  /** px del valor en segundos */
  toX: (seconds: number) => number;
  /** px del cero (linea del semaforo) */
  zeroX: number;
  ticks: { seconds: number; x: number; label: string }[];
  min: number;
  max: number;
}

export interface TimeScaleOptions {
  min: number;
  max: number;
  x0: number;
  x1: number;
  /** separacion minima entre etiquetas del eje, en px */
  minTickGap?: number;
  /**
   * Fraccion maxima del ancho reservada al lado negativo. Las salidas en falso
   * son pocas (media de dos por carrera) pero pueden llegar a -8 min, asi que
   * sin tope se comerian un tercio del eje y comprimirian a los cuarenta o
   * cincuenta pilotos del grid limpio.
   */
  negativeShare?: number;
}

export function timeScale(o: TimeScaleOptions): TimeScale {
  // Un suelo pequeno evita la escala degenerada cuando todos los tiempos son
  // casi identicos, sin desperdiciar ancho en las carreras que se deciden por
  // decimas: con un suelo de un segundo el ultimo punto quedaba al 76%
  const hasPositive = o.max > 0;
  const max = hasPositive ? Math.max(o.max, 0.05) : 0;
  const min = Math.min(o.min, 0);
  const width = o.x1 - o.x0;
  // Si nadie ha entrado despues del semaforo, el lado negativo se queda con
  // todo el eje: reservar el 84% a un lado sin datos dejaba ticks huerfanos
  const share = hasPositive ? (o.negativeShare ?? 0.16) : 1;

  // Reparto del ancho: el lado negativo solo recibe lo que necesita, con tope
  const negSpan = -forward(min);
  const posSpan = forward(max);
  const natural = negSpan / (negSpan + posSpan);
  const negWidth = negSpan > 0 ? width * Math.min(natural, share) : 0;
  const zeroX = o.x0 + negWidth;

  const toX = (seconds: number): number => {
    if (seconds >= 0) {
      return zeroX + (posSpan > 0 ? (forward(seconds) / posSpan) * (o.x1 - zeroX) : 0);
    }
    return zeroX - (negSpan > 0 ? (-forward(seconds) / negSpan) * negWidth : 0);
  };

  // Los ticks se eligen por importancia y no de izquierda a derecha: el cero es
  // la referencia del semaforo y no puede caer nunca, despues entran las
  // unidades redondas y solo al final los valores intermedios, siempre que
  // quede sitio. Asi ninguna etiqueta se pisa con otra.
  const gap = o.minTickGap ?? 46;
  const accepted: { seconds: number; x: number; label: string }[] = [];
  const tryPush = (seconds: number): void => {
    // El limite exacto entra: si alguien se adelanta 1800 s justos, "-30 min" es
    // precisamente la etiqueta que hay que poner, no la siguiente hacia dentro
    if (seconds !== 0 && (seconds > max || seconds < min)) return;
    const x = toX(seconds);
    const label = formatTick(seconds);
    if (accepted.some((t) => Math.abs(t.x - x) < gap)) return;
    accepted.push({ seconds, x, label });
  };

  const CANDIDATES = [
    0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600,
  ];

  tryPush(0);

  // Los extremos van justo detras del cero: sin ellos, un piloto que entra
  // media hora antes se dibujaba en el borde con la ultima etiqueta en "-1 min",
  // y el eje daba a entender que se habia adelantado un minuto
  const extreme = (limit: number): number | undefined =>
    [...CANDIDATES].reverse().find((candidate) => candidate <= limit);
  const positiveEdge = extreme(max);
  if (positiveEdge) tryPush(positiveEdge);
  if (min < 0) {
    const negativeEdge = extreme(-min);
    if (negativeEdge) tryPush(-negativeEdge);
  }

  const byImportance = [
    [1, 60, 600, 10, 3600, 0.1],
    [5, 30, 300, 1800, 0.5],
    [2, 20, 120, 1200, 0.25],
  ];
  for (const tier of byImportance) {
    for (const value of tier) {
      tryPush(value);
      if (min < 0) tryPush(-value);
    }
  }

  accepted.sort((a, b) => a.x - b.x);
  return { toX, zeroX, ticks: accepted, min, max };
}

/** Etiqueta corta para el eje: 0 · 0.5s · 30s · 2 min */
export function formatTick(seconds: number): string {
  if (seconds === 0) return '0';
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  if (abs < 1) return `${sign}${abs}s`;
  if (abs < 60) return `${sign}${abs}s`;
  const min = abs / 60;
  return `${sign}${Number.isInteger(min) ? min : min.toFixed(1)} min`;
}

/**
 * Etiqueta de valor: +0.072s por debajo del minuto, +1:06 por encima.
 *
 * La cifra tiene que coincidir con la de la tabla del embed, porque las dos
 * viajan en el MISMO mensaje de Discord: la tabla en el cuerpo y esto en la
 * imagen adjunta. Cuando la tabla se recorto a mm:ss para no romper la linea en
 * clientes estrechos, esto se quedo en milisegundos y el mismo piloto salia con
 * dos cifras: 65,6 s daba "+1:06" en la tabla y "+1:05.600" en la grafica, que
 * ni siquiera se leen como el mismo minuto.
 *
 * Aqui sobra sitio para el milisegundo, asi que se conserva donde se decide la
 * carrera, por debajo del minuto. Por encima se redondea el total en segundos,
 * igual que la tabla, para que las dos digan lo mismo. El invariante lo fija un
 * test que compara las dos funciones.
 */
export function formatDiff(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+';
  const abs = Math.abs(seconds);
  if (abs < 60) return `${sign}${abs.toFixed(3)}s`;
  const total = Math.round(abs);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${sign}${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Etiqueta compacta para grupos: 4.3s · 46s · 2:30 · 17:49
 *
 * El redondeo se hace una sola vez, sobre el valor completo, y el acarreo se
 * arrastra al elegir el formato. Redondeando dentro de cada tramo salian
 * etiquetas imposibles: 59.594 s daba "60s" y 119.7 s daba "1:60".
 *
 * Por encima de la hora se sigue usando m:ss ("60:00" para 3599.7 s) en lugar
 * de anadir un tramo h:mm:ss: la daily dura quince minutos y la cola medida
 * llega a 32, asi que un valor de una hora ya seria un dato roto y conviene
 * que se lea en la misma unidad que el resto de la grafica, no disfrazado.
 */
export function formatShort(seconds: number): string {
  const abs = Math.abs(seconds);
  const sign = seconds < 0 ? '-' : '';
  const tenths = Math.round(abs * 10) / 10;
  if (tenths < 10) return `${sign}${tenths.toFixed(1)}s`;
  const whole = Math.round(abs);
  if (whole < 60) return `${sign}${whole}s`;
  const min = Math.floor(whole / 60);
  const sec = whole % 60;
  return `${sign}${min}:${String(sec).padStart(2, '0')}`;
}

export interface Beeswarm {
  /** calle asignada a cada punto, en el orden de entrada */
  lanes: number[];
  /**
   * Puntos que no han conseguido sitio propio y han acabado solapando a otro.
   * Quien llama lo necesita para saber si el reparto ha cabido de verdad: sin
   * este dato la unica senal era el numero de calles usadas, que nunca llega al
   * maximo, asi que el reparto siempre parecia correcto y los puntos apilados
   * se dibujaban invisibles, unos exactamente debajo de otros.
   */
  stacked: number;
}

/**
 * Reparte en calles verticales los puntos que caen demasiado cerca en el eje X,
 * de modo que los empates exactos (hasta 8 pilotos con el mismo timestamp en
 * los datos reales) no se dibujen unos encima de otros.
 */
export function beeswarm(
  xs: number[],
  radius: number,
  maxLanes: number,
): Beeswarm {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const laneLastX: number[] = [];
  const lanes = new Array<number>(xs.length).fill(0);
  let stacked = 0;

  for (const point of order) {
    let lane = laneLastX.findIndex((last) => point.x - last >= radius * 2);
    if (lane === -1) {
      if (laneLastX.length < maxLanes) {
        lane = laneLastX.length;
        laneLastX.push(point.x);
      } else {
        // Sin calles libres se apila en la que tenga el hueco mas antiguo
        lane = laneLastX.indexOf(Math.min(...laneLastX));
        stacked += 1;
      }
    }
    laneLastX[lane] = point.x;
    lanes[point.i] = lane;
  }
  return { lanes, stacked };
}
