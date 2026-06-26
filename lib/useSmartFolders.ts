'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BookEntry, AudiobookEntry } from '@/types/books';

export type SmartFolderMediaType = 'ebook' | 'audiobook' | 'any';

export interface SmartFolder {
  id: string;
  name: string;
  /** Media type filter */
  mediaType: SmartFolderMediaType;
  /** Match items whose source includes this string (case-insensitive) */
  source?: string;
  /** Match items whose author includes this string (case-insensitive) */
  author?: string;
  /** Match items whose title includes this string (case-insensitive) */
  titleKeyword?: string;
  /** Published year range */
  yearMin?: number;
  yearMax?: number;
  /** Minimum reading progress % (ebooks only) */
  progressMin?: number;
  /** Maximum reading progress % (ebooks only) */
  progressMax?: number;
  /** Only include items with any progress tracked */
  hasProgress?: boolean;
}

const SMART_FOLDERS_KEY = 'joshbooks-smart-folders';

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `sf_${Date.now().toString(36)}`;
  }
}

export function matchesSmartFolder(
  folder: SmartFolder,
  item: BookEntry | AudiobookEntry,
  kind: 'ebook' | 'audiobook'
): boolean {
  if (folder.mediaType !== 'any' && folder.mediaType !== kind) return false;

  const title = kind === 'ebook'
    ? ((item as BookEntry).title ?? (item as BookEntry).name ?? '')
    : (item as AudiobookEntry).title;

  if (folder.titleKeyword) {
    if (!title.toLowerCase().includes(folder.titleKeyword.toLowerCase())) return false;
  }

  if (folder.source) {
    if (!item.source.toLowerCase().includes(folder.source.toLowerCase())) return false;
  }

  const authors = kind === 'ebook'
    ? ((item as BookEntry).authors ?? [])
    : ((item as AudiobookEntry).authors ?? []);
  if (folder.author) {
    const q = folder.author.toLowerCase();
    if (!authors.some((a) => a.toLowerCase().includes(q))) return false;
  }

  const year = kind === 'ebook'
    ? parseInt((item as BookEntry).publishedDate ?? '', 10)
    : parseInt((item as AudiobookEntry).publishedDate ?? '', 10);
  if (folder.yearMin && (!year || year < folder.yearMin)) return false;
  if (folder.yearMax && (!year || year > folder.yearMax)) return false;

  if (kind === 'ebook') {
    const progress = (item as BookEntry).readingProgress ?? 0;
    if (folder.hasProgress && progress === 0) return false;
    if (folder.progressMin !== undefined && progress < folder.progressMin) return false;
    if (folder.progressMax !== undefined && progress > folder.progressMax) return false;
  }

  return true;
}

export function useSmartFolders() {
  const [folders, setFolders] = useState<SmartFolder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SMART_FOLDERS_KEY);
      if (raw) setFolders(JSON.parse(raw) as SmartFolder[]);
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(SMART_FOLDERS_KEY, JSON.stringify(folders));
  }, [folders, loaded]);

  const createFolder = useCallback((input: Omit<SmartFolder, 'id'>) => {
    const id = newId();
    setFolders((prev) => [...prev, { ...input, id }]);
    return id;
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Omit<SmartFolder, 'id'>>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { folders, createFolder, updateFolder, deleteFolder };
}
