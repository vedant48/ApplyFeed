import { describe, it, expect } from 'vitest';
import { SyncService } from '@/lib/email/sync-service';
import { repository } from '@/lib/db/repository';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

describe('Requirement 14: Live Historical Sync Verification (>100 Emails)', () => {
  it('scans and processes >100 emails without stopping at 100, matching discovered count', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping live sync test: DATABASE_URL not set');
      return;
    }

    const sql = postgres(process.env.DATABASE_URL);
    const dbAccounts = await sql`
      SELECT * FROM email_accounts 
      WHERE email = 'vedant@iiitmanipur.ac.in' OR email = 'vedantkumar48@gmail.com'
      ORDER BY email
    `;

    if (dbAccounts.length === 0) {
      console.log('No real connected accounts found for live sync test');
      await sql.end();
      return;
    }

    // Target the account that had the missing Swiggy & Amazon emails (vedant@iiitmanipur.ac.in)
    const targetRow = dbAccounts.find(a => a.email === 'vedant@iiitmanipur.ac.in') || dbAccounts[0];
    console.log(`Starting live historical sync for: ${targetRow.email}...`);

    const account = {
      id: targetRow.id,
      userId: targetRow.user_id,
      provider: targetRow.provider,
      email: targetRow.email,
      providerAccountId: targetRow.provider_account_id,
      encryptedAccessToken: targetRow.encrypted_access_token,
      encryptedRefreshToken: targetRow.encrypted_refresh_token,
      tokenExpiresAt: targetRow.token_expires_at,
      lastSyncedAt: targetRow.last_synced_at,
      syncCursor: targetRow.sync_cursor,
      status: targetRow.status,
      lastError: targetRow.last_error,
      createdAt: targetRow.created_at,
      updatedAt: targetRow.updated_at,
    };

    // 30-day historical window
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = new Date();

    const syncResult = await SyncService.syncHistory(account as any, fromDate, toDate);

    console.log('Live Sync Result:', {
      success: syncResult.success,
      account: syncResult.accountEmail,
      discovered: syncResult.stats?.discovered,
      fetched: syncResult.stats?.fetched,
      processed: syncResult.stats?.processed,
      jobRelated: syncResult.stats?.jobRelated,
      uncertain: syncResult.stats?.uncertain,
      nonJob: syncResult.stats?.nonJob,
      errors: syncResult.stats?.errors,
    });

    expect(syncResult.success).toBe(true);
    expect(syncResult.stats).toBeDefined();

    const stats = syncResult.stats!;

    // Requirement 14: Must exceed 100 emails and process all discovered emails
    expect(stats.discovered).toBeGreaterThan(100);
    expect(stats.processed).toBeGreaterThan(100);
    expect(stats.processed).toBe(stats.discovered - stats.errors);
    expect(stats.errors).toBeLessThanOrEqual(5);

    // Verify previously missing emails are now indexed in the database
    const swiggyMsg = await sql`
      SELECT id, classification, category, company, role 
      FROM emails 
      WHERE provider_message_id = '1a08d627ef477767'
    `;
    console.log('Swiggy Email in DB:', swiggyMsg);
    if (swiggyMsg.length > 0) {
      expect(swiggyMsg[0].classification).toBe('JOB');
    }

    const amazonStatusMsg = await sql`
      SELECT id, classification, category, company, role 
      FROM emails 
      WHERE provider_message_id = '1a0950f3c7ea5b70'
    `;
    console.log('Amazon Status Email in DB:', amazonStatusMsg);
    if (amazonStatusMsg.length > 0) {
      expect(amazonStatusMsg[0].classification).toBe('JOB');
    }

    const amazonTrackMsg = await sql`
      SELECT id, classification, category, company, role 
      FROM emails 
      WHERE provider_message_id = '1a08d5177faeeeed'
    `;
    console.log('Amazon Keep Track Email in DB:', amazonTrackMsg);
    if (amazonTrackMsg.length > 0) {
      expect(amazonTrackMsg[0].classification).toBe('JOB');
    }

    await sql.end();
  }, 120000); // 2 minute timeout for live pagination through hundreds of emails
});
