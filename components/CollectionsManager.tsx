'use client';

import { useState } from 'react';
import type { useCollections } from '@/lib/useCollections';
import type { useSmartFolders, SmartFolder, SmartFolderMediaType } from '@/lib/useSmartFolders';

type CollectionsApi = ReturnType<typeof useCollections>;
type SmartFoldersApi = ReturnType<typeof useSmartFolders>;

interface Props {
  api: CollectionsApi;
  smartFoldersApi?: SmartFoldersApi;
  /** Filter selection (when not in item-membership mode). */
  selectedId?: string | null;
  selectedSmartId?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectSmart?: (id: string | null) => void;
  /** When set, the modal toggles this item's membership in folders. */
  itemId?: string | null;
  itemLabel?: string;
  onClose: () => void;
}

const MEDIA_TYPE_LABELS: Record<SmartFolderMediaType, string> = {
  any: 'All media',
  ebook: 'Ebooks',
  audiobook: 'Audiobooks',
};

function SmartFolderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<SmartFolder>;
  onSave: (data: Omit<SmartFolder, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [mediaType, setMediaType] = useState<SmartFolderMediaType>(initial?.mediaType ?? 'any');
  const [source, setSource] = useState(initial?.source ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [titleKeyword, setTitleKeyword] = useState(initial?.titleKeyword ?? '');
  const [yearMin, setYearMin] = useState(initial?.yearMin?.toString() ?? '');
  const [yearMax, setYearMax] = useState(initial?.yearMax?.toString() ?? '');
  const [progressMin, setProgressMin] = useState(initial?.progressMin?.toString() ?? '');
  const [progressMax, setProgressMax] = useState(initial?.progressMax?.toString() ?? '');
  const [hasProgress, setHasProgress] = useState(initial?.hasProgress ?? false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      mediaType,
      source: source.trim() || undefined,
      author: author.trim() || undefined,
      titleKeyword: titleKeyword.trim() || undefined,
      yearMin: yearMin ? parseInt(yearMin, 10) : undefined,
      yearMax: yearMax ? parseInt(yearMax, 10) : undefined,
      progressMin: progressMin ? parseInt(progressMin, 10) : undefined,
      progressMax: progressMax ? parseInt(progressMax, 10) : undefined,
      hasProgress: hasProgress || undefined,
    });
  };

  const inputCls = 'w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500';
  const labelCls = 'block text-xs text-slate-400 mb-1';

  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4">
      <div>
        <label className={labelCls}>Name</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High progress ebooks" />
      </div>
      <div>
        <label className={labelCls}>Media type</label>
        <select className={inputCls} value={mediaType} onChange={(e) => setMediaType(e.target.value as SmartFolderMediaType)}>
          {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Source contains</label>
          <input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Book Club" />
        </div>
        <div>
          <label className={labelCls}>Author contains</label>
          <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Tolkien" />
        </div>
        <div>
          <label className={labelCls}>Title keyword</label>
          <input className={inputCls} value={titleKeyword} onChange={(e) => setTitleKeyword(e.target.value)} placeholder="e.g. ring" />
        </div>
        <div>
          <label className={labelCls}>Year range</label>
          <div className="flex gap-1">
            <input className={inputCls} value={yearMin} onChange={(e) => setYearMin(e.target.value)} placeholder="from" type="number" />
            <input className={inputCls} value={yearMax} onChange={(e) => setYearMax(e.target.value)} placeholder="to" type="number" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Progress % range (ebooks)</label>
          <div className="flex gap-1">
            <input className={inputCls} value={progressMin} onChange={(e) => setProgressMin(e.target.value)} placeholder="min" type="number" min="0" max="100" />
            <input className={inputCls} value={progressMax} onChange={(e) => setProgressMax(e.target.value)} placeholder="max" type="number" min="0" max="100" />
          </div>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={hasProgress} onChange={(e) => setHasProgress(e.target.checked)} className="accent-violet-500" />
            Has any progress
          </label>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={!name.trim()} className="rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded-full bg-slate-700 px-4 py-1.5 text-sm text-slate-200 transition hover:bg-slate-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function CollectionsManager({ api, smartFoldersApi, selectedId, selectedSmartId, onSelect, onSelectSmart, itemId, itemLabel, onClose }: Props) {
  const [, force] = useState(0);
  const [showSmartForm, setShowSmartForm] = useState(false);
  const [editingSmartId, setEditingSmartId] = useState<string | null>(null);
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
                className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${selectedId == null && !selectedSmartId ? 'bg-sky-600/20 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
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

          {/* Smart folders section */}
          {!memberMode && smartFoldersApi && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-widest text-violet-400">Smart folders</p>
              {smartFoldersApi.folders.length === 0 && !showSmartForm && (
                <p className="px-2 pb-2 text-sm text-slate-500">No smart folders yet.</p>
              )}
              <div className="space-y-1">
                {smartFoldersApi.folders.map((f) => (
                  editingSmartId === f.id ? (
                    <SmartFolderForm
                      key={f.id}
                      initial={f}
                      onSave={(data) => {
                        smartFoldersApi.updateFolder(f.id, data);
                        setEditingSmartId(null);
                      }}
                      onCancel={() => setEditingSmartId(null)}
                    />
                  ) : (
                    <div
                      key={f.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${selectedSmartId === f.id ? 'bg-violet-600/20' : 'hover:bg-slate-800'}`}
                    >
                      <button type="button" onClick={() => onSelectSmart?.(f.id)} className="text-base">✦</button>
                      <button
                        type="button"
                        onClick={() => onSelectSmart?.(f.id)}
                        className="min-w-0 flex-1 truncate text-left text-slate-200"
                      >
                        {f.name}
                        <span className="ml-2 text-xs text-slate-500">{MEDIA_TYPE_LABELS[f.mediaType]}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingSmartId(f.id)}
                          className="rounded px-1.5 py-0.5 text-slate-400 hover:bg-slate-700 hover:text-white"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete smart folder "${f.name}"?`)) {
                              smartFoldersApi.deleteFolder(f.id);
                              if (selectedSmartId === f.id) onSelectSmart?.(null);
                            }
                          }}
                          className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-500/20"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>

              {showSmartForm ? (
                <div className="mt-2">
                  <SmartFolderForm
                    onSave={(data) => {
                      smartFoldersApi.createFolder(data);
                      setShowSmartForm(false);
                    }}
                    onCancel={() => setShowSmartForm(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSmartForm(true)}
                  className="mt-2 rounded-full bg-violet-600/20 px-4 py-1.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-600/40"
                >
                  ✦ New smart folder
                </button>
              )}
            </div>
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
