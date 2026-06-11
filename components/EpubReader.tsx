'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ePub from 'epubjs';

interface EpubReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialLocation: string;
  onProgress: (progress: number, location: string) => Promise<void>;
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

export default function EpubReader({ fileId, name, arrayBuffer, initialLocation, onProgress }: EpubReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<any>(null);
  const renditionRef = useRef<any>(null);
  const onProgressRef = useRef(onProgress);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [fontSize, setFontSize] = useState<number>(1);
  const [showToolbar, setShowToolbar] = useState(true);
  const saveTimeout = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const location = useMemo(() => initialLocation?.trim() || '', [initialLocation]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('bookshelf-reader-theme') as 'light' | 'dark' | 'sepia' | null;
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
    window.localStorage.setItem('bookshelf-reader-theme', currentTheme);
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
    });
    renditionRef.current = rendition;

    rendition.themes.register('light', themes.light);
    rendition.themes.register('dark', themes.dark);
    rendition.themes.register('sepia', themes.sepia);
    rendition.themes.select(currentTheme);
    rendition.themes.fontSize(fontSizes[fontSize]);

    const displayPromise = book.ready
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">EPUB Reader</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowToolbar((value) => !value)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Toggle Controls
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

      <div className="h-[5rem]" />
      <div className="h-[5rem]" />
      <div className="relative min-h-[calc(100vh-10rem)]">
        <div ref={containerRef} className="h-[calc(100vh-10rem)] w-full" />
        {!isReady && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80">
            <p className="text-white">Rendering EPUB...</p>
          </div>
        )}
      </div>
    </div>
  );
}
