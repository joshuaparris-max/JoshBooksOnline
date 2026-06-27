'use client';

import type { UseTtsReturn } from '@/lib/useTts';

const RATES = [0.8, 1.0, 1.2, 1.5, 2.0];

interface ReaderTtsBarProps {
  tts: UseTtsReturn;
  onPlay: () => void;
  hasLinkedAudio?: boolean;
}

export default function ReaderTtsBar({ tts, onPlay, hasLinkedAudio }: ReaderTtsBarProps) {
  const { status, voices, voice, rate, chunkIndex, totalChunks, error, pause, resume, stop, nextChunk, prevChunk, setRate, setVoice } = tts;

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isActive = isPlaying || isPaused;
  const isLoading = status === 'loading';

  // Sit above DockedAudioPlayer (≈56 px tall when collapsed) when a linked audiobook is present
  const bottomClass = hasLinkedAudio ? 'bottom-14' : 'bottom-0';

  return (
    <div className={`fixed inset-x-0 ${bottomClass} z-50 border-t border-white/10 bg-slate-950/95 backdrop-blur`}>
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* Play / Pause / Resume */}
          <button
            type="button"
            onClick={isPlaying ? pause : isPaused ? resume : onPlay}
            disabled={isLoading}
            className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {isLoading ? 'Preparing…' : isPlaying ? '⏸ Pause' : isPaused ? '▶ Resume' : '▶ Listen'}
          </button>

          {/* Stop */}
          {isActive && (
            <button
              type="button"
              onClick={stop}
              className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700"
            >
              ⏹ Stop
            </button>
          )}

          {/* Chunk navigation */}
          {isActive && totalChunks > 1 && (
            <>
              <button
                type="button"
                onClick={prevChunk}
                disabled={chunkIndex === 0}
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
              >
                ‹ Back
              </button>
              <span className="text-xs text-slate-500">{chunkIndex + 1} / {totalChunks}</span>
              <button
                type="button"
                onClick={nextChunk}
                disabled={chunkIndex >= totalChunks - 1}
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
              >
                Skip ›
              </button>
            </>
          )}

          {/* Speed */}
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>

          {/* Voice */}
          {voices.length > 0 && (
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="max-w-[140px] truncate rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"
            >
              <option value="">Default voice</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          )}

          {/* Error */}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}
