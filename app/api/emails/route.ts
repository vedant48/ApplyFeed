import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get('search') || undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const accountId = searchParams.get('account') || undefined;
    const category = searchParams.get('category') || undefined;
    const classification = searchParams.get('classification') || undefined;
    const needsAttentionParam = searchParams.get('needsAttention');
    const needsAttention = needsAttentionParam === 'true';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const result = await repository.getEmails({
      userId: user.userId,
      isDemo: user.isDemo,
      search,
      from,
      to,
      accountId,
      category,
      classification,
      needsAttention,
      page,
      limit,
    });

    return NextResponse.json({
      emails: result.emails,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit) || 1,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch emails' },
      { status: 500 }
    );
  }
}
