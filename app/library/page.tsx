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
  txt: 'bg-slate-600 text-white',
  docx: 'bg-blue-600 text-white',
};

type SortField =
  | 'title'
  | 'author'
  | 'published'
  | 'added'
  | 'lastOpened'
  | 'progress'
  | 'size'
  | 'format'
  | 'source'
  | 'series';

type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'published', label: 'Publish date' },
  { value: 'series', label: 'Series' },
  { value: 'added', label: 'Date added' },
  { value: 'lastOpened', label: 'Last opened' },
  { value: 'progress', label: 'Progress' },
  { value: 'size', label: 'Size' },
  { value: 'format', label: 'Format' },
  { value: 'source', label: 'Source' },
];

function prettifyName(name: string) {
  return name.replace(/\.(pdf|epub|txt|docx)$/i, '').replace(/[_]+/g, ' ').trim();
}

function displayTitle(book: BookEntry) {
  return book.title?.trim() || prettifyName(book.name);
}

function displayAuthors(book: BookEntry) {
  return book.authors && book.authors.length > 0 ? book.authors.join(', ') : '';
}

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

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(iso));
}

/** Sort key for a field. Returns '' / undefined for "missing" values, which always sort last. */
function sortKey(book: BookEntry, field: SortField): string | number | undefined {
  switch (field) {
    case 'title':
      return displayTitle(book).toLowerCase();
    case 'author':
      return book.authors?.[0]?.toLowerCase();
    case 'published': {
      if (!book.publishedDate) return undefined;
      const ts = Date.parse(book.publishedDate);
      return Number.isNaN(ts) ? book.publishedDate : ts;
    }
    case 'series':
      return book.series?.toLowerCase();
    case 'added':
      return book.modifiedTime ? Date.parse(book.modifiedTime) : undefined;
    case 'lastOpened':
      return book.lastOpened ? Date.parse(book.lastOpened) : undefined;
    case 'progress':
      return book.readingProgress;
    case 'size':
      return book.size;
    case 'format':
      return book.format;
    case 'source':
      return book.source;
    default:
      return undefined;
  }
}

function compareBooks(a: BookEntry, b: BookEntry, field: SortField, dir: SortDir) {
  const ka = sortKey(a, field);
  const kb = sortKey(b, field);
  const missingA = ka === undefined || ka === '';
  const missingB = kb === undefined || kb === '';
  if (missingA && missingB) return 0;
  if (missingA) return 1; // missing values always last, regardless of direction
  if (missingB) return -1;

  let cmp: number;
  if (typeof ka === 'number' && typeof kb === 'number') {
    cmp = ka - kb;
  } else {
    cmp = String(ka).localeCompare(String(kb));
  }
  return dir === 'asc' ? cmp : -cmp;
}

function Cover({ book, className }: { book: BookEntry; className: string }) {
  const [failed, setFailed] = useState(false);
  const title = displayTitle(book);

  if (book.coverUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverUrl}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: getColorFromTitle(title) }}
    >
      {getInitials(title)}
    </div>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LibraryPage() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [enrich, setEnrich] = useState<{ running: boolean; done: number; total: number; message: string }>({
    running: false,
    done: 0,
    total: 0,
    message: '',
  });
  const [refetchingId, setRefetchingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Restore persisted view + sort preferences
  useEffect(() => {
    const storedView = window.localStorage.getItem('joshbooks-view') as ViewMode | null;
    const storedField = window.localStorage.getItem('joshbooks-sort-field') as SortField | null;
    const storedDir = window.localStorage.getItem('joshbooks-sort-dir') as SortDir | null;
    if (storedView === 'grid' || storedView === 'table') setViewMode(storedView);
    if (storedField && SORT_OPTIONS.some((o) => o.value === storedField)) setSortField(storedField);
    if (storedDir === 'asc' || storedDir === 'desc') setSortDir(storedDir);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('joshbooks-view', viewMode);
  }, [viewMode]);
  useEffect(() => {
    window.localStorage.setItem('joshbooks-sort-field', sortField);
  }, [sortField]);
  useEffect(() => {
    window.localStorage.setItem('joshbooks-sort-dir', sortDir);
  }, [sortDir]);

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
    } catch {
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

  /** Enrich a single book and patch it into state. Returns true on a match. */
  const enrichOne = async (book: BookEntry): Promise<boolean> => {
    try {
      const response = await fetch('/api/library/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: book.id, name: book.name }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { metadata: Partial<BookEntry> | null };
      if (data.metadata) {
        setBooks((prev) =>
          prev ? prev.map((b) => (b.id === book.id ? { ...b, ...data.metadata } : b)) : prev
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const fetchAllMetadata = async () => {
    if (!books) return;
    const targets = books.filter((b) => !b.metadataSource);
    if (targets.length === 0) {
      setEnrich({ running: false, done: 0, total: 0, message: 'All books already have metadata.' });
      setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 4000);
      return;
    }

    setEnrich({ running: true, done: 0, total: targets.length, message: `Enriching 0/${targets.length}…` });
    let done = 0;
    let matched = 0;
    for (const book of targets) {
      const ok = await enrichOne(book);
      if (ok) matched += 1;
      done += 1;
      setEnrich((s) => ({ ...s, done, message: `Enriching ${done}/${targets.length}…` }));
      await sleep(300); // be gentle with the public APIs
    }
    setEnrich({
      running: false,
      done,
      total: targets.length,
      message: `Done — matched ${matched} of ${targets.length} book${targets.length !== 1 ? 's' : ''}.`,
    });
    setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 6000);
  };

  const refetchOne = async (book: BookEntry) => {
    setRefetchingId(book.id);
    await enrichOne(book);
    setRefetchingId(null);
  };

  const sortedBooks = useMemo(() => {
    if (!books) return [];
    const query = search.trim().toLowerCase();

    const filtered = query
      ? books.filter((book) => {
          return (
            displayTitle(book).toLowerCase().includes(query) ||
            displayAuthors(book).toLowerCase().includes(query) ||
            book.name.toLowerCase().includes(query) ||
            book.source.toLowerCase().includes(query) ||
            book.format.toLowerCase().includes(query)
          );
        })
      : [...books];

    return filtered.sort((a, b) => compareBooks(a, b, sortField, sortDir));
  }, [books, search, sortField, sortDir]);

  const unenrichedCount = books ? books.filter((b) => !b.metadataSource).length : 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortArrow = (field: SortField) => (sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <DrivePicker
                onImportStart={handleImportStart}
                onImportComplete={handleImportComplete}
                onImportError={handleImportError}
              />
              <button
                type="button"
                onClick={fetchAllMetadata}
                disabled={enrich.running || !books || unenrichedCount === 0}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {enrich.running
                  ? `Fetching… ${enrich.done}/${enrich.total}`
                  : `Fetch metadata${unenrichedCount ? ` (${unenrichedCount})` : ''}`}
              </button>
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

          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author, source, or format"
              className="w-full flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-sm text-slate-400">
                  Sort
                </label>
                <select
                  id="sort"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as SortField)}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
                  title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
                </button>
              </div>

              <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Table
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                {books ? sortedBooks.length : '...'} books
              </div>
            </div>
          </div>
        </section>

        {(importStatus.type !== 'idle' || enrich.message) && (
          <section
            className={`rounded-3xl border p-6 ${
              importStatus.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : importStatus.type === 'error'
                ? 'border-rose-500/30 bg-rose-500/5 text-rose-100'
                : 'border-sky-500/30 bg-sky-500/5 text-sky-100'
            }`}
          >
            <p className="font-medium">{importStatus.type !== 'idle' ? importStatus.message : enrich.message}</p>
            {enrich.running && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${enrich.total ? (enrich.done / enrich.total) * 100 : 0}%` }}
                />
              </div>
            )}
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
        ) : sortedBooks.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
            <p className="text-xl font-medium">No books match your search.</p>
            <p className="mt-2">Try a broader search or refresh the library.</p>
          </section>
        ) : viewMode === 'grid' ? (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sortedBooks.map((book) => (
              <article
                key={book.id}
                className="group flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/10 transition hover:border-slate-500/40 hover:bg-slate-800/70 hover:shadow-black/20"
              >
                <Link href={`/reader/${book.id}`} className="flex gap-4">
                  <Cover book={book} className="h-28 w-20 shrink-0 overflow-hidden rounded-2xl text-2xl" />
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-lg font-semibold text-white">{displayTitle(book)}</h2>
                    {displayAuthors(book) && (
                      <p className="mt-1 truncate text-sm text-slate-300">{displayAuthors(book)}</p>
                    )}
                    {book.publishedDate && (
                      <p className="mt-0.5 text-xs text-slate-500">{book.publishedDate}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 ${SOURCE_BADGES[book.source] ?? 'bg-slate-500 text-white'}`}>
                        {book.source}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 ${FORMAT_BADGES[book.format] ?? 'bg-slate-500 text-white'}`}>
                        {book.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="mt-5 space-y-4 text-slate-300">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Size</span>
                      <span>{formatBytes(book.size)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Added</span>
                      <span>{formatDateShort(book.modifiedTime)}</span>
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
                      <div
                        className="h-2 rounded-full bg-sky-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, book.readingProgress))}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchOne(book)}
                    disabled={refetchingId === book.id}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {refetchingId === book.id
                      ? 'Fetching…'
                      : book.metadataSource
                      ? 'Re-fetch metadata'
                      : 'Fetch metadata'}
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/10">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Cover</th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('title')}
                  >
                    Title{sortArrow('title')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('author')}
                  >
                    Author{sortArrow('author')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('published')}
                  >
                    Published{sortArrow('published')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('format')}
                  >
                    Format{sortArrow('format')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('source')}
                  >
                    Source{sortArrow('source')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-white"
                    onClick={() => toggleSort('size')}
                  >
                    Size{sortArrow('size')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 text-right font-medium hover:text-white"
                    onClick={() => toggleSort('progress')}
                  >
                    Progress{sortArrow('progress')}
                  </th>
                  <th
                    className="cursor-pointer select-none px-4 py-3 font-medium hover:text-white"
                    onClick={() => toggleSort('added')}
                  >
                    Added{sortArrow('added')}
                  </th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedBooks.map((book) => (
                  <tr key={book.id} className="transition hover:bg-slate-800/60">
                    <td className="px-4 py-3">
                      <Link href={`/reader/${book.id}`}>
                        <Cover book={book} className="h-14 w-10 overflow-hidden rounded-md text-xs" />
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/reader/${book.id}`} className="font-medium text-white hover:text-sky-300">
                        {displayTitle(book)}
                      </Link>
                      {book.series && (
                        <div className="text-xs text-slate-500">
                          {book.series}
                          {book.seriesIndex !== undefined ? ` #${book.seriesIndex}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{displayAuthors(book) || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{book.publishedDate ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${FORMAT_BADGES[book.format] ?? 'bg-slate-500 text-white'}`}>
                        {book.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${SOURCE_BADGES[book.source] ?? 'bg-slate-500 text-white'}`}>
                        {book.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatBytes(book.size)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{Math.round(book.readingProgress)}%</td>
                    <td className="px-4 py-3 text-slate-400">{formatDateShort(book.modifiedTime)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => refetchOne(book)}
                        disabled={refetchingId === book.id}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
                        title={book.metadataSource ? 'Re-fetch metadata' : 'Fetch metadata'}
                      >
                        {refetchingId === book.id ? '…' : book.metadataSource ? '↻' : 'Fetch'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/10 transition">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Audiobooks</h2>
              <p className="mt-2 text-sm text-slate-400">Quick access to audiobook folders in Google Drive.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://drive.google.com/drive/folders/1SBqmfghmj5gqxWRnCrxbHP65I23ohlcQ"
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-white/10 bg-slate-950/80 p-5 transition hover:border-slate-500/40 hover:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-lg text-white">
                  🎧
                </span>
                <div>
                  <p className="text-lg font-semibold text-white">Outlander Series</p>
                  <p className="mt-1 text-sm text-slate-400">Open Drive folder</p>
                </div>
              </div>
            </a>

            <a
              href="https://drive.google.com/drive/folders/1NRY6dXCpILRzfG4yYTpisGqLnqx2ECEQ"
              target="_blank"
              rel="noreferrer"
              className="group rounded-3xl border border-white/10 bg-slate-950/80 p-5 transition hover:border-slate-500/40 hover:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-lg text-white">
                  🎧
                </span>
                <div>
                  <p className="text-lg font-semibold text-white">Other Audiobooks</p>
                  <p className="mt-1 text-sm text-slate-400">Open Drive folder</p>
                </div>
              </div>
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
