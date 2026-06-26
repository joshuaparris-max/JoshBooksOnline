'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Audiobook } from '@/types/books';
import {
  mergeYoutubeCatalog,
  type YoutubeCatalogState,
} from '@/lib/youtubeCatalog';

const REMOVED_KEY = 'joshbooks-youtube-removed';
const EDITS_KEY = 'joshbooks-youtube-edits';
const CUSTOM_KEY = 'joshbooks-youtube-custom';
const LINKS_KEY = 'joshbooks-youtube-links';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota
  }
}

export function useYoutubeCatalog() {
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Audiobook>>>({});
  const [custom, setCustom] = useState<Audiobook[]>([]);
  const [youtubeLinks, setYoutubeLinks] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const serverReady = useRef(false);

  const catalogState: YoutubeCatalogState = useMemo(
    () => ({ removedIds, edits, custom }),
    [removedIds, edits, custom]
  );

  const catalog = useMemo(() => mergeYoutubeCatalog(catalogState), [catalogState]);

  // Restore from localStorage on mount
  useEffect(() => {
    setRemovedIds(readJson<string[]>(REMOVED_KEY, []));
    setEdits(readJson<Record<string, Partial<Audiobook>>>(EDITS_KEY, {}));
    setCustom(readJson<Audiobook[]>(CUSTOM_KEY, []));
    setYoutubeLinks(readJson<Record<string, string>>(LINKS_KEY, {}));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(REMOVED_KEY, removedIds);
  }, [removedIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(EDITS_KEY, edits);
  }, [edits, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(CUSTOM_KEY, custom);
  }, [custom, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(LINKS_KEY, youtubeLinks);
  }, [youtubeLinks, hydrated]);

  const hydrateFromServer = useCallback((data: Record<string, unknown> | null) => {
    if (!data) return;
    if (Array.isArray(data.youtubeRemoved)) setRemovedIds(data.youtubeRemoved as string[]);
    if (data.youtubeEdits && typeof data.youtubeEdits === 'object') {
      setEdits(data.youtubeEdits as Record<string, Partial<Audiobook>>);
    }
    if (Array.isArray(data.youtubeCustom)) setCustom(data.youtubeCustom as Audiobook[]);
    if (data.youtubeLinks && typeof data.youtubeLinks === 'object') {
      setYoutubeLinks(data.youtubeLinks as Record<string, string>);
    }
  }, []);

  const serverBlob = useMemo(
    () => ({
      youtubeRemoved: removedIds,
      youtubeEdits: edits,
      youtubeCustom: custom,
      youtubeLinks,
    }),
    [removedIds, edits, custom, youtubeLinks]
  );

  const removeYoutube = useCallback((id: string) => {
    setRemovedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setYoutubeLinks((prev) => {
      const next = { ...prev };
      for (const [ebookId, ytId] of Object.entries(next)) {
        if (ytId === id) delete next[ebookId];
      }
      return next;
    });
  }, []);

  const restoreYoutube = useCallback((id: string) => {
    setRemovedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const saveYoutubeEdit = useCallback((audiobook: Audiobook) => {
    const isCustom = audiobook.isCustom || custom.some((ab) => ab.id === audiobook.id);
    if (isCustom) {
      setCustom((prev) => {
        const idx = prev.findIndex((ab) => ab.id === audiobook.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...audiobook, isCustom: true };
          return next;
        }
        return [...prev, { ...audiobook, isCustom: true }];
      });
    } else {
      setEdits((prev) => ({ ...prev, [audiobook.id]: audiobook }));
    }
    setRemovedIds((prev) => prev.filter((x) => x !== audiobook.id));
  }, [custom]);

  const addYoutubeCustom = useCallback((audiobook: Audiobook) => {
    const entry = { ...audiobook, isCustom: true };
    setCustom((prev) => {
      const idx = prev.findIndex((ab) => ab.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
    setRemovedIds((prev) => prev.filter((x) => x !== entry.id));
  }, []);

  const setYoutubeLink = useCallback((ebookId: string, youtubeId: string | null) => {
    setYoutubeLinks((prev) => {
      if (!youtubeId) {
        const next = { ...prev };
        delete next[ebookId];
        return next;
      }
      return { ...prev, [ebookId]: youtubeId };
    });
  }, []);

  return {
    catalog,
    catalogState,
    youtubeLinks,
    hydrated,
    serverReady,
    serverBlob,
    hydrateFromServer,
    removeYoutube,
    restoreYoutube,
    saveYoutubeEdit,
    addYoutubeCustom,
    setYoutubeLink,
    setYoutubeLinks,
  };
}
