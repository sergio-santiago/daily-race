import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { Driver } from '../../../../core/entities/driver.entity';
import { StartingGridEntryOrmEntity } from '../entities/starting-grid-entry.orm-entity';

export class StartingGridEntryMapper {
  static toDomain(orm: StartingGridEntryOrmEntity): StartingGridEntry {
    return new StartingGridEntry(
      orm.position,
      new Driver(
        orm.driverId,
        orm.driver?.googleId ?? '',
        orm.driver?.displayName ?? '',
        orm.driver?.email ?? null,
      ),
      orm.startTime,
      orm.greenLight,
      orm.points,
      orm.isFalseStart,
      orm.isWorstOnGrid,
    );
  }

  static toOrm(
    raceId: string,
    domain: StartingGridEntry,
  ): Partial<StartingGridEntryOrmEntity> {
    return {
      raceId,
      driverId: domain.driver.id,
      position: domain.position,
      startTime: domain.startTime,
      greenLight: domain.greenLight,
      points: domain.points,
      isFalseStart: domain.isFalseStart,
      isWorstOnGrid: domain.isWorstOnGrid,
    };
  }
}
