import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3001';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  return NextResponse.redirect(
    `${protocol}://${host}/settings/email-accounts?error=${encodeURIComponent(
      'Microsoft Outlook integration is temporarily deprecated. Please connect with Google Gmail.'
    )}`
  );
}
