'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { MOVIES } from '@/lib/movies';
import { ONLINE_EBOOKS } from '@/lib/onlineEbooks';
import { getBaseYoutubeCatalog, findYoutubeByCatalogId, mergeYoutubeCatalog } from '@/lib/youtubeCatalog';
import type { YoutubeCatalogState } from '@/lib/youtubeCatalog';
import type { Audiobook, AudiobookEntry, BookEntry, MovieEntry, OnlineEbook } from '@/types/books';

type MediaKind = 'ebook' | 'audiobook' | 'movie' | 'online-ebook' | 'online-audiobook';
type DetailItem =
  | { kind: 'ebook'; item: BookEntry }
  | { kind: 'audiobook'; item: AudiobookEntry }
  | { kind: 'movie'; item: MovieEntry }
  | { kind: 'online-ebook'; item: OnlineEbook }
  | { kind: 'online-audiobook'; item: Audiobook };

const KIND_LABELS: Record<MediaKind, string> = {
  ebook: 'Ebook',
  audiobook: 'Audiobook',
  movie: 'Movie',
  'online-ebook': 'Free online ebook',
  'online-audiobook': 'YouTube audiobook',
};

function isMediaKind(value: string): value is MediaKind {
  return ['ebook', 'audiobook', 'movie', 'online-ebook', 'online-audiobook'].includes(value);
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
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

function formatBytes(bytes?: number) {
  if (!bytes) return undefined;
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatDate(iso?: string) {
  if (!iso) return undefined;
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(iso));
}

function displayBookTitle(book: BookEntry) {
  return book.title || book.name.replace(/\.[^.]+$/, '');
}

function getTitle(detail: DetailItem) {
  switch (detail.kind) {
    case 'ebook':
      return displayBookTitle(detail.item);
    case 'audiobook':
    case 'movie':
    case 'online-ebook':
    case 'online-audiobook':
      return detail.item.title;
  }
}

function getSubtitle(detail: DetailItem) {
  switch (detail.kind) {
    case 'ebook':
      return detail.item.authors?.join(', ') || detail.item.source;
    case 'audiobook':
      return detail.item.authors?.join(', ') || detail.item.source;
    case 'movie':
      return [detail.item.year, detail.item.collection].filter(Boolean).join(' · ') || 'Google Drive movie';
    case 'online-ebook':
      return detail.item.author;
    case 'online-audiobook':
      return detail.item.author;
  }
}

function getPrimaryAction(detail: DetailItem) {
  switch (detail.kind) {
    case 'ebook':
      return { href: `/reader/${encodeURIComponent(detail.item.id)}`, label: 'Read' };
    case 'audiobook':
      return { href: `/listen/${encodeURIComponent(detail.item.id)}`, label: 'Listen' };
    case 'movie':
      return {
        href: `/watch/${encodeURIComponent(detail.item.driveFileId)}?title=${encodeURIComponent(detail.item.title)}`,
        label: 'Watch',
      };
    case 'online-ebook':
      return {
        href: `/read-online?url=${encodeURIComponent(detail.item.url)}&format=${detail.item.format}&title=${encodeURIComponent(detail.item.title)}`,
        label: 'Read free',
      };
    case 'online-audiobook':
      return { href: detail.item.youtubeUrl, label: 'Open on YouTube', external: true };
  }
}

function findRelated(detail: DetailItem) {
  const title = getTitle(detail).toLowerCase();
  if (detail.kind === 'movie' && detail.item.collection) {
    return MOVIES.filter((movie) => movie.collection === detail.item.collection && movie.id !== detail.item.id)
      .slice(0, 6)
      .map((movie) => ({ href: `/media/movie/${movie.id}`, label: movie.title, meta: movie.year?.toString() }));
  }

  if (detail.kind === 'online-ebook') {
    return mergeYoutubeCatalog(readYoutubeCatalogState())
      .filter((audio) => audio.catalogueMatches.some((match) => match.toLowerCase().includes(title)))
      .slice(0, 4)
      .map((audio) => ({ href: `/media/online-audiobook/${encodeURIComponent(audio.id)}`, label: audio.title, meta: audio.author }));
  }

  if (detail.kind === 'online-audiobook') {
    return ONLINE_EBOOKS.filter((book) =>
      detail.item.catalogueMatches.some((match) => book.title.toLowerCase().includes(match.toLowerCase()) || match.toLowerCase().includes(book.title.toLowerCase()))
    )
      .slice(0, 4)
      .map((book) => ({ href: `/media/online-ebook/${book.id}`, label: book.title, meta: book.author }));
  }

  return [];
}

function readYoutubeCatalogState(): YoutubeCatalogState {
  try {
    return {
      removedIds: JSON.parse(window.localStorage.getItem('joshbooks-youtube-removed') ?? '[]') as string[],
      edits: JSON.parse(window.localStorage.getItem('joshbooks-youtube-edits') ?? '{}') as Record<string, Partial<Audiobook>>,
      custom: JSON.parse(window.localStorage.getItem('joshbooks-youtube-custom') ?? '[]') as Audiobook[],
    };
  } catch {
    return { removedIds: [], edits: {}, custom: [] };
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load media details.');
  return (await response.json()) as T;
}

export default function MediaDetailPage() {
  const params = useParams() as Record<string, string | string[]> | null;
  const kindParam = Array.isArray(params?.kind) ? params?.kind[0] : params?.kind;
  const idParam = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const kind = kindParam && isMediaKind(kindParam) ? kindParam : undefined;
  const id = idParam ? decodeURIComponent(idParam) : undefined;

  const [detail, setDetail] = useState<DetailItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!kind || !id) {
        setError('This media link is invalid.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (kind === 'movie') {
          const movie = MOVIES.find((entry) => entry.id === id);
          if (!movie) throw new Error('Movie not found.');
          if (!cancelled) setDetail({ kind, item: movie });
          return;
        }

        if (kind === 'online-ebook') {
          const ebook = ONLINE_EBOOKS.find((entry) => entry.id === id);
          if (!ebook) throw new Error('Online ebook not found.');
          if (!cancelled) setDetail({ kind, item: ebook });
          return;
        }

        if (kind === 'online-audiobook') {
          const audiobook = findYoutubeByCatalogId(id, readYoutubeCatalogState());
          if (!audiobook) throw new Error('Online audiobook not found.');
          if (!cancelled) setDetail({ kind, item: audiobook });
          return;
        }

        if (kind === 'ebook') {
          const books = await fetchJson<BookEntry[]>('/api/library');
          const book = books.find((entry) => entry.id === id);
          if (!book) throw new Error('Ebook not found.');
          if (!cancelled) setDetail({ kind, item: book });
          return;
        }

        const audiobook = await fetchJson<AudiobookEntry>(`/api/library/audiobook/${encodeURIComponent(id)}`);
        if (!cancelled) setDetail({ kind, item: audiobook });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load media details.');
          setDetail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const related = useMemo(() => (detail ? findRelated(detail) : []), [detail]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-slate-300">
          Loading media details…
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
        <div className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-rose-100">
          <p>{error ?? 'Media item not found.'}</p>
          <Link href="/library" className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
            Back to library
          </Link>
        </div>
      </main>
    );
  }

  const title = getTitle(detail);
  const subtitle = getSubtitle(detail);
  const action = getPrimaryAction(detail);
  const coverUrl = detail.kind === 'ebook' || detail.kind === 'audiobook' || detail.kind === 'online-ebook' ? detail.item.coverUrl : undefined;

  const facts =
    detail.kind === 'ebook'
      ? [
          ['Format', detail.item.format.toUpperCase()],
          ['Size', formatBytes(detail.item.size)],
          ['Progress', `${detail.item.readingProgress ?? 0}%`],
          ['Added', formatDate(detail.item.modifiedTime)],
          ['Source', detail.item.source],
        ]
      : detail.kind === 'audiobook'
        ? [
            [
              'Type',
              detail.item.isManualGroup
                ? 'Merged group'
                : (detail.item.tracks?.length ?? 0) > 1
                  ? 'Multi-track audiobook'
                  : detail.item.isFolder
                    ? 'Folder audiobook'
                    : 'Single audio file',
            ],
            ['Tracks', detail.item.tracks?.length?.toString()],
            ['Source', detail.item.source],
            ['Published', detail.item.publishedDate],
          ]
        : detail.kind === 'movie'
          ? [
              ['Year', detail.item.year?.toString()],
              ['Collection', detail.item.collection],
              ['Source', 'Google Drive'],
            ]
          : detail.kind === 'online-ebook'
            ? [
                ['Format', detail.item.format.toUpperCase()],
                ['Category', detail.item.category],
                ['Source', detail.item.source],
              ]
            : [
                ['Availability', detail.item.displayLabel ?? detail.item.availabilityType],
                ['Source', detail.item.source],
                ['Duration', detail.item.durationLabel],
              ];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/library" className="inline-flex rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          ← Back to library
        </Link>

        <section className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20 md:grid-cols-[180px_1fr]">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-64 w-44 rounded-2xl object-cover" />
          ) : (
            <div
              className="flex h-64 w-44 items-center justify-center rounded-2xl text-4xl font-semibold text-white"
              style={{ backgroundColor: getColorFromTitle(title) }}
              aria-hidden="true"
            >
              {getInitials(title)}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">{KIND_LABELS[detail.kind]}</p>
              <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
              {subtitle && <p className="mt-2 text-slate-300">{subtitle}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noopener noreferrer' : undefined}
                className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                {action.label}
              </Link>
              {detail.kind === 'movie' && (
                <a
                  href={detail.item.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Open in Drive
                </a>
              )}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              {facts
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-100">{value}</dd>
                  </div>
                ))}
            </dl>

            {detail.kind === 'audiobook' && (detail.item.tracks?.length ?? 0) > 1 && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                  Chapters
                </h2>
                <ol className="mt-3 max-h-96 space-y-1 overflow-y-auto">
                  {detail.item.tracks?.map((track, index) => (
                    <li key={track.id}>
                      <Link
                        href={`/listen/${encodeURIComponent(detail.item.id)}?track=${index}`}
                        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                      >
                        <span className="w-7 shrink-0 text-right text-xs text-slate-500">
                          {index + 1}
                        </span>
                        <span className="truncate">{track.name.replace(/\.[^.]+$/, '')}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {'description' in detail.item && detail.item.description && (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">{detail.item.description}</p>
            )}
            {detail.kind === 'online-audiobook' && detail.item.rightsNote && (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">{detail.item.rightsNote}</p>
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <h2 className="text-lg font-semibold text-white">Related items</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                  <p className="font-medium text-white">{item.label}</p>
                  {item.meta && <p className="mt-1 text-sm text-slate-400">{item.meta}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
