'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import ReaderSearchBar from './ReaderSearchBar';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PdfMatch {
  page: number;
  snippet: string;
}

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface PdfReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialPage: number;
  onProgress: (progress: number, location: string) => Promise<void>;
}

export default function PdfReader({ fileId, name, arrayBuffer, initialPage, onProgress }: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const saveTimeout = useRef<number | null>(null);
  const inFlightPages = useRef<Set<number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PdfMatch[]>([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [searching, setSearching] = useState(false);
  const pageTextCache = useRef<Map<number, string>>(new Map());

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  useEffect(() => {
    const loadPdf = async () => {
      const data = new Uint8Array(arrayBuffer);
      const document = await getDocument({ data }).promise;
      setPdf(document);
      setNumPages(document.numPages);
    };

    loadPdf().catch((error) => {
      console.error('Failed to load PDF', error);
    });
  }, [arrayBuffer]);

  useEffect(() => {
    if (numPages === 0 || !pdf) return;

    const scrollToInitial = () => {
      const element = pageRefs.current[initialPage - 1];
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    };

    scrollToInitial();
    setCurrentPage(initialPage);
  }, [initialPage, numPages, pdf]);

  useEffect(() => {
    if (!pdf) return;

    const renderPage = async (pageNumber: number) => {
      if (pageNumber < 1 || pageNumber > (pdf as PDFDocumentProxy).numPages) return;
      if (renderedPages.has(pageNumber)) return;
      if (inFlightPages.current.has(pageNumber)) return;
      inFlightPages.current.add(pageNumber);
      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = pageRefs.current[pageNumber - 1]?.querySelector('canvas');
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const renderContext = {
          canvasContext: context,
          viewport,
          canvas,
        } as any;
        await page.render(renderContext).promise;
        setRenderedPages((prev) => new Set(prev).add(pageNumber));
      } catch (error) {
        console.error('PDF page render failed', error);
      } finally {
        inFlightPages.current.delete(pageNumber);
      }
    };

    renderPage(currentPage);
    renderPage(currentPage - 1);
    renderPage(currentPage + 1);
  }, [pdf, currentPage, renderedPages]);

  useEffect(() => {
    if (!pdf || numPages === 0) return;

    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const top = window.scrollY;
      let mostVisible = currentPage;
      let maxVisible = 0;

      pageRefs.current.forEach((page, index) => {
        if (!page) return;
        const rect = page.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        if (visible > maxVisible) {
          maxVisible = visible;
          mostVisible = index + 1;
        }
      });

      if (mostVisible !== currentPage) {
        setCurrentPage(mostVisible);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentPage, numPages, pdf]);

  useEffect(() => {
    if (!numPages) return;
    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = window.setTimeout(() => {
      const progress = Math.round((currentPage / numPages) * 100);
      onProgress(progress, String(currentPage)).catch((error) => {
        console.error('Failed saving PDF progress', error);
      });
    }, 2000);

    return () => {
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [currentPage, numPages, onProgress]);

  const goToPage = (page: number) => {
    if (page < 1 || page > numPages) return;
    const element = pageRefs.current[page - 1];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setCurrentPage(page);
  };

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

  // Extract and cache each page's text, then collect matches across the document.
  useEffect(() => {
    if (!searchOpen || !pdf) return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const re = new RegExp(escapeRegExp(q), 'gi');
      const found: PdfMatch[] = [];
      for (let p = 1; p <= numPages; p += 1) {
        if (cancelled) return;
        let text = pageTextCache.current.get(p);
        if (text === undefined) {
          try {
            const page = await pdf.getPage(p);
            const tc = await page.getTextContent();
            text = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ');
          } catch {
            text = '';
          }
          pageTextCache.current.set(p, text);
        }
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          const from = Math.max(0, m.index - 30);
          const snippet =
            (from > 0 ? '…' : '') + text.slice(from, m.index + q.length + 30).trim() + '…';
          found.push({ page: p, snippet });
          if (m.index === re.lastIndex) re.lastIndex += 1;
        }
      }
      if (!cancelled) {
        setMatches(found);
        setActiveMatch(0);
      }
      setSearching(false);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, searchOpen, pdf, numPages]);

  useEffect(() => {
    const match = matches[activeMatch];
    if (match) goToPage(match.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatch, matches]);

  const nextMatch = () => matches.length && setActiveMatch((i) => (i + 1) % matches.length);
  const prevMatch = () =>
    matches.length && setActiveMatch((i) => (i - 1 + matches.length) % matches.length);

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
          busy={searching}
          detail={matches[activeMatch] ? `page ${matches[activeMatch].page}` : undefined}
        />
      )}
      <div className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">PDF Reader</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded-full bg-slate-800 px-4 py-2 transition hover:bg-slate-700"
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            className="rounded-full bg-slate-800 px-4 py-2 transition hover:bg-slate-700"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            className="rounded-full bg-slate-800 px-4 py-2 transition hover:bg-slate-700"
          >
            Next
          </button>
          <span>
            Page <strong>{currentPage}</strong> / {numPages || '...'}
          </span>
        </div>
      </div>

      <div className="h-[96px] md:h-[88px]" />
      <div ref={containerRef} className="space-y-8 px-4 pb-16 pt-4 md:px-8">
        {numPages === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-center">
            <p>Loading PDF…</p>
          </div>
        ) : (
          pages.map((pageNumber) => (
            <section
              key={pageNumber}
              ref={(element) => {
                pageRefs.current[pageNumber - 1] = element;
              }}
              className="rounded-3xl border border-white/10 bg-slate-900/80 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-300">
                <span>Page {pageNumber}</span>
                <span>{pageNumber === currentPage ? 'Visible' : ''}</span>
              </div>
              <div className="overflow-hidden rounded-3xl bg-black">
                <canvas className="w-full" />
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
