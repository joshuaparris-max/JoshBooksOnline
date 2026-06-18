'use client';

import { useState } from 'react';
import type { useCollections } from '@/lib/useCollections';

type CollectionsApi = ReturnType<typeof useCollections>;

interface Props {
  api: CollectionsApi;
  /** Filter selection (when not in item-membership mode). */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** When set, the modal toggles this item's membership in folders. */
  itemId?: string | null;
  itemLabel?: string;
  onClose: () => void;
}

export default function CollectionsManager({ api, selectedId, onSelect, itemId, itemLabel, onClose }: Props) {
  const [, force] = useState(0);
  const memberMode = !!itemId;

  const rows = (parentId: string | null, depth: number): React.ReactNode[] =>
    api.childrenOf(parentId).flatMap((c) => {
      const count = (api.membership[c.id] ?? []).length;
      const inItem = memberMode && (api.membership[c.id] ?? []).includes(itemId!);
      const moveTargets = api.collections.filter(
        (t) => t.id !== c.id && !api.descendantIds(c.id).includes(t.id)
      );
      return [
        <div
          key={c.id}
          className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${selectedId === c.id && !memberMode ? 'bg-sky-600/20' : 'hover:bg-slate-800'}`}
          style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        >
          {memberMode ? (
            <input
              type="checkbox"
              checked={inItem}
              onChange={() => {
                api.toggleItem(c.id, itemId!);
                force((n) => n + 1);
              }}
              className="h-4 w-4 accent-sky-500"
            />
          ) : (
            <button type="button" onClick={() => onSelect?.(c.id)} className="text-base">
              📁
            </button>
          )}
          <button
            type="button"
            onClick={() => (memberMode ? api.toggleItem(c.id, itemId!) : onSelect?.(c.id))}
            className="min-w-0 flex-1 truncate text-left text-slate-200"
            title={c.tags.length ? `Tags: ${c.tags.join(', ')}` : undefined}
          >
            {c.name}
            <span className="ml-2 text-xs text-slate-500">{count}</span>
            {c.tags.length > 0 && <span className="ml-2 text-xs text-amber-300/80">#{c.tags.join(' #')}</span>}
          </button>

          {!memberMode && (
            <div className="flex shrink-0 items-center gap-1 text-xs">
              <button
                type="button"
                title="New sub-folder"
                onClick={() => {
                  const name = window.prompt('New sub-folder name:');
                  if (name) api.createCollection(name, c.id);
                }}
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                ＋
              </button>
              <button
                type="button"
                title="Rename"
                onClick={() => {
                  const name = window.prompt('Rename folder:', c.name);
                  if (name) api.renameCollection(c.id, name);
                }}
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                ✎
              </button>
              <button
                type="button"
                title="Edit tags (comma separated)"
                onClick={() => {
                  const tags = window.prompt('Tags (comma separated):', c.tags.join(', '));
                  if (tags !== null) api.setTags(c.id, tags.split(',').map((t) => t.trim()).filter(Boolean));
                }}
                className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                #
              </button>
              <select
                title="Move to…"
                value={c.parentId ?? ''}
                onChange={(e) => api.moveCollection(c.id, e.target.value || null)}
                className="rounded border border-white/10 bg-slate-950 px-1 py-0.5 text-slate-300"
              >
                <option value="">(top level)</option>
                {moveTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    → {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="Delete folder"
                onClick={() => {
                  if (window.confirm(`Delete folder "${c.name}" and its sub-folders? (Items are not deleted.)`))
                    api.deleteCollection(c.id);
                }}
                className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-500/20"
              >
                🗑
              </button>
            </div>
          )}
        </div>,
        ...rows(c.id, depth + 1),
      ];
    });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {memberMode ? 'Add to folders' : 'Folders'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        {memberMode && itemLabel && (
          <p className="truncate px-6 pt-3 text-xs text-slate-500">{itemLabel}</p>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {!memberMode && (
            <div className="mb-2 space-y-1">
              <button
                type="button"
                onClick={() => onSelect?.(null)}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${selectedId == null ? 'bg-sky-600/20 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
              >
                📚 All items
              </button>
              <button
                type="button"
                onClick={() => onSelect?.('__unfiled__')}
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${selectedId === '__unfiled__' ? 'bg-sky-600/20 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
              >
                🗂 Unfiled
              </button>
            </div>
          )}

          {api.collections.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No folders yet. Create one below.</p>
          ) : (
            <div className="space-y-0.5">{rows(null, 0)}</div>
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('New folder name:');
              if (name) api.createCollection(name, null);
            }}
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            ＋ New folder
          </button>
        </div>
      </div>
    </div>
  );
}
