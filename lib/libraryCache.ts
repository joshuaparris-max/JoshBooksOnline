import { createHash } from 'crypto';
import type { AudiobookEntry, BookEntry } from '@/types/books';
import { kvConfigured, redis } from '@/lib/redis';

const LIBRARY_CACHE_TTL_MS = 5 * 60 * 1000;
const LIBRARY_CACHE_PREFIX = 'joshbooks:library:';
const AUDIOBOOKS_CACHE_PREFIX = 'joshbooks:audiobooks:';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const ebookCache = new Map<string, CacheEntry<BookEntry[]>>();
const audiobookCache = new Map<string, CacheEntry<AudiobookEntry[]>>();

function memoryKey(accessToken: string) {
  return createHash('sha256').update(accessToken).digest('hex');
}

function cacheKey(accessToken: string) {
  return memoryKey(accessToken);
}

function persistentKey(prefix: string, accessToken: string, email?: string) {
  const ownerId = email ? email.toLowerCase() : memoryKey(accessToken);
  return `${prefix}${ownerId}`;
}

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

async function getPersistentCache<T>(prefix: string, accessToken: string, email?: string): Promise<T | null> {
  if (!kvConfigured()) return null;

  const key = persistentKey(prefix, accessToken, email);
  try {
    const raw = (await redis(['GET', key])) as string | null;
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setPersistentCache<T>(prefix: string, accessToken: string, email: string | undefined, value: T) {
  if (!kvConfigured()) return;

  const key = persistentKey(prefix, accessToken, email);
  try {
    await redis(['SET', key, JSON.stringify(value), 'PX', LIBRARY_CACHE_TTL_MS]);
  } catch {
    // Ignore persistent cache failures; the in-memory cache still helps.
  }
}

async function deletePersistentCache(prefix: string, accessToken: string, email?: string) {
  if (!kvConfigured()) return;

  const key = persistentKey(prefix, accessToken, email);
  try {
    await redis(['DEL', key]);
  } catch {
    // Ignore persistent cache failures.
  }
}

export async function getCachedLibrary(accessToken: string, email?: string): Promise<BookEntry[] | null> {
  const key = cacheKey(accessToken);
  const memory = getCached(ebookCache, key);
  if (memory) return memory;

  const persistent = await getPersistentCache<BookEntry[]>(LIBRARY_CACHE_PREFIX, accessToken, email);
  if (persistent) {
    setCached(ebookCache, key, persistent);
  }
  return persistent;
}

export async function setCachedLibrary(accessToken: string, books: BookEntry[], email?: string) {
  const key = cacheKey(accessToken);
  setCached(ebookCache, key, books);
  await setPersistentCache(LIBRARY_CACHE_PREFIX, accessToken, email, books);
}

export async function getCachedAudiobooks(accessToken: string, email?: string): Promise<AudiobookEntry[] | null> {
  const key = cacheKey(accessToken);
  const memory = getCached(audiobookCache, key);
  if (memory) return memory;

  const persistent = await getPersistentCache<AudiobookEntry[]>(AUDIOBOOKS_CACHE_PREFIX, accessToken, email);
  if (persistent) {
    setCached(audiobookCache, key, persistent);
  }
  return persistent;
}

export async function setCachedAudiobooks(accessToken: string, audiobooks: AudiobookEntry[], email?: string) {
  const key = cacheKey(accessToken);
  setCached(audiobookCache, key, audiobooks);
  await setPersistentCache(AUDIOBOOKS_CACHE_PREFIX, accessToken, email, audiobooks);
}

export async function clearLibraryCache(accessToken: string, email?: string) {
  const key = cacheKey(accessToken);
  ebookCache.delete(key);
  audiobookCache.delete(key);
  await Promise.all([
    deletePersistentCache(LIBRARY_CACHE_PREFIX, accessToken, email),
    deletePersistentCache(AUDIOBOOKS_CACHE_PREFIX, accessToken, email),
  ]);
}
