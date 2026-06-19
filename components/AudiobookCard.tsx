'use client';

import { useState } from 'react';
import type { Audiobook } from '@/types/books';

interface AudiobookCardProps {
  audiobook: Audiobook;
  onRemove?: (id: string) => void;
  onEdit?: (audiobook: Audiobook) => void;
}

function getColorFromTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 35%)`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

export function AudiobookCard({ audiobook, onRemove, onEdit }: AudiobookCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const youtubeId = extractYouTubeId(audiobook.youtubeUrl);

  const typeColor =
    audiobook.availabilityType === 'full_public_domain'
      ? 'bg-emerald-600 text-white'
      : audiobook.availabilityType === 'official_preview'
        ? 'bg-amber-600 text-white'
        : 'bg-slate-600 text-white';

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20 transition hover:border-white/20 hover:bg-slate-900">
      <div className="flex items-start gap-4">
        {/* Album Art */}
        <div
          className="h-24 w-24 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl"
          style={{ backgroundColor: getColorFromTitle(audiobook.title) }}
        >
          {getInitials(audiobook.title)}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">
            {audiobook.title}
          </h3>
          <p className="text-sm text-slate-400 truncate">{audiobook.author}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {audiobook.displayLabel && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${typeColor}`}>
                {audiobook.displayLabel}
              </span>
            )}
            {audiobook.source && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                {audiobook.source}
              </span>
            )}
          </div>

          {audiobook.notes && (
            <p className="mt-2 text-xs text-slate-400 line-clamp-2">
              {audiobook.notes}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowPlayer(true)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
            >
              Play
            </button>
            <a
              href={audiobook.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition"
            >
              YouTube
            </a>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(audiobook)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 text-sm font-semibold transition hover:bg-white/10"
              >
                Edit
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(audiobook.id)}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-semibold transition"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* YouTube Player Modal */}
      {showPlayer && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <div className="rounded-2xl bg-slate-950 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white truncate">
                    {audiobook.title}
                  </h3>
                  <p className="text-sm text-slate-400 truncate">
                    {audiobook.author}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPlayer(false);
                    setVideoError(false);
                  }}
                  className="ml-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                  aria-label="Close player"
                >
                  ✕
                </button>
              </div>

              {videoError ? (
                <div className="aspect-video bg-slate-950 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-slate-400 mb-4">
                      Unable to load video. This may be because:
                    </p>
                    <ul className="text-left text-sm text-slate-400 space-y-2 max-w-md mx-auto mb-6">
                      <li>• The video has been removed or made private</li>
                      <li>• The video is age-restricted or not available in your region</li>
                      <li>• Embedding is disabled for this video</li>
                    </ul>
                    <a
                      href={audiobook.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                </div>
              ) : youtubeId ? (
                <iframe
                  width="100%"
                  height="500"
                  src={`https://www.youtube.com/embed/${youtubeId}`}
                  title={audiobook.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={() => setVideoError(true)}
                  className="bg-black"
                />
              ) : (
                <div className="aspect-video bg-slate-950 flex items-center justify-center">
                  <p className="text-slate-400">Invalid YouTube URL</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
