import { NextResponse } from 'next/server';
import { createDemoSession, getSessionCookieOptions } from '@/lib/auth/session';

export async function POST() {
  try {
    const { token, user } = await createDemoSession();
    const cookieOpts = getSessionCookieOptions(14);

    const response = NextResponse.json({
      success: true,
      message: 'Signed in as Demo User with pre-loaded data',
      user,
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
      { success: false, error: err.message || 'Demo sign-in failed' },
      { status: 500 }
    );
  }
}
