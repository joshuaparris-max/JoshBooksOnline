'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

const EpubReader = dynamic(() => import('@/components/EpubReader'), { ssr: false });
const TxtReader = dynamic(() => import('@/components/TxtReader'), { ssr: false });

function ReadOnlineInner() {
  const params = useSearchParams();
  const router = useRouter();
  const url = params.get('url') ?? '';
  const format = (params.get('format') ?? 'epub') as 'epub' | 'txt';
  const title = params.get('title') ?? 'Book';

  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const progressKey = useMemo(() => `online-progress:${url}`, [url]);
  const initialLocation = useMemo(() => {
    if (typeof window === 'undefined' || !url) return '';
    return window.localStorage.getItem(progressKey) ?? '';
  }, [progressKey, url]);

  useEffect(() => {
    if (!url) {
      setError('No book specified.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/fetch-ebook?url=${encodeURIComponent(url)}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error('failed');
        const buf = await response.arrayBuffer();
        if (!cancelled) setBuffer(buf);
      } catch {
        if (!cancelled) setError('Could not load this book. The source may be temporarily unavailable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const onProgress = async (_progress: number, location: string) => {
    try {
      window.localStorage.setItem(progressKey, location);
    } catch {
      // ignore storage failures
    }
  };

  const back = (
    <button
      onClick={() => router.push('/library')}
      className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
    >
      Back to library
    </button>
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        {back}
        <div className="max-w-md rounded-3xl border border-rose-500/20 bg-slate-900/90 p-8 text-center">
          <h1 className="text-xl font-semibold text-rose-300">Unable to open book</h1>
          <p className="mt-3 text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!buffer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        {back}
        <p className="text-lg">Loading “{title}”…</p>
      </div>
    );
  }

  const Reader = format === 'txt' ? TxtReader : EpubReader;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {back}
      <div className="mx-auto max-w-7xl p-4">
        <Reader
          fileId={url}
          name={title}
          arrayBuffer={buffer}
          initialLocation={initialLocation}
          onProgress={onProgress}
        />
      </div>
    </div>
  );
}

export default function ReadOnlinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading…</div>
      }
    >
      <ReadOnlineInner />
    </Suspense>
  );
}
