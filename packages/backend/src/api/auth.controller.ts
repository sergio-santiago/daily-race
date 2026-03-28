import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { GoogleAuthService } from '../infrastructure/google/google-auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly googleAuth: GoogleAuthService) {}

  @Get('google')
  startGoogleAuth(@Res() res: Response) {
    const url = this.googleAuth.getAuthUrl();
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

    await this.googleAuth.handleCallback(code);
    res.json({
      message: 'Google OAuth completed. Tokens saved.',
      authenticated: true,
    });
  }

  @Get('google/status')
  getStatus() {
    return {
      authenticated: this.googleAuth.isAuthenticated(),
    };
  }
}
