import { Driver } from '../../../../core/entities/driver.entity';
import { DriverOrmEntity } from '../entities/driver.orm-entity';

export class DriverMapper {
  static toDomain(orm: DriverOrmEntity): Driver {
    return new Driver(
      orm.id,
      orm.googleId,
      orm.displayName,
      orm.email,
    );
  }

  static toOrm(domain: Driver): Partial<DriverOrmEntity> {
    return {
      ...(domain.id ? { id: domain.id } : {}),
      googleId: domain.googleId,
      displayName: domain.displayName,
      email: domain.email,
    };
  }
}
