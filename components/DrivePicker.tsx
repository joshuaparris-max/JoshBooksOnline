'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface DrivePickerProps {
  onImportStart: () => void;
  onImportComplete: (count: number) => void;
  onImportError: (error: string) => void;
}

// Type augmentation for Google Picker API
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

/**
 * Component to handle Google Drive file/folder picker integration
 * Opens the official Google Picker API UI for browsing Drive files
 */
export function DrivePicker({ onImportStart, onImportComplete, onImportError }: DrivePickerProps) {
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
      // Load the Google Picker API script dynamically
      await loadGooglePickerScript();

      const google = window.google;
      if (!google?.picker) {
        throw new Error('Google Picker API not available');
      }

      // Build the Picker UI with Drive view
      const picker = new google.picker.PickerBuilder()
        .addView(new google.picker.DocsView()
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
      // Extract file/folder IDs from selected items
      const selectedIds = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        mimeType: doc.mimeType,
        type: doc.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      }));

      // Call the import API route
      const response = await fetch('/api/library/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedIds }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to import files');
      }

      const result = await response.json();
      onImportComplete(result.importedCount || 0);
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
      {loading ? 'Opening picker...' : 'Import from Drive'}
    </button>
  );
}

/**
 * Load the Google Picker API script dynamically if not already loaded
 */
function loadGooglePickerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
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
