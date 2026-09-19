import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const OverrideSchema = z.object({
  classification: z.enum(['JOB', 'UNCERTAIN', 'NOT_JOB']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }
    const body = await req.json();

    const { classification } = OverrideSchema.parse(body);

    const updated = await repository.overrideEmailClassification(id, user.userId, classification, user.isDemo);
    if (!updated) {
      return NextResponse.json({ error: 'Email not found or not owned by user' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      email: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update email classification override' },
      { status: 500 }
    );
  }
}

export const PATCH = POST;
