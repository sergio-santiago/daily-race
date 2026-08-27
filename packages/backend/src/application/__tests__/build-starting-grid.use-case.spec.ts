import { BuildStartingGridUseCase } from '../build-starting-grid.use-case';
import { CalculatePointsUseCase } from '../calculate-points.use-case';
import { MeetParticipantData } from '../../core/ports/meet.provider.port';
import {
  F1_POINTS,
  ATTENDANCE_POINTS,
  FALSE_START_PENALTY,
} from '../../core/constants';

describe('BuildStartingGridUseCase', () => {
  let useCase: BuildStartingGridUseCase;

  beforeEach(() => {
    useCase = new BuildStartingGridUseCase(new CalculatePointsUseCase());
  });

  const greenLight = new Date('2026-03-27T09:30:00.000Z');

  function participant(
    name: string,
    offsetMs: number,
  ): MeetParticipantData {
    return {
      googleParticipantId: `users/${name.toLowerCase().replace(' ', '-')}`,
      displayName: name,
      email: null,
      earliestStartTime: new Date(greenLight.getTime() + offsetMs),
    };
  }

  it('should sort participants by entry time and assign positions', () => {
    const participants = [
      participant('Charlie', 5000),
      participant('Alice', 1000),
      participant('Bob', 3000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid).toHaveLength(3);
    expect(grid[0].position).toBe(1);
    expect(grid[0].driver.displayName).toBe('Alice');
    expect(grid[1].position).toBe(2);
    expect(grid[1].driver.displayName).toBe('Bob');
    expect(grid[2].position).toBe(3);
    expect(grid[2].driver.displayName).toBe('Charlie');
  });

  it('should mark the last participant as busted when no false starts', () => {
    const participants = [
      participant('Alice', 1000),
      participant('Bob', 3000),
      participant('Charlie', 5000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].isWorstOnGrid).toBe(false);
    expect(grid[1].isWorstOnGrid).toBe(false);
    expect(grid[2].isWorstOnGrid).toBe(true);
  });

  it('should mark the most-early false starter as busted when any false start exists', () => {
    const participants = [
      participant('EarlyEarly', -30000),
      participant('Early', -1000),
      participant('OnTime', 1000),
      participant('Late', 60000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    // sorted: EarlyEarly (-30s), Early (-1s), OnTime (+1s), Late (+60s)
    expect(grid[0].driver.displayName).toBe('EarlyEarly');
    expect(grid[0].isWorstOnGrid).toBe(true);
    expect(grid[1].isWorstOnGrid).toBe(false);
    expect(grid[2].isWorstOnGrid).toBe(false);
    expect(grid[3].isWorstOnGrid).toBe(false);
  });

  it('should mark early entries as false start with -5 pts and put them last in the ranking', () => {
    const participants = [
      participant('Early', -5000),
      participant('OnTime', 1000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].driver.displayName).toBe('Early');
    expect(grid[0].isFalseStart).toBe(true);
    // 2 participants total → false starter gets last position (2)
    expect(grid[0].position).toBe(2);
    expect(grid[0].points).toBe(FALSE_START_PENALTY);

    expect(grid[1].driver.displayName).toBe('OnTime');
    expect(grid[1].isFalseStart).toBe(false);
    expect(grid[1].position).toBe(1);
    expect(grid[1].points).toBe(F1_POINTS[0]); // P1 = 25
  });

  it('should assign last positions to false starters in order of how early they arrived', () => {
    // 3 false starts + 2 on-time = 5 total. Most-early false starter gets pos 5.
    const participants = [
      participant('EarlyEarly', -30000),
      participant('Early', -10000),
      participant('Earlyish', -1000),
      participant('OnTime', 1000),
      participant('Late', 5000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    // sorted: EarlyEarly(-30s) Early(-10s) Earlyish(-1s) OnTime(+1s) Late(+5s)
    expect(grid[0].driver.displayName).toBe('EarlyEarly');
    expect(grid[0].position).toBe(5); // worst (most early)
    expect(grid[0].isWorstOnGrid).toBe(true);

    expect(grid[1].driver.displayName).toBe('Early');
    expect(grid[1].position).toBe(4);

    expect(grid[2].driver.displayName).toBe('Earlyish');
    expect(grid[2].position).toBe(3);

    expect(grid[3].driver.displayName).toBe('OnTime');
    expect(grid[3].position).toBe(1);

    expect(grid[4].driver.displayName).toBe('Late');
    expect(grid[4].position).toBe(2);
  });

  it('should give flat -5 pts regardless of how early the false start is', () => {
    const participants = [
      participant('FiveEarly', -5000),
      participant('OneMinEarly', -60000),
      participant('OnTime', 1000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[0].points).toBe(FALSE_START_PENALTY);
    expect(grid[1].points).toBe(FALSE_START_PENALTY);
    expect(grid[2].points).toBe(F1_POINTS[0]);
  });

  it('should assign F1 points to top 10 clean grid', () => {
    const participants = Array.from({ length: 10 }, (_, i) =>
      participant(`P${i + 1}`, (i + 1) * 1000),
    );

    const grid = useCase.execute({ participants, greenLight });

    grid.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1);
      expect(entry.points).toBe(F1_POINTS[i]);
    });
  });

  it('should give 1 pt (attendance) to positions beyond top 10', () => {
    const participants = Array.from({ length: 15 }, (_, i) =>
      participant(`P${i + 1}`, (i + 1) * 1000),
    );

    const grid = useCase.execute({ participants, greenLight });

    expect(grid[9].position).toBe(10);
    expect(grid[9].points).toBe(F1_POINTS[9]); // P10 = 1 (matches attendance)
    expect(grid[10].position).toBe(11);
    expect(grid[10].points).toBe(ATTENDANCE_POINTS);
    expect(grid[14].position).toBe(15);
    expect(grid[14].points).toBe(ATTENDANCE_POINTS);
  });

  it('should skip false starts when counting top positions', () => {
    const participants = [
      participant('FalseA', -3000),
      participant('FalseB', -1000),
      participant('P1Real', 500),
      participant('P2Real', 1500),
      participant('P3Real', 3000),
    ];

    const grid = useCase.execute({ participants, greenLight });

    // Sorted: FalseA, FalseB, P1Real, P2Real, P3Real (5 total)
    expect(grid[0].isFalseStart).toBe(true);
    expect(grid[0].position).toBe(5); // most early → last pos
    expect(grid[1].isFalseStart).toBe(true);
    expect(grid[1].position).toBe(4);
    expect(grid[2].position).toBe(1);
    expect(grid[2].points).toBe(F1_POINTS[0]); // 25
    expect(grid[3].position).toBe(2);
    expect(grid[3].points).toBe(F1_POINTS[1]); // 18
    expect(grid[4].position).toBe(3);
    expect(grid[4].points).toBe(F1_POINTS[2]); // 15
  });

  it('should handle single participant', () => {
    const participants = [participant('Solo', 2000)];

    const grid = useCase.execute({ participants, greenLight });

    expect(grid).toHaveLength(1);
    expect(grid[0].position).toBe(1);
    expect(grid[0].isWorstOnGrid).toBe(true);
    expect(grid[0].points).toBe(F1_POINTS[0]);
  });

  it('should handle empty participants', () => {
    const grid = useCase.execute({ participants: [], greenLight });
    expect(grid).toHaveLength(0);
  });

  it('should not mutate the original participants array', () => {
    const participants = [
      participant('Bob', 3000),
      participant('Alice', 1000),
    ];
    const original = [...participants];

    useCase.execute({ participants, greenLight });

    expect(participants[0].displayName).toBe(original[0].displayName);
    expect(participants[1].displayName).toBe(original[1].displayName);
  });

  describe('empates al instante', () => {
    // Entrar en el mismo instante pasa en 37 de las 89 carreras medidas, casi
    // siempre porque quien ya esta en la sala cuando arranca la reunion recibe
    // todo el grupo el mismo timestamp. Antes lo decidia el orden en que Google
    // Meet devolvia los participantes, que no esta especificado.

    it('comparte la posicion y los puntos entre los que entran a la vez', () => {
      const participants = [
        participant('Ana', 1000),
        participant('Bruno', 1000),
        participant('Carla', 3000),
      ];

      const grid = useCase.execute({ participants, greenLight });

      expect(grid.map((e) => e.position)).toEqual([1, 1, 3]);
      // F1_POINTS es 0-indexado: [0] son los puntos de P1
      expect(grid[0].points).toBe(F1_POINTS[0]);
      expect(grid[1].points).toBe(F1_POINTS[0]);
      // El siguiente es P3, no P2: la segunda posicion no existe
      expect(grid[2].position).toBe(3);
      expect(grid[2].points).toBe(F1_POINTS[2]);
    });

    it('no deja que el orden de llegada de los datos decida los puntos', () => {
      const unOrden = [participant('Ana', 1000), participant('Bruno', 1000)];
      const otroOrden = [participant('Bruno', 1000), participant('Ana', 1000)];

      const puntos = (grid: { driver: { displayName: string }; points: number }[]) =>
        Object.fromEntries(grid.map((e) => [e.driver.displayName, e.points]));

      expect(puntos(useCase.execute({ participants: unOrden, greenLight }))).toEqual(
        puntos(useCase.execute({ participants: otroOrden, greenLight })),
      );
    });

    it('numera bien el grupo siguiente cuando el empate es de muchos', () => {
      // Ocho a la vez es el maximo medido en produccion
      const participants = [
        ...Array.from({ length: 8 }, (_, i) => participant(`Grupo ${i + 1}`, 500)),
        participant('Rezagado', 9000),
      ];

      const grid = useCase.execute({ participants, greenLight });

      expect(grid.slice(0, 8).map((e) => e.position)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
      expect(grid[8].position).toBe(9);
      expect(grid[8].points).toBe(F1_POINTS[8]);
    });

    it('comparte tambien la posicion entre salidas en falso simultaneas', () => {
      const participants = [
        participant('Madrugador A', -5000),
        participant('Madrugador B', -5000),
        participant('Puntual', 1000),
      ];

      const grid = useCase.execute({ participants, greenLight });
      const enFalso = grid.filter((e) => e.isFalseStart);

      // Dos en falso de tres: comparten la peor posicion, la 2, y dejan la 1
      // libre para el limpio
      expect(enFalso.map((e) => e.position)).toEqual([2, 2]);
      expect(enFalso.every((e) => e.points === FALSE_START_PENALTY)).toBe(true);
      expect(grid.find((e) => !e.isFalseStart)!.position).toBe(1);
    });

    it('reparte la calavera entre todos los empatados en el extremo', () => {
      const participants = [
        participant('Puntual', 1000),
        participant('Tarde A', 8000),
        participant('Tarde B', 8000),
      ];

      const grid = useCase.execute({ participants, greenLight });
      const busted = grid.filter((e) => e.isWorstOnGrid);

      expect(busted.map((e) => e.driver.displayName)).toEqual(['Tarde A', 'Tarde B']);
    });

    it('reparte la calavera entre los que se adelantaron lo mismo', () => {
      const participants = [
        participant('Madrugador A', -7000),
        participant('Madrugador B', -7000),
        participant('Menos madrugador', -1000),
        participant('Puntual', 1000),
      ];

      const grid = useCase.execute({ participants, greenLight });
      const busted = grid.filter((e) => e.isWorstOnGrid);

      expect(busted.map((e) => e.driver.displayName)).toEqual([
        'Madrugador A',
        'Madrugador B',
      ]);
    });

    it('no marca dos veces la calavera cuando el extremo no esta empatado', () => {
      const participants = [
        participant('Ana', 1000),
        participant('Bruno', 1000),
        participant('Ultimo', 9000),
      ];

      const grid = useCase.execute({ participants, greenLight });

      expect(grid.filter((e) => e.isWorstOnGrid)).toHaveLength(1);
      expect(grid.find((e) => e.isWorstOnGrid)!.driver.displayName).toBe('Ultimo');
    });
  });

});
