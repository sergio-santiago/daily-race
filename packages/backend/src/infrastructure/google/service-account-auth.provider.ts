import { Injectable } from '@nestjs/common';
import { AuthProviderPort } from '../../core/ports/auth.provider.port';

@Injectable()
export class ServiceAccountAuthProvider implements AuthProviderPort {
  getAuthUrl(): string {
    return '';
  }

  async handleCallback(): Promise<void> {}

  isAuthenticated(): boolean {
    return true;
  }
}
