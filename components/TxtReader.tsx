'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReaderSearchBar from './ReaderSearchBar';
import { useReaderTheme, READER_THEMES, READER_THEME_SURFACE } from '@/lib/useReaderTheme';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TxtReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialLocation: string;
  onProgress: (progress: number, location: string) => Promise<void>;
}

const fontSizes = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;

export default function TxtReader({ name, arrayBuffer, initialLocation, onProgress }: TxtReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimeout = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const [fontSize, setFontSize] = useState<number>(() => {
    try { return parseInt(window.localStorage.getItem('bookshelf-reader-fontSize') ?? '1', 10) || 1; } catch { return 1; }
  });
  const [theme, setTheme] = useReaderTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const markRefs = useRef<(HTMLElement | null)[]>([]);

  const text = useMemo(() => new TextDecoder('utf-8').decode(arrayBuffer), [arrayBuffer]);

  const matches = useMemo(() => {
    if (!searchOpen || query.trim().length < 1) return [] as { start: number; end: number }[];
    const re = new RegExp(escapeRegExp(query), 'gi');
    const out: { start: number; end: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      out.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    return out;
  }, [searchOpen, query, text]);

  useEffect(() => {
    setActiveMatch(0);
  }, [query]);

  useEffect(() => {
    const el = markRefs.current[activeMatch];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatch, matches]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const nextMatch = () => matches.length && setActiveMatch((i) => (i + 1) % matches.length);
  const prevMatch = () =>
    matches.length && setActiveMatch((i) => (i - 1 + matches.length) % matches.length);

  const content = useMemo(() => {
    if (!matches.length) return text;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((mm, i) => {
      if (mm.start > last) nodes.push(text.slice(last, mm.start));
      nodes.push(
        <mark
          key={i}
          ref={(el) => {
            markRefs.current[i] = el;
          }}
          className={i === activeMatch ? 'bg-amber-400 text-black' : 'bg-amber-500/40 text-inherit'}
        >
          {text.slice(mm.start, mm.end)}
        </mark>
      );
      last = mm.end;
    });
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }, [text, matches, activeMatch]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Restore scroll position once content is laid out
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const percent = Number(initialLocation);
    if (!Number.isNaN(percent) && percent > 0) {
      requestAnimationFrame(() => {
        const max = container.scrollHeight - container.clientHeight;
        container.scrollTop = (percent / 100) * max;
      });
    }
  }, [initialLocation, text]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const max = container.scrollHeight - container.clientHeight;
      const progress = max > 0 ? Math.round((container.scrollTop / max) * 100) : 0;

      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = window.setTimeout(() => {
        onProgressRef.current(progress, String(progress)).catch((error) => {
          console.error('Failed saving TXT progress', error);
        });
      }, 2000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [text]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {searchOpen && (
        <ReaderSearchBar
          query={query}
          onQueryChange={setQuery}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={() => setSearchOpen(false)}
          current={matches.length ? activeMatch + 1 : 0}
          total={matches.length}
        />
      )}
      <div className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Text Reader</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded-full bg-slate-800 px-3 py-1 text-slate-200 transition hover:bg-slate-700"
          >
            Find
          </button>
          <span className="text-slate-400">Theme:</span>
          {READER_THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-full px-3 py-1 capitalize transition ${theme === t ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              {t}
            </button>
          ))}
          <span className="text-slate-400">Font size:</span>
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => { setFontSize(index); try { window.localStorage.setItem('bookshelf-reader-fontSize', String(index)); } catch {} }}
              className={`rounded-full px-3 py-1 transition ${fontSize === index ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              {['Small', 'Normal', 'Large', 'XL'][index]}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[96px] md:h-[88px]" />
      <div
        ref={containerRef}
        className="mx-auto h-[calc(100vh-96px)] max-w-3xl overflow-y-auto px-4 pb-16 md:px-8"
      >
        <pre className={`whitespace-pre-wrap break-words rounded-3xl p-6 font-serif leading-relaxed transition-colors ${READER_THEME_SURFACE[theme]} ${fontSizes[fontSize]}`}>
          {content}
        </pre>
      </div>
    </div>
  );
}
