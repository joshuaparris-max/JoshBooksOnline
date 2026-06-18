import { NextResponse } from 'next/server';
import type { AudiobookEntry } from '@/types/books';
import youtubeAudiobooks from '@/lib/youtube-audiobooks.json';

/**
 * GET /api/library/youtube-audiobooks
 *
 * Returns YouTube audiobooks that can be linked to ebook editions
 * Query parameters:
 *   - search: Search by title, author, or catalogue matches
 *   - type: 'full' | 'preview' | 'all' (default: 'all')
 *   - catalogueMatch: Filter by catalogue match (exact match on catalogueMatches array)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() ?? '';
    const type = searchParams.get('type') ?? 'all';
    const catalogueMatch = searchParams.get('catalogueMatch')?.toLowerCase();

    interface YouTubeAudiobookData {
      id: string;
      title: string;
      author: string;
      youtubeUrl: string;
      catalogueMatches: string[];
      availabilityType: 'full_public_domain' | 'official_preview' | 'unknown';
      displayLabel?: string;
      source?: string;
      rightsNote?: string;
      notes?: string;
    }

    let filtered = [...(youtubeAudiobooks as YouTubeAudiobookData[])];

    // Filter by type
    if (type === 'full') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'full_public_domain');
    } else if (type === 'preview') {
      filtered = filtered.filter((ab) => ab.availabilityType === 'official_preview');
    }

    // Filter by catalogue match (case-insensitive substring match)
    if (catalogueMatch) {
      filtered = filtered.filter((ab) =>
        ab.catalogueMatches.some((match) =>
          match.toLowerCase().includes(catalogueMatch)
        )
      );
    }

    // Filter by search query (title, author, catalogue)
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

    // Convert to AudiobookEntry format for consistency
    const audiobooks: AudiobookEntry[] = filtered.map((yt) => ({
      id: `youtube-${yt.id}`,
      title: yt.title,
      source: 'Audiobooks',
      isFolder: false,
      authors: [yt.author],
      description: yt.notes || yt.rightsNote,
      linkedTextId: undefined, // Will be populated by the client
      // Custom field for YouTube URL (not in standard AudiobookEntry but useful for UI)
      youtubeUrl: yt.youtubeUrl,
      availabilityType: yt.availabilityType,
      displayLabel: yt.displayLabel,
      catalogueMatches: yt.catalogueMatches,
    })) as (AudiobookEntry & {
      youtubeUrl: string;
      availabilityType: string;
      displayLabel?: string;
      catalogueMatches: string[];
    })[];

    return NextResponse.json(audiobooks);
  } catch (error) {
    console.error('Error fetching YouTube audiobooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch YouTube audiobooks' },
      { status: 500 }
    );
  }
}
