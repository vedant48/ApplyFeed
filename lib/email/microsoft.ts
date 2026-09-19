import { EmailProvider, OAuthTokens } from './provider';
import { SyncOptions, SyncFetchResult, NormalizedEmail } from './types';
import { cleanSnippet, extractLinks, stripHtml } from './normalizer';

export class MicrosoftProvider implements EmailProvider {
  type: 'microsoft' = 'microsoft';

  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.MICROSOFT_CLIENT_ID || '';
    this.clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId || 'demo-microsoft-client-id',
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'offline_access Mail.Read User.Read',
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.clientId || !this.clientSecret) {
      // Mock OAuth exchange for testing/local sandbox
      return {
        accessToken: `mock_ms_access_${Date.now()}`,
        refreshToken: `mock_ms_refresh_${Date.now()}`,
        expiresIn: 3600,
        email: 'user' + Math.floor(Math.random() * 100) + '@outlook.com',
        accountId: 'ms_' + Math.random().toString(36).substring(2, 9),
      };
    }

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Microsoft OAuth code exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();

    // Fetch user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      throw new Error('Failed to retrieve Microsoft profile');
    }

    const profile = await profileRes.json();
    const userEmail = profile.mail || profile.userPrincipalName;

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      email: userEmail,
      accountId: profile.id || userEmail,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Microsoft OAuth credentials not configured');
    }

    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
      const errText = await tokenRes.text();
      const err = new Error(`Microsoft token refresh failed: ${errText}`);
      (err as any).status = tokenRes.status;
      throw err;
    }

    const tokenData = await tokenRes.json();
    return {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in || 3600,
    };
  }

  async fetchEmails(accessToken: string, options: SyncOptions): Promise<SyncFetchResult> {
    if (accessToken.startsWith('mock_')) {
      return this.generateMockSyncEmails(options);
    }

    const graphUrl = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages');
    graphUrl.searchParams.set('$top', String(options.maxResults || 20));
    graphUrl.searchParams.set('$orderby', 'receivedDateTime desc');

    if (options.fromDate) {
      graphUrl.searchParams.set('$filter', `receivedDateTime ge ${options.fromDate.toISOString()}`);
    }

    const res = await fetch(graphUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      const err = new Error(`Microsoft Graph error: ${res.status} ${errText}`);
      (err as any).status = res.status;
      throw err;
    }

    const data = await res.json();
    const rawMessages = data.value || [];
    const normalized: NormalizedEmail[] = [];

    for (const msg of rawMessages) {
      const sender = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown';
      const senderEmail = msg.from?.emailAddress?.address || '';
      const bodyContent = msg.body?.content || msg.bodyPreview || '';
      const cleanBody = stripHtml(bodyContent);
      const links = extractLinks(bodyContent);

      normalized.push({
        provider: 'microsoft',
        providerMessageId: msg.id,
        providerThreadId: msg.conversationId,
        sender,
        senderEmail,
        subject: msg.subject || '(No Subject)',
        snippet: cleanSnippet(msg.bodyPreview || cleanBody),
        bodyText: cleanBody,
        receivedAt: new Date(msg.receivedDateTime),
        links,
      });
    }

    return {
      emails: normalized,
      nextCursor: data['@odata.deltaLink'] || data['@odata.nextLink'] || undefined,
    };
  }

  getDeepLink(messageId: string, threadId?: string): string {
    return `https://outlook.live.com/mail/0/deeplink/read/${encodeURIComponent(messageId)}`;
  }

  private generateMockSyncEmails(options: SyncOptions): SyncFetchResult {
    const now = new Date();
    const newMsgId = 'ms_sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const sampleEmails: NormalizedEmail[] = [
      {
        provider: 'microsoft',
        providerMessageId: newMsgId,
        providerThreadId: 'th_' + newMsgId,
        sender: 'Vercel Recruiting',
        senderEmail: 'careers@vercel.com',
        subject: 'Application received — Staff Next.js Engineer',
        snippet: 'Thank you for your application to Vercel! We have received your materials for the Staff Next.js Engineer opening.',
        bodyText: `Hello!

Thank you for your interest in joining Vercel. We have received your application for Staff Next.js Engineer submitted via Ashby.

Our team reviews applications on a rolling basis and will reach out if there is a strong alignment with our current engineering initiatives.

Best regards,
Vercel Talent Acquisition`,
        receivedAt: new Date(now.getTime() - 25 * 60 * 1000), // 25 mins ago
        links: ['https://jobs.ashbyhq.com/vercel'],
      }
    ];

    return {
      emails: sampleEmails,
      nextCursor: 'cursor_ms_' + Date.now(),
    };
  }
}
