import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AUTH_PROVIDER, AuthProviderPort } from '../core/ports/auth.provider.port';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
  ) {}

  @Get('google')
  startGoogleAuth(@Res() res: Response) {
    const url = this.authProvider.getAuthUrl();
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    if (!code) {
      res.status(400).json({ error: 'Missing code parameter' });
      return;
    }

    await this.authProvider.handleCallback(code);
    res.json({
      message: 'Google OAuth completed. Tokens saved.',
      authenticated: true,
    });
  }

  @Get('google/status')
  getStatus() {
    return {
      authenticated: this.authProvider.isAuthenticated(),
    };
  }
}
