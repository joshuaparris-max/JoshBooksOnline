'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AudiobookCard } from '@/components/AudiobookCard';
import type { Audiobook } from '@/types/books';

export default function AudiobooksPage() {
  const [audiobooks, setAudiobooks] = useState<Audiobook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'full' | 'preview'>('all');

  useEffect(() => {
    const loadAudiobooks = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (typeFilter !== 'all') {
          params.append('type', typeFilter);
        }

        const response = await fetch(`/api/audiobooks?${params}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          setError('Failed to load audiobooks');
          setAudiobooks([]);
          return;
        }

        const data = (await response.json()) as Audiobook[];
        setAudiobooks(data);
      } catch {
        setError('Unable to fetch audiobooks. Please check your connection.');
        setAudiobooks([]);
      } finally {
        setLoading(false);
      }
    };

    loadAudiobooks();
  }, [typeFilter]);

  const filteredAudiobooks = useMemo(() => {
    if (!audiobooks) return [];

    const query = search.trim().toLowerCase();
    if (!query) return audiobooks;

    return audiobooks.filter((ab) => {
      const titleMatch = ab.title.toLowerCase().includes(query);
      const authorMatch = ab.author.toLowerCase().includes(query);
      const catalogueMatch = ab.catalogueMatches.some((match) =>
        match.toLowerCase().includes(query)
      );
      return titleMatch || authorMatch || catalogueMatch;
    });
  }, [audiobooks, search]);

  const stats = useMemo(() => {
    if (!audiobooks) return { total: 0, full: 0, preview: 0 };
    return {
      total: audiobooks.length,
      full: audiobooks.filter((ab) => ab.availabilityType === 'full_public_domain')
        .length,
      preview: audiobooks.filter((ab) => ab.availabilityType === 'official_preview')
        .length,
    };
  }, [audiobooks]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Audiobooks</h1>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Browse YouTube audiobooks from public-domain recordings and official previews.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

        {/* Search and Filters */}
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
              className={`px-4 py-3 rounded-lg font-semibold text-sm transition ${
                typeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All {audiobooks ? `(${stats.total})` : '...'}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('full')}
              className={`px-4 py-3 rounded-lg font-semibold text-sm transition ${
                typeFilter === 'full'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Full {audiobooks ? `(${stats.full})` : '...'}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('preview')}
              className={`px-4 py-3 rounded-lg font-semibold text-sm transition ${
                typeFilter === 'preview'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Previews {audiobooks ? `(${stats.preview})` : '...'}
            </button>
            <div className="rounded-lg border border-white/10 bg-slate-950 p-3 text-sm text-slate-400 text-center">
              {filteredAudiobooks.length} results
            </div>
          </div>
        </section>

        {/* Error State */}
        {error && (
          <section className="rounded-3xl border border-red-500/20 bg-red-950/30 p-6">
            <p className="text-red-300">{error}</p>
          </section>
        )}

        {/* Loading State */}
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

        {/* Audiobooks Grid */}
        {!loading && audiobooks && filteredAudiobooks.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAudiobooks.map((audiobook) => (
              <AudiobookCard key={audiobook.id} audiobook={audiobook} />
            ))}
          </section>
        )}

        {/* Empty State */}
        {!loading && audiobooks && filteredAudiobooks.length === 0 && (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-12 text-center">
            <p className="text-xl text-slate-400 mb-2">No audiobooks found</p>
            <p className="text-sm text-slate-500">
              Try adjusting your search or filter criteria
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
