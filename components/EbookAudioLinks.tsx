'use client';

import Link from 'next/link';
import type { Audiobook } from '@/types/books';
import { youtubeListenId } from '@/lib/youtubeCatalog';

interface EbookAudioLinksProps {
  driveLinkId?: string;
  youtubeLinkId?: string;
  youtubeMatches: Audiobook[];
  onLink: () => void;
  onUnlinkDrive: () => void;
  onUnlinkYoutube: () => void;
  onPickYoutube: () => void;
  compact?: boolean;
}

export default function EbookAudioLinks({
  driveLinkId,
  youtubeLinkId,
  youtubeMatches,
  onLink,
  onUnlinkDrive,
  onUnlinkYoutube,
  onPickYoutube,
  compact = false,
}: EbookAudioLinksProps) {
  const hasDrive = Boolean(driveLinkId);
  const hasYoutube = Boolean(youtubeLinkId);
  const ambiguousYoutube = !hasYoutube && youtubeMatches.length > 1;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {hasDrive && (
          <>
            <Link
              href={`/listen/${driveLinkId}`}
              title="Listen (Drive)"
              className="rounded-full bg-sky-600/20 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-600/30"
            >
              🎧
            </Link>
            <button
              type="button"
              onClick={onUnlinkDrive}
              title="Unlink Drive audiobook"
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
            >
              ✕
            </button>
          </>
        )}
        {hasYoutube && (
          <>
            <Link
              href={`/listen/${youtubeListenId(youtubeLinkId!)}`}
              title="Listen (YouTube)"
              className="rounded-full bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-600/30"
            >
              ▶
            </Link>
            <button
              type="button"
              onClick={onUnlinkYoutube}
              title="Unlink YouTube audiobook"
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"
            >
              ✕
            </button>
          </>
        )}
        {ambiguousYoutube && (
          <button
            type="button"
            onClick={onPickYoutube}
            title="Choose among YouTube matches"
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
          >
            ▶ {youtubeMatches.length}
          </button>
        )}
        {!hasDrive && !hasYoutube && !ambiguousYoutube && (
          <button
            type="button"
            onClick={onLink}
            title="Link an audiobook"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            🔗
          </button>
        )}
        {!hasDrive && !hasYoutube && youtubeMatches.length === 1 && (
          <button
            type="button"
            onClick={onPickYoutube}
            title="Link matched YouTube audiobook"
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            ▶ YT
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasDrive && (
        <div className="flex items-center gap-2">
          <Link
            href={`/listen/${driveLinkId}`}
            className="flex-1 rounded-full bg-sky-600/20 px-3 py-2 text-center text-xs font-semibold text-sky-200 transition hover:bg-sky-600/30"
          >
            🎧 Drive audiobook
          </Link>
          <button
            type="button"
            onClick={onUnlinkDrive}
            title="Unlink Drive audiobook"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Unlink
          </button>
        </div>
      )}
      {hasYoutube && (
        <div className="flex items-center gap-2">
          <Link
            href={`/listen/${youtubeListenId(youtubeLinkId!)}`}
            className="flex-1 rounded-full bg-red-600/20 px-3 py-2 text-center text-xs font-semibold text-red-200 transition hover:bg-red-600/30"
          >
            ▶ YouTube audiobook
          </Link>
          <button
            type="button"
            onClick={onUnlinkYoutube}
            title="Unlink YouTube audiobook"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Unlink
          </button>
        </div>
      )}
      {ambiguousYoutube && (
        <button
          type="button"
          onClick={onPickYoutube}
          className="w-full rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
        >
          ▶ Pick YouTube match ({youtubeMatches.length} options)
        </button>
      )}
      {!hasDrive && !hasYoutube && !ambiguousYoutube && youtubeMatches.length === 1 && (
        <button
          type="button"
          onClick={onPickYoutube}
          className="w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          ▶ Link YouTube match
        </button>
      )}
      <button
        type="button"
        onClick={onLink}
        className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
      >
        {hasDrive || hasYoutube ? 'Change audiobook links…' : '🎧 Link audiobook'}
      </button>
    </div>
  );
}
