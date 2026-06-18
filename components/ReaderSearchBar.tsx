'use client';

import { useEffect, useRef } from 'react';

interface ReaderSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  /** 1-based index of the active match (0 when none). */
  current: number;
  total: number;
  /** Optional extra context shown after the counter (e.g. "page 42"). */
  detail?: string;
  busy?: boolean;
}

/**
 * Shared in-reader find bar. Presentational only — each reader supplies the
 * search logic and match navigation. Handles Enter / Shift+Enter / Esc.
 */
export default function ReaderSearchBar({
  query,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
  current,
  total,
  detail,
  busy,
}: ReaderSearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev();
            else onNext();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Find in book…"
        className="w-44 rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-sky-500 sm:w-56"
      />
      <span className="min-w-[3.5rem] text-center text-xs text-slate-400">
        {busy ? '…' : total > 0 ? `${current}/${total}` : query ? '0/0' : ''}
      </span>
      {detail && <span className="hidden text-xs text-slate-500 sm:inline">{detail}</span>}
      <button
        type="button"
        onClick={onPrev}
        disabled={total === 0}
        title="Previous match (Shift+Enter)"
        className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={total === 0}
        title="Next match (Enter)"
        className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
      >
        ›
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        className="rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-700"
      >
        ✕
      </button>
    </div>
  );
}
