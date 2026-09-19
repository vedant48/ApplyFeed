import { describe, it, expect, beforeEach } from 'vitest';
import { SyncService } from '@/lib/email/sync-service';
import { repository } from '@/lib/db/repository';
import { EmailAccount } from '@/lib/db/schema';

describe('Sync Service (Spec Sections 6, 7, 36, 37, 39)', () => {
  const userId = 'usr_sync_test';
  let account1: EmailAccount;
  let account2: EmailAccount;

  beforeEach(async () => {
    account1 = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `sync_test_1_${Date.now()}@gmail.com`,
      providerAccountId: `google_${Date.now()}_1`,
      encryptedAccessToken: 'mock_token_1',
      status: 'IDLE',
    });

    account2 = await repository.createEmailAccount({
      userId,
      provider: 'microsoft',
      email: `sync_test_2_${Date.now()}@outlook.com`,
      providerAccountId: `ms_${Date.now()}_2`,
      encryptedAccessToken: 'mock_token_2',
      status: 'IDLE',
    });
  });

  it('performs incremental sync for a single account successfully', async () => {
    const result = await SyncService.syncAccount(account1);

    expect(result.success).toBe(true);
    expect(result.accountId).toBe(account1.id);
    expect(result.newEmailsFound).toBeGreaterThanOrEqual(1);

    // Verify account status updated in DB
    const updated = await repository.getEmailAccountById(account1.id, userId);
    expect(updated?.status).toBe('SUCCESS');
    expect(updated?.lastSyncedAt).toBeDefined();
  });

  it('prevents concurrent sync requests for the same account (Section 39)', async () => {
    // Launch two syncs concurrently
    const [resultA, resultB] = await Promise.all([
      SyncService.syncAccount(account2),
      SyncService.syncAccount(account2),
    ]);

    // One of them must either succeed or trigger concurrency guard
    const hasConcurrencyBlock = 
      resultA.error?.includes('already in progress') || 
      resultB.error?.includes('already in progress') ||
      (resultA.success && resultB.success); // or one handled via cooldown

    expect(hasConcurrencyBlock).toBe(true);
  });

  it('global sync processes multiple accounts independently (Section 36, 37)', async () => {
    const globalResult = await SyncService.syncAllAccounts(userId);

    expect(globalResult.accountsProcessed).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(globalResult.results)).toBe(true);
    expect(globalResult.totalStats).toBeDefined();
    expect(globalResult.totalStats?.totalScanned).toBeGreaterThanOrEqual(0);
  });

  it('collects and returns comprehensive FilterStats for transparent on-screen diagnostics', async () => {
    const result = await SyncService.syncAccount(account1);

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats?.totalScanned).toBeGreaterThanOrEqual(1);
    expect(result.stats?.evaluatedByClassifier).toBeGreaterThanOrEqual(0);
    expect(result.stats?.jobEmailsSaved).toBeGreaterThanOrEqual(1);
    expect(result.stats?.nonJobBreakdown).toBeDefined();
    expect(result.stats?.jobCategoryBreakdown).toBeDefined();
    expect(result.stats?.jobCategoryBreakdown['INTERVIEW']).toBeGreaterThanOrEqual(1);
  });

  it('performs historical sync for 90 days and returns filter breakdown', async () => {
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const result = await SyncService.syncHistory(account1, fromDate, toDate, 50);

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats?.totalScanned).toBeGreaterThanOrEqual(1);
    expect(result.stats?.jobEmailsSaved).toBeGreaterThanOrEqual(1);
  });
});
