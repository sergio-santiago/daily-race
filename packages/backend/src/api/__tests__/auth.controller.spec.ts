import { ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthProviderPort } from '../../core/ports/auth.provider.port';

// La guarda de produccion de este controlador es la unica barrera que impide
// disparar el flujo OAuth contra la instancia real, asi que se comprueba en los
// dos sentidos y ademas que corta antes de tocar el proveedor.

const authProvider = () => ({
  getAuthUrl: jest.fn().mockReturnValue('https://accounts.google.test/o/oauth2/auth'),
  handleCallback: jest.fn().mockResolvedValue(undefined),
  isAuthenticated: jest.fn().mockReturnValue(true),
});

interface FakeResponse {
  redirect: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

const fakeResponse = (): FakeResponse => {
  const res: FakeResponse = {
    redirect: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const asResponse = (res: FakeResponse): Response => res as unknown as Response;

describe('AuthController', () => {
  let provider: ReturnType<typeof authProvider>;
  let controller: AuthController;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    provider = authProvider();
    controller = new AuthController(provider as AuthProviderPort);
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('GET /auth/google fuera de produccion', () => {
    it('redirige a la url que da el proveedor', () => {
      const res = fakeResponse();

      controller.startGoogleAuth(asResponse(res));

      expect(provider.getAuthUrl).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        'https://accounts.google.test/o/oauth2/auth',
      );
    });

    it('sigue permitida cuando NODE_ENV no esta definida', () => {
      delete process.env.NODE_ENV;
      const res = fakeResponse();

      controller.startGoogleAuth(asResponse(res));

      expect(res.redirect).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /auth/google en produccion', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('responde 403 con el mensaje de endpoints deshabilitados', () => {
      const res = fakeResponse();

      let thrown: unknown;
      try {
        controller.startGoogleAuth(asResponse(res));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      expect((thrown as ForbiddenException).getStatus()).toBe(403);
      expect((thrown as ForbiddenException).message).toBe(
        'OAuth endpoints are disabled in production',
      );
    });

    it('corta antes de pedir la url y antes de redirigir', () => {
      const res = fakeResponse();

      expect(() => controller.startGoogleAuth(asResponse(res))).toThrow(
        ForbiddenException,
      );
      expect(provider.getAuthUrl).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/google/callback en produccion', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('responde 403 y no canjea el codigo', async () => {
      const res = fakeResponse();

      await expect(
        controller.googleCallback('codigo-valido', asResponse(res)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(provider.handleCallback).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('la guarda gana al chequeo del codigo ausente', async () => {
      const res = fakeResponse();

      await expect(
        controller.googleCallback(undefined as unknown as string, asResponse(res)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/google/callback fuera de produccion', () => {
    it('canjea el codigo y confirma que los tokens quedan guardados', async () => {
      const res = fakeResponse();

      await controller.googleCallback('codigo-valido', asResponse(res));

      expect(provider.handleCallback).toHaveBeenCalledWith('codigo-valido');
      expect(res.json).toHaveBeenCalledWith({
        message: 'Google OAuth completed. Tokens saved.',
        authenticated: true,
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('responde 400 sin canjear nada cuando falta el codigo', async () => {
      const res = fakeResponse();

      await controller.googleCallback('', asResponse(res));

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing code parameter' });
      expect(provider.handleCallback).not.toHaveBeenCalled();
    });

    it('propaga el fallo del proveedor al canjear', async () => {
      provider.handleCallback.mockRejectedValue(new Error('invalid_grant'));
      const res = fakeResponse();

      await expect(
        controller.googleCallback('codigo-caducado', asResponse(res)),
      ).rejects.toThrow('invalid_grant');
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/google/status', () => {
    it('expone el estado del proveedor', () => {
      expect(controller.getStatus()).toEqual({ authenticated: true });

      provider.isAuthenticated.mockReturnValue(false);
      expect(controller.getStatus()).toEqual({ authenticated: false });
    });

    it('sigue disponible en produccion: la guarda solo tapa el flujo OAuth', () => {
      process.env.NODE_ENV = 'production';

      expect(controller.getStatus()).toEqual({ authenticated: true });
    });
  });
});
