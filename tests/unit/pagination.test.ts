import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncService } from '@/lib/email/sync-service';
import { repository } from '@/lib/db/repository';
import { EmailAccount } from '@/lib/db/schema';
import * as providerRegistry from '@/lib/email';

describe('Requirement 3 & Part 23: Pagination & Large Mailbox Testing', () => {
  const userId = 'usr_pagination_test';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function createMockGmailProvider(totalMessagesToReturn: number, pageSize: number = 100) {
    // Generate mock message references
    const allIds = Array.from({ length: totalMessagesToReturn }, (_, i) => ({
      id: `msg_${i + 1}`,
      threadId: `th_${i + 1}`,
    }));

    return {
      type: 'gmail',
      listMessageIdsPage: vi.fn(async (_token: string, _options: any, pageToken?: string) => {
        const offset = pageToken ? parseInt(pageToken.replace('page_', ''), 10) : 0;
        const pageItems = allIds.slice(offset, offset + pageSize);
        const nextOffset = offset + pageSize;
        const nextPageToken = nextOffset < allIds.length ? `page_${nextOffset}` : undefined;

        return {
          messageIds: pageItems,
          nextPageToken,
          resultSizeEstimate: allIds.length,
        };
      }),
      fetchMessagesBatch: vi.fn(async (_token: string, messageRefs: Array<{ id: string; threadId: string }>) => {
        return messageRefs.map((ref, idx) => ({
          provider: 'gmail' as const,
          providerMessageId: ref.id,
          providerThreadId: ref.threadId,
          sender: 'Google Careers',
          senderEmail: 'jobs-noreply@google.com',
          subject: `Interview invitation — Software Engineer #${ref.id}`,
          snippet: 'We would love to invite you for an interview.',
          bodyText: 'We would love to invite you for an interview. Link: https://google.com/about/careers',
          receivedAt: new Date(Date.now() - idx * 1000),
          links: ['https://google.com/about/careers'],
        }));
      }),
    };
  }

  it('correctly paginates across 2 pages for 101 messages (no 100-email ceiling)', async () => {
    const mockProvider = createMockGmailProvider(101, 100);
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_101_${Date.now()}@gmail.com`,
      providerAccountId: `google_101_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(result.stats?.discovered).toBe(101);
    expect(result.stats?.fetched).toBe(101);
    expect(result.stats?.processed).toBe(101);
    expect(result.stats?.jobRelated).toBe(101);
    expect(mockProvider.listMessageIdsPage).toHaveBeenCalledTimes(2);
  });

  it('correctly streams and paginates 500 messages across 5 pages', async () => {
    const mockProvider = createMockGmailProvider(500, 100);
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_500_${Date.now()}@gmail.com`,
      providerAccountId: `google_500_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(result.stats?.discovered).toBe(500);
    expect(result.stats?.processed).toBe(500);
    expect(mockProvider.listMessageIdsPage).toHaveBeenCalledTimes(5);
  });

  it('correctly handles 1,000 messages across 10 pages', async () => {
    const mockProvider = createMockGmailProvider(1000, 100);
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_1000_${Date.now()}@gmail.com`,
      providerAccountId: `google_1000_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(result.stats?.discovered).toBe(1000);
    expect(result.stats?.processed).toBe(1000);
    expect(mockProvider.listMessageIdsPage).toHaveBeenCalledTimes(10);
  });

  it('correctly handles 5,000+ messages across 50+ pages', async () => {
    const mockProvider = createMockGmailProvider(5050, 100);
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);
    vi.spyOn(repository, 'saveBatchEmails').mockImplementation(async (items) => ({
      inserted: items.length,
      updated: 0,
      skipped: 0,
    }));

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_5000_${Date.now()}@gmail.com`,
      providerAccountId: `google_5000_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    expect(result.stats?.discovered).toBe(5050);
    expect(result.stats?.processed).toBe(5050);
    expect(mockProvider.listMessageIdsPage).toHaveBeenCalledTimes(51);
  });

  it('deduplicates properly: encountering identical IDs produces zero duplicate database records', async () => {
    const duplicateIds = [
      { id: 'dup_msg_1', threadId: 'th_dup_1' },
      { id: 'dup_msg_1', threadId: 'th_dup_1' }, // Exact duplicate
    ];

    const mockProvider = {
      type: 'gmail',
      listMessageIdsPage: vi.fn(async () => ({
        messageIds: duplicateIds,
        nextPageToken: undefined,
      })),
      fetchMessagesBatch: vi.fn(async () => [
        {
          provider: 'gmail' as const,
          providerMessageId: 'dup_msg_1',
          sender: 'Swiggy',
          senderEmail: 'careers@swiggy.in',
          subject: 'Welcome! Application Received',
          snippet: 'Your application is received.',
          bodyText: 'Your application is received.',
          receivedAt: new Date(),
          links: [],
        },
        {
          provider: 'gmail' as const,
          providerMessageId: 'dup_msg_1',
          sender: 'Swiggy',
          senderEmail: 'careers@swiggy.in',
          subject: 'Welcome! Application Received',
          snippet: 'Your application is received.',
          bodyText: 'Your application is received.',
          receivedAt: new Date(),
          links: [],
        },
      ]),
    };
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_dup_${Date.now()}@gmail.com`,
      providerAccountId: `google_dup_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      status: 'IDLE',
    });

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(true);
    const emailsInDb = await repository.getEmails({ userId, accountId: account.id });
    expect(emailsInDb.total).toBe(1); // Only 1 record in database!
  });

  it('Requirement 8: Safe Cursor — does not advance cursor if page batch fetch fails midway', async () => {
    const initialCursor = 'safe_initial_cursor_123';

    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_fail_cursor_${Date.now()}@gmail.com`,
      providerAccountId: `google_fail_${Date.now()}`,
      encryptedAccessToken: 'real_like_token_without_mock_prefix',
      syncCursor: initialCursor,
      status: 'IDLE',
    });

    const mockProvider = {
      type: 'gmail',
      listMessageIdsPage: vi.fn(async () => {
        throw new Error('Gmail network connection timeout');
      }),
      fetchMessagesBatch: vi.fn(async () => []),
      fetchEmails: vi.fn(async () => {
        throw new Error('Gmail network connection timeout');
      }),
    };
    vi.spyOn(providerRegistry, 'getProvider').mockReturnValue(mockProvider as any);

    const result = await SyncService.syncAccount(account);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Gmail network connection timeout');

    // Verify cursor in DB was NOT corrupted or advanced
    const updatedAccount = await repository.getEmailAccountById(account.id, userId);
    expect(updatedAccount?.syncCursor).toBe(initialCursor);
    expect(updatedAccount?.status).toBe('ERROR');
  });
});
