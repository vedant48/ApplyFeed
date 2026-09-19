export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  isDemo: boolean;
}

export interface SessionPayload extends AuthUser {
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'applyfeed_session';
export const DEMO_USER_ID = 'usr_demo';
export const DEMO_USER_EMAIL = 'demo.candidate@applyfeed.com';
export const DEMO_USER_NAME = 'Demo Candidate';

function getSessionSecret(): string {
  return process.env.ENCRYPTION_SECRET || 'applyinbox-secure-secret-key-32b-min!';
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Signs data using HMAC-SHA256 via standard Web Crypto API (universal in Node & Middleware).
 */
async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Buffer.from(signature).toString('base64url');
}

/**
 * Creates a cryptographically signed session token.
 */
export async function createSessionToken(
  user: AuthUser,
  expiresInDays: number = 7
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInDays * 24 * 60 * 60;

  const payload: SessionPayload = {
    ...user,
    iat: now,
    exp,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(encodedPayload, getSessionSecret());

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a session token and returns the payload if valid, or null if expired/tampered.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  try {
    const expectedSignature = await hmacSha256(encodedPayload, getSessionSecret());
    if (signature !== expectedSignature) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Creates a pre-configured demo session for testing and presentations.
 */
export async function createDemoSession(): Promise<{ token: string; user: AuthUser }> {
  const user: AuthUser = {
    userId: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    name: DEMO_USER_NAME,
    isDemo: true,
  };
  const token = await createSessionToken(user, 14);
  return { token, user };
}

/**
 * Cookie configuration for secure HTTP-only cookies.
 */
export function getSessionCookieOptions(expiresInDays: number = 7) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: expiresInDays * 24 * 60 * 60,
  };
}
