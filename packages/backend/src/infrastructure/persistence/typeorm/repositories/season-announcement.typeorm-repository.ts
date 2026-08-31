import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeasonAnnouncementRepositoryPort } from '../../../../core/ports/season-announcement.repository.port';
import { SeasonAnnouncementOrmEntity } from '../entities/season-announcement.orm-entity';

@Injectable()
export class SeasonAnnouncementTypeOrmRepository
  implements SeasonAnnouncementRepositoryPort
{
  constructor(
    @InjectRepository(SeasonAnnouncementOrmEntity)
    private readonly repo: Repository<SeasonAnnouncementOrmEntity>,
  ) {}

  /**
   * Un INSERT que ignora el conflicto y mira cuantas filas ha insertado: si es
   * una, este proceso se lleva el anuncio, si es cero ya estaba anunciada. Toda
   * la decision cabe en una sentencia, asi que no hay ventana entre comprobar y
   * escribir por la que se cuele un segundo tick.
   */
  async claim(seasonLabel: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(SeasonAnnouncementOrmEntity)
      .values({ seasonLabel })
      .orIgnore()
      .execute();

    return (result.raw as unknown[]).length > 0;
  }
}
