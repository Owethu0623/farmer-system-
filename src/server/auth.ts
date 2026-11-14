import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { ROLE_PERMISSION_MAP, hashToken, store } from './store.ts';
import { RoleCode, SanitizedUser, User } from './types.ts';

const COOKIE_NAME = 'fieldshift_session';
const DEFAULT_SESSION_TTL_HOURS = 168; // 7 days

export function getSessionTtlMs(): number {
  const configuredHours = Number(store.db.systemConfig?.application?.sessionTimeoutHours);
  const clampedHours = Number.isFinite(configuredHours)
    ? Math.max(1, Math.min(720, configuredHours))
    : DEFAULT_SESSION_TTL_HOURS;
  return clampedHours * 60 * 60 * 1000;
}

export interface AuthRequest extends Request {
  authUser?: SanitizedUser;
  sessionToken?: string;
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
}

export function createAuthRateLimiter(maxAttempts = 15, windowMs = 60_000) {
  const buckets = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxAttempts) {
      res.status(429).json({
        error: 'Too many authentication attempts. Please wait a minute before trying again.',
      });
      return;
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 5000) {
      for (const [k, v] of buckets.entries()) {
        if (v.every((ts) => now - ts >= windowMs)) {
          buckets.delete(k);
        }
      }
    }
    next();
  };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export function sanitizeUser(user: User): SanitizedUser {
  const role = store.db.roles.find((r) => r.id === user.roleId);
  const profile = store.db.userProfiles.find((p) => p.userId === user.id) || null;
  const roleCode = (role?.code || 'prospective_farmer') as RoleCode;

  const userPerms = store.db.userPermissions.filter((p) => p.userId === user.id);
  const revokedKeys = new Set(userPerms.filter((p) => !p.isAllowed).map((p) => p.permissionKey));
  const customAllowed = userPerms.filter((p) => p.isAllowed).map((p) => p.permissionKey);
  const rolePerms = (ROLE_PERMISSION_MAP[roleCode] || []).filter((k) => !revokedKeys.has(k));
  const permissions = Array.from(new Set([...rolePerms, ...customAllowed]));

  return {
    id: user.id,
    email: user.email,
    roleCode,
    roleName: role?.name || 'Prospective Farmer',
    preferredLanguageCode: user.preferredLanguageCode,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    onboardingCompleted: user.onboardingCompleted,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    profile,
    permissions,
  };
}

export function createSessionForUser(userId: string): { rawToken: string; expiresAt: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const ttlMs = getSessionTtlMs();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  // Opportunistically purge stale expired sessions on new session creation
  const nowMs = Date.now();
  store.db.sessions = store.db.sessions.filter(
    (s) => new Date(s.expiresAt).getTime() > nowMs
  );

  store.db.sessions.push({
    id: `sess-${crypto.randomUUID()}`,
    userId,
    tokenHash,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  store.save();

  return { rawToken, expiresAt };
}

export function setSessionCookie(res: Response, rawToken: string): void {
  res.cookie(COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: getSessionTtlMs(),
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const rawToken = extractSessionToken(req);
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const tokenHash = hashToken(rawToken);
  const session = store.db.sessions.find((s) => s.tokenHash === tokenHash);
  if (!session) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    store.db.sessions = store.db.sessions.filter((s) => s.id !== session.id);
    store.save();
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const user = store.db.users.find((u) => u.id === session.userId);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
    return;
  }

  req.authUser = sanitizeUser(user);
  req.sessionToken = rawToken;
  next();
}

export function requireRoles(...allowedRoles: RoleCode[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.roleCode)) {
      res.status(403).json({ error: 'Access denied for your current role.' });
      return;
    }
    next();
  };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both letters and numbers.';
  }
  return null;
}
