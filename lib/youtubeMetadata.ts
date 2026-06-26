import {
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  isValidYoutubeUrl,
} from '@/lib/youtubeCatalog';

export type YoutubeLookupResult = {
  youtubeUrl: string;
  title: string;
  author: string;
  durationLabel?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  source?: string;
  isPlaylist: boolean;
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export function normalizeYoutubeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const videoId = url.pathname.replace(/^\//, '').split('/')[0];
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/playlist') {
        const listId = url.searchParams.get('list');
        return listId ? `https://www.youtube.com/playlist?list=${listId}` : null;
      }

      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function formatDurationSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Best-effort split of a YouTube oEmbed title into book title and author. */
export function parseAudiobookTitle(rawTitle: string, channelName: string): { title: string; author: string } {
  let working = rawTitle.trim();
  if (!working) return { title: 'Untitled', author: channelName || 'Unknown' };

  working = working
    .replace(/\s*\|\s*Full Audio Book.*$/i, '')
    .replace(/\s*\|\s*FULL Audiobook.*$/i, '')
    .replace(/\s*\|\s*Full Audiobook.*$/i, '')
    .replace(/\s*\|\s*.*$/i, '')
    .replace(/\s*—\s*Full Course.*$/i, '')
    .replace(/\s*-\s*Full Course.*$/i, '')
    .trim();

  const byMatch = working.match(/^(.+?)\s+by\s+(.+?)(?:\s+read\s+by|\s+Part\s+\d|\s*\(|$)/i);
  if (byMatch) {
    return {
      title: byMatch[1].trim(),
      author: byMatch[2].trim(),
    };
  }

  const readByMatch = working.match(/^(.+?)\s+read\s+by\s+(.+)$/i);
  if (readByMatch) {
    return {
      title: readByMatch[1].trim(),
      author: readByMatch[2].trim(),
    };
  }

  return {
    title: working,
    author: channelName || 'Unknown',
  };
}

function extractDurationSeconds(html: string): number | undefined {
  const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
  if (lengthMatch) return Number(lengthMatch[1]);

  const msMatch = html.match(/"approxDurationMs":"(\d+)"/);
  if (msMatch) return Math.round(Number(msMatch[1]) / 1000);

  return undefined;
}

export async function fetchYoutubeMetadata(inputUrl: string): Promise<YoutubeLookupResult> {
  const youtubeUrl = normalizeYoutubeUrl(inputUrl);
  if (!youtubeUrl || !isValidYoutubeUrl(youtubeUrl)) {
    throw new Error('Enter a valid YouTube watch, youtu.be, or playlist URL.');
  }

  const isPlaylist = /youtube\.com\/playlist\?list=/.test(youtubeUrl);
  const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeUrl)}`;
  const oembedRes = await fetch(oembedUrl, {
    headers: { 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });

  if (!oembedRes.ok) {
    throw new Error('That YouTube link could not be found or is unavailable.');
  }

  const oembed = (await oembedRes.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  const rawTitle = oembed.title?.trim() ?? 'Untitled';
  const channelName = oembed.author_name?.trim() ?? 'Unknown';
  const { title, author } = parseAudiobookTitle(rawTitle, channelName);

  let durationSeconds: number | undefined;
  if (!isPlaylist) {
    try {
      const pageRes = await fetch(youtubeUrl, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
      });
      if (pageRes.ok) {
        durationSeconds = extractDurationSeconds(await pageRes.text());
      }
    } catch {
      // duration is optional
    }
  }

  return {
    youtubeUrl,
    title,
    author,
    durationLabel: durationSeconds ? formatDurationSeconds(durationSeconds) : undefined,
    durationSeconds,
    thumbnailUrl: oembed.thumbnail_url,
    source: channelName,
    isPlaylist,
  };
}

export function youtubeUrlsMatch(a: string, b: string): boolean {
  const left = normalizeYoutubeUrl(a);
  const right = normalizeYoutubeUrl(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftVideo = extractYouTubeVideoId(left);
  const rightVideo = extractYouTubeVideoId(right);
  if (leftVideo && rightVideo) return leftVideo === rightVideo;

  const leftPlaylist = extractYouTubePlaylistId(left);
  const rightPlaylist = extractYouTubePlaylistId(right);
  if (leftPlaylist && rightPlaylist && /playlist\?list=/.test(left) && /playlist\?list=/.test(right)) {
    return leftPlaylist === rightPlaylist;
  }

  return false;
}
