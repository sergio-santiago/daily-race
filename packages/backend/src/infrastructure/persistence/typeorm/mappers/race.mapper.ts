import { Race, RaceStatus } from '../../../../core/entities/race.entity';
import { Driver } from '../../../../core/entities/driver.entity';
import { StartingGridEntry } from '../../../../core/entities/starting-grid-entry.entity';
import { RaceOrmEntity } from '../entities/race.orm-entity';

export class RaceMapper {
  static toDomain(orm: RaceOrmEntity): Race {
    const grid = (orm.startingGrid ?? [])
      .sort((a, b) => a.position - b.position)
      .map(
        (entry) =>
          new StartingGridEntry(
            entry.position,
            new Driver(
              entry.driverId,
              entry.driver?.googleId ?? '',
              entry.driver?.displayName ?? '',
              entry.driver?.email ?? null,
            ),
            entry.startTime,
            entry.greenLight,
            Number(entry.points),
            entry.isFalseStart,
            entry.isLastOnGrid,
          ),
      );

    return new Race(
      orm.id,
      orm.conferenceRecordName,
      orm.meetingCode,
      orm.greenLight,
      orm.endTime,
      orm.status as RaceStatus,
      grid,
      orm.processedAt,
    );
  }

  static toOrm(domain: Race): Partial<RaceOrmEntity> {
    return {
      ...(domain.id ? { id: domain.id } : {}),
      conferenceRecordName: domain.conferenceRecordName,
      meetingCode: domain.meetingCode,
      greenLight: domain.greenLight,
      endTime: domain.endTime,
      status: domain.status,
      processedAt: domain.processedAt,
    };
  }
}
