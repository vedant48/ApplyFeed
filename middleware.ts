import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static assets & internal Next.js requests are always public
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // images, icons, robots.txt, etc.
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const isAuthenticated = Boolean(session && session.userId);

  // If authenticated user tries to access /login, redirect to /inbox
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/inbox', req.url));
  }

  // Public routes: /login
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Root path / redirects to /inbox if authenticated, or /login if not
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/inbox', req.url));
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Protected routes: /inbox, /jobs, /resume, /settings
  const isProtectedPage =
    pathname.startsWith('/inbox') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/resume') ||
    pathname.startsWith('/settings');

  if (isProtectedPage && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
