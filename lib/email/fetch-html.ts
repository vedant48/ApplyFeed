import { repository } from '@/lib/db/repository';
import { EmailAccount, Email } from '@/lib/db/schema';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { getProvider } from '@/lib/email';
import { extractMimeBody } from '@/lib/email/gmail';
import { isPlaceholderPlainText, stripHtml } from '@/lib/email/normalizer';

/**
 * Gets a valid decrypted access token for an email account, refreshing it if expired.
 */
async function getValidAccessToken(account: EmailAccount, provider: any): Promise<string> {
  let accessToken = account.encryptedAccessToken;
  if (accessToken.includes(':')) {
    try {
      accessToken = decryptToken(accessToken);
    } catch {
      // If decryption fails, token might already be plaintext
    }
  }

  const isExpired = account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() <= Date.now() + 60000;
  if (!isExpired) {
    return accessToken;
  }

  // Refresh token
  if (!account.encryptedRefreshToken) {
    return accessToken;
  }

  let refreshToken = account.encryptedRefreshToken;
  if (refreshToken.includes(':')) {
    try {
      refreshToken = decryptToken(refreshToken);
    } catch {}
  }

  if (typeof provider.refreshAccessToken !== 'function') {
    return accessToken;
  }

  try {
    const refreshed = await provider.refreshAccessToken(refreshToken);
    const newAccess = refreshed.accessToken;
    const newEncryptedAccess = encryptToken(newAccess);
    const newExpiresAt = new Date(Date.now() + (refreshed.expiresIn || 3600) * 1000);

    await repository.updateEmailAccount(account.id, {
      encryptedAccessToken: newEncryptedAccess,
      tokenExpiresAt: newExpiresAt,
    });

    account.encryptedAccessToken = newEncryptedAccess;
    account.tokenExpiresAt = newExpiresAt;
    return newAccess;
  } catch (err) {
    console.warn(`Failed to refresh token for account ${account.email}:`, err);
    return accessToken;
  }
}

/**
 * Fetches the rich HTML content for an email directly from its upstream provider (Gmail or Microsoft),
 * and automatically auto-heals any "Please Enable HTML" placeholder text stored in the database.
 */
export async function getLiveEmailHtml(
  email: Email,
  userId: string,
  isDemo?: boolean
): Promise<{ html: string | null; updatedBodyText?: string }> {
  if (!email.emailAccountId || !email.providerMessageId || isDemo) {
    return { html: null };
  }

  const account = await repository.getEmailAccountById(email.emailAccountId, userId, isDemo);
  if (!account || !account.encryptedAccessToken) {
    return { html: null };
  }

  const providerType = account.provider || 'gmail';
  let provider: any;
  try {
    provider = getProvider(providerType as any);
  } catch {
    return { html: null };
  }

  const token = await getValidAccessToken(account, provider);

  let htmlContent: string | null = null;

  if (providerType === 'gmail') {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.providerMessageId}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const msgData = await res.json();
        const extracted = extractMimeBody(msgData.payload);
        if (extracted.html) {
          htmlContent = extracted.html;
        }
      }
    } catch (e: any) {
      console.warn(`Failed to fetch Gmail HTML for ${email.providerMessageId}:`, e.message);
    }
  } else if (providerType === 'microsoft') {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${email.providerMessageId}?$select=body`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const msgData = await res.json();
        if (msgData.body?.contentType?.toLowerCase() === 'html' && msgData.body?.content) {
          htmlContent = msgData.body.content;
        }
      }
    } catch (e: any) {
      console.warn(`Failed to fetch Microsoft HTML for ${email.providerMessageId}:`, e.message);
    }
  }

  let updatedBodyText: string | undefined;

  // Auto-healing: If stored bodyText is a dummy placeholder (e.g. "Please Enable HTML")
  // and we now have real HTML content, extract and update the database document.
  if (isPlaceholderPlainText(email.bodyText)) {
    if (htmlContent) {
      const clean = stripHtml(htmlContent);
      if (clean) {
        updatedBodyText = clean.substring(0, 2000);
        try {
          await repository.updateEmail(email.id, userId, { bodyText: updatedBodyText }, isDemo);
        } catch (updateErr) {
          console.warn('Could not auto-heal email bodyText:', updateErr);
        }
      }
    } else if (email.snippet) {
      updatedBodyText = email.snippet;
    }
  }

  return { html: htmlContent, updatedBodyText };
}
