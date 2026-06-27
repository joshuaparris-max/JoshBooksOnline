'use client';

import { useEffect, useState } from 'react';
import AudioPlayer from './AudioPlayer';
import type { AudiobookEntry } from '@/types/books';

/**
 * A collapsible audio player docked to the bottom of the reader, so the user can
 * listen to the linked audiobook while reading the text edition.
 */
export default function DockedAudioPlayer({ audiobookId }: { audiobookId: string }) {
  const [audiobook, setAudiobook] = useState<AudiobookEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/library/audiobook/${audiobookId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('failed');
        const data = (await response.json()) as AudiobookEntry;
        if (!cancelled) setAudiobook(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audiobookId]);

  if (error) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
        >
          <span>🎧 {audiobook ? audiobook.title : 'Loading audiobook…'}</span>
          <span className="text-slate-400">{open ? 'Hide ▾' : 'Listen while reading ▴'}</span>
        </button>
        {open && audiobook && (
          <div className="max-h-[60vh] overflow-y-auto pb-3 pt-3">
            <AudioPlayer audiobook={audiobook} />
          </div>
        )}
      </div>
    </div>
  );
}
