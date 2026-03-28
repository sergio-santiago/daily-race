import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { AuthProviderPort } from '../../core/ports/auth.provider.port';

const SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const DEFAULT_TOKENS_DIR = '/app/data';

@Injectable()
export class GoogleAuthService implements AuthProviderPort {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly oauth2Client: OAuth2Client;
  private readonly tokensPath: string;

  constructor(private readonly config: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      config.getOrThrow('GOOGLE_CLIENT_ID'),
      config.getOrThrow('GOOGLE_CLIENT_SECRET'),
      config.getOrThrow('GOOGLE_REDIRECT_URI'),
    );
    this.tokensPath = path.join(
      config.get('GOOGLE_TOKENS_DIR', DEFAULT_TOKENS_DIR),
      'google-tokens.json',
    );

    this.loadStoredTokens();
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleCallback(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.saveTokens(tokens);
    this.logger.log('Google OAuth tokens saved');
  }

  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  isAuthenticated(): boolean {
    return !!this.oauth2Client.credentials?.access_token;
  }

  private loadStoredTokens(): void {
    try {
      if (fs.existsSync(this.tokensPath)) {
        const raw = fs.readFileSync(this.tokensPath, 'utf-8');
        const tokens: Credentials = JSON.parse(raw);
        this.oauth2Client.setCredentials(tokens);
        this.logger.log('Google OAuth tokens loaded from disk');
      }
    } catch (error) {
      this.logger.warn(`Could not load stored tokens: ${error}`);
    }
  }

  private saveTokens(tokens: Credentials): void {
    try {
      const dir = path.dirname(this.tokensPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.tokensPath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      this.logger.error(`Could not save tokens: ${error}`);
    }
  }
}
