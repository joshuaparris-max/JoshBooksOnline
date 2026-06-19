import { NextResponse } from 'next/server';
import type { AudiobookEntry } from '@/types/books';
import { getBaseYoutubeCatalog, youtubeListenId } from '@/lib/youtubeCatalog';

/**
 * GET /api/library/youtube-audiobooks
 *
 * Returns YouTube audiobooks for linking to ebook editions.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() ?? '';
    const type = searchParams.get('type') ?? 'all';
    const catalogueMatch = searchParams.get('catalogueMatch')?.toLowerCase();

    let filtered = [...getBaseYoutubeCatalog()];

    if (type === 'full') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'full_public_domain');
    } else if (type === 'preview') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'official_preview');
    }

    if (catalogueMatch) {
      filtered = filtered.filter((ab) =>
        ab.catalogueMatches.some((match) => match.toLowerCase().includes(catalogueMatch))
      );
    }

    if (search) {
      filtered = filtered.filter((ab) => {
        const titleMatch = ab.title.toLowerCase().includes(search);
        const authorMatch = ab.author.toLowerCase().includes(search);
        const catalogueSearchMatch = ab.catalogueMatches.some((match) =>
          match.toLowerCase().includes(search)
        );
        return titleMatch || authorMatch || catalogueSearchMatch;
      });
    }

    const audiobooks: AudiobookEntry[] = filtered.map((yt) => ({
      id: youtubeListenId(yt.id),
      title: yt.title,
      source: 'Audiobooks',
      isFolder: false,
      authors: [yt.author],
      description: yt.notes || yt.rightsNote,
      linkedTextId: undefined,
      youtubeUrl: yt.youtubeUrl,
      availabilityType: yt.availabilityType,
      displayLabel: yt.displayLabel,
      catalogueMatches: yt.catalogueMatches,
    })) as AudiobookEntry[];

    return NextResponse.json(audiobooks);
  } catch (error) {
    console.error('Error fetching YouTube audiobooks:', error);
    return NextResponse.json({ error: 'Failed to fetch YouTube audiobooks' }, { status: 500 });
  }
}
