'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Audiobook, AudiobookEntry } from '@/types/books';
import {
  catalogIdFromListenId,
  findYoutubeByCatalogId,
  isYoutubeListenId,
} from '@/lib/youtubeCatalog';
import { AudiobookCard } from '@/components/AudiobookCard';

const AudioPlayer = dynamic(() => import('@/components/AudioPlayer'), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300">
      Loading player…
    </div>
  ),
});

function readYoutubeLinks(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem('joshbooks-youtube-links');
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function readYoutubeCatalogState() {
  try {
    const removed = JSON.parse(
      window.localStorage.getItem('joshbooks-youtube-removed') ?? '[]'
    ) as string[];
    const edits = JSON.parse(
      window.localStorage.getItem('joshbooks-youtube-edits') ?? '{}'
    ) as Record<string, Partial<Audiobook>>;
    const custom = JSON.parse(
      window.localStorage.getItem('joshbooks-youtube-custom') ?? '[]'
    ) as Audiobook[];
    return { removedIds: removed, edits, custom };
  } catch {
    return { removedIds: [], edits: {}, custom: [] };
  }
}

export default function ListenPage() {
  const params = useParams() as Record<string, string> | null;
  const router = useRouter();
  const id = params?.id;
  const [audiobook, setAudiobook] = useState<AudiobookEntry | null>(null);
  const [youtubeAudiobook, setYoutubeAudiobook] = useState<Audiobook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedTextId, setLinkedTextId] = useState<string | undefined>(undefined);

  const isYoutube = id ? isYoutubeListenId(id) : false;

  // Resolve linked text edition from Drive links or YouTube links
  useEffect(() => {
    if (!id) return;
    try {
      const driveLinks = window.localStorage.getItem('joshbooks-links');
      if (driveLinks) {
        const links = JSON.parse(driveLinks) as Record<string, string>;
        const ebookId = Object.keys(links).find((k) => links[k] === id);
        if (ebookId) {
          setLinkedTextId(ebookId);
          return;
        }
      }
      if (isYoutube) {
        const catalogId = catalogIdFromListenId(id);
        const ytLinks = readYoutubeLinks();
        const ebookId = Object.keys(ytLinks).find((k) => ytLinks[k] === catalogId);
        if (ebookId) setLinkedTextId(ebookId);
      }
    } catch {
      // ignore
    }
  }, [id, isYoutube]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    if (isYoutube) {
      const catalogId = catalogIdFromListenId(id);
      if (!catalogId) {
        setError('Invalid YouTube audiobook id.');
        return;
      }
      const state = readYoutubeCatalogState();
      const entry = findYoutubeByCatalogId(catalogId, state);
      if (!entry) {
        setError('This YouTube audiobook is not in your catalog.');
        return;
      }
      setYoutubeAudiobook(entry);
      setAudiobook(null);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`/api/library/audiobook/${id}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('failed');
        const data = (await response.json()) as AudiobookEntry;
        if (!cancelled) {
          setAudiobook(data);
          setYoutubeAudiobook(null);
        }
      } catch {
        if (!cancelled) setError('Unable to load this audiobook.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, isYoutube]);

  const linkedFromCatalog = useMemo(() => {
    if (!id || !isYoutube) return undefined;
    const catalogId = catalogIdFromListenId(id);
    if (!catalogId) return undefined;
    const ytLinks = readYoutubeLinks();
    return Object.keys(ytLinks).find((k) => ytLinks[k] === catalogId);
  }, [id, isYoutube]);

  const textEditionId = linkedTextId ?? linkedFromCatalog ?? audiobook?.linkedTextId;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <button
          type="button"
          onClick={() => router.push('/library')}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          ← Back to library
        </button>

        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 text-center text-rose-200">
            {error}
          </div>
        ) : isYoutube && youtubeAudiobook ? (
          <>
            <AudiobookCard audiobook={youtubeAudiobook} />
            {textEditionId && (
              <Link
                href={`/reader/${textEditionId}`}
                className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-sky-300 transition hover:bg-white/10"
              >
                📖 Read the text edition →
              </Link>
            )}
          </>
        ) : !audiobook ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300">
            Loading audiobook…
          </div>
        ) : (
          <>
            <AudioPlayer audiobook={audiobook} />
            {textEditionId && (
              <Link
                href={`/reader/${textEditionId}`}
                className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-sky-300 transition hover:bg-white/10"
              >
                📖 Read the text edition →
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
