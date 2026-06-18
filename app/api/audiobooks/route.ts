import { NextResponse } from 'next/server';
import type { Audiobook } from '@/types/books';
import audiobooks from '@/lib/audiobooks.json';

/**
 * GET /api/audiobooks
 *
 * Returns all available audiobooks with optional filtering
 * Query parameters:
 *   - type: 'full' | 'preview' | 'all' (default: 'all')
 *   - search: Search audiobooks by title, author, or catalogue matches
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'all';
    const search = searchParams.get('search')?.toLowerCase() ?? '';

    let filtered = [...(audiobooks as Audiobook[])];

    // Filter by type
    if (type === 'full') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'full_public_domain');
    } else if (type === 'preview') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'official_preview');
    }

    // Filter by search query
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
    return NextResponse.json(
      { error: 'Failed to fetch audiobooks' },
      { status: 500 }
    );
  }
}
