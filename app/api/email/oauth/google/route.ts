import { NextRequest, NextResponse } from 'next/server';
import { GmailProvider } from '@/lib/email/gmail';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/email/oauth/google/callback`;

  const state = Math.random().toString(36).substring(2, 15);
  const gmail = new GmailProvider();
  const authUrl = gmail.getAuthUrl(state, redirectUri);

  return NextResponse.redirect(authUrl);
}
