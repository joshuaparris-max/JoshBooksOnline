import baseCatalog from '@/lib/youtube-audiobooks.json';
import type { Audiobook, BookEntry } from '@/types/books';
import { bookCatalogueKeys, matchesCatalogueAlias } from '@/lib/catalogueMatch';

export type YoutubeCatalogState = {
  removedIds: string[];
  edits: Record<string, Partial<Audiobook>>;
  custom: Audiobook[];
};

export const YOUTUBE_ID_PREFIX = 'youtube-';

export function youtubeListenId(catalogId: string): string {
  return catalogId.startsWith(YOUTUBE_ID_PREFIX) ? catalogId : `${YOUTUBE_ID_PREFIX}${catalogId}`;
}

export function catalogIdFromListenId(id: string): string | null {
  if (!id.startsWith(YOUTUBE_ID_PREFIX)) return null;
  return id.slice(YOUTUBE_ID_PREFIX.length);
}

export function isYoutubeListenId(id: string): boolean {
  return id.startsWith(YOUTUBE_ID_PREFIX);
}

export function getBaseYoutubeCatalog(): Audiobook[] {
  return baseCatalog as Audiobook[];
}

/** Apply user removals, edits, and custom entries on top of the bundled catalog. */
export function mergeYoutubeCatalog(state: YoutubeCatalogState): Audiobook[] {
  const removed = new Set(state.removedIds);
  const merged: Audiobook[] = [];

  for (const entry of getBaseYoutubeCatalog()) {
    if (removed.has(entry.id)) continue;
    const edit = state.edits[entry.id];
    merged.push(edit ? { ...entry, ...edit } : { ...entry });
  }

  for (const custom of state.custom) {
    if (removed.has(custom.id)) continue;
    const edit = state.edits[custom.id];
    merged.push(edit ? { ...custom, ...edit } : { ...custom });
  }

  return merged;
}

export function findYoutubeMatches(
  book: Pick<BookEntry, 'name' | 'title'>,
  catalog: Audiobook[]
): Audiobook[] {
  const keys = bookCatalogueKeys(book);
  return catalog.filter((ab) => matchesCatalogueAlias(keys, ab.catalogueMatches));
}

export function dedupeAudiobooksById(items: Audiobook[]): Audiobook[] {
  return Array.from(new Map(items.map((ab) => [ab.id, ab])).values());
}

export function findYoutubeByCatalogId(catalogId: string, state: YoutubeCatalogState): Audiobook | null {
  return mergeYoutubeCatalog(state).find((ab) => ab.id === catalogId) ?? null;
}

export function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

export function isValidYoutubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}
