'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export interface ReaderShellProps {
  fileId?: string;
  EpubReader: React.ComponentType<any>;
  PdfReader: React.ComponentType<any>;
}

interface DriveFileMetadata {
  name: string;
  mimeType: string;
  appProperties?: {
    lastLocation?: string;
  };
}

export default function ReaderShell({ fileId, EpubReader, PdfReader }: ReaderShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const goToLibrary = () => router.push('/library');
  const [metadata, setMetadata] = useState<DriveFileMetadata | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.accessToken;

  useEffect(() => {
    if (status === 'loading' || !fileId) return;
    if (!accessToken) {
      setError('Authentication is required to load this book.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchMetadata = async () => {
      try {
        const metadataResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,appProperties`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        );

        if (!metadataResponse.ok) {
          const body = await metadataResponse.text();
          throw new Error(`Metadata fetch failed: ${metadataResponse.status} ${body}`);
        }

        const metadataJson = (await metadataResponse.json()) as DriveFileMetadata;
        setMetadata(metadataJson);
      } catch (err) {
        console.error('Failed to load book metadata:', err);
        setError('Unable to load book metadata.');
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [accessToken, fileId, status]);

  useEffect(() => {
    if (!metadata || !accessToken || !fileId) return;
    const fetchBinary = async () => {
      try {
        const binaryResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: 'no-store',
          }
        );

        if (!binaryResponse.ok) {
          const body = await binaryResponse.text();
          throw new Error(`Binary fetch failed: ${binaryResponse.status} ${body}`);
        }

        const buffer = await binaryResponse.arrayBuffer();
        setArrayBuffer(buffer);
      } catch (err) {
        console.error('Failed to load book binary:', err);
        setError('Unable to load book content.');
      } finally {
        setLoading(false);
      }
    };

    fetchBinary();
  }, [accessToken, fileId, metadata]);

  const initialLocation = useMemo(() => metadata?.appProperties?.lastLocation ?? '', [metadata]);

  if (!fileId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-xl space-y-6">
          <div className="flex justify-start">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <div className="rounded-3xl border border-yellow-500/20 bg-slate-900/90 p-8 text-center">
            <h1 className="text-2xl font-semibold text-yellow-300">Invalid book selected</h1>
            <p className="mt-4 text-slate-300">This book could not be opened because no file identifier was provided.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="max-w-xl w-full">
          <div className="flex justify-start p-4">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">Preparing reader…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-xl w-full space-y-6">
          <div className="flex justify-start p-4">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <div className="rounded-3xl border border-red-500/20 bg-slate-900/90 p-8 text-center">
            <h1 className="text-2xl font-semibold text-red-300">Unable to open book</h1>
            <p className="mt-4 text-slate-300">{error}</p>
            {accessToken ? null : (
              <p className="mt-4 text-slate-400">Please sign in again and reload the page.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!metadata || !arrayBuffer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="max-w-xl w-full">
          <div className="flex justify-start p-4">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <div className="text-center">
            <p className="text-lg">Loading book content…</p>
          </div>
        </div>
      </div>
    );
  }

  if (metadata.mimeType === 'application/epub+zip') {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex justify-start mb-4">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <EpubReader
            fileId={fileId}
            name={metadata.name}
            arrayBuffer={arrayBuffer}
            initialLocation={initialLocation}
            onProgress={async (progress: number, location: string) => {
              await fetch('/api/library/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, progress, location }),
              });
            }}
          />
        </div>
      </div>
    );
  }

  if (metadata.mimeType === 'application/pdf') {
    const initialPage = Number(initialLocation) || 1;
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex justify-start mb-4">
            <button onClick={goToLibrary} className="fixed left-4 top-4 z-50 rounded-full bg-slate-800 px-3 py-2 text-sm font-semibold hover:bg-slate-700">Back to library</button>
          </div>
          <PdfReader
            fileId={fileId}
            name={metadata.name}
            arrayBuffer={arrayBuffer}
            initialPage={initialPage}
            onProgress={async (progress: number, location: string) => {
              await fetch('/api/library/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, progress, location }),
              });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
      <div className="max-w-xl rounded-3xl border border-yellow-500/20 bg-slate-900/90 p-8 text-center">
        <h1 className="text-2xl font-semibold text-yellow-300">Unsupported file format</h1>
        <p className="mt-4 text-slate-300">This reader only supports PDF and EPUB files.</p>
      </div>
    </div>
  );
}
