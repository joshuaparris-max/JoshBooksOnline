import { getServerSession } from 'next-auth';
import { removeBookFromLibrary } from '@/lib/googleDrive';
import authOptions from '@/lib/auth';
import type { LibrarySource } from '@/types/books';

/**
 * POST /api/library/remove
 * Remove a book from the library WITHOUT deleting the Drive file. The file is
 * detached from its library folder (best effort) and hidden from listings.
 *
 * Request body: { fileId: string, source: LibrarySource }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileId, source } = (await request.json()) as {
      fileId?: string;
      source?: LibrarySource;
    };

    if (!fileId || !source) {
      return Response.json({ error: 'Missing required fields: fileId, source' }, { status: 400 });
    }

    await removeBookFromLibrary(session.accessToken, fileId, source);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to remove book:', error);
    return Response.json({ error: 'Failed to remove book' }, { status: 500 });
  }
}
