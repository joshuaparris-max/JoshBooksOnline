'use client';

import { useMemo, useState } from 'react';
import type { BookMetadata } from '@/types/books';

interface MetadataEditorProps {
  /** Only the display name is needed — works for both ebooks and audiobooks. */
  book: { name: string };
  /** Pre-filled metadata — a pending online suggestion or the book's current metadata. */
  initial: BookMetadata;
  onClose: () => void;
  onSave: (metadata: BookMetadata) => Promise<void>;
}

/** Form state holds everything as strings for easy controlled inputs. */
interface FormState {
  title: string;
  authors: string;
  publishedDate: string;
  publisher: string;
  series: string;
  seriesIndex: string;
  categories: string;
  pageCount: string;
  language: string;
  isbn: string;
  description: string;
  coverUrl: string;
  googleBooksId?: string;
  openLibraryCoverId?: string;
}

function toForm(m: BookMetadata): FormState {
  return {
    title: m.title ?? '',
    authors: m.authors?.join(', ') ?? '',
    publishedDate: m.publishedDate ?? '',
    publisher: m.publisher ?? '',
    series: m.series ?? '',
    seriesIndex: m.seriesIndex !== undefined ? String(m.seriesIndex) : '',
    categories: m.categories?.join(', ') ?? '',
    pageCount: m.pageCount !== undefined ? String(m.pageCount) : '',
    language: m.language ?? '',
    isbn: m.isbn ?? '',
    description: m.description ?? '',
    coverUrl: m.coverUrl ?? '',
    googleBooksId: m.googleBooksId,
    openLibraryCoverId: m.openLibraryCoverId,
  };
}

function fromForm(f: FormState): BookMetadata {
  const splitList = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const num = (s: string) => {
    const n = Number(s);
    return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
  };

  return {
    title: f.title.trim() || undefined,
    authors: f.authors.trim() ? splitList(f.authors) : undefined,
    publishedDate: f.publishedDate.trim() || undefined,
    publisher: f.publisher.trim() || undefined,
    series: f.series.trim() || undefined,
    seriesIndex: num(f.seriesIndex),
    categories: f.categories.trim() ? splitList(f.categories) : undefined,
    pageCount: num(f.pageCount),
    language: f.language.trim() || undefined,
    isbn: f.isbn.trim() || undefined,
    description: f.description.trim() || undefined,
    coverUrl: f.coverUrl.trim() || undefined,
    googleBooksId: f.googleBooksId,
    openLibraryCoverId: f.openLibraryCoverId,
    metadataSource: 'manual',
  };
}

const FIELD =
  'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
const LABEL = 'block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1';

export default function MetadataEditor({ book, initial, onClose, onSave }: MetadataEditorProps) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<BookMetadata[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const prettyName = useMemo(
    () => book.name.replace(/\.(pdf|epub|txt|docx)$/i, '').replace(/[_]+/g, ' ').trim(),
    [book.name]
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const runSearch = async () => {
    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch('/api/library/metadata/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: book.name, query: searchQuery.trim() || undefined }),
      });
      if (!response.ok) throw new Error('Search failed');
      const data = (await response.json()) as { candidates: BookMetadata[] };
      setCandidates(data.candidates);
      if (data.candidates.length === 0) setSearchError('No matches found. Try a different search.');
    } catch {
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const applyCandidate = (c: BookMetadata) => {
    setForm(toForm({ ...c }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(fromForm(form));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Edit metadata</h2>
            <p className="truncate text-xs text-slate-500">{book.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 md:grid-cols-[1fr_auto]">
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Title</label>
              <input className={FIELD} value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Authors (comma separated)</label>
              <input className={FIELD} value={form.authors} onChange={(e) => set('authors', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Published</label>
                <input
                  className={FIELD}
                  value={form.publishedDate}
                  onChange={(e) => set('publishedDate', e.target.value)}
                  placeholder="e.g. 2019 or 2019-05-01"
                />
              </div>
              <div>
                <label className={LABEL}>Publisher</label>
                <input className={FIELD} value={form.publisher} onChange={(e) => set('publisher', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Series</label>
                <input className={FIELD} value={form.series} onChange={(e) => set('series', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Series #</label>
                <input className={FIELD} value={form.seriesIndex} onChange={(e) => set('seriesIndex', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Pages</label>
                <input className={FIELD} value={form.pageCount} onChange={(e) => set('pageCount', e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Language</label>
                <input className={FIELD} value={form.language} onChange={(e) => set('language', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Tags / Categories (comma separated)</label>
              <input className={FIELD} value={form.categories} onChange={(e) => set('categories', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>ISBN</label>
              <input className={FIELD} value={form.isbn} onChange={(e) => set('isbn', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Cover image URL</label>
              <input
                className={FIELD}
                value={form.coverUrl}
                onChange={(e) =>
                  // Manually changing the cover means we can no longer rely on the stored ids
                  setForm((f) => ({ ...f, coverUrl: e.target.value, googleBooksId: undefined, openLibraryCoverId: undefined }))
                }
              />
            </div>
            <div>
              <label className={LABEL}>Description</label>
              <textarea
                className={`${FIELD} h-28 resize-y`}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>
          </div>

          {/* Cover preview */}
          <div className="hidden w-40 shrink-0 md:block">
            <label className={LABEL}>Cover</label>
            <div className="aspect-[2/3] w-40 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
              {form.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverUrl} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-slate-600">
                  No cover
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Online search */}
        <div className="border-t border-white/10 px-6 py-5">
          <p className="mb-2 text-sm font-semibold text-slate-200">Search online for metadata</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={FIELD}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
              placeholder={`Default: "${prettyName}"`}
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="shrink-0 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:bg-slate-700"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {searchError && <p className="mt-2 text-sm text-rose-300">{searchError}</p>}

          {candidates && candidates.length > 0 && (
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {candidates.map((c, index) => (
                <button
                  key={`${c.googleBooksId ?? c.openLibraryCoverId ?? c.title}-${index}`}
                  type="button"
                  onClick={() => applyCandidate(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-left transition hover:border-sky-500/50 hover:bg-slate-800"
                >
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-slate-800">
                    {c.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{c.title}</p>
                    <p className="truncate text-xs text-slate-400">{c.authors?.join(', ') || 'Unknown author'}</p>
                    <p className="text-xs text-slate-500">
                      {[c.publishedDate, c.publisher].filter(Boolean).join(' · ')}
                      <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5">
                        {c.metadataSource === 'google-books' ? 'Google Books' : 'Open Library'}
                      </span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:bg-slate-700"
          >
            {saving ? 'Saving…' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  );
}
