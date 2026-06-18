import { createHash } from 'crypto';
import type { AudiobookEntry, BookEntry } from '@/types/books';

const LIBRARY_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const ebookCache = new Map<string, CacheEntry<BookEntry[]>>();
const audiobookCache = new Map<string, CacheEntry<AudiobookEntry[]>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + LIBRARY_CACHE_TTL_MS,
  });
}

export function getCachedLibrary(accessToken: string): BookEntry[] | null {
  return getCached(ebookCache, cacheKey(accessToken));
}

export function setCachedLibrary(accessToken: string, books: BookEntry[]) {
  setCached(ebookCache, cacheKey(accessToken), books);
}

export function getCachedAudiobooks(accessToken: string): AudiobookEntry[] | null {
  return getCached(audiobookCache, cacheKey(accessToken));
}

export function setCachedAudiobooks(accessToken: string, audiobooks: AudiobookEntry[]) {
  setCached(audiobookCache, cacheKey(accessToken), audiobooks);
}

export function clearLibraryCache(accessToken: string) {
  const key = cacheKey(accessToken);
  ebookCache.delete(key);
  audiobookCache.delete(key);
}

function cacheKey(accessToken: string) {
  return createHash('sha256').update(accessToken).digest('hex');
}
