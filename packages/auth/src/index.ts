export interface AuthSession {
  userId: string;
  tenantId: string;
  roles: string[];
}

export interface AuthProvider {
  getSession(token: string): Promise<AuthSession | null>;
}
