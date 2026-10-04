import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { getCurrentUser, getCurrentUserId } from '@/lib/auth';
import { getProvider } from '@/lib/email';
import { getLiveEmailHtml } from '@/lib/email/fetch-html';
import { isPlaceholderPlainText } from '@/lib/email/normalizer';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const email = await repository.getEmailById(id, user.userId, user.isDemo);
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    let deepLink: string | null = null;
    if (email.accountProvider) {
      try {
        const provider = getProvider(email.accountProvider as any);
        deepLink = provider.getDeepLink(email.providerMessageId, email.providerThreadId || undefined);
      } catch (e) {
        // Deep link generation failed, ignore
      }
    }

    // Attempt to load rich HTML body and auto-heal placeholder text
    const { html, updatedBodyText } = await getLiveEmailHtml(email, user.userId, user.isDemo);

    let effectiveBodyText = updatedBodyText || email.bodyText;
    if (isPlaceholderPlainText(effectiveBodyText)) {
      effectiveBodyText = email.snippet || effectiveBodyText;
    }

    return NextResponse.json({
      email: {
        ...email,
        bodyText: effectiveBodyText,
        bodyHtml: html,
        deepLink,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve email' },
      { status: 500 }
    );
  }
}

const PatchSchema = z.object({
  isRead: z.boolean().optional(),
});

export async function PATCH(
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
    const { isRead } = PatchSchema.parse(body);

    const updated = await repository.updateEmail(id, user.userId, {
      ...(isRead !== undefined ? { isRead } : {}),
    }, user.isDemo);

    if (!updated) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    return NextResponse.json({ email: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update email' },
      { status: 400 }
    );
  }
}
