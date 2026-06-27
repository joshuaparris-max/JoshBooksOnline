'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DockedAudioPlayer from './DockedAudioPlayer';
import { saveOfflineFile, loadOfflineFile, deleteOfflineFile, isOfflineSaved, formatBytes } from '@/lib/offlineStorage';

export interface ReaderShellProps {
  fileId?: string;
  EpubReader: React.ComponentType<any>;
  PdfReader: React.ComponentType<any>;
  TxtReader: React.ComponentType<any>;
  DocxReader: React.ComponentType<any>;
}

interface DriveFileMetadata {
  name: string;
  mimeType: string;
  appProperties?: {
    lastLocation?: string;
    m_link_audio?: string;
  };
}

function getLinkedAudio(fileId: string, metadata: DriveFileMetadata | null): string | undefined {
  try {
    const raw = window.localStorage.getItem('joshbooks-links');
    if (raw) {
      const links = JSON.parse(raw) as Record<string, string>;
      if (links[fileId]) return links[fileId];
    }
  } catch {
    // ignore
  }
  return metadata?.appProperties?.m_link_audio || undefined;
}

export default function ReaderShell({ fileId, EpubReader, PdfReader, TxtReader, DocxReader }: ReaderShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const goToLibrary = () => {
    if (window.history.length > 1) router.back();
    else router.push('/library');
  };

  const [metadata, setMetadata] = useState<DriveFileMetadata | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromOffline, setFromOffline] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<boolean | null>(null);
  const [savingOffline, setSavingOffline] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const saveMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accessToken = session?.accessToken;
  const linkedAudioId = fileId ? getLinkedAudio(fileId, metadata) : undefined;

  // Check offline status independently
  useEffect(() => {
    if (!fileId) return;
    isOfflineSaved(fileId).then(setOfflineSaved).catch(() => setOfflineSaved(false));
  }, [fileId]);

  // Load: try IndexedDB first, then Drive API
  useEffect(() => {
    if (!fileId) return;
    if (status === 'loading') return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      // Offline cache check
      try {
        const cached = await loadOfflineFile(fileId);
        if (cached && !cancelled) {
          setMetadata({ name: cached.meta.name, mimeType: cached.meta.mimeType });
          setArrayBuffer(cached.buffer);
          setFromOffline(true);
          setOfflineSaved(true);
          setLoading(false);
          return;
        }
      } catch {
        // IndexedDB unavailable — fall through to Drive
      }

      if (!accessToken) {
        if (!cancelled) {
          setError('Authentication is required. If offline, save this book first while online.');
          setLoading(false);
        }
        return;
      }

      try {
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,appProperties`,
          { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
        );
        if (!metaRes.ok) throw new Error(`Metadata ${metaRes.status}`);
        const meta = (await metaRes.json()) as DriveFileMetadata;
        if (cancelled) return;
        setMetadata(meta);

        const binRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
        );
        if (!binRes.ok) throw new Error(`Binary ${binRes.status}`);
        const buf = await binRes.arrayBuffer();
        if (!cancelled) {
          setArrayBuffer(buf);
          setLoading(false);
        }
      } catch (err) {
        console.error('ReaderShell load error:', err);
        if (!cancelled) {
          setError('Unable to load this book. Check your connection or save it for offline use.');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [accessToken, fileId, status]);

  const showMsg = (msg: string) => {
    setSaveMsg(msg);
    if (saveMsgTimer.current) clearTimeout(saveMsgTimer.current);
    saveMsgTimer.current = setTimeout(() => setSaveMsg(null), 3000);
  };

  const saveForOffline = async () => {
    if (!fileId || !arrayBuffer || !metadata) return;
    setSavingOffline(true);
    try {
      await saveOfflineFile(
        { id: fileId, name: metadata.name, mimeType: metadata.mimeType, savedAt: new Date().toISOString(), kind: 'ebook', size: arrayBuffer.byteLength },
        arrayBuffer
      );
      setOfflineSaved(true);
      showMsg(`Saved (${formatBytes(arrayBuffer.byteLength)})`);
    } catch {
      showMsg('Save failed');
    } finally {
      setSavingOffline(false);
    }
  };

  const removeOffline = async () => {
    if (!fileId) return;
    try {
      await deleteOfflineFile(fileId);
      setOfflineSaved(false);
      setFromOffline(false);
      showMsg('Removed from offline');
    } catch {
      showMsg('Remove failed');
    }
  };

  const initialLocation = useMemo(() => metadata?.appProperties?.lastLocation ?? '', [metadata]);

  // Offline action bar (fixed, shown when book is loaded)
  const offlineBar = arrayBuffer && metadata ? (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
      {fromOffline && (
        <span className="rounded-full bg-emerald-700/80 px-2.5 py-1 text-xs font-semibold text-emerald-100 backdrop-blur">
          Offline copy
        </span>
      )}
      {saveMsg && (
        <span className="rounded-full bg-slate-700/90 px-2.5 py-1 text-xs text-slate-200 backdrop-blur">
          {saveMsg}
        </span>
      )}
      {offlineSaved ? (
        <button
          type="button"
          onClick={removeOffline}
          title="Remove offline copy"
          className="rounded-full bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-emerald-400 backdrop-blur transition hover:bg-slate-700"
        >
          ✓ Offline
        </button>
      ) : (
        <button
          type="button"
          onClick={saveForOffline}
          disabled={savingOffline}
          title="Save for offline reading"
          className="rounded-full bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur transition hover:bg-slate-700 disabled:opacity-50"
        >
          {savingOffline ? 'Saving…' : '↓ Save offline'}
        </button>
      )}
    </div>
  ) : null;

  const backBtn = (
    <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">
      Back to library
    </button>
  );

  if (!fileId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        {backBtn}
        <div className="max-w-xl rounded-3xl border border-yellow-500/20 bg-slate-900/90 p-8 text-center">
          <h1 className="text-2xl font-semibold text-yellow-300">Invalid book selected</h1>
          <p className="mt-4 text-slate-300">This book could not be opened because no file identifier was provided.</p>
        </div>
      </div>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        {backBtn}
        <p className="text-lg font-medium">Preparing reader…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        {backBtn}
        <div className="max-w-xl rounded-3xl border border-red-500/20 bg-slate-900/90 p-8 text-center">
          <h1 className="text-2xl font-semibold text-red-300">Unable to open book</h1>
          <p className="mt-4 text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!metadata || !arrayBuffer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        {backBtn}
        <p className="text-lg">Loading book content…</p>
      </div>
    );
  }

  const onProgress = async (progress: number, location: string) => {
    if (fromOffline) return; // can't save progress without Drive when fully offline
    await fetch('/api/library/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, progress, location }),
    });
  };

  if (metadata.mimeType === 'application/epub+zip') {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {backBtn}
        {offlineBar}
        <EpubReader fileId={fileId} name={metadata.name} arrayBuffer={arrayBuffer} initialLocation={initialLocation} onProgress={onProgress} hasLinkedAudio={!!linkedAudioId} />
        {linkedAudioId && <DockedAudioPlayer audiobookId={linkedAudioId} />}
      </div>
    );
  }

  if (metadata.mimeType === 'application/pdf') {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {backBtn}
        {offlineBar}
        <PdfReader fileId={fileId} name={metadata.name} arrayBuffer={arrayBuffer} initialPage={Number(initialLocation) || 1} onProgress={onProgress} />
        {linkedAudioId && <DockedAudioPlayer audiobookId={linkedAudioId} />}
      </div>
    );
  }

  const isTxt = metadata.mimeType === 'text/plain';
  const isDocx = metadata.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isTxt || isDocx) {
    const FlowReader = isTxt ? TxtReader : DocxReader;
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        {backBtn}
        {offlineBar}
        <FlowReader fileId={fileId} name={metadata.name} arrayBuffer={arrayBuffer} initialLocation={initialLocation} onProgress={onProgress} hasLinkedAudio={!!linkedAudioId} />
        {linkedAudioId && <DockedAudioPlayer audiobookId={linkedAudioId} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      {backBtn}
      <div className="max-w-xl rounded-3xl border border-yellow-500/20 bg-slate-900/90 p-8 text-center">
        <h1 className="text-2xl font-semibold text-yellow-300">Unsupported file format</h1>
        <p className="mt-4 text-slate-300">This reader supports PDF, EPUB, TXT, and DOCX files.</p>
      </div>
    </div>
  );
}
