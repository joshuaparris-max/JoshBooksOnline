'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getBaseYoutubeCatalog } from '@/lib/youtubeCatalog';
import { useYoutubeCatalog } from '@/lib/useYoutubeCatalog';
import type { BookEntry, AudiobookEntry, Audiobook } from '@/types/books';

// ── Types ──────────────────────────────────────────────────────────────────

interface YtSuggestion {
  kind: 'youtube';
  audiobook: Audiobook;
  score: number;
  reason: string;
  matchedBookTitle?: string;
}

interface DriveSuggestion {
  kind: 'drive';
  searchQuery: string;
  reason: string;
  hint: string;
}

// ── Algorithm ──────────────────────────────────────────────────────────────

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function wordsOf(s: string) {
  return normalise(s).split(/\s+/).filter((w) => w.length > 3);
}

function overlap(a: string[], b: string[]) {
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length;
}

function buildYtSuggestions(
  books: BookEntry[],
  driveAudiobooks: AudiobookEntry[],
  ytCatalog: Audiobook[],
): YtSuggestion[] {
  // IDs the user already has in their YouTube catalog
  const existingIds = new Set(ytCatalog.map((a) => a.id));
  const baseCatalog = getBaseYoutubeCatalog().filter((yt) => !existingIds.has(yt.id));

  const ebookAuthors: string[] = [];
  const ebookTitles: string[] = [];

  for (const b of books) {
    const title = b.title ?? b.name.replace(/\.[^.]+$/, '');
    ebookTitles.push(normalise(title));
    for (const a of b.authors ?? []) ebookAuthors.push(normalise(a));
  }
  for (const a of driveAudiobooks) {
    for (const auth of a.authors ?? []) ebookAuthors.push(normalise(auth));
  }

  const seen = new Set<string>();
  const suggestions: YtSuggestion[] = [];

  for (const yt of baseCatalog) {
    if (seen.has(yt.id)) continue;

    let score = 0;
    let reason = '';
    let matchedBookTitle: string | undefined;

    const ytWords = wordsOf(yt.title);
    const ytAuthorWords = wordsOf(yt.author);

    // Title match via catalogueMatches
    for (const cm of yt.catalogueMatches) {
      const cmNorm = normalise(cm);
      for (let i = 0; i < books.length; i++) {
        const title = normalise(books[i].title ?? books[i].name.replace(/\.[^.]+$/, ''));
        if (cmNorm === title || title.includes(cmNorm) || cmNorm.includes(title.split(' ')[0])) {
          score = Math.max(score, 20);
          matchedBookTitle = books[i].title ?? books[i].name;
          reason = `Matches your ebook "${matchedBookTitle}"`;
          break;
        }
      }
      if (score >= 20) break;
    }

    // Title word overlap
    if (score < 20) {
      for (const ebTitle of ebookTitles) {
        const ebWords = wordsOf(ebTitle);
        const ov = overlap(ytWords, ebWords);
        if (ov >= 2 && score < 15) {
          score = Math.max(score, 12);
          reason = reason || `Title keywords match your library`;
        }
      }
    }

    // Author match
    if (score < 15) {
      for (const ebAuthor of ebookAuthors) {
        const ebAuthWords = wordsOf(ebAuthor);
        const ov = overlap(ytAuthorWords, ebAuthWords);
        if (ov >= 1 && ebAuthWords.length > 0) {
          score = Math.max(score, 8);
          reason = reason || `By ${yt.author} — author in your library`;
        }
      }
    }

    if (score >= 8) {
      seen.add(yt.id);
      suggestions.push({ kind: 'youtube', audiobook: yt, score, reason, matchedBookTitle });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 60);
}

function buildDriveSuggestions(books: BookEntry[]): DriveSuggestion[] {
  const suggestions: DriveSuggestion[] = [];

  // Suggest searching Drive for ebooks the user has as one format but maybe not others
  const pdfIds = new Set(books.filter((b) => b.format === 'pdf').map((b) => normalise(b.title ?? b.name)));
  const epubIds = new Set(books.filter((b) => b.format === 'epub').map((b) => normalise(b.title ?? b.name)));

  for (const b of books) {
    const title = b.title ?? b.name.replace(/\.[^.]+$/, '');
    const normTitle = normalise(title);

    // Has PDF but no EPUB
    if (b.format === 'pdf' && !epubIds.has(normTitle)) {
      suggestions.push({
        kind: 'drive',
        searchQuery: `"${title}" epub`,
        reason: `You have the PDF — find the EPUB version`,
        hint: `Search Google Drive for "${title}" epub to add the reflowable edition`,
      });
    }

    // Has EPUB but no PDF
    if (b.format === 'epub' && !pdfIds.has(normTitle)) {
      suggestions.push({
        kind: 'drive',
        searchQuery: `"${title}" pdf`,
        reason: `You have the EPUB — find the PDF version`,
        hint: `Search Google Drive for "${title}" pdf to add the fixed-layout edition`,
      });
    }
  }

  // Also suggest classic public-domain titles that fit if library is small
  if (books.length < 30) {
    const classics = [
      { title: 'Pride and Prejudice', author: 'Jane Austen' },
      { title: 'Moby Dick', author: 'Herman Melville' },
      { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
      { title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' },
      { title: 'War and Peace', author: 'Leo Tolstoy' },
      { title: 'Les Misérables', author: 'Victor Hugo' },
    ];
    const existingTitles = new Set(books.map((b) => normalise(b.title ?? b.name)));
    for (const c of classics) {
      if (!existingTitles.has(normalise(c.title))) {
        suggestions.push({
          kind: 'drive',
          searchQuery: `"${c.title}" ${c.author} epub OR pdf`,
          reason: `Classic you might enjoy`,
          hint: `"${c.title}" by ${c.author} — free to download from Project Gutenberg`,
        });
      }
    }
  }

  return suggestions.slice(0, 20);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SuggestionsPage() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [driveAudiobooks, setDriveAudiobooks] = useState<AudiobookEntry[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [ytFilter, setYtFilter] = useState<'all' | 'full' | 'preview'>('all');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const youtube = useYoutubeCatalog();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/library', { cache: 'no-store' }).then((r) => r.json() as Promise<BookEntry[]>),
      fetch('/api/library/audiobooks', { cache: 'no-store' })
        .then((r) => r.json() as Promise<AudiobookEntry[]>)
        .catch(() => [] as AudiobookEntry[]),
    ])
      .then(([bks, abs]) => {
        if (!cancelled) {
          setBooks(bks);
          setDriveAudiobooks(abs);
        }
      })
      .catch(() => { if (!cancelled) setBooks([]); })
      .finally(() => { if (!cancelled) setLoadingBooks(false); });
    return () => { cancelled = true; };
  }, []);

  const ytSuggestions = useMemo<YtSuggestion[]>(() => {
    if (!books || !youtube.hydrated) return [];
    return buildYtSuggestions(books, driveAudiobooks, youtube.catalog);
  }, [books, driveAudiobooks, youtube.catalog, youtube.hydrated]);

  const driveSuggestions = useMemo<DriveSuggestion[]>(() => {
    if (!books) return [];
    return buildDriveSuggestions(books);
  }, [books]);

  const filteredYt = useMemo(() => {
    if (ytFilter === 'full') return ytSuggestions.filter((s) => s.audiobook.availabilityType === 'full_public_domain');
    if (ytFilter === 'preview') return ytSuggestions.filter((s) => s.audiobook.availabilityType === 'official_preview');
    return ytSuggestions;
  }, [ytSuggestions, ytFilter]);

  const addYt = (ab: Audiobook) => {
    youtube.addYoutubeCustom(ab);
    setAddedIds((prev) => new Set(prev).add(ab.id));
  };

  const loading = loadingBooks || !youtube.hydrated;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Import suggestions</h1>
              <p className="mt-2 text-slate-400">
                Based on the {books?.length ?? '…'} books and {driveAudiobooks.length} audiobooks already in your library.
              </p>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              ← Back to library
            </Link>
          </div>
        </section>

        {/* YouTube audiobook suggestions */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">🎧 YouTube audiobooks</h2>
              <p className="mt-1 text-sm text-slate-400">
                Free audiobooks from YouTube that match your existing library — click to add them.
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              {(['all', 'full', 'preview'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setYtFilter(f)}
                  className={`rounded-full px-4 py-1.5 font-semibold transition ${ytFilter === f ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  {f === 'all' ? 'All' : f === 'full' ? 'Full only' : 'Previews'}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-slate-900/80" />
              ))}
            </div>
          )}

          {!loading && filteredYt.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
              <p className="text-lg font-medium">No YouTube suggestions found</p>
              <p className="mt-2 text-sm">
                {ytFilter !== 'all'
                  ? 'Try switching the filter to "All".'
                  : 'Add more ebooks to your library to generate personalised suggestions.'}
              </p>
            </div>
          )}

          {!loading && filteredYt.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredYt.map((s) => {
                const ab = s.audiobook;
                const alreadyAdded = addedIds.has(ab.id);
                return (
                  <div
                    key={ab.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-slate-500/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white line-clamp-2">{ab.title}</p>
                      <p className="mt-0.5 text-sm text-slate-400">{ab.author}</p>
                      <p className="mt-1 text-xs text-sky-400">{s.reason}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ab.availabilityType === 'full_public_domain' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                        {ab.availabilityType === 'full_public_domain' ? 'Full audiobook' : 'Preview'}
                      </span>
                      {ab.durationLabel && (
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">{ab.durationLabel}</span>
                      )}
                      <div className="ml-auto flex gap-2">
                        <a
                          href={ab.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                        >
                          Preview ↗
                        </a>
                        <button
                          type="button"
                          onClick={() => addYt(ab)}
                          disabled={alreadyAdded}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${alreadyAdded ? 'bg-emerald-700/40 text-emerald-300' : 'bg-sky-600 text-white hover:bg-sky-500'}`}
                        >
                          {alreadyAdded ? '✓ Added' : '+ Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Google Drive search suggestions */}
        {driveSuggestions.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-white">📁 Google Drive searches</h2>
              <p className="mt-1 text-sm text-slate-400">
                Search queries to find more books to add to your Drive library.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {driveSuggestions.map((s, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <p className="text-sm font-semibold text-white">{s.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">{s.hint}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`https://drive.google.com/drive/search?q=${encodeURIComponent(s.searchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                    >
                      Search Drive ↗
                    </a>
                    <a
                      href={`https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(s.searchQuery.replace(/"/g, '').replace(/ epub OR pdf$/, ''))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
                    >
                      Gutenberg ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
