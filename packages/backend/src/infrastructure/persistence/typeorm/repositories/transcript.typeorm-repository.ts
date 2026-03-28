import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TranscriptRepositoryPort,
  TranscriptEntryData,
} from '../../../../core/ports/transcript.repository.port';
import { TranscriptEntryOrmEntity } from '../entities/transcript-entry.orm-entity';

@Injectable()
export class TranscriptTypeOrmRepository implements TranscriptRepositoryPort {
  constructor(
    @InjectRepository(TranscriptEntryOrmEntity)
    private readonly repo: Repository<TranscriptEntryOrmEntity>,
  ) {}

  async saveAll(
    raceId: string,
    entries: TranscriptEntryData[],
  ): Promise<void> {
    const orms = entries.map((e) => ({
      raceId,
      speakerName: e.speakerName,
      text: e.text,
      startTime: e.startTime,
      endTime: e.endTime,
    }));
    await this.repo.save(orms);
  }
}
