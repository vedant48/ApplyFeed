import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const searchParams = req.nextUrl.searchParams;
  const callbackUrl = searchParams.get('callbackUrl') || '/inbox';

  // Use the callback URI authorized in Google Cloud Console
  const redirectUri = `${protocol}://${host}/api/email/oauth/google/callback`;

  const nonce = Math.random().toString(36).substring(2, 15);
  const statePayload = JSON.stringify({ mode: 'login', nonce, callbackUrl, redirectUri });
  const state = Buffer.from(statePayload).toString('base64url');

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent select_account',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('applyfeed_oauth_state', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  return res;
}
