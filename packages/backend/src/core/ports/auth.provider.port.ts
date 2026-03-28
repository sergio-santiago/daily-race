export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

export interface AuthProviderPort {
  getAuthUrl(): string;
  handleCallback(code: string): Promise<void>;
  isAuthenticated(): boolean;
}
