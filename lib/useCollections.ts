'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  tags: string[];
}

const COLLECTIONS_KEY = 'joshbooks-collections';
const MEMBERSHIP_KEY = 'joshbooks-collection-items';

type Membership = Record<string, string[]>; // collectionId -> item ids

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
}

/**
 * Virtual collections (folders) + membership, persisted to localStorage. Supports
 * nesting (parentId), tags, and items belonging to multiple collections. Works
 * across ebooks and audiobooks regardless of Drive permissions.
 */
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [membership, setMembership] = useState<Membership>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const c = window.localStorage.getItem(COLLECTIONS_KEY);
      if (c) setCollections(JSON.parse(c) as Collection[]);
      const m = window.localStorage.getItem(MEMBERSHIP_KEY);
      if (m) setMembership(JSON.parse(m) as Membership);
    } catch {
      // ignore malformed values
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections, loaded]);
  useEffect(() => {
    if (loaded) window.localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(membership));
  }, [membership, loaded]);

  const childrenOf = useCallback(
    (parentId: string | null) => collections.filter((c) => c.parentId === parentId),
    [collections]
  );

  const descendantIds = useCallback(
    (id: string): string[] => {
      const out: string[] = [];
      const walk = (pid: string) => {
        for (const c of collections) {
          if (c.parentId === pid) {
            out.push(c.id);
            walk(c.id);
          }
        }
      };
      walk(id);
      return out;
    },
    [collections]
  );

  const createCollection = useCallback((name: string, parentId: string | null = null) => {
    const id = newId();
    setCollections((prev) => [...prev, { id, name: name.trim() || 'Untitled', parentId, tags: [] }]);
    return id;
  }, []);

  const renameCollection = useCallback((id: string, name: string) => {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c)));
  }, []);

  const setTags = useCallback((id: string, tags: string[]) => {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, tags } : c)));
  }, []);

  const moveCollection = useCallback(
    (id: string, parentId: string | null) => {
      // prevent cycles: can't move into self or a descendant
      if (id === parentId) return;
      if (parentId && descendantIds(id).includes(parentId)) return;
      setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, parentId } : c)));
    },
    [descendantIds]
  );

  const deleteCollection = useCallback(
    (id: string) => {
      const toRemove = new Set([id, ...descendantIds(id)]);
      setCollections((prev) => prev.filter((c) => !toRemove.has(c.id)));
      setMembership((prev) => {
        const next = { ...prev };
        for (const cid of toRemove) delete next[cid];
        return next;
      });
    },
    [descendantIds]
  );

  /** Replace all collections + membership (used when hydrating from the server). */
  const hydrate = useCallback((nextCollections: Collection[], nextMembership: Membership) => {
    if (Array.isArray(nextCollections)) setCollections(nextCollections);
    if (nextMembership && typeof nextMembership === 'object') setMembership(nextMembership);
  }, []);

  const toggleItem = useCallback((collectionId: string, itemId: string) => {
    setMembership((prev) => {
      const current = prev[collectionId] ?? [];
      const has = current.includes(itemId);
      return {
        ...prev,
        [collectionId]: has ? current.filter((i) => i !== itemId) : [...current, itemId],
      };
    });
  }, []);

  const itemCollections = useCallback(
    (itemId: string) => collections.filter((c) => (membership[c.id] ?? []).includes(itemId)).map((c) => c.id),
    [collections, membership]
  );

  /** Item ids in a collection, optionally including all nested sub-collections. */
  const collectionItemIds = useCallback(
    (id: string, includeDescendants = true): Set<string> => {
      const ids = includeDescendants ? [id, ...descendantIds(id)] : [id];
      const set = new Set<string>();
      for (const cid of ids) for (const item of membership[cid] ?? []) set.add(item);
      return set;
    },
    [descendantIds, membership]
  );

  const allFiledItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const ids of Object.values(membership)) for (const i of ids) set.add(i);
    return set;
  }, [membership]);

  return {
    collections,
    membership,
    childrenOf,
    descendantIds,
    createCollection,
    renameCollection,
    setTags,
    moveCollection,
    deleteCollection,
    toggleItem,
    hydrate,
    itemCollections,
    collectionItemIds,
    allFiledItemIds,
  };
}
