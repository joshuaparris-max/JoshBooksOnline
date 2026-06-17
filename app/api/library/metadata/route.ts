import { getServerSession } from 'next-auth';
import { updateBookMetadata } from '@/lib/googleDrive';
import { enrichBookMetadata } from '@/lib/bookMetadata';
import authOptions from '@/lib/auth';

/**
 * POST /api/library/metadata
 * Enrich a single book's metadata from online sources and persist it to Drive.
 *
 * Request body: { fileId: string, name: string }
 * Response: { metadata: BookMetadata } on a match, or { metadata: null } when
 *           no online source produced a usable result.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileId, name } = await request.json();

    if (!fileId || !name) {
      return Response.json(
        { error: 'Missing required fields: fileId, name' },
        { status: 400 }
      );
    }

    const metadata = await enrichBookMetadata(name);

    if (!metadata) {
      return Response.json({ metadata: null });
    }

    await updateBookMetadata(session.accessToken, fileId, metadata);

    return Response.json({ metadata });
  } catch (error) {
    console.error('Failed to enrich metadata:', error);
    return Response.json({ error: 'Failed to enrich metadata' }, { status: 500 });
  }
}
