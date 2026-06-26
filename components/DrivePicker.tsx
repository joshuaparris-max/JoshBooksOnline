'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import type { DriveImportResult } from '@/lib/driveImportMessages';

export type DriveImportTarget = 'auto' | 'ebooks' | 'audiobooks';

interface DrivePickerProps {
  onImportStart: () => void;
  onImportComplete: (result: DriveImportResult) => void;
  onImportError: (error: string) => void;
  /** Where imported files should land. Defaults to auto (ebooks + audio). */
  target?: DriveImportTarget;
  label?: string;
}

declare global {
  interface Window {
    google?: {
      picker: {
        Action: {
          ACTION: string;
          CANCEL: string;
          PICKED_INCLUDE: string;
        };
        Response: {
          DOCUMENTS: string;
        };
        PickerBuilder: new () => any;
        DocsView: new () => any;
      };
    };
  }
}

export function DrivePicker({
  onImportStart,
  onImportComplete,
  onImportError,
  target = 'auto',
  label = 'Import from Drive',
}: DrivePickerProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const openPicker = async () => {
    if (!session?.accessToken) {
      onImportError('No access token available. Please sign in again.');
      return;
    }

    if (!process.env.NEXT_PUBLIC_GOOGLE_API_KEY) {
      onImportError('Google API Key not configured. Please contact support.');
      return;
    }

    setLoading(true);

    try {
      await loadGooglePickerScript();

      const google = window.google;
      if (!google?.picker) {
        throw new Error('Google Picker API not available');
      }

      const picker = new google.picker.PickerBuilder()
        .addView(
          new google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setOwnedByMe(true)
        )
        .setOAuthToken(session.accessToken)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
        .setCallback(handlePickerCallback)
        .build();

      picker.setVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open Drive picker';
      onImportError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickerCallback = async (data: any) => {
    const google = window.google;
    if (!google?.picker) return;

    const action = data[google.picker.Action.ACTION];
    const docs = data[google.picker.Response.DOCUMENTS] || [];

    if (action === google.picker.Action.CANCEL) {
      return;
    }

    if (action !== google.picker.Action.PICKED_INCLUDE) {
      return;
    }

    if (docs.length === 0) {
      onImportError('No files or folders selected.');
      return;
    }

    onImportStart();

    try {
      const selectedIds = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        type: doc.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      }));

      const response = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedIds, target }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to import files');
      }

      const result = (await response.json()) as DriveImportResult;
      onImportComplete({
        importedCount: result.importedCount ?? 0,
        importedAudiobookCount: result.importedAudiobookCount ?? 0,
        errors: result.errors ?? [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      onImportError(message);
    }
  };

  return (
    <button
      onClick={openPicker}
      disabled={loading || !session}
      className="inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Opening picker...' : label}
    </button>
  );
}

function loadGooglePickerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/picker.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Picker API'));
    };

    document.head.appendChild(script);
  });
}
