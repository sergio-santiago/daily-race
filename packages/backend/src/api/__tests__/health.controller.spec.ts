import type { DataSource } from 'typeorm';
import { HealthController } from '../health.controller';
import { AuthProviderPort } from '../../core/ports/auth.provider.port';

// El health lo consume el orquestador para decidir si el contenedor esta vivo:
// tiene que responder siempre, tambien cuando la base se ha caido.

const build = (
  query: jest.Mock,
  authenticated = true,
): { controller: HealthController; query: jest.Mock } => {
  const dataSource = { query } as unknown as DataSource;
  const authProvider: AuthProviderPort = {
    getAuthUrl: jest.fn(),
    handleCallback: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(authenticated),
  };
  return { controller: new HealthController(dataSource, authProvider), query };
};

describe('HealthController', () => {
  it('responde ok y comprueba la base con un SELECT 1', async () => {
    const query = jest.fn().mockResolvedValue([{ '1': 1 }]);
    const { controller } = build(query);

    const result = await controller.check();

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(result.status).toBe('ok');
    expect(result.services).toEqual({ database: true, googleAuth: true });
  });

  it('degrada sin lanzar cuando la base rechaza la consulta', async () => {
    const query = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { controller } = build(query);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe(false);
    // El estado de Google no depende de la base
    expect(result.services.googleAuth).toBe(true);
  });

  it('refleja que Google no esta autenticado sin degradar el estado', async () => {
    const { controller } = build(jest.fn().mockResolvedValue([]), false);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.services.googleAuth).toBe(false);
  });

  it('sella la respuesta con un timestamp ISO en UTC', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T07:00:00.123Z'));
    try {
      const { controller } = build(jest.fn().mockResolvedValue([]));

      const result = await controller.check();

      expect(result.timestamp).toBe('2026-08-26T07:00:00.123Z');
    } finally {
      jest.useRealTimers();
    }
  });
});
