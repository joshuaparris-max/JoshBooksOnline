'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  continueLabel,
  displayBookTitle,
  getRecentBooks,
} from '@/lib/recentBooks';
import type { BookEntry } from '@/types/books';

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  epub: 'EPUB',
  txt: 'TXT',
  docx: 'DOCX',
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getColorFromTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 35%)`;
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

export default function ContinueReading() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/library', { cache: 'no-store' });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? 'Failed to load library');
        }
        const data = (await response.json()) as BookEntry[];
        if (!cancelled) setBooks(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load recent books');
          setBooks([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = books ? getRecentBooks(books) : [];

  return (
    <section className="w-full max-w-6xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Continue reading</h2>
          <p className="mt-1 text-sm text-slate-400">Pick up where you left off</p>
        </div>
        <Link
          href="/library"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          Browse library →
        </Link>
      </div>

      {books === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-white/10 bg-slate-950/80"
            />
          ))}
        </div>
      )}

      {books !== null && error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-6 text-center text-sm text-rose-200">
          {error}
        </div>
      )}

      {books !== null && !error && recent.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-10 text-center">
          <p className="text-base font-medium text-slate-300">No recent books yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Open a book from your library and it will appear here.
          </p>
          <Link
            href="/library"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Go to library
          </Link>
        </div>
      )}

      {books !== null && !error && recent.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((book) => {
            const title = displayBookTitle(book);
            const progress = Math.max(0, Math.min(100, Math.round(book.readingProgress)));
            return (
              <article
                key={book.id}
                className="flex flex-col rounded-2xl border border-white/10 bg-slate-950/80 p-4 transition hover:border-sky-500/30 hover:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverUrl}
                      alt=""
                      className="h-16 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: getColorFromTitle(title) }}
                    >
                      {getInitials(title)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                        {FORMAT_LABELS[book.format] ?? book.format}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        {book.source}
                      </span>
                    </div>
                    {book.lastOpened && (
                      <p className="mt-1 text-xs text-slate-500">{formatRelative(book.lastOpened)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <Link
                  href={`/reader/${book.id}`}
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  {continueLabel(book.readingProgress)}
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
