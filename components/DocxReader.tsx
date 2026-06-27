'use client';

import { useEffect, useRef, useState } from 'react';
import ReaderSearchBar from './ReaderSearchBar';
import ReaderTtsBar from './ReaderTtsBar';
import { useReaderTheme, READER_THEMES, READER_THEME_SURFACE } from '@/lib/useReaderTheme';
import { useTts } from '@/lib/useTts';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight all matches of `query` inside `container` by wrapping them in
 * <mark data-find> elements. Returns the total match count and scrolls the
 * active match into view. Existing highlights are removed first.
 */
function highlightContainer(container: HTMLElement, query: string, activeIndex: number): number {
  container.querySelectorAll('mark[data-find]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
    parent.normalize();
  });

  if (!query) return 0;

  const re = new RegExp(escapeRegExp(query), 'gi');
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) textNodes.push(node as Text);

  const marks: HTMLElement[] = [];
  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? '';
    re.lastIndex = 0;
    if (!re.test(value)) continue;
    re.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      if (m.index > last) frag.appendChild(document.createTextNode(value.slice(last, m.index)));
      const mark = document.createElement('mark');
      mark.setAttribute('data-find', '');
      mark.textContent = m[0];
      frag.appendChild(mark);
      marks.push(mark);
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  marks.forEach((mark, i) => {
    mark.className = i === activeIndex ? 'bg-amber-400 text-black' : 'bg-amber-500/40';
  });
  marks[activeIndex]?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  return marks.length;
}

interface DocxReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialLocation: string;
  onProgress: (progress: number, location: string) => Promise<void>;
  hasLinkedAudio?: boolean;
}

const fontSizes = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;

export default function DocxReader({ fileId, name, arrayBuffer, initialLocation, onProgress, hasLinkedAudio }: DocxReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimeout = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(() => {
    try { return parseInt(window.localStorage.getItem('bookshelf-reader-fontSize') ?? '1', 10) || 1; } catch { return 1; }
  });
  const [theme, setTheme] = useReaderTheme();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [ttsOpen, setTtsOpen] = useState(false);
  const tts = useTts(fileId);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    let cancelled = false;
    const convert = async () => {
      try {
        // mammoth ships a browser build that works off an ArrayBuffer
        const mammoth = (await import('mammoth/mammoth.browser')).default;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (err) {
        console.error('Failed to convert DOCX', err);
        if (!cancelled) setError('Unable to render this Word document.');
      }
    };
    convert();
    return () => {
      cancelled = true;
    };
  }, [arrayBuffer]);

  // Restore scroll position once content is rendered
  useEffect(() => {
    const container = containerRef.current;
    if (!container || html === null) return;
    const percent = Number(initialLocation);
    if (!Number.isNaN(percent) && percent > 0) {
      requestAnimationFrame(() => {
        const max = container.scrollHeight - container.clientHeight;
        container.scrollTop = (percent / 100) * max;
      });
    }
  }, [initialLocation, html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || html === null) return;

    const handleScroll = () => {
      const max = container.scrollHeight - container.clientHeight;
      const progress = max > 0 ? Math.round((container.scrollTop / max) * 100) : 0;

      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = window.setTimeout(() => {
        onProgressRef.current(progress, String(progress)).catch((err) => {
          console.error('Failed saving DOCX progress', err);
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
  }, [html]);

  // Inject the converted HTML imperatively so we can mutate it for search highlights.
  useEffect(() => {
    if (contentRef.current && html !== null) {
      contentRef.current.innerHTML = html;
    }
  }, [html]);

  useEffect(() => {
    setActiveMatch(0);
  }, [query]);

  useEffect(() => {
    if (!contentRef.current || html === null) return;
    const count = highlightContainer(contentRef.current, searchOpen ? query.trim() : '', activeMatch);
    setMatchCount(count);
  }, [html, query, activeMatch, searchOpen]);

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

  const nextMatch = () => matchCount && setActiveMatch((i) => (i + 1) % matchCount);
  const prevMatch = () => matchCount && setActiveMatch((i) => (i - 1 + matchCount) % matchCount);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {searchOpen && (
        <ReaderSearchBar
          query={query}
          onQueryChange={setQuery}
          onNext={nextMatch}
          onPrev={prevMatch}
          onClose={() => setSearchOpen(false)}
          current={matchCount ? activeMatch + 1 : 0}
          total={matchCount}
        />
      )}
      <div className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Word Reader</p>
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
          {tts.isSupported && (
            <button
              type="button"
              onClick={() => setTtsOpen((v) => !v)}
              className={`rounded-full px-3 py-1 text-slate-200 transition ${ttsOpen ? 'bg-sky-700 hover:bg-sky-600' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              Listen
            </button>
          )}
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

      {ttsOpen && (
        <ReaderTtsBar
          tts={tts}
          onPlay={() => tts.play(() => contentRef.current?.innerText ?? '')}
          hasLinkedAudio={hasLinkedAudio}
        />
      )}
      <div className="h-[96px] md:h-[88px]" />
      <div
        ref={containerRef}
        className={`mx-auto h-[calc(100vh-96px)] max-w-3xl overflow-y-auto px-4 md:px-8 ${ttsOpen ? 'pb-28' : 'pb-16'}`}
      >
        {error ? (
          <div className="rounded-3xl border border-red-500/20 bg-slate-900/80 p-8 text-center text-red-300">
            {error}
          </div>
        ) : html === null ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center">
            <p>Rendering document…</p>
          </div>
        ) : (
          <div
            ref={contentRef}
            className={`docx-content rounded-3xl p-8 transition-colors ${READER_THEME_SURFACE[theme]} ${fontSizes[fontSize]}`}
          />
        )}
      </div>
    </div>
  );
}
