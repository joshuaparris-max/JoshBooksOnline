'use client';

import Link from 'next/link';
import { signIn, signOut, useSession } from 'next-auth/react';
import ContinueReading from '@/components/ContinueReading';

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-10 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10">
        <header className="w-full text-center">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">BookShelf</h1>
          <p className="mt-3 text-lg text-slate-300">
            Your personal ebook reader powered by Google Drive
          </p>
        </header>

        {status === 'unauthenticated' && (
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            Sign in with Google
          </button>
        )}

        {status !== 'unauthenticated' && (
          <div className="flex w-full flex-col items-center gap-8">
            <div className="flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isAuthenticated ? (
                <>
                  <p className="text-sm text-slate-400">
                    Signed in as{' '}
                    <span className="font-medium text-slate-200">{session.user?.email}</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/library"
                      className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
                    >
                      Open library
                    </Link>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-10 w-full animate-pulse rounded-full bg-white/5" aria-label="Loading account" />
              )}
            </div>

            <ContinueReading enabled={isAuthenticated} />
          </div>
        )}
      </div>
    </main>
  );
}
