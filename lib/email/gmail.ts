import { EmailProvider, OAuthTokens } from './provider';
import { SyncOptions, SyncFetchResult, NormalizedEmail } from './types';
import { cleanSnippet, stripHtml, resolveBestBodyText } from './normalizer';

// Concurrency limit for Gmail messages.get requests (bounded to prevent 429/403 rate limits)
const CONCURRENCY_LIMIT = 3;

/**
 * Bounded concurrency executor with staggered worker startup and pacing delay.
 */
async function boundedMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async (_, workerId) => {
    // Stagger worker start by 50ms so they don't hit Gmail API at the exact same millisecond
    if (workerId > 0) {
      await new Promise(r => setTimeout(r, workerId * 50));
    }
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
      // Pacing delay to stay well within Gmail per-second and per-minute quotas
      await new Promise(r => setTimeout(r, 100));
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Fetches with retry on rate limit (403/429) with exponential backoff and randomized jitter.
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = 5, delayMs = 1500): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    // Retry on rate limit errors
    const isRateLimit = res.status === 429 || res.status === 403;
    if (isRateLimit && attempt < retries) {
      const jitter = Math.floor(Math.random() * 800);
      const backoff = delayMs * Math.pow(2, attempt) + jitter;
      console.warn(`Gmail rate limit hit (HTTP ${res.status}). Waiting ${backoff}ms before retry ${attempt + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }
    return res;
  }
  return fetch(url, options);
}

/**
 * Decodes Gmail base64url encoded string.
 */
function decodeBase64Url(data: string): string {
  if (!data) return '';
  const sanitized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(sanitized, 'base64').toString('utf8');
}

/**
 * Recursively traverses Gmail MIME parts (multipart/mixed, multipart/alternative, multipart/related).
 */
export function extractMimeBody(part: any): { plainText: string; html: string } {
  let plainText = '';
  let html = '';

  const mimeType = (part?.mimeType || '').toLowerCase();

  if (part?.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (mimeType.includes('text/plain')) {
      plainText += decoded + '\n';
    } else if (mimeType.includes('text/html')) {
      html += decoded + '\n';
    }
  }

  if (part?.parts && Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const sub = extractMimeBody(subPart);
      if (sub.plainText) plainText += sub.plainText + '\n';
      if (sub.html) html += sub.html + '\n';
    }
  }

  return { plainText: plainText.trim(), html: html.trim() };
}

/**
 * Extracts links from both HTML href attributes and raw plain text.
 */
function extractAllLinks(html: string, plainText: string): string[] {
  const links = new Set<string>();

  // Extract from HTML href="..."
  const hrefRegex = /href\s*=\s*["'](https?:\/\/[^"'\s>]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    if (match[1]) links.add(match[1]);
  }

  // Extract raw URLs from plainText and html
  const urlRegex = /(https?:\/\/[^\s"'<>()]+)/gi;
  const textMatches = plainText.match(urlRegex) || [];
  for (const url of textMatches) links.add(url);
  const htmlMatches = html.match(urlRegex) || [];
  for (const url of htmlMatches) links.add(url);

  // Filter out image/css assets
  return Array.from(links).filter(link => {
    const l = link.toLowerCase();
    return (
      !l.endsWith('.png') &&
      !l.endsWith('.jpg') &&
      !l.endsWith('.jpeg') &&
      !l.endsWith('.gif') &&
      !l.endsWith('.svg') &&
      !l.endsWith('.ico') &&
      !l.endsWith('.woff') &&
      !l.endsWith('.woff2') &&
      !l.endsWith('.css')
    );
  });
}

export class GmailProvider implements EmailProvider {
  type: 'gmail' = 'gmail';

  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId || 'demo-google-client-id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.clientId || !this.clientSecret) {
      return {
        accessToken: `mock_gmail_access_${Date.now()}`,
        refreshToken: `mock_gmail_refresh_${Date.now()}`,
        expiresIn: 3600,
        email: 'user' + Math.floor(Math.random() * 100) + '@gmail.com',
        accountId: 'gmail_' + Math.random().toString(36).substring(2, 9),
      };
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google OAuth code exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new Error('Failed to retrieve Gmail profile');
    }

    const profile = await profileRes.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      email: profile.emailAddress,
      accountId: profile.emailAddress,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Google token refresh failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600,
    };
  }

  /**
   * Fetches a single page of message IDs from Gmail.
   */
  async listMessageIdsPage(
    accessToken: string,
    options: SyncOptions,
    pageToken?: string
  ): Promise<{
    messageIds: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }> {
    let q = '-in:trash -in:spam';
    if (options.fromDate) {
      const afterEpoch = Math.floor(options.fromDate.getTime() / 1000);
      q += ` after:${afterEpoch}`;
    }
    if (options.toDate) {
      const beforeEpoch = Math.floor(options.toDate.getTime() / 1000);
      q += ` before:${beforeEpoch}`;
    }

    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', q);
    // Page size 100 per Gmail API documentation
    listUrl.searchParams.set('maxResults', '100');
    if (pageToken) {
      listUrl.searchParams.set('pageToken', pageToken);
    }

    const listRes = await fetchWithRetry(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      // Auto-recovery for invalid/expired cursor
      if (listRes.status === 400 && errText.includes('Invalid pageToken') && pageToken) {
        console.warn('Gmail pageToken invalid or expired, retrying without cursor...');
        listUrl.searchParams.delete('pageToken');
        const retryRes = await fetch(listUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return {
            messageIds: retryData.messages || [],
            nextPageToken: retryData.nextPageToken,
            resultSizeEstimate: retryData.resultSizeEstimate,
          };
        }
      }
      const err = new Error(`Gmail API messages.list error: ${listRes.status} ${errText}`);
      (err as any).status = listRes.status;
      throw err;
    }

    const listData = await listRes.json();
    return {
      messageIds: listData.messages || [],
      nextPageToken: listData.nextPageToken,
      resultSizeEstimate: listData.resultSizeEstimate,
    };
  }

  /**
   * Fetches full message bodies for a list of message IDs using bounded concurrency.
   */
  async fetchMessagesBatch(
    accessToken: string,
    messageRefs: Array<{ id: string; threadId: string }>
  ): Promise<NormalizedEmail[]> {
    const results = await boundedMap(
      messageRefs,
      CONCURRENCY_LIMIT,
      async (ref): Promise<NormalizedEmail | null> => {
        try {
          const msgRes = await fetchWithRetry(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!msgRes.ok) {
            if (msgRes.status === 401) {
              const err = new Error(`Gmail 401 Unauthorized for message ${ref.id}`);
              (err as any).status = 401;
              throw err;
            }
            console.warn(`Failed to fetch message ${ref.id}: status ${msgRes.status}`);
            return null;
          }

          const msgData = await msgRes.json();
          const headers = msgData.payload?.headers || [];
          const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

          const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/);
          const sender = fromMatch ? fromMatch[1].replace(/["']/g, '').trim() : fromHeader;
          const senderEmail = fromMatch ? fromMatch[2].trim() : fromHeader;

          const receivedAt = dateHeader ? new Date(dateHeader) : new Date(Number(msgData.internalDate));
          const snippet = msgData.snippet || '';

          // Recursive MIME parsing supporting multipart/mixed, multipart/alternative, multipart/related
          const { plainText, html } = extractMimeBody(msgData.payload);
          const bodyText = resolveBestBodyText(plainText, html, snippet);
          const links = extractAllLinks(html, plainText);

          const email: NormalizedEmail = {
            provider: 'gmail',
            providerMessageId: msgData.id,
            providerThreadId: msgData.threadId,
            sender,
            senderEmail,
            subject,
            snippet: cleanSnippet(snippet),
            bodyText,
            bodyHtml: html || undefined,
            receivedAt,
            links,
          };
          return email;
        } catch (e: any) {
          if (e.status === 401 || e.message?.includes('401') || e.message?.includes('Unauthorized')) {
            throw e;
          }
          console.warn(`Error processing message ${ref.id}:`, e.message);
          return null;
        }
      }
    );

    return results.filter((em): em is NormalizedEmail => em !== null);
  }

  /**
   * Fetches emails from Gmail with complete pagination.
   * Continues through every nextPageToken until the requested date range is exhausted.
   * 100 is strictly a page size, NEVER a total limit.
   */
  async fetchEmails(accessToken: string, options: SyncOptions): Promise<SyncFetchResult> {
    if (accessToken.startsWith('mock_')) {
      return this.generateMockSyncEmails(options);
    }

    const allNormalized: NormalizedEmail[] = [];
    let pageToken: string | undefined =
      options.cursor && !options.cursor.startsWith('cursor_') ? options.cursor : undefined;
    let initialCursor = pageToken;
    let totalDiscovered = 0;

    const maxLimit = options.maxResults || Number.POSITIVE_INFINITY;

    do {
      const pageResult = await this.listMessageIdsPage(accessToken, options, pageToken);
      totalDiscovered += pageResult.messageIds.length;

      if (pageResult.messageIds.length === 0) {
        break;
      }

      // Fetch batch with bounded concurrency
      const batchEmails = await this.fetchMessagesBatch(accessToken, pageResult.messageIds);
      allNormalized.push(...batchEmails);

      pageToken = pageResult.nextPageToken;

      // Stop only if no more pages or explicitly reached safety maxLimit
      if (!pageToken || allNormalized.length >= maxLimit) {
        break;
      }
    } while (pageToken);

    return {
      emails: allNormalized,
      nextCursor: pageToken || initialCursor,
      discovered: totalDiscovered,
    };
  }

  getDeepLink(messageId: string, threadId?: string): string {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId || messageId}`;
  }

  private generateMockSyncEmails(options: SyncOptions): SyncFetchResult {
    const count = options.maxResults || 1;
    const emails: NormalizedEmail[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const id = `mock_gmail_${Date.now()}_${i}`;
      emails.push({
        provider: 'gmail',
        providerMessageId: id,
        providerThreadId: `th_${id}`,
        sender: 'Anthropic Recruiting',
        senderEmail: 'recruiting@anthropic.com',
        subject: 'Interview invitation — Senior Systems Engineer',
        snippet: 'We would love to invite you to schedule your technical interview.',
        bodyText: 'We would love to invite you to schedule your technical interview. Link: https://jobs.ashbyhq.com/anthropic/schedule/tech-stage',
        receivedAt: new Date(now.getTime() - i * 60000),
        links: ['https://jobs.ashbyhq.com/anthropic/schedule/tech-stage'],
      });
    }

    return {
      emails,
      nextCursor: 'mock_cursor_safe_' + Date.now(),
      discovered: count,
    };
  }
}
