'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AudiobookCard } from '@/components/AudiobookCard';
import YouTubeAudiobookEditor from '@/components/YouTubeAudiobookEditor';
import YouTubeAudiobookAddDialog from '@/components/YouTubeAudiobookAddDialog';
import type { Audiobook } from '@/types/books';
import { useYoutubeCatalog } from '@/lib/useYoutubeCatalog';
import { useUserdataYoutubeSync } from '@/lib/useUserdataYoutubeSync';

export default function AudiobooksPage() {
  const youtube = useYoutubeCatalog();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'full' | 'preview'>('all');
  const [editingYoutube, setEditingYoutube] = useState<Audiobook | null>(null);
  const [addingYoutube, setAddingYoutube] = useState(false);

  useUserdataYoutubeSync(youtube.serverBlob, youtube.hydrateFromServer);

  useEffect(() => {
    if (youtube.hydrated) setLoading(false);
  }, [youtube.hydrated]);

  const filteredAudiobooks = useMemo(() => {
    let list = youtube.catalog;

    if (typeFilter === 'full') {
      list = list.filter((ab) => ab.availabilityType === 'full_public_domain');
    } else if (typeFilter === 'preview') {
      list = list.filter((ab) => ab.availabilityType === 'official_preview');
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((ab) => {
      const titleMatch = ab.title.toLowerCase().includes(query);
      const authorMatch = ab.author.toLowerCase().includes(query);
      const catalogueMatch = ab.catalogueMatches.some((match) =>
        match.toLowerCase().includes(query)
      );
      return titleMatch || authorMatch || catalogueMatch;
    });
  }, [youtube.catalog, search, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: youtube.catalog.length,
      full: youtube.catalog.filter((ab) => ab.availabilityType === 'full_public_domain').length,
      preview: youtube.catalog.filter((ab) => ab.availabilityType === 'official_preview').length,
      custom: youtube.catalog.filter((ab) => ab.isCustom).length,
    };
  }, [youtube.catalog]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Audiobooks</h1>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Browse YouTube audiobooks from public-domain recordings and official previews.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setAddingYoutube(true)}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Add audiobook
              </button>
              <Link
                href="/library"
                className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Back to Library
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20 space-y-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, or collection"
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
          />

          <div className="grid gap-4 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                typeFilter === 'all'
                  ? 'border-sky-500 bg-sky-600 text-white'
                  : 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('full')}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                typeFilter === 'full'
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Full ({stats.full})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('preview')}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                typeFilter === 'preview'
                  ? 'border-amber-500 bg-amber-600 text-white'
                  : 'border-white/10 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Previews ({stats.preview})
            </button>
            {stats.custom > 0 && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                Yours ({stats.custom})
              </div>
            )}
          </div>
        </section>

        {loading && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-3xl border border-white/10 bg-slate-900/80"
              />
            ))}
          </section>
        )}

        {!loading && filteredAudiobooks.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAudiobooks.map((audiobook) => (
              <AudiobookCard
                key={audiobook.id}
                audiobook={audiobook}
                onEdit={setEditingYoutube}
                onRemove={youtube.removeYoutube}
              />
            ))}
          </section>
        )}

        {!loading && filteredAudiobooks.length === 0 && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-12 text-center">
            <p className="text-xl text-slate-400 mb-2">No audiobooks found</p>
            <p className="text-sm text-slate-500">
              Try adjusting your search or filter criteria
            </p>
          </section>
        )}
      </div>

      {addingYoutube && (
        <YouTubeAudiobookAddDialog
          existingCatalog={youtube.catalog}
          onClose={() => setAddingYoutube(false)}
          onSave={(ab) => {
            youtube.addYoutubeCustom(ab);
            setAddingYoutube(false);
          }}
        />
      )}

      {editingYoutube && (
        <YouTubeAudiobookEditor
          initial={editingYoutube}
          onClose={() => setEditingYoutube(null)}
          onSave={(ab) => {
            youtube.saveYoutubeEdit(ab);
            setEditingYoutube(null);
          }}
        />
      )}
    </main>
  );
}
