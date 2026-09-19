import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { encryptToken } from '@/lib/crypto';
import { SyncService } from '@/lib/email/sync-service';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const rawState = searchParams.get('state');

  if (error || !code) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${protocol}://${host}/login?error=${encodeURIComponent(error || 'Access denied by Google')}`);
  }

  let callbackUrl = '/inbox';
  let redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
      if (decoded.callbackUrl) callbackUrl = decoded.callbackUrl;
      if (decoded.redirectUri) redirectUri = decoded.redirectUri;
    } catch (e) {
      console.warn('Could not parse OAuth state:', e);
    }
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;

    // 2. Fetch Google user profile
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userinfoRes.ok) {
      throw new Error('Failed to retrieve Google user profile');
    }

    const profile = await userinfoRes.json();
    const email = (profile.email || '').toLowerCase().trim();
    const name = profile.name || profile.given_name || email.split('@')[0];
    const googleId = profile.sub;
    const avatarUrl = profile.picture;

    if (!email) {
      throw new Error('No email found in Google account profile');
    }

    // 3. Upsert user in app_users
    const user = await repository.upsertGoogleUser({
      email,
      name,
      googleId,
      avatarUrl,
    });

    // 4. Automatically connect or update user's Gmail account in email_accounts
    try {
      const encryptedAccess = encryptToken(accessToken);
      const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Check if account already exists for this user
      const existingAccounts = await repository.getEmailAccounts(user.id);
      const existingAcc = existingAccounts.find(a => a.email.toLowerCase() === email);

      if (existingAcc) {
        await repository.updateEmailAccount(existingAcc.id, {
          encryptedAccessToken: encryptedAccess,
          ...(encryptedRefresh ? { encryptedRefreshToken: encryptedRefresh } : {}),
          tokenExpiresAt: expiresAt,
          status: 'SUCCESS',
          lastError: null,
        });
      } else {
        const newAccount = await repository.createEmailAccount({
          userId: user.id,
          provider: 'gmail',
          email,
          providerAccountId: googleId || email,
          encryptedAccessToken: encryptedAccess,
          encryptedRefreshToken: encryptedRefresh,
          tokenExpiresAt: expiresAt,
          status: 'IDLE',
        });
        SyncService.syncAccount(newAccount).catch(e => console.error('Initial sync error:', e));
      }
    } catch (accErr) {
      console.warn('Could not auto-link Gmail account during login:', accErr);
    }

    // 5. Create secure signed session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      avatarUrl: user.avatarUrl || undefined,
      isDemo: false,
    });

    const cookieOptions = getSessionCookieOptions();

    // 6. Redirect to dashboard
    const response = NextResponse.redirect(new URL(callbackUrl, `${protocol}://${host}`));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, cookieOptions);
    // Clear oauth state cookie
    response.cookies.delete('applyfeed_oauth_state');

    return response;
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(`${protocol}://${host}/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
  }
}
