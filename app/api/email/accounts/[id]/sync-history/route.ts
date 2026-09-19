import { NextRequest, NextResponse } from 'next/server';
import { repository, parseDateRangeBoundaries } from '@/lib/db/repository';
import { getCurrentUserId } from '@/lib/auth';
import { SyncService } from '@/lib/email/sync-service';
import { z } from 'zod';

const SyncHistorySchema = z.object({
  from: z.string(),
  to: z.string(),
  maxResults: z.number().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const account = await repository.getEmailAccountById(id, userId);
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const body = await req.json();
    const { from, to, maxResults } = SyncHistorySchema.parse(body);

    const { fromDate, toDate } = parseDateRangeBoundaries(from, to);
    if (!fromDate || !toDate) {
      return NextResponse.json({ error: 'Invalid from or to date' }, { status: 400 });
    }

    if (fromDate.getTime() > toDate.getTime()) {
      return NextResponse.json({ error: 'From date cannot be after To date' }, { status: 400 });
    }

    const result = await SyncService.syncHistory(account, fromDate, toDate, maxResults || 500);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Historical sync failed' },
      { status: 500 }
    );
  }
}
