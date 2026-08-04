export interface JwtAccessPayload {
  sub: string; // userId
  email: string | null;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  sessionId: string;
  tokenId: string; // RefreshToken row id, so it can be revoked/rotated
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  sessionId: string;
}
