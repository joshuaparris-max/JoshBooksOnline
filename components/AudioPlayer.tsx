'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudiobookEntry } from '@/types/books';

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'm4a' || ext === 'm4b' || ext === 'mp4' || ext === 'aac') return 'audio/mp4';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'flac') return 'audio/flac';
  return 'audio/mpeg';
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const RATE_KEY = 'joshbooks-audio-speed';

function getSavedRate(): number {
  try {
    const saved = parseFloat(window.localStorage.getItem(RATE_KEY) ?? '');
    return SPEEDS.includes(saved) ? saved : 1;
  } catch {
    return 1;
  }
}

export default function AudioPlayer({ audiobook }: { audiobook: AudiobookEntry }) {
  const tracks = audiobook.tracks ?? [];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(
    audiobook.audioTrack !== undefined && audiobook.audioTrack < tracks.length ? audiobook.audioTrack : 0
  );
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const resumePos = useRef(audiobook.audioPosition ?? 0);
  const lastSave = useRef(0);
  const [resumeLoaded, setResumeLoaded] = useState(false);

  const current = tracks[index];

  // Fetch the cross-device resume point (Redis) before loading any audio.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/audio-progress?id=${encodeURIComponent(audiobook.id)}`, {
          cache: 'no-store',
        });
        const { progress } = (await response.json()) as {
          progress: { track?: number; position?: number } | null;
        };
        if (!cancelled && progress) {
          if (typeof progress.track === 'number' && progress.track < tracks.length) setIndex(progress.track);
          if (typeof progress.position === 'number') resumePos.current = progress.position;
        }
      } catch {
        // fall back to the Drive-provided resume already in state
      } finally {
        if (!cancelled) setResumeLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audiobook.id]);

  // Load the current track's stream; resume position applies on first load.
  useEffect(() => {
    if (!resumeLoaded) return;
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = `/api/stream/${current.id}?mime=${encodeURIComponent(mimeFromName(current.name))}`;
    audio.playbackRate = rate;
    audio.load();
    const onLoaded = () => {
      if (resumePos.current > 0) {
        audio.currentTime = resumePos.current;
        resumePos.current = 0;
      }
      if (playing) audio.play().catch(() => {});
    };
    audio.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, resumeLoaded]);

  // Load persisted speed on mount
  useEffect(() => {
    const saved = getSavedRate();
    if (saved !== 1) setRate(saved);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
    try { window.localStorage.setItem(RATE_KEY, String(rate)); } catch { /* ignore */ }
  }, [rate]);

  const save = (force = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 8000) return;
    lastSave.current = now;
    // Cross-device resume (Redis); best-effort Drive sync too.
    const body = JSON.stringify({ id: audiobook.id, track: index, position: Math.floor(audio.currentTime) });
    fetch('/api/audio-progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(
      () => {}
    );
    fetch('/api/library/audio-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});
  };

  // Save on page exit via sendBeacon (fire-and-forget, doesn't block navigation or affect session)
  useEffect(() => {
    const onExit = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const body = JSON.stringify({ id: audiobook.id, track: index, position: Math.floor(audio.currentTime) });
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/audio-progress', blob);
      navigator.sendBeacon('/api/library/audio-progress', blob);
    };
    window.addEventListener('pagehide', onExit);
    return () => window.removeEventListener('pagehide', onExit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts: Space = play/pause, ←/→ = skip 30s, ,/. = prev/next track
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { audio.play().catch(() => {}); setPlaying(true); }
    else { audio.pause(); setPlaying(false); save(true); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const a = audioRef.current;
        if (a) a.currentTime = Math.max(0, a.currentTime - 30);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const a = audioRef.current;
        if (a) a.currentTime = Math.min(a.duration || 0, a.currentTime + 30);
      } else if (e.key === ',' && tracks.length > 1) {
        setIndex((i) => Math.max(0, i - 1));
        setPlaying(true);
      } else if (e.key === '.' && tracks.length > 1) {
        setIndex((i) => Math.min(tracks.length - 1, i + 1));
        setPlaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, tracks.length]);

  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  };

  const selectTrack = (i: number) => {
    resumePos.current = 0;
    setIndex(i);
    setPlaying(true);
  };

  const onEnded = () => {
    if (index < tracks.length - 1) setIndex((i) => i + 1);
    else {
      setPlaying(false);
      save(true);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center text-slate-400">
        No audio tracks found in this audiobook.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a) {
            setTime(a.currentTime);
            save();
          }
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a) setDuration(a.duration || 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
      />

      {/* Now playing */}
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
        <div className="flex items-start gap-4">
          {audiobook.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={audiobook.coverUrl} alt="" className="h-24 w-16 rounded-xl object-cover" />
          ) : (
            <div className="flex h-24 w-16 items-center justify-center rounded-xl bg-sky-600 text-2xl">🎧</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white">{audiobook.title}</h1>
            {audiobook.authors && <p className="text-sm text-slate-400">{audiobook.authors.join(', ')}</p>}
            <p className="mt-1 truncate text-sm text-slate-300">
              Track {index + 1} of {tracks.length}: {current?.name}
            </p>
          </div>
        </div>

        {/* Seek bar */}
        <div className="mt-5">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={time}
            onChange={(e) => {
              const a = audioRef.current;
              if (a) {
                a.currentTime = Number(e.target.value);
                setTime(Number(e.target.value));
              }
            }}
            className="w-full accent-sky-500"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>{fmt(time)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => selectTrack(Math.max(0, index - 1))}
            disabled={index === 0}
            className="rounded-full bg-slate-800 px-3 py-2 text-sm transition hover:bg-slate-700 disabled:opacity-40"
          >
            ⏮ Prev
          </button>
          <button
            type="button"
            onClick={() => skip(-30)}
            className="rounded-full bg-slate-800 px-3 py-2 text-sm transition hover:bg-slate-700"
          >
            −30s
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-full bg-sky-600 px-6 py-3 text-lg font-semibold text-white transition hover:bg-sky-500"
          >
            {playing ? '❚❚' : '►'}
          </button>
          <button
            type="button"
            onClick={() => skip(30)}
            className="rounded-full bg-slate-800 px-3 py-2 text-sm transition hover:bg-slate-700"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={() => selectTrack(Math.min(tracks.length - 1, index + 1))}
            disabled={index === tracks.length - 1}
            className="rounded-full bg-slate-800 px-3 py-2 text-sm transition hover:bg-slate-700 disabled:opacity-40"
          >
            Next ⏭
          </button>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-full border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
        <p className="mt-3 text-center text-xs text-slate-600">
          Space / K · ←/→ skip 30s {tracks.length > 1 ? '· , / . prev/next track' : ''}
        </p>
      </div>

      {/* Track list */}
      {tracks.length > 1 && (
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4">
          <p className="mb-2 px-2 text-xs uppercase tracking-wider text-slate-500">Tracks</p>
          <ol className="max-h-80 space-y-1 overflow-y-auto">
            {tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selectTrack(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    i === index ? 'bg-sky-600/20 text-sky-200' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="w-6 text-right text-xs text-slate-500">{i + 1}</span>
                  <span className="truncate">{t.name.replace(/\.[^.]+$/, '')}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
