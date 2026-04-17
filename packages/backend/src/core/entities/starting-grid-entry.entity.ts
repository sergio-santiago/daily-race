import { Driver } from './driver.entity';

export class StartingGridEntry {
  constructor(
    public readonly position: number,
    public readonly driver: Driver,
    public readonly startTime: Date,
    public readonly greenLight: Date,
    public readonly points: number,
    public readonly isFalseStart: boolean,
    public readonly isWorstOnGrid: boolean,
  ) {}

  get diffSeconds(): number {
    return (this.startTime.getTime() - this.greenLight.getTime()) / 1000;
  }
}
