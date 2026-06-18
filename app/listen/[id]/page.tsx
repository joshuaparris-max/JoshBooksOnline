'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AudiobookEntry } from '@/types/books';

const AudioPlayer = dynamic(() => import('@/components/AudioPlayer'), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300">
      Loading player…
    </div>
  ),
});

export default function ListenPage() {
  const params = useParams() as Record<string, string> | null;
  const router = useRouter();
  const id = params?.id;
  const [audiobook, setAudiobook] = useState<AudiobookEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkedTextId, setLinkedTextId] = useState<string | undefined>(undefined);

  // Resolve the linked text edition from the local link map (reverse lookup)
  useEffect(() => {
    if (!id) return;
    try {
      const raw = window.localStorage.getItem('joshbooks-links');
      if (raw) {
        const links = JSON.parse(raw) as Record<string, string>;
        const ebookId = Object.keys(links).find((k) => links[k] === id);
        if (ebookId) setLinkedTextId(ebookId);
      }
    } catch {
      // ignore
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/library/audiobook/${id}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('failed');
        const data = (await response.json()) as AudiobookEntry;
        if (!cancelled) setAudiobook(data);
      } catch {
        if (!cancelled) setError('Unable to load this audiobook.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        ) : !audiobook ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-300">
            Loading audiobook…
          </div>
        ) : (
          <>
            <AudioPlayer audiobook={audiobook} />
            {(linkedTextId ?? audiobook.linkedTextId) && (
              <Link
                href={`/reader/${linkedTextId ?? audiobook.linkedTextId}`}
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
