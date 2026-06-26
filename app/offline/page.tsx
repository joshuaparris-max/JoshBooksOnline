'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listOfflineFiles, deleteOfflineFile, formatBytes } from '@/lib/offlineStorage';
import type { OfflineMeta } from '@/lib/offlineStorage';

const MIME_LABELS: Record<string, string> = {
  'application/epub+zip': 'EPUB',
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function OfflinePage() {
  const [files, setFiles] = useState<OfflineMeta[] | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    listOfflineFiles()
      .then((list) => setFiles(list.sort((a, b) => b.savedAt.localeCompare(a.savedAt))))
      .catch(() => setFiles([]));
  }, []);

  const remove = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await deleteOfflineFile(id);
      setFiles((prev) => prev?.filter((f) => f.id !== id) ?? []);
    } catch {
      // ignore
    } finally {
      setDeleting((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const totalSize = files?.reduce((sum, f) => sum + f.size, 0) ?? 0;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/library" className="rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
            ← Library
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Offline library</h1>
            {files !== null && (
              <p className="mt-0.5 text-sm text-slate-400">
                {files.length} item{files.length !== 1 ? 's' : ''} · {formatBytes(totalSize)} stored on this device
              </p>
            )}
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <p className="mb-4 text-sm text-slate-400">
            Books saved here are available to read without an internet connection. Tap a title to open it, or remove items to free up space.
          </p>

          {files === null && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-800" />
              ))}
            </div>
          )}

          {files !== null && files.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-10 text-center">
              <p className="text-base font-medium text-slate-300">No offline books yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Open any ebook and click <strong className="text-slate-300">↓ Save offline</strong> to store it here.
              </p>
              <Link
                href="/library"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                Browse library
              </Link>
            </div>
          )}

          {files !== null && files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <Link
                    href={`/reader/${encodeURIComponent(file.id)}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-semibold text-white hover:text-sky-300 transition">{file.name.replace(/\.[^.]+$/, '')}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {MIME_LABELS[file.mimeType] ?? 'Book'} · {formatBytes(file.size)} · Saved {formatDate(file.savedAt)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(file.id)}
                    disabled={deleting.has(file.id)}
                    className="shrink-0 rounded-full bg-rose-600/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-600/40 disabled:opacity-50"
                  >
                    {deleting.has(file.id) ? '…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="mb-2 text-sm font-semibold text-amber-300">How offline reading works</h2>
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li>· Books are saved to your browser&apos;s local storage (IndexedDB), not your device downloads folder.</li>
            <li>· Reading progress won&apos;t sync to Drive while offline — sync resumes when you reconnect.</li>
            <li>· Clearing browser data will remove all saved books.</li>
            <li>· Audiobooks are not yet available offline — only ebooks (EPUB, PDF, TXT, DOCX).</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
