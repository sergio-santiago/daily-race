import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StartingGridRepositoryPort } from '../../../../core/ports/starting-grid.repository.port';
import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';
import { StartingGridEntryMapper } from '../mappers/starting-grid-entry.mapper';

@Injectable()
export class StartingGridTypeOrmRepository
  implements StartingGridRepositoryPort
{
  constructor(
    @InjectRepository(StartingGridEntryOrmEntity)
    private readonly repo: Repository<StartingGridEntryOrmEntity>,
  ) {}

  async saveAll(
    raceId: string,
    entries: StartingGridEntry[],
  ): Promise<void> {
    const orms = entries.map((e) =>
      StartingGridEntryMapper.toOrm(raceId, e),
    );
    await this.repo.save(orms);
  }

  async findByRaceId(raceId: string): Promise<StartingGridEntry[]> {
    const orms = await this.repo.find({
      where: { raceId },
      relations: ['driver'],
      order: { position: 'ASC' },
    });
    return orms.map(StartingGridEntryMapper.toDomain);
  }

  async findByDriverInDateRange(
    driverId: string,
    start: Date,
    end: Date,
  ): Promise<StartingGridEntry[]> {
    const orms = await this.repo.find({
      where: {
        driverId,
        startTime: Between(start, end),
      },
      relations: ['driver'],
      order: { startTime: 'ASC' },
    });
    return orms.map(StartingGridEntryMapper.toDomain);
  }
}
