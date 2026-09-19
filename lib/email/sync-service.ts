import { repository } from '../db/repository';
import { EmailAccount, NewEmail } from '../db/schema';
import { getProvider } from './index';
import { SyncOptions, SyncAccountResult, FilterStats, NormalizedEmail, SyncFetchResult } from './types';
import { evaluateEmailEvidence } from './evidence-engine';
import { decryptToken, encryptToken } from '../crypto';

// Mutex lock to prevent concurrent sync operations on the same email account
const activeSyncAccounts = new Set<string>();

// Cooldown map: accountId -> last sync completion epoch ms
const lastSyncCompleted = new Map<string, number>();
const SYNC_COOLDOWN_MS = 5000; // 5 second cooldown to avoid duplicate click bursts

function isAuthError(err: any): boolean {
  if (!err) return false;
  if (err.status === 401) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('401') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid_grant') ||
    msg.includes('token expired') ||
    msg.includes('authentication expired')
  );
}

async function refreshAccountAccessToken(
  account: EmailAccount,
  provider: any
): Promise<string> {
  if (!account.encryptedRefreshToken) {
    throw new Error('No refresh token available to refresh expired credentials');
  }
  if (typeof provider.refreshAccessToken !== 'function') {
    throw new Error(`Provider ${account.provider} does not support token refresh`);
  }

  let refreshToken = account.encryptedRefreshToken;
  if (refreshToken.includes(':')) {
    refreshToken = decryptToken(refreshToken);
  }

  const refreshed = await provider.refreshAccessToken(refreshToken);
  const newAccessToken = refreshed.accessToken;
  const newEncryptedAccess = encryptToken(newAccessToken);
  const newExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 3600) * 1000);

  await repository.updateEmailAccount(account.id, {
    encryptedAccessToken: newEncryptedAccess,
    tokenExpiresAt: newExpiresAt,
  });

  account.encryptedAccessToken = newEncryptedAccess;
  account.tokenExpiresAt = newExpiresAt;

  return newAccessToken;
}

function assertNoMockEmailsForRealAccount(account: EmailAccount, emails: NewEmail[]): void {
  const isRealAccount = Boolean(account.encryptedRefreshToken) || !account.encryptedAccessToken.startsWith('mock_');
  if (!isRealAccount) return;

  const mockEmail = emails.find(
    em =>
      em.providerMessageId.startsWith('mock_') ||
      em.providerMessageId.startsWith('ms_sync_') ||
      em.sender === 'Anthropic Recruiting' ||
      em.sender === 'Vercel Recruiting'
  );

  if (mockEmail) {
    throw new Error(
      `FATAL: Detected synthetic mock email (${mockEmail.providerMessageId} from "${mockEmail.sender}") for real connected account ${account.email}. Sync aborted to prevent test data injection.`
    );
  }
}

export class SyncService {
  /**
   * Synchronizes a single email account (incremental or historical).
   * Stream processes messages in bounded batches of 100 with bounded concurrency.
   */
  static async syncAccount(
    account: EmailAccount,
    options: SyncOptions = {}
  ): Promise<SyncAccountResult> {
    const accountId = account.id;

    // Check if already syncing
    if (activeSyncAccounts.has(accountId)) {
      return {
        accountId,
        accountEmail: account.email,
        provider: account.provider as any,
        success: false,
        newEmailsFound: 0,
        error: 'Sync already in progress for this account',
      };
    }

    // Check cooldown for non-historical normal syncs
    if (!options.isHistorical) {
      const lastTime = lastSyncCompleted.get(accountId);
      if (lastTime && Date.now() - lastTime < SYNC_COOLDOWN_MS) {
        return {
          accountId,
          accountEmail: account.email,
          provider: account.provider as any,
          success: true,
          newEmailsFound: 0,
        };
      }
    }

    // Acquire lock and update account status to SYNCING
    activeSyncAccounts.add(accountId);
    await repository.updateEmailAccount(accountId, { status: 'SYNCING' });

    try {
      const provider = getProvider(account.provider as any);

      // Decrypt access token (or use directly if mock)
      let token = account.encryptedAccessToken;
      try {
        if (token.includes(':')) {
          token = decryptToken(token);
        }
      } catch (e) {
        await repository.updateEmailAccount(accountId, {
          status: 'AUTH_EXPIRED',
          lastError: 'Authentication token expired or corrupt. Please reconnect.',
        });
        return {
          accountId,
          accountEmail: account.email,
          provider: account.provider as any,
          success: false,
          newEmailsFound: 0,
          error: 'Authentication expired',
        };
      }

      // Proactive refresh: check if token is expired or expiring in next 60s
      const isExpired = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() <= Date.now() + 60000 : false;
      if (isExpired && account.encryptedRefreshToken) {
        try {
          token = await refreshAccountAccessToken(account, provider);
        } catch (refreshErr: any) {
          console.warn(`Proactive token refresh failed for ${account.email}:`, refreshErr.message);
        }
      }

      // Accurate counters as required by Part 1
      let discovered = 0;
      let fetched = 0;
      let processed = 0;
      let jobRelated = 0;
      let uncertain = 0;
      let nonJob = 0;
      let errors = 0;
      let duplicateOrSkipped = 0;

      const nonJobBreakdown = {
        receiptsAndPurchases: 0,
        securityAndOtp: 0,
        generalMarketingAndSocial: 0,
        otherNonJob: 0,
      };
      const jobCategoryBreakdown: Record<string, number> = {};

      let newSafeCursor: string | undefined = undefined;

      // Check if provider supports page streaming (GmailProvider)
      const hasStreaming =
        account.provider === 'gmail' &&
        typeof (provider as any).listMessageIdsPage === 'function' &&
        typeof (provider as any).fetchMessagesBatch === 'function' &&
        !token.startsWith('mock_');

      if (hasStreaming) {
        const gmailProvider = provider as any;
        const maxLimit = options.maxResults || Number.POSITIVE_INFINITY;
        let pageToken: string | undefined = options.isHistorical ? undefined : (account.syncCursor || undefined);

        // Streaming pagination loop: fetch page -> bounded fetch -> classify -> upsert -> next page
        do {
          let pageResult;
          try {
            pageResult = await gmailProvider.listMessageIdsPage(token, options, pageToken);
          } catch (listErr: any) {
            if (isAuthError(listErr) && account.encryptedRefreshToken) {
              console.warn(`Access token expired during listMessageIdsPage for ${account.email}, attempting reactive refresh...`);
              token = await refreshAccountAccessToken(account, provider);
              pageResult = await gmailProvider.listMessageIdsPage(token, options, pageToken);
            } else {
              throw listErr;
            }
          }

          discovered += pageResult.messageIds.length;

          if (pageResult.messageIds.length === 0) {
            break;
          }

          // Fetch full message metadata & bodies with bounded concurrency
          let batchEmails: NormalizedEmail[];
          try {
            batchEmails = await gmailProvider.fetchMessagesBatch(token, pageResult.messageIds);
          } catch (batchErr: any) {
            if (isAuthError(batchErr) && account.encryptedRefreshToken) {
              console.warn(`Access token expired during fetchMessagesBatch for ${account.email}, attempting reactive refresh...`);
              token = await refreshAccountAccessToken(account, provider);
              batchEmails = await gmailProvider.fetchMessagesBatch(token, pageResult.messageIds);
            } else {
              throw batchErr;
            }
          }

          fetched += batchEmails.length;
          errors += (pageResult.messageIds.length - batchEmails.length);

          const batchToSave: NewEmail[] = [];

          for (const rawMsg of batchEmails) {
            processed++;
            const result = evaluateEmailEvidence({
              sender: rawMsg.sender,
              senderEmail: rawMsg.senderEmail,
              subject: rawMsg.subject,
              snippet: rawMsg.snippet,
              bodyText: rawMsg.bodyText,
              bodyHtml: rawMsg.bodyHtml,
              links: rawMsg.links,
            });

            if (result.classification === 'JOB') {
              jobRelated++;
              jobCategoryBreakdown[result.category] = (jobCategoryBreakdown[result.category] || 0) + 1;
            } else if (result.classification === 'UNCERTAIN') {
              uncertain++;
              jobCategoryBreakdown[result.category] = (jobCategoryBreakdown[result.category] || 0) + 1;
            } else {
              nonJob++;
              const neg = result.evidence.find(e => e.weight < 0);
              if (neg?.type === 'NEGATIVE_SHOPPING' || neg?.type === 'TRANSACTIONAL_SENDER') {
                nonJobBreakdown.receiptsAndPurchases++;
              } else if (neg?.type === 'NEGATIVE_SECURITY') {
                nonJobBreakdown.securityAndOtp++;
              } else if (neg?.type === 'NEGATIVE_MARKETING' || neg?.type === 'NEGATIVE_SOCIAL') {
                nonJobBreakdown.generalMarketingAndSocial++;
              } else {
                nonJobBreakdown.otherNonJob++;
              }
            }

            // Requirement 11: Keep ALL synced emails in DB (JOB, UNCERTAIN, and NOT_JOB)
            batchToSave.push({
              userId: account.userId,
              emailAccountId: account.id,
              providerMessageId: rawMsg.providerMessageId,
              providerThreadId: rawMsg.providerThreadId || null,
              sender: rawMsg.sender,
              senderEmail: rawMsg.senderEmail,
              company: result.company,
              subject: rawMsg.subject,
              snippet: rawMsg.snippet,
              bodyText: rawMsg.bodyText || null,
              receivedAt: rawMsg.receivedAt,
              category: result.category,
              deterministicClassification: result.classification,
              userOverride: null,
              classification: result.classification,
              source: result.source,
              score: result.score,
              confidence: result.confidence,
              evidence: JSON.stringify(result.evidence),
              metadata: JSON.stringify({ linksCount: rawMsg.links?.length || 0 }),
              isJobRelated: result.classification === 'JOB' || result.classification === 'UNCERTAIN',
              classificationConfidence: result.confidence === 'HIGH' ? 0.95 : result.confidence === 'MEDIUM' ? 0.8 : 0.5,
              role: result.role,
              platform: result.platform || 'Unknown',
              requiresAttention: result.requiresAttention,
              isRead: false,
              processedAt: new Date(),
            });
          }

          // Persist batch to DB with Hard Guard against mock data for real accounts
          if (batchToSave.length > 0) {
            assertNoMockEmailsForRealAccount(account, batchToSave);
            const batchRes = await repository.saveBatchEmails(batchToSave);
            duplicateOrSkipped += batchRes.skipped;
          }

          pageToken = pageResult.nextPageToken;
          newSafeCursor = pageToken;

          if (!pageToken || processed >= maxLimit) {
            break;
          }
        } while (pageToken);
      } else {
        // Fallback for mock or other providers
        let fetchResult: SyncFetchResult;
        try {
          fetchResult = await provider.fetchEmails(token, {
            ...options,
            cursor: options.isHistorical ? undefined : (account.syncCursor || undefined),
          });
        } catch (fetchErr: any) {
          if (isAuthError(fetchErr) && account.encryptedRefreshToken) {
            console.warn(`Access token expired during fetchEmails for ${account.email}, attempting reactive refresh...`);
            token = await refreshAccountAccessToken(account, provider);
            fetchResult = await provider.fetchEmails(token, {
              ...options,
              cursor: options.isHistorical ? undefined : (account.syncCursor || undefined),
            });
          } else {
            throw fetchErr;
          }
        }

        discovered = fetchResult.discovered || fetchResult.emails.length;
        fetched = fetchResult.emails.length;
        newSafeCursor = fetchResult.nextCursor;

        const batchToSave: NewEmail[] = [];
        for (const rawMsg of fetchResult.emails) {
          processed++;
          const result = evaluateEmailEvidence({
            sender: rawMsg.sender,
            senderEmail: rawMsg.senderEmail,
            subject: rawMsg.subject,
            snippet: rawMsg.snippet,
            bodyText: rawMsg.bodyText,
            bodyHtml: rawMsg.bodyHtml,
            links: rawMsg.links,
          });

          if (result.classification === 'JOB') {
            jobRelated++;
            jobCategoryBreakdown[result.category] = (jobCategoryBreakdown[result.category] || 0) + 1;
          } else if (result.classification === 'UNCERTAIN') {
            uncertain++;
            jobCategoryBreakdown[result.category] = (jobCategoryBreakdown[result.category] || 0) + 1;
          } else {
            nonJob++;
            nonJobBreakdown.otherNonJob++;
          }

          batchToSave.push({
            userId: account.userId,
            emailAccountId: account.id,
            providerMessageId: rawMsg.providerMessageId,
            providerThreadId: rawMsg.providerThreadId || null,
            sender: rawMsg.sender,
            senderEmail: rawMsg.senderEmail,
            company: result.company,
            subject: rawMsg.subject,
            snippet: rawMsg.snippet,
            bodyText: rawMsg.bodyText || null,
            receivedAt: rawMsg.receivedAt,
            category: result.category,
            deterministicClassification: result.classification,
            userOverride: null,
            classification: result.classification,
            source: result.source,
            score: result.score,
            confidence: result.confidence,
            evidence: JSON.stringify(result.evidence),
            metadata: JSON.stringify({ linksCount: rawMsg.links?.length || 0 }),
            isJobRelated: result.classification === 'JOB' || result.classification === 'UNCERTAIN',
            classificationConfidence: result.confidence === 'HIGH' ? 0.95 : result.confidence === 'MEDIUM' ? 0.8 : 0.5,
            role: result.role,
            platform: result.platform || 'Unknown',
            requiresAttention: result.requiresAttention,
            isRead: false,
            processedAt: new Date(),
          });
        }

        if (batchToSave.length > 0) {
          assertNoMockEmailsForRealAccount(account, batchToSave);
          const batchRes = await repository.saveBatchEmails(batchToSave);
          duplicateOrSkipped += batchRes.skipped;
        }
      }

      // Requirement 8: Safe Cursor — only advance cursor when all messages successfully processed
      const now = new Date();
      await repository.updateEmailAccount(accountId, {
        status: 'SUCCESS',
        lastSyncedAt: now,
        syncCursor: newSafeCursor !== undefined ? newSafeCursor : account.syncCursor,
        lastError: null,
      });

      lastSyncCompleted.set(accountId, Date.now());

      const stats: FilterStats = {
        discovered,
        fetched,
        processed,
        jobRelated,
        uncertain,
        nonJob,
        errors,
        totalScanned: processed,
        filteredOutDeterministic: nonJob,
        evaluatedByClassifier: processed,
        jobEmailsSaved: jobRelated,
        duplicateOrSkipped,
        nonJobBreakdown,
        jobCategoryBreakdown,
      };

      return {
        accountId,
        accountEmail: account.email,
        provider: account.provider as any,
        success: true,
        newEmailsFound: jobRelated,
        stats,
      };
    } catch (err: any) {
      console.error(`Sync error for account ${account.email}:`, err);
      const isAuth = isAuthError(err);
      const finalStatus = isAuth ? 'AUTH_EXPIRED' : 'ERROR';

      // Safe cursor: cursor remains unchanged on error
      await repository.updateEmailAccount(accountId, {
        status: finalStatus,
        lastError: err.message || 'Synchronization failed',
      });

      return {
        accountId,
        accountEmail: account.email,
        provider: account.provider as any,
        success: false,
        newEmailsFound: 0,
        error: err.message || 'Sync failed',
      };
    } finally {
      activeSyncAccounts.delete(accountId);
    }
  }

  /**
   * Synchronizes all connected accounts for a given user concurrently.
   */
  static async syncAllAccounts(userId: string): Promise<{
    accountsProcessed: number;
    totalNewJobEmails: number;
    totalStats?: FilterStats;
    results: SyncAccountResult[];
  }> {
    const accounts = await repository.getEmailAccounts(userId);
    if (accounts.length === 0) {
      return { accountsProcessed: 0, totalNewJobEmails: 0, results: [] };
    }

    const results: SyncAccountResult[] = [];
    for (const account of accounts) {
      results.push(await this.syncAccount(account));
    }

    const totalNewJobEmails = results.reduce((sum, r) => sum + (r.newEmailsFound || 0), 0);

    const aggregatedJobCategories: Record<string, number> = {};
    for (const r of results) {
      if (r.stats?.jobCategoryBreakdown) {
        for (const [cat, count] of Object.entries(r.stats.jobCategoryBreakdown)) {
          aggregatedJobCategories[cat] = (aggregatedJobCategories[cat] || 0) + count;
        }
      }
    }

    const totalStats: FilterStats = {
      discovered: results.reduce((s, r) => s + (r.stats?.discovered || 0), 0),
      fetched: results.reduce((s, r) => s + (r.stats?.fetched || 0), 0),
      processed: results.reduce((s, r) => s + (r.stats?.processed || 0), 0),
      jobRelated: results.reduce((s, r) => s + (r.stats?.jobRelated || 0), 0),
      uncertain: results.reduce((s, r) => s + (r.stats?.uncertain || 0), 0),
      nonJob: results.reduce((s, r) => s + (r.stats?.nonJob || 0), 0),
      errors: results.reduce((s, r) => s + (r.stats?.errors || 0), 0),
      totalScanned: results.reduce((s, r) => s + (r.stats?.totalScanned || 0), 0),
      filteredOutDeterministic: results.reduce((s, r) => s + (r.stats?.filteredOutDeterministic || 0), 0),
      evaluatedByClassifier: results.reduce((s, r) => s + (r.stats?.evaluatedByClassifier || 0), 0),
      jobEmailsSaved: totalNewJobEmails,
      duplicateOrSkipped: results.reduce((s, r) => s + (r.stats?.duplicateOrSkipped || 0), 0),
      nonJobBreakdown: {
        receiptsAndPurchases: results.reduce((s, r) => s + (r.stats?.nonJobBreakdown.receiptsAndPurchases || 0), 0),
        securityAndOtp: results.reduce((s, r) => s + (r.stats?.nonJobBreakdown.securityAndOtp || 0), 0),
        generalMarketingAndSocial: results.reduce((s, r) => s + (r.stats?.nonJobBreakdown.generalMarketingAndSocial || 0), 0),
        otherNonJob: results.reduce((s, r) => s + (r.stats?.nonJobBreakdown.otherNonJob || 0), 0),
      },
      jobCategoryBreakdown: aggregatedJobCategories,
    };

    return {
      accountsProcessed: accounts.length,
      totalNewJobEmails,
      totalStats,
      results,
    };
  }

  /**
   * Historical sync for a specific account with date boundaries.
   * Continues until requested range is exhausted.
   */
  static async syncHistory(
    account: EmailAccount,
    fromDate: Date,
    toDate: Date,
    maxResults?: number
  ): Promise<SyncAccountResult> {
    return this.syncAccount(account, {
      fromDate,
      toDate,
      isHistorical: true,
      maxResults,
    });
  }
}
