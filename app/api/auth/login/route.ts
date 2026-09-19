import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/db/repository';
import { verifyPassword } from '@/lib/auth/passwords';
import { createSessionToken, getSessionCookieOptions, DEMO_USER_ID } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await repository.getAppUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isDemo = user.id === DEMO_USER_ID;
    const authUser = {
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      isDemo,
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
      { error: err.message || 'Login failed' },
      { status: 500 }
    );
  }
}
