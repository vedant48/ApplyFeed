import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { getCurrentUser, getCurrentUserId } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    const accounts = await repository.getEmailAccounts(user.userId, user.isDemo);

    // Sanitize accounts (do NOT send encrypted tokens to client!)
    const safeAccounts = accounts.map(a => ({
      id: a.id,
      provider: a.provider,
      email: a.email,
      status: a.status,
      lastSyncedAt: a.lastSyncedAt,
      lastError: a.lastError,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ accounts: safeAccounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list accounts' }, { status: 500 });
  }
}

const ConnectSchema = z.object({
  provider: z.enum(['gmail', 'microsoft']),
  email: z.string().email(),
  providerAccountId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    const body = await req.json();
    const { provider, email, providerAccountId } = ConnectSchema.parse(body);

    const account = await repository.createEmailAccount({
      userId,
      provider,
      email,
      providerAccountId: providerAccountId || `${provider}_${Date.now()}`,
      encryptedAccessToken: encryptToken(`demo_access_${Date.now()}`),
      status: 'IDLE',
    });

    return NextResponse.json({
      account: {
        id: account.id,
        provider: account.provider,
        email: account.email,
        status: account.status,
        lastSyncedAt: account.lastSyncedAt,
        createdAt: account.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to connect account' }, { status: 400 });
  }
}
