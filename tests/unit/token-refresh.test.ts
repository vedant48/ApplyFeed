import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '@/lib/email/sync-service';
import { repository } from '@/lib/db/repository';
import { encryptToken, decryptToken } from '@/lib/crypto';
import * as providerRegistry from '@/lib/email';

describe('Token Expiration & Mock Injection Prevention', () => {
  const userId = 'usr_token_refresh_test';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reactively refreshes expired token mid-sync during listMessageIdsPage and completes sync', async () => {
    let callCount = 0;
    const mockProvider = {
      type: 'gmail',
      refreshAccessToken: vi.fn(async (refreshToken: string) => {
        expect(refreshToken).toBe('valid_refresh_token_123');
        return {
          accessToken: 'fresh_live_access_token_456',
          expiresIn: 3600,
        };
      }),
      listMessageIdsPage: vi.fn(async (token: string) => {
        callCount++;
        if (callCount === 1) {
          expect(token).toBe('initial_expired_token');
          const err = new Error('Gmail API messages.list error: 401 Invalid Credentials');
          (err as any).status = 401;
          throw err;
        }
        expect(token).toBe('fresh_live_access_token_456');
        return {
          messageIds: [{ id: 'live_msg_1', threadId: 'th_1' }],
          nextPageToken: undefined,
        };
      }),
      fetchMessagesBatch: vi.fn(async (token: string, messageRefs: Array<{ id: string; threadId: string }>) => {
        expect(token).toBe('fresh_live_access_token_456');
        return [
          {
            provider: 'gmail' as const,
            providerMessageId: messageRefs[0].id,
            providerThreadId: messageRefs[0].threadId,
            sender: 'Stripe Recruiting',
            senderEmail: 'recruiting@stripe.com',
            subject: 'Interview Confirmation — Staff Engineer',
            snippet: 'Your interview is confirmed.',
            bodyText: 'Your interview is confirmed. Link: https://stripe.com/jobs',
            receivedAt: new Date(),
            links: ['https://stripe.com/jobs'],
          },
        ];
      }),
    };

    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    const saveBatchSpy = vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `refresh_test_${Date.now()}@gmail.com`,
      providerAccountId: `google_refresh_${Date.now()}`,
      encryptedAccessToken: encryptToken('initial_expired_token'),
      encryptedRefreshToken: encryptToken('valid_refresh_token_123'),
      tokenExpiresAt: new Date(Date.now() + 300000), // claims valid, but provider actually returns 401
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(mockProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockProvider.listMessageIdsPage).toHaveBeenCalledTimes(2);
    expect(saveBatchSpy).toHaveBeenCalledTimes(1);

    // Verify token was updated in database
    const updatedAccount = await repository.getEmailAccountById(account.id, userId);
    expect(updatedAccount?.status).toBe('SUCCESS');
    expect(decryptToken(updatedAccount!.encryptedAccessToken)).toBe('fresh_live_access_token_456');
  });

  it('reactively refreshes expired token mid-sync during fetchMessagesBatch', async () => {
    let batchCallCount = 0;
    const mockProvider = {
      type: 'gmail',
      refreshAccessToken: vi.fn(async () => ({
        accessToken: 'fresh_batch_access_token_789',
        expiresIn: 3600,
      })),
      listMessageIdsPage: vi.fn(async () => ({
        messageIds: [{ id: 'live_batch_msg_1', threadId: 'th_b1' }],
        nextPageToken: undefined,
      })),
      fetchMessagesBatch: vi.fn(async (token: string, messageRefs: Array<{ id: string; threadId: string }>) => {
        batchCallCount++;
        if (batchCallCount === 1) {
          const err = new Error('Gmail 401 Unauthorized for message ' + messageRefs[0].id);
          (err as any).status = 401;
          throw err;
        }
        expect(token).toBe('fresh_batch_access_token_789');
        return [
          {
            provider: 'gmail' as const,
            providerMessageId: messageRefs[0].id,
            providerThreadId: messageRefs[0].threadId,
            sender: 'Airbnb Recruiting',
            senderEmail: 'careers@airbnb.com',
            subject: 'Application update from Airbnb',
            snippet: 'Thank you for applying.',
            bodyText: 'Thank you for applying. Link: https://airbnb.com/careers',
            receivedAt: new Date(),
            links: ['https://airbnb.com/careers'],
          },
        ];
      }),
    };

    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `batch_refresh_${Date.now()}@gmail.com`,
      providerAccountId: `google_batch_${Date.now()}`,
      encryptedAccessToken: encryptToken('expired_before_batch_fetch'),
      encryptedRefreshToken: encryptToken('valid_refresh_token_xyz'),
      tokenExpiresAt: new Date(Date.now() + 300000),
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(mockProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockProvider.fetchMessagesBatch).toHaveBeenCalledTimes(2);

    const updatedAccount = await repository.getEmailAccountById(account.id, userId);
    expect(updatedAccount?.status).toBe('SUCCESS');
    expect(decryptToken(updatedAccount!.encryptedAccessToken)).toBe('fresh_batch_access_token_789');
  });

  it('aborts cleanly and sets AUTH_EXPIRED without inserting mock data when refresh token fails', async () => {
    const initialCursor = 'safe_initial_cursor_123';
    const mockProvider = {
      type: 'gmail',
      refreshAccessToken: vi.fn(async () => {
        const err = new Error('Google token refresh failed: invalid_grant: Token has been expired or revoked.');
        (err as any).status = 400;
        throw err;
      }),
      listMessageIdsPage: vi.fn(async () => {
        const err = new Error('Gmail API messages.list error: 401 Unauthorized');
        (err as any).status = 401;
        throw err;
      }),
      fetchMessagesBatch: vi.fn(async () => []),
    };

    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    const saveBatchSpy = vi.spyOn(repository, 'saveBatchEmails');

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `revoked_token_${Date.now()}@gmail.com`,
      providerAccountId: `google_revoked_${Date.now()}`,
      encryptedAccessToken: encryptToken('expired_token'),
      encryptedRefreshToken: encryptToken('revoked_refresh_token'),
      status: 'IDLE',
      syncCursor: initialCursor,
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // Zero mock emails saved to DB!
    expect(saveBatchSpy).not.toHaveBeenCalled();

    // Verify account status marked as AUTH_EXPIRED and cursor preserved
    const updatedAccount = await repository.getEmailAccountById(account.id, userId);
    expect(updatedAccount?.status).toBe('AUTH_EXPIRED');
    expect(updatedAccount?.syncCursor).toBe(initialCursor);
  });

  it('hard guard blocks mock email injection for real connected accounts', async () => {
    const mockProvider = {
      type: 'gmail',
      listMessageIdsPage: vi.fn(async () => ({
        messageIds: [{ id: 'mock_gmail_fake_id_1', threadId: 'th_fake' }],
        nextPageToken: undefined,
      })),
      fetchMessagesBatch: vi.fn(async () => [
        {
          provider: 'gmail' as const,
          providerMessageId: 'mock_gmail_sneaky_injection',
          providerThreadId: 'th_mock',
          sender: 'Anthropic Recruiting',
          senderEmail: 'recruiting@anthropic.com',
          subject: 'Mock interview',
          snippet: 'Mock snippet',
          bodyText: 'Mock body text',
          receivedAt: new Date(),
          links: [],
        },
      ]),
    };

    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    const saveBatchSpy = vi.spyOn(repository, 'saveBatchEmails');

    // Real connected account with refresh token
    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `real_account_mock_guard_${Date.now()}@gmail.com`,
      providerAccountId: `google_real_${Date.now()}`,
      encryptedAccessToken: encryptToken('valid_access_token'),
      encryptedRefreshToken: encryptToken('valid_refresh_token'),
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    // Must fail and block DB insertion
    expect(result.success).toBe(false);
    expect(result.error).toContain('FATAL: Detected synthetic mock email');
    expect(saveBatchSpy).not.toHaveBeenCalled();
  });

  it('reactively refreshes expired token for Microsoft account during fetchEmails without mock fallback', async () => {
    let callCount = 0;
    const mockMicrosoftProvider = {
      type: 'microsoft',
      refreshAccessToken: vi.fn(async (refreshToken: string) => {
        expect(refreshToken).toBe('valid_ms_refresh_token');
        return {
          accessToken: 'fresh_ms_access_token_999',
          expiresIn: 3600,
        };
      }),
      fetchEmails: vi.fn(async (token: string) => {
        callCount++;
        if (callCount === 1) {
          expect(token).toBe('initial_ms_expired_token');
          const err = new Error('Microsoft Graph error: 401 Unauthorized');
          (err as any).status = 401;
          throw err;
        }
        expect(token).toBe('fresh_ms_access_token_999');
        return {
          emails: [
            {
              provider: 'microsoft' as const,
              providerMessageId: 'real_ms_msg_1',
              providerThreadId: 'th_ms_1',
              sender: 'Microsoft Careers',
              senderEmail: 'careers@microsoft.com',
              subject: 'Your application status at Microsoft',
              snippet: 'We are reviewing your application.',
              bodyText: 'We are reviewing your application.',
              receivedAt: new Date(),
              links: [],
            },
          ],
          nextCursor: undefined,
          discovered: 1,
        };
      }),
    };

    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockMicrosoftProvider as any);
    const saveBatchSpy = vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'microsoft',
      email: `ms_refresh_test_${Date.now()}@outlook.com`,
      providerAccountId: `ms_refresh_${Date.now()}`,
      encryptedAccessToken: encryptToken('initial_ms_expired_token'),
      encryptedRefreshToken: encryptToken('valid_ms_refresh_token'),
      tokenExpiresAt: new Date(Date.now() + 300000),
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(mockMicrosoftProvider.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockMicrosoftProvider.fetchEmails).toHaveBeenCalledTimes(2);
    expect(saveBatchSpy).toHaveBeenCalledTimes(1);

    const updatedAccount = await repository.getEmailAccountById(account.id, userId);
    expect(updatedAccount?.status).toBe('SUCCESS');
    expect(decryptToken(updatedAccount!.encryptedAccessToken)).toBe('fresh_ms_access_token_999');
  });
});
