'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';

const PROGRESS_KEY = (fileId: string) => `joshbooks-watch-progress:${fileId}`;

function WatchInner() {
  const params = useParams() as Record<string, string> | null;
  const searchParams = useSearchParams();
  const router = useRouter();

  const fileId = params?.fileId ?? '';
  const title = searchParams.get('title') ?? 'Movie';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resumeApplied = useRef(false);
  const lastSavedTime = useRef(0);

  // Restore saved position on first play
  const handleCanPlay = () => {
    if (resumeApplied.current) return;
    resumeApplied.current = true;
    try {
      const saved = window.localStorage.getItem(PROGRESS_KEY(fileId));
      if (saved) {
        const pos = parseFloat(saved);
        if (Number.isFinite(pos) && pos > 5 && videoRef.current) {
          videoRef.current.currentTime = pos;
        }
      }
    } catch {
      // ignore storage errors
    }
  };

  // Save position every ~10s (not every frame)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const now = video.currentTime;
    if (Math.abs(now - lastSavedTime.current) < 10) return;
    lastSavedTime.current = now;
    try {
      window.localStorage.setItem(PROGRESS_KEY(fileId), String(Math.floor(now)));
    } catch {
      // ignore
    }
  };

  const handleError = () => {
    setError('Unable to play this movie. The file may be unavailable or unsupported by your browser. Try opening it in Google Drive instead.');
  };

  useEffect(() => {
    resumeApplied.current = false;
    setError(null);
  }, [fileId]);

  const streamUrl = `/api/stream/${encodeURIComponent(fileId)}`;
  const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => { if (window.history.length > 1) router.back(); else router.push('/library'); }}
          className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20"
        >
          ← Back
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/20"
        >
          Open in Drive
        </a>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <p className="max-w-md text-slate-300">{error}</p>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Open in Google Drive
          </a>
        </div>
      ) : (
        <video
          ref={videoRef}
          key={fileId}
          src={streamUrl}
          controls
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          onError={handleError}
          className="w-full"
          style={{ maxHeight: 'calc(100vh - 56px)' }}
        />
      )}
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense>
      <WatchInner />
    </Suspense>
  );
}
