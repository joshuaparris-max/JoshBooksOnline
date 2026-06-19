'use client';

import { useState } from 'react';
import type { Audiobook, AudiobookAvailabilityType } from '@/types/books';
import { isValidYoutubeUrl } from '@/lib/youtubeCatalog';

interface YouTubeAudiobookEditorProps {
  initial: Audiobook;
  onClose: () => void;
  onSave: (audiobook: Audiobook) => void;
}

const FIELD =
  'w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
const LABEL = 'block text-xs font-medium uppercase tracking-wide text-slate-400 mb-1';

export default function YouTubeAudiobookEditor({
  initial,
  onClose,
  onSave,
}: YouTubeAudiobookEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [author, setAuthor] = useState(initial.author);
  const [youtubeUrl, setYoutubeUrl] = useState(initial.youtubeUrl);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [availabilityType, setAvailabilityType] = useState<AudiobookAvailabilityType>(
    initial.availabilityType
  );
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!title.trim() || !author.trim()) {
      setError('Title and author are required.');
      return;
    }
    if (!isValidYoutubeUrl(youtubeUrl.trim())) {
      setError('Enter a valid YouTube watch or youtu.be URL.');
      return;
    }
    const displayLabel =
      availabilityType === 'full_public_domain'
        ? 'Full public-domain audiobook'
        : availabilityType === 'official_preview'
          ? 'Official audiobook preview'
          : undefined;

    onSave({
      ...initial,
      title: title.trim(),
      author: author.trim(),
      youtubeUrl: youtubeUrl.trim(),
      notes: notes.trim() || undefined,
      availabilityType,
      displayLabel,
      catalogueMatches: initial.catalogueMatches?.length
        ? initial.catalogueMatches
        : [title.trim()],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Edit YouTube audiobook</h2>
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
            <label className={LABEL}>Title</label>
            <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Author</label>
            <input className={FIELD} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>YouTube URL</label>
            <input
              className={FIELD}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select
              className={FIELD}
              value={availabilityType}
              onChange={(e) => setAvailabilityType(e.target.value as AudiobookAvailabilityType)}
            >
              <option value="full_public_domain">Full public-domain audiobook</option>
              <option value="official_preview">Official preview / sample</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              className={`${FIELD} min-h-[80px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
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
              className="rounded-full bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
