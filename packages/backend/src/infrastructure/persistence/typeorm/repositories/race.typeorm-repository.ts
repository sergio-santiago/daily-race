import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { RaceRepositoryPort } from '../../../../core/ports/race.repository.port';
import { Race } from '../../../../core/entities/race.entity';
import { RaceOrmEntity } from '../entities/race.orm-entity';
import { RaceMapper } from '../mappers/race.mapper';

@Injectable()
export class RaceTypeOrmRepository implements RaceRepositoryPort {
  constructor(
    @InjectRepository(RaceOrmEntity)
    private readonly repo: Repository<RaceOrmEntity>,
  ) {}

  async save(race: Race): Promise<Race> {
    const orm = RaceMapper.toOrm(race);
    const saved = await this.repo.save(orm);
    return RaceMapper.toDomain(
      await this.repo.findOneOrFail({
        where: { id: saved.id },
        relations: ['startingGrid', 'startingGrid.driver'],
      }),
    );
  }

  async findById(id: string): Promise<Race | null> {
    const orm = await this.repo.findOne({
      where: { id },
      relations: ['startingGrid', 'startingGrid.driver'],
    });
    return orm ? RaceMapper.toDomain(orm) : null;
  }

  async findByConferenceRecordName(name: string): Promise<Race | null> {
    const orm = await this.repo.findOne({
      where: { conferenceRecordName: name },
      relations: ['startingGrid', 'startingGrid.driver'],
    });
    return orm ? RaceMapper.toDomain(orm) : null;
  }

  async findByDateRange(start: Date, end: Date): Promise<Race[]> {
    const orms = await this.repo.find({
      where: { greenLight: Between(start, end) },
      relations: ['startingGrid', 'startingGrid.driver'],
      order: { greenLight: 'DESC' },
    });
    return orms.map(RaceMapper.toDomain);
  }

  async existsByConferenceRecordName(name: string): Promise<boolean> {
    return this.repo.existsBy({ conferenceRecordName: name });
  }
}
