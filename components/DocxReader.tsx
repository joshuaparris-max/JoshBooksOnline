'use client';

import { useEffect, useRef, useState } from 'react';

interface DocxReaderProps {
  fileId: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  initialLocation: string;
  onProgress: (progress: number, location: string) => Promise<void>;
}

const fontSizes = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const;

export default function DocxReader({ name, arrayBuffer, initialLocation, onProgress }: DocxReaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimeout = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(1);

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Word Reader</p>
          <h1 className="text-lg font-semibold">{name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
          <span className="text-slate-400">Font size:</span>
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              type="button"
              onClick={() => setFontSize(index)}
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
            className={`docx-content rounded-3xl bg-white p-8 text-slate-900 ${fontSizes[fontSize]}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
