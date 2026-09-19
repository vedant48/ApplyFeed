import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { repository } from '@/lib/db/repository';
import { hashPassword } from '@/lib/auth/passwords';
import { createSessionToken, getSessionCookieOptions } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await repository.getAppUserByEmail(normalizedEmail);

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email address already exists' },
        { status: 409 }
      );
    }

    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const passwordHash = hashPassword(password);

    const newUser = await repository.createAppUser({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || null,
    });

    const authUser = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name || undefined,
      isDemo: false,
    };

    const token = await createSessionToken(authUser, 7);
    const cookieOpts = getSessionCookieOptions(7);

    const response = NextResponse.json({
      success: true,
      user: authUser,
    });

    response.cookies.set({
      name: cookieOpts.name,
      value: token,
      httpOnly: cookieOpts.httpOnly,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
