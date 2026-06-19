import { NextResponse } from 'next/server';
import { findYoutubeByCatalogId } from '@/lib/youtubeCatalog';

/**
 * GET /api/audiobooks/[id]
 * Return one catalog entry by id (base catalog only; client merges userdata edits).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = findYoutubeByCatalogId(id, { removedIds: [], edits: {}, custom: [] });
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching audiobook:', error);
    return NextResponse.json({ error: 'Failed to fetch audiobook' }, { status: 500 });
  }
}
