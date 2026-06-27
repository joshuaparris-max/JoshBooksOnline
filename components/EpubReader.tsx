'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ePub from 'epubjs';
import ReaderSearchBar from './ReaderSearchBar';
import ReaderTtsBar from './ReaderTtsBar';
import { useTts } from '@/lib/useTts';

interface EpubMatch {
  cfi: string;
  excerpt: string;
}

interface EpubReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialLocation: string;
  onProgress: (progress: number, location: string) => Promise<void>;
  hasLinkedAudio?: boolean;
}

const themes = {
  light: {
    body: {
      background: '#f8fafc',
      color: '#0f172a',
    },
  },
  dark: {
    body: {
      background: '#0f172a',
      color: '#f8fafc',
    },
  },
  sepia: {
    body: {
      background: '#f5e8d0',
      color: '#2b2541',
    },
  },
};

const fontSizes = ['90%', '100%', '110%', '120%'] as const;

export default function EpubReader({ fileId, name, arrayBuffer, initialLocation, onProgress, hasLinkedAudio }: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [fontSize, setFontSize] = useState<number>(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const saveTimeout = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EpubMatch[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const prevHighlight = useRef<string | null>(null);
  const [ttsOpen, setTtsOpen] = useState(false);
  const [epubTextCache, setEpubTextCache] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const tts = useTts(fileId);

  const location = useMemo(() => initialLocation?.trim() || '', [initialLocation]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('joshbooks-reader-theme') as 'light' | 'dark' | 'sepia' | null;
    const storedFontSize = window.localStorage.getItem('bookshelf-reader-fontSize');
    if (storedTheme && ['light', 'dark', 'sepia'].includes(storedTheme)) {
      setCurrentTheme(storedTheme);
    }
    if (storedFontSize) {
      const index = Number(storedFontSize);
      if (!Number.isNaN(index) && index >= 0 && index < fontSizes.length) {
        setFontSize(index);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('joshbooks-reader-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    window.localStorage.setItem('bookshelf-reader-fontSize', String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const book = (ePub as any)(arrayBuffer);
    bookRef.current = book;

    const rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      allowScriptedContent: true,
    });
    renditionRef.current = rendition;

    rendition.themes.register('light', themes.light);
    rendition.themes.register('dark', themes.dark);
    rendition.themes.register('sepia', themes.sepia);
    rendition.themes.select(currentTheme);
    rendition.themes.fontSize(fontSizes[fontSize]);

    book.ready
      .then(() => book.locations.generate(1600))
      .then(() => {
        setIsReady(true);
        return rendition.display(location || undefined);
      })
      .catch((error: unknown) => {
        console.error('EPUB render error', error);
      });

    rendition.on('relocated', (event: any) => {
      const start = event.start as { cfi: string };
      if (!book.locations || !start) return;
      const cfi = start.cfi;
      const progress = book.locations.percentageFromCfi(cfi) * 100;

      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }

      saveTimeout.current = window.setTimeout(() => {
        onProgressRef.current(Math.round(progress), cfi).catch((error) => {
          console.error('Failed saving EPUB progress', error);
        });
      }, 2000);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        rendition.next();
      }
      if (event.key === 'ArrowLeft') {
        rendition.prev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
      rendition.destroy();
      book.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrayBuffer, location]);

  useEffect(() => {
    renditionRef.current?.themes.select(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(fontSizes[fontSize]);
  }, [fontSize]);

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

  // Debounced full-text search across the whole spine
  useEffect(() => {
    if (!searchOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const book = bookRef.current;
      if (!book) return;
      setSearching(true);
      try {
        await book.ready;
        const items = book.spine?.spineItems ?? [];
        const found: EpubMatch[] = [];
        for (const item of items) {
          if (cancelled) return;
          try {
            await item.load(book.load.bind(book));
            const matches = (item.find(q) as EpubMatch[]) ?? [];
            matches.forEach((m) => found.push(m));
          } catch {
            // skip sections that fail to load/search
          } finally {
            try {
              item.unload();
            } catch {
              // ignore
            }
          }
        }
        if (!cancelled) {
          setResults(found);
          setActiveMatch(0);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen]);

  // Navigate to and highlight the active match
  useEffect(() => {
    const rendition = renditionRef.current;
    const match = results[activeMatch];
    if (!rendition || !match) return;
    rendition
      .display(match.cfi)
      .then(() => {
        if (prevHighlight.current) {
          try {
            rendition.annotations.remove(prevHighlight.current, 'highlight');
          } catch {
            // ignore
          }
        }
        try {
          rendition.annotations.highlight(match.cfi);
          prevHighlight.current = match.cfi;
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, [activeMatch, results]);

  const nextMatch = () => results.length && setActiveMatch((i) => (i + 1) % results.length);
  const prevMatch = () =>
    results.length && setActiveMatch((i) => (i - 1 + results.length) % results.length);

  const closeSearch = () => {
    setSearchOpen(false);
    const rendition = renditionRef.current;
    if (prevHighlight.current && rendition) {
      try {
        rendition.annotations.remove(prevHighlight.current, 'highlight');
      } catch {
        // ignore
      }
    }
    prevHighlight.current = null;
  };

  // Extract plain text from all spine items — same pattern as the search feature.
  // Result is cached so subsequent Listen presses are instant.
  const handleTtsPlay = useCallback(async () => {
    if (tts.status === 'playing') { tts.pause(); return; }
    if (tts.status === 'paused') { tts.resume(); return; }

    if (epubTextCache) {
      tts.play(() => epubTextCache);
      return;
    }

    setExtracting(true);
    try {
      const book = bookRef.current;
      if (!book) return;
      await book.ready;
      const items = (book.spine?.spineItems ?? []) as any[];
      const parts: string[] = [];
      for (const item of items) {
        try {
          await item.load(book.load.bind(book));
          const doc = item.document as Document | undefined;
          if (doc?.body) {
            const t = (doc.body as HTMLElement).innerText ?? doc.body.textContent ?? '';
            if (t.trim()) parts.push(t.trim());
          }
        } catch {
          // skip sections that fail to load
        } finally {
          try { item.unload(); } catch {}
        }
      }
      const text = parts.join('\n\n');
      setEpubTextCache(text);
      tts.play(() => text);
    } finally {
      setExtracting(false);
    }
  }, [epubTextCache, tts]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {searchOpen && (
        <ReaderSearchBar
          query={query}
          onQueryChange={setQuery}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={closeSearch}
          current={results.length ? activeMatch + 1 : 0}
          total={results.length}
          busy={searching}
        />
      )}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">EPUB Reader</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Find
          </button>
          {tts.isSupported && (
            <button
              type="button"
              onClick={() => setTtsOpen((v) => !v)}
              className={`rounded-full border px-4 py-2 text-sm transition ${ttsOpen ? 'border-sky-500/50 bg-sky-700/50 hover:bg-sky-700' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              Listen
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowToolbar((value) => !value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            {showToolbar ? 'Hide controls' : 'Show controls'}
          </button>
        </div>
      </div>

      {showToolbar && (
        <div className="fixed inset-x-0 top-16 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-3 text-sm md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Theme:</span>
            {(['light', 'dark', 'sepia'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => {
                  setCurrentTheme(theme);
                  renditionRef.current?.themes.select(theme);
                }}
                className={`rounded-full px-3 py-1 transition ${currentTheme === theme ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {theme}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Font size:</span>
            {[0, 1, 2, 3].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setFontSize(index);
                  renditionRef.current?.themes.fontSize(fontSizes[index]);
                }}
                className={`rounded-full px-3 py-1 transition ${fontSize === index ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
              >
                {['Small', 'Normal', 'Large', 'XL'][index]}
              </button>
            ))}
          </div>
        </div>
      )}

      {ttsOpen && (
        <ReaderTtsBar
          tts={tts}
          onPlay={handleTtsPlay}
          hasLinkedAudio={hasLinkedAudio}
        />
      )}
      <div className="h-[5rem]" />
      <div className="h-[5rem]" />
      <div className="relative min-h-[calc(100vh-10rem)]">
        <div ref={containerRef} className="h-[calc(100vh-10rem)] w-full" />
        <button
          type="button"
          onClick={() => renditionRef.current?.prev()}
          className="fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-4 text-2xl text-white shadow-xl shadow-black/30 backdrop-blur transition hover:bg-slate-900"
          aria-label="Previous page"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => renditionRef.current?.next()}
          className="fixed right-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-slate-900/70 p-4 text-2xl text-white shadow-xl shadow-black/30 backdrop-blur transition hover:bg-slate-900"
          aria-label="Next page"
        >
          ›
        </button>
        {(!isReady || extracting) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80">
            <p className="text-white">{extracting ? 'Preparing text for reading…' : 'Rendering EPUB...'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
