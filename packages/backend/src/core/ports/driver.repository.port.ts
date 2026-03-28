import { Driver } from '../entities/driver.entity';

export const DRIVER_REPOSITORY = Symbol('DRIVER_REPOSITORY');

export interface DriverRepositoryPort {
  save(driver: Driver): Promise<Driver>;
  findByGoogleId(googleId: string): Promise<Driver | null>;
  findAll(): Promise<Driver[]>;
  upsert(driver: Driver): Promise<Driver>;
}
