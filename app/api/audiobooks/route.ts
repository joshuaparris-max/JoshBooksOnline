import { NextResponse } from 'next/server';
import { getBaseYoutubeCatalog } from '@/lib/youtubeCatalog';

/**
 * GET /api/audiobooks
 *
 * Returns the bundled YouTube audiobook catalog. Client-side userdata overrides
 * (edits, removals, custom links) are merged in the browser.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'all';
    const search = searchParams.get('search')?.toLowerCase() ?? '';

    let filtered = [...getBaseYoutubeCatalog()];

    if (type === 'full') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'full_public_domain');
    } else if (type === 'preview') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'official_preview');
    }

    if (search) {
      filtered = filtered.filter((ab) => {
        const titleMatch = ab.title.toLowerCase().includes(search);
        const authorMatch = ab.author.toLowerCase().includes(search);
        const catalogueMatch = ab.catalogueMatches.some((match) =>
          match.toLowerCase().includes(search)
        );
        return titleMatch || authorMatch || catalogueMatch;
      });
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching audiobooks:', error);
    return NextResponse.json({ error: 'Failed to fetch audiobooks' }, { status: 500 });
  }
}
