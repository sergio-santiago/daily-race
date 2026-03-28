import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverRepositoryPort } from '../../../../core/ports/driver.repository.port';
import { Driver } from '../../../../core/entities/driver.entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';
import { DriverMapper } from '../mappers/driver.mapper';

@Injectable()
export class DriverTypeOrmRepository implements DriverRepositoryPort {
  constructor(
    @InjectRepository(DriverOrmEntity)
    private readonly repo: Repository<DriverOrmEntity>,
  ) {}

  async save(driver: Driver): Promise<Driver> {
    const orm = DriverMapper.toOrm(driver);
    const saved = await this.repo.save(orm);
    return DriverMapper.toDomain(
      await this.repo.findOneOrFail({ where: { id: saved.id } }),
    );
  }

  async findByGoogleId(googleId: string): Promise<Driver | null> {
    const orm = await this.repo.findOne({ where: { googleId } });
    return orm ? DriverMapper.toDomain(orm) : null;
  }

  async findAll(): Promise<Driver[]> {
    const orms = await this.repo.find({ order: { displayName: 'ASC' } });
    return orms.map(DriverMapper.toDomain);
  }

  async upsert(driver: Driver): Promise<Driver> {
    const existing = await this.repo.findOne({
      where: { googleId: driver.googleId },
    });

    if (existing) {
      existing.displayName = driver.displayName;
      if (driver.email) existing.email = driver.email;
      const saved = await this.repo.save(existing);
      return DriverMapper.toDomain(saved);
    }

    return this.save(driver);
  }
}
