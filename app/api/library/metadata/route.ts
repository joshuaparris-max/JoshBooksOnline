import { getServerSession } from 'next-auth';
import { updateBookMetadata } from '@/lib/googleDrive';
import { clearLibraryCache } from '@/lib/libraryCache';
import authOptions from '@/lib/auth';
import type { BookMetadata } from '@/types/books';

/**
 * POST /api/library/metadata
 * Persist a book's metadata to Drive. The caller supplies the exact metadata to
 * save (an approved online candidate or a hand-edited form) — this endpoint does
 * NOT fetch anything, so nothing is written without explicit review.
 *
 * Request body: { fileId: string, metadata: BookMetadata }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileId, metadata } = (await request.json()) as {
      fileId?: string;
      metadata?: BookMetadata;
    };

    if (!fileId || !metadata) {
      return Response.json(
        { error: 'Missing required fields: fileId, metadata' },
        { status: 400 }
      );
    }

    await updateBookMetadata(session.accessToken, fileId, metadata);
    clearLibraryCache(session.accessToken);

    return Response.json({ ok: true, metadata });
  } catch (error) {
    console.error('Failed to save metadata:', error);
    return Response.json({ error: 'Failed to save metadata' }, { status: 500 });
  }
}
