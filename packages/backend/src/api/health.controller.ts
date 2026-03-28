import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUTH_PROVIDER, AuthProviderPort } from '../core/ports/auth.provider.port';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProviderPort,
  ) {}

  @Get()
  async check() {
    let db = false;
    try {
      await this.dataSource.query('SELECT 1');
      db = true;
    } catch {}

    return {
      status: db ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: db,
        googleAuth: this.authProvider.isAuthenticated(),
      },
    };
  }
}
