'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { DrivePicker } from '@/components/DrivePicker';
import type { BookEntry } from '@/types/books';

const SOURCE_BADGES: Record<string, string> = {
  'IT PD Ebooks': 'bg-amber-500 text-slate-950',
  'Book Club': 'bg-indigo-500 text-white',
  Unsorted: 'bg-slate-500 text-white',
  'Avance KBs': 'bg-cyan-500 text-slate-950',
  'ITIL PDFs': 'bg-violet-500 text-white',
  ITIL: 'bg-fuchsia-500 text-white',
  'ITIL PRINCE COBIT': 'bg-rose-500 text-white',
  'IEC 27001': 'bg-emerald-500 text-slate-950',
  'Local Books': 'bg-emerald-500 text-slate-950',
};

const FORMAT_BADGES: Record<string, string> = {
  pdf: 'bg-red-600 text-white',
  epub: 'bg-teal-600 text-white',
};

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function getColorFromTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 35%)`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatTime(iso?: string) {
  if (!iso) return 'Never opened';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function LibraryPage() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  const refreshLibrary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/library', { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to load library');
        setBooks([]);
        return;
      }

      const data = (await response.json()) as BookEntry[];
      setBooks(data);
    } catch (err) {
      setError('Unable to fetch library. Please check your connection.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImportStart = () => {
    setImportStatus({ type: 'loading', message: 'Importing files...' });
  };

  const handleImportComplete = (count: number) => {
    setImportStatus({
      type: 'success',
      message: `Successfully imported ${count} file${count !== 1 ? 's' : ''}.`,
    });
    setTimeout(() => {
      setImportStatus({ type: 'idle', message: '' });
      refreshLibrary();
    }, 2000);
  };

  const handleImportError = (errorMessage: string) => {
    setImportStatus({ type: 'error', message: errorMessage });
    setTimeout(() => {
      setImportStatus({ type: 'idle', message: '' });
    }, 5000);
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  const filteredBooks = useMemo(() => {
    if (!books) return [];

    const query = search.trim().toLowerCase();
    if (!query) return books;

    return books.filter((book) => {
      return (
        book.name.toLowerCase().includes(query) ||
        book.source.toLowerCase().includes(query) ||
        book.format.toLowerCase().includes(query)
      );
    });
  }, [books, search]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Library</h1>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Browse books from your mapped Drive folders, then open them in the reader.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <DrivePicker
                onImportStart={handleImportStart}
                onImportComplete={handleImportComplete}
                onImportError={handleImportError}
              />
              <button
                type="button"
                onClick={refreshLibrary}
                className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Refresh Library
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Sign out
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, source, or format"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-400">
              {books ? filteredBooks.length : '...'} books found
            </div>
          </div>
        </section>

        {importStatus.type !== 'idle' && (
          <section className={`rounded-3xl border p-6 ${
            importStatus.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
              : importStatus.type === 'error'
              ? 'border-rose-500/30 bg-rose-500/5 text-rose-100'
              : 'border-sky-500/30 bg-sky-500/5 text-sky-100'
          }`}>
            <p className="font-medium">{importStatus.message}</p>
          </section>
        )}

        {loading ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                <div className="h-48 rounded-3xl bg-slate-800" />
                <div className="mt-4 h-6 w-3/4 rounded-full bg-slate-800" />
                <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-800" />
                <div className="mt-6 h-3 rounded-full bg-slate-800" />
              </div>
            ))}
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 text-rose-100">
            <h2 className="text-2xl font-semibold">Unable to load library</h2>
            <p className="mt-2 text-slate-300">{error}</p>
            <button
              type="button"
              onClick={refreshLibrary}
              className="mt-4 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Try again
            </button>
          </section>
        ) : filteredBooks.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
            <p className="text-xl font-medium">No books match your search.</p>
            <p className="mt-2">Try a broader search or refresh the library.</p>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredBooks.map((book) => (
              <Link
                key={book.id}
                href={`/reader/${book.id}`}
                className="group rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/10 transition hover:border-slate-500/40 hover:bg-slate-800/70 hover:shadow-black/20 hover:-translate-y-0.5 transform cursor-pointer"
              >
                <article className="h-full">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-semibold text-white"
                      style={{ backgroundColor: getColorFromTitle(book.name) }}
                    >
                      {getInitials(book.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-semibold text-white">{book.name}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 ${SOURCE_BADGES[book.source] ?? 'bg-slate-500 text-white'}`}>
                          {book.source}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 ${FORMAT_BADGES[book.format] ?? 'bg-slate-500 text-white'}`}>
                          {book.format.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4 text-slate-300">
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Size</span>
                        <span>{formatBytes(book.size)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Modified</span>
                        <span>{formatTime(book.modifiedTime)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Last opened</span>
                        <span>{book.lastOpened ? formatTime(book.lastOpened) : 'Never'}</span>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                        <span>Progress</span>
                        <span>{Math.round(book.readingProgress)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-2 rounded-full bg-sky-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, book.readingProgress))}%` }} />
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
