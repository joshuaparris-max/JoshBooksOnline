import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Protect every route that reads the user's Drive library or personal data.
 * Unauthenticated users are redirected to the home page sign-in flow.
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (token) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/audiobooks/:path*',
    '/library/:path*',
    '/listen/:path*',
    '/media/:path*',
    '/reader/:path*',
    '/suggestions/:path*',
    '/watch/:path*',
  ],
};
