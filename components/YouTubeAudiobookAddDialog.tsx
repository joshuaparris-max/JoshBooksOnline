'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Audiobook, AudiobookAvailabilityType } from '@/types/books';
import { createCustomYoutubeId, isValidYoutubeUrl } from '@/lib/youtubeCatalog';
import type { YoutubeLookupResult } from '@/lib/youtubeMetadata';
import { youtubeUrlsMatch } from '@/lib/youtubeMetadata';

interface YouTubeAudiobookAddDialogProps {
  existingCatalog: Audiobook[];
  onClose: () => void;
  onSave: (audiobook: Audiobook) => void;
}

const FIELD =
  'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
const LABEL = 'block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1';

export default function YouTubeAudiobookAddDialog({
  existingCatalog,
  onClose,
  onSave,
}: YouTubeAudiobookAddDialogProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [durationLabel, setDurationLabel] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [availabilityType, setAvailabilityType] = useState<AudiobookAvailabilityType>('unknown');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupTimer = useRef<number | null>(null);

  const applyLookup = useCallback((metadata: YoutubeLookupResult) => {
    setYoutubeUrl(metadata.youtubeUrl);
    setTitle(metadata.title);
    setAuthor(metadata.author);
    setDurationLabel(metadata.durationLabel);
    setSource(metadata.source);
    setLookedUp(true);
    if (metadata.isPlaylist) {
      setNotes((prev) => prev || 'YouTube playlist — multiple videos.');
    }
  }, []);

  const runLookup = useCallback(
    async (rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (!trimmed) {
        setError('Paste a YouTube URL first.');
        return;
      }
      if (!isValidYoutubeUrl(trimmed)) {
        setError('Enter a valid YouTube watch, youtu.be, or playlist URL.');
        return;
      }

      const duplicate = existingCatalog.find((entry) => youtubeUrlsMatch(entry.youtubeUrl, trimmed));
      if (duplicate) {
        setError(`This URL is already in your catalogue as “${duplicate.title}”.`);
        return;
      }

      setLookupLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/youtube/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        const payload = (await response.json()) as {
          metadata?: YoutubeLookupResult;
          error?: string;
        };
        if (!response.ok || !payload.metadata) {
          throw new Error(payload.error ?? 'Could not look up that YouTube link.');
        }
        applyLookup(payload.metadata);
      } catch (lookupError) {
        setError(lookupError instanceof Error ? lookupError.message : 'Lookup failed.');
        setLookedUp(false);
      } finally {
        setLookupLoading(false);
      }
    },
    [applyLookup, existingCatalog]
  );

  useEffect(() => {
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    const trimmed = youtubeUrl.trim();
    if (!trimmed || !isValidYoutubeUrl(trimmed) || lookedUp) return;

    lookupTimer.current = window.setTimeout(() => {
      void runLookup(trimmed);
    }, 700);

    return () => {
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
  }, [youtubeUrl, lookedUp, runLookup]);

  const handleSave = () => {
    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl || !isValidYoutubeUrl(trimmedUrl)) {
      setError('Enter a valid YouTube URL.');
      return;
    }
    if (!title.trim() || !author.trim()) {
      setError('Title and author are required.');
      return;
    }

    const id = createCustomYoutubeId(trimmedUrl);
    if (!id) {
      setError('Could not derive an id from that YouTube URL.');
      return;
    }

    const duplicate = existingCatalog.find(
      (entry) => entry.id === id || youtubeUrlsMatch(entry.youtubeUrl, trimmedUrl)
    );
    if (duplicate) {
      setError(`This audiobook is already in your catalogue as “${duplicate.title}”.`);
      return;
    }

    const displayLabel =
      availabilityType === 'full_public_domain'
        ? 'Full public-domain audiobook'
        : availabilityType === 'official_preview'
          ? 'Official audiobook preview'
          : 'Added by you';

    onSave({
      id,
      title: title.trim(),
      author: author.trim(),
      youtubeUrl: trimmedUrl,
      catalogueMatches: [title.trim()],
      availabilityType,
      displayLabel,
      source: source ?? 'YouTube',
      rightsNote: 'User-added link; availability and recording rights not independently verified.',
      notes: notes.trim() || undefined,
      durationLabel,
      isCustom: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Add YouTube audiobook</h2>
            <p className="mt-1 text-sm text-slate-400">
              Paste a link — title, author and length are fetched automatically. Saved entries sync across your devices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <div>
            <label className={LABEL}>YouTube URL</label>
            <div className="flex gap-2">
              <input
                className={FIELD}
                value={youtubeUrl}
                onChange={(e) => {
                  setYoutubeUrl(e.target.value);
                  setLookedUp(false);
                  setError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=… or playlist link"
                autoFocus
              />
              <button
                type="button"
                onClick={() => void runLookup(youtubeUrl)}
                disabled={lookupLoading}
                className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
              >
                {lookupLoading ? 'Looking…' : 'Look up'}
              </button>
            </div>
          </div>

          {lookedUp && (
            <>
              <div>
                <label className={LABEL}>Title</label>
                <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>Author</label>
                <input className={FIELD} value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              {durationLabel && (
                <div>
                  <label className={LABEL}>Length</label>
                  <p className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                    {durationLabel}
                  </p>
                </div>
              )}
              {source && (
                <p className="text-xs text-slate-500">YouTube channel: {source}</p>
              )}
              <div>
                <label className={LABEL}>Type</label>
                <select
                  className={FIELD}
                  value={availabilityType}
                  onChange={(e) => setAvailabilityType(e.target.value as AudiobookAvailabilityType)}
                >
                  <option value="unknown">Unknown / user-added</option>
                  <option value="full_public_domain">Full public-domain audiobook</option>
                  <option value="official_preview">Official preview / sample</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Notes</label>
                <textarea
                  className={`${FIELD} min-h-[80px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!lookedUp || lookupLoading}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Add to catalogue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
