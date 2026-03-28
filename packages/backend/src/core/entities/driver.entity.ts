export class Driver {
  constructor(
    public readonly id: string,
    public readonly googleId: string,
    public readonly displayName: string,
    public readonly email: string | null,
  ) {}
}
