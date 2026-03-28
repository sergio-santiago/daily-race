import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GoogleAuthService } from '../infrastructure/google/google-auth.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly googleAuth: GoogleAuthService,
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
        googleAuth: this.googleAuth.isAuthenticated(),
      },
    };
  }
}
