import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to protect /library and /reader routes
 * Redirects unauthenticated users to the home page (sign-in page)
 */
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // Allow access if token exists
  if (token) {
    return NextResponse.next();
  }

  // Redirect to home page for sign-in
  return NextResponse.redirect(new URL('/', request.url));
}

/**
 * Apply middleware to /library and /reader routes
 */
export const config = {
  matcher: ['/library/:path*', '/reader/:path*'],
};
