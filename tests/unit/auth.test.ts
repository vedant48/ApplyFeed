import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  createDemoSession,
  DEMO_USER_ID,
  DEMO_USER_EMAIL,
} from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/passwords';
import { getCurrentUser, requireAuth } from '@/lib/auth';
import { repository } from '@/lib/db/repository';

describe('Authentication & Authorization Suite', () => {
  it('creates and verifies a valid cryptographic session token', async () => {
    const user = {
      userId: 'usr_test_123',
      email: 'alex@example.com',
      name: 'Alex Engineer',
      isDemo: false,
    };

    const token = await createSessionToken(user, 7);
    expect(token).toContain('.');

    const verified = await verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('usr_test_123');
    expect(verified?.email).toBe('alex@example.com');
    expect(verified?.isDemo).toBe(false);
  });

  it('rejects tampered session tokens', async () => {
    const user = {
      userId: 'usr_legit',
      email: 'legit@example.com',
      isDemo: false,
    };

    const token = await createSessionToken(user, 1);
    const [payload, signature] = token.split('.');

    // Tamper with payload (elevate user ID to demo or admin)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...user, userId: 'usr_hacked' })
    ).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${signature}`;

    const result = await verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it('rejects expired session tokens', async () => {
    const user = {
      userId: 'usr_expired',
      email: 'expired@example.com',
      isDemo: false,
    };

    // Create session token with -1 day expiry (already expired)
    const token = await createSessionToken(user, -1);
    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });

  it('creates a pre-configured demo session for usr_demo', async () => {
    const { token, user } = await createDemoSession();

    expect(user.userId).toBe(DEMO_USER_ID);
    expect(user.userId).toBe('usr_demo');
    expect(user.email).toBe(DEMO_USER_EMAIL);
    expect(user.isDemo).toBe(true);

    const verified = await verifySessionToken(token);
    expect(verified?.userId).toBe('usr_demo');
    expect(verified?.isDemo).toBe(true);
  });

  it('upsertGoogleUser creates and updates Google OAuth user profiles', async () => {
    const testGoogleId = `goog_${Date.now()}`;
    const testEmail = `google_user_${Date.now()}@gmail.com`;

    const created = await repository.upsertGoogleUser({
      email: testEmail,
      name: 'Google Candidate',
      googleId: testGoogleId,
      avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
    });

    expect(created.email).toBe(testEmail);
    expect(created.name).toBe('Google Candidate');
    expect(created.googleId).toBe(testGoogleId);
    expect(created.avatarUrl).toBe('https://lh3.googleusercontent.com/photo.jpg');

    // Update existing user on subsequent login
    const updated = await repository.upsertGoogleUser({
      email: testEmail,
      name: 'Updated Google Candidate',
      googleId: testGoogleId,
      avatarUrl: 'https://lh3.googleusercontent.com/new_photo.jpg',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated Google Candidate');
  });

  it('queries isolated demo tables for demo users with zero exposure of sensitive accounts', async () => {
    // Query demo inbox
    const demoInbox = await repository.getEmails({
      userId: 'usr_demo',
      isDemo: true,
      limit: 50,
    });

    expect(demoInbox.total).toBeGreaterThan(0);
    // Assert none of the user's real or sensitive emails appear in demo tables
    for (const em of demoInbox.emails) {
      expect(em.senderEmail).not.toContain('vedantkumar48');
      expect(em.senderEmail).not.toContain('vedant@iiitmanipur');
      expect(em.subject).not.toContain('vedantkumar48');
      expect(em.accountEmail).not.toBe('vedantkumar48@gmail.com');
      expect(em.accountEmail).not.toBe('vedant@iiitmanipur.ac.in');
    }

    // Query demo accounts
    const demoAccounts = await repository.getEmailAccounts('usr_demo', true);
    for (const acc of demoAccounts) {
      expect(acc.email).not.toBe('vedantkumar48@gmail.com');
      expect(acc.email).not.toBe('vedant@iiitmanipur.ac.in');
    }
  });

  it('correctly hashes and verifies passwords using PBKDF2', () => {
    const plain = 'superSecretPassword123!';
    const hashed = hashPassword(plain);

    expect(hashed).toContain(':');
    expect(verifyPassword(plain, hashed)).toBe(true);
    expect(verifyPassword('wrongPassword', hashed)).toBe(false);
  });

  it('enforces multi-tenant data isolation: User B cannot access User A accounts', async () => {
    const userA = `usr_tenant_a_${Date.now()}`;
    const userB = `usr_tenant_b_${Date.now()}`;

    // User A creates an email account
    const accountA = await repository.createEmailAccount({
      userId: userA,
      provider: 'gmail',
      email: `tenant_a_${Date.now()}@gmail.com`,
      providerAccountId: `google_a_${Date.now()}`,
      encryptedAccessToken: 'mock_token',
      status: 'IDLE',
    });

    // User A can access their own account
    const foundByA = await repository.getEmailAccountById(accountA.id, userA);
    expect(foundByA).not.toBeNull();
    expect(foundByA?.id).toBe(accountA.id);

    // User B CANNOT access User A's account
    const foundByB = await repository.getEmailAccountById(accountA.id, userB);
    expect(foundByB).toBeNull();

    // User B cannot delete User A's account
    const deleteAttempt = await repository.deleteEmailAccount(accountA.id, userB);
    expect(deleteAttempt).toBe(false);

    // Account still exists for User A
    const verifyStillExists = await repository.getEmailAccountById(accountA.id, userA);
    expect(verifyStillExists).not.toBeNull();

    // Clean up test account
    await repository.deleteEmailAccount(accountA.id, userA);
  });

  it('requireAuth enforces authentication and returns user on valid request', async () => {
    const { token, user } = await createDemoSession();

    const mockRequest = new Request('http://localhost:3001/api/emails', {
      headers: {
        cookie: `applyfeed_session=${token}`,
      },
    });

    const authenticatedUser = await requireAuth(mockRequest);
    expect(authenticatedUser.userId).toBe(DEMO_USER_ID);
    expect(authenticatedUser.email).toBe(DEMO_USER_EMAIL);
  });

  it('requireAuth throws 401 error if request is unauthenticated', async () => {
    // In test environment, override NODE_ENV temporarily to simulate production request
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    try {
      const unauthRequest = new Request('http://localhost:3001/api/emails');
      await expect(requireAuth(unauthRequest)).rejects.toThrow('Unauthorized');
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    }
  });
});
