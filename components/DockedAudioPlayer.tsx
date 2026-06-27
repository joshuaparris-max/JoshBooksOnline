'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AudioPlayer, { fmtSeconds, type AudioPlayerHandle, type PlaybackState } from './AudioPlayer';
import type { AudiobookEntry } from '@/types/books';

/**
 * A collapsible audio player docked to the bottom of the reader.
 *
 * Fix: AudioPlayer stays mounted (and audio keeps playing) when the dock
 * is collapsed. Only the UI panel is hidden via CSS — the <audio> element is
 * never unmounted while playback is active.
 */
export default function DockedAudioPlayer({ audiobookId }: { audiobookId: string }) {
  const [audiobook, setAudiobook] = useState<AudiobookEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const playerRef = useRef<AudioPlayerHandle>(null);

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

  const handlePlaybackStateChange = useCallback((state: PlaybackState) => {
    setPlaybackState(state);
  }, []);

  if (error) return null;

  const isActive = !!(playbackState && playbackState.trackCount > 0);
  const shortTrackName = playbackState?.trackName.replace(/\.[^.]+$/, '') ?? '';

  // Collapsed-bar content changes based on whether audio has ever loaded + is playing
  const collapsedLabel = (() => {
    if (!audiobook) return 'Loading audiobook…';
    if (!isActive) return audiobook.title;
    if (playbackState.playing)
      return `${audiobook.title} — ${shortTrackName} · ${fmtSeconds(playbackState.time)} / ${fmtSeconds(playbackState.duration)}`;
    return `${audiobook.title} — ${shortTrackName} · Paused`;
  })();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-2">
        {/* Header row — always visible */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex flex-1 items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <span className="truncate">🎧 {collapsedLabel}</span>
            <span className="ml-2 shrink-0 text-slate-400">
              {open ? 'Hide controls ▾' : 'Show controls ▴'}
            </span>
          </button>

          {/* Mini play/pause button — only when collapsed and a track is loaded */}
          {!open && isActive && (
            <button
              type="button"
              aria-label={playbackState.playing ? 'Pause' : 'Play'}
              onClick={() => playerRef.current?.togglePlay()}
              className="shrink-0 rounded-full bg-sky-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              {playbackState.playing ? '⏸' : '▶'}
            </button>
          )}
        </div>

        {/* AudioPlayer — mounted once the audiobook is loaded; hidden (not unmounted) when collapsed.
            display:none preserves the <audio> element so playback never stops. */}
        {audiobook && (
          <div className={open ? 'max-h-[60vh] overflow-y-auto pb-3 pt-3' : 'hidden'}>
            <AudioPlayer
              ref={playerRef}
              audiobook={audiobook}
              docked
              onPlaybackStateChange={handlePlaybackStateChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
