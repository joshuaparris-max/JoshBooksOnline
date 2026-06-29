'use client';

import { useEffect, useRef } from 'react';

/**
 * Loads the user's full /api/userdata blob once, hydrates YouTube catalogue
 * overrides from it, then debounces PUTs that merge YouTube changes back into
 * the same blob (without wiping metadata, links, collections, etc.).
 */
export function useUserdataYoutubeSync(
  serverBlob: Record<string, unknown>,
  hydrateFromServer: (data: Record<string, unknown> | null) => void
) {
  const serverReady = useRef(false);
  const userdataBase = useRef<Record<string, unknown>>({ v: 1 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/userdata', { cache: 'no-store' });
        const { data } = (await response.json()) as { data: Record<string, unknown> | null };
        if (!cancelled && data) {
          // One-time migration: clear a stale removal list that was hiding most
          // of the bundled catalogue. The cleared blob (with the marker) is
          // persisted by the debounced PUT below, so removals don't come back.
          const blob = data.youtubeRemovedResetV1
            ? data
            : { ...data, youtubeRemoved: [], youtubeRemovedResetV1: true };
          userdataBase.current = blob;
          hydrateFromServer(blob);
        }
      } catch {
        // offline / KV not configured — localStorage still works
      } finally {
        if (!cancelled) serverReady.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer]);

  useEffect(() => {
    if (!serverReady.current) return;
    const merged = { ...userdataBase.current, ...serverBlob };
    const timer = window.setTimeout(() => {
      fetch('/api/userdata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
        .then(() => {
          userdataBase.current = merged;
        })
        .catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [serverBlob]);
}
