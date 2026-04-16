import { Driver } from './driver.entity';

export class ChampionshipStanding {
  constructor(
    public readonly driver: Driver,
    public readonly totalPoints: number,
    public readonly racesAttended: number,
    public readonly falseStarts: number,
    public readonly bestFinish: number,
    public readonly rank: number,
    public readonly wins: number = 0,
    public readonly podiums: number = 0,
  ) {}
}
