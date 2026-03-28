export interface Driver {
  id: string;
  googleId: string;
  displayName: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}
