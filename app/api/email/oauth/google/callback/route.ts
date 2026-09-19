import { NextRequest, NextResponse } from 'next/server';
import { GmailProvider } from '@/lib/email/gmail';
import { repository } from '@/lib/db/repository';
import { getCurrentUserId } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import { SyncService } from '@/lib/email/sync-service';
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/email/oauth/google/callback`;

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const rawState = searchParams.get('state');

  if (error || !code) {
    return NextResponse.redirect(`${protocol}://${host}/settings/email-accounts?error=${encodeURIComponent(error || 'Missing code')}`);
  }

  let isLoginMode = false;
  let callbackUrl = '/inbox';
  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
      if (decoded.mode === 'login') isLoginMode = true;
      if (decoded.callbackUrl) callbackUrl = decoded.callbackUrl;
    } catch {
      // not JSON state, normal connection
    }
  }

  try {
    let userId = await getCurrentUserId(req);
    const gmail = new GmailProvider();
    const tokenResult = await gmail.exchangeCode(code, redirectUri);

    // If unauthenticated or in login mode, upsert the user profile and establish session
    let sessionCookieVal: string | null = null;
    if (!userId || isLoginMode) {
      let name = tokenResult.email.split('@')[0];
      let avatarUrl: string | undefined;
      let googleId = tokenResult.accountId;

      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        });
        if (userinfoRes.ok) {
          const uinfo = await userinfoRes.json();
          if (uinfo.name) name = uinfo.name;
          if (uinfo.picture) avatarUrl = uinfo.picture;
          if (uinfo.sub) googleId = uinfo.sub;
        }
      } catch (e) {
        console.warn('Could not fetch userinfo profile:', e);
      }

      const user = await repository.upsertGoogleUser({
        email: tokenResult.email,
        name,
        googleId,
        avatarUrl,
      });
      userId = user.id;

      sessionCookieVal = await createSessionToken({
        userId: user.id,
        email: user.email,
        name: user.name || undefined,
        avatarUrl: user.avatarUrl || undefined,
        isDemo: false,
      });
    }

    // Encrypt tokens before saving
    const encryptedAccess = encryptToken(tokenResult.accessToken);
    const encryptedRefresh = tokenResult.refreshToken ? encryptToken(tokenResult.refreshToken) : null;
    const expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);

    // Check if account already exists for this user
    const existingAccounts = await repository.getEmailAccounts(userId);
    const existingAcc = existingAccounts.find(a => a.email.toLowerCase() === tokenResult.email.toLowerCase());

    if (existingAcc) {
      await repository.updateEmailAccount(existingAcc.id, {
        encryptedAccessToken: encryptedAccess,
        ...(encryptedRefresh ? { encryptedRefreshToken: encryptedRefresh } : {}),
        tokenExpiresAt: expiresAt,
        status: 'SUCCESS',
        lastError: null,
      });
    } else {
      const account = await repository.createEmailAccount({
        userId,
        provider: 'gmail',
        email: tokenResult.email,
        providerAccountId: tokenResult.accountId,
        encryptedAccessToken: encryptedAccess,
        encryptedRefreshToken: encryptedRefresh,
        tokenExpiresAt: expiresAt,
        status: 'IDLE',
      });
      SyncService.syncAccount(account).catch(e => console.error('Initial sync error:', e));
    }

    const targetUrl = isLoginMode ? callbackUrl : '/settings/email-accounts?success=gmail_connected';
    const response = NextResponse.redirect(new URL(targetUrl, `${protocol}://${host}`));

    if (sessionCookieVal) {
      response.cookies.set(SESSION_COOKIE_NAME, sessionCookieVal, getSessionCookieOptions());
    }

    return response;
  } catch (err: any) {
    console.error('Google OAuth callback failed:', err);
    const errTarget = isLoginMode ? '/login' : '/settings/email-accounts';
    return NextResponse.redirect(`${protocol}://${host}${errTarget}?error=${encodeURIComponent(err.message || 'OAuth failed')}`);
  }
}
