import { getServerSession } from 'next-auth';
import { linkEbookAudio } from '@/lib/googleDrive';
import { clearLibraryCache } from '@/lib/libraryCache';
import authOptions from '@/lib/auth';

/**
 * POST /api/library/link
 * Best-effort record of an ebook <-> audiobook link in Drive appProperties.
 * Body: { ebookId: string, audioId: string | null }  (null = unlink)
 * The client treats its localStorage link map as authoritative; this only adds
 * cross-device sync when the user can write to the files.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { ebookId, audioId } = await request.json();
    if (!ebookId) {
      return Response.json({ error: 'Missing ebookId' }, { status: 400 });
    }
    await linkEbookAudio(session.accessToken, ebookId, audioId ?? null);
    await clearLibraryCache(session.accessToken, session.user?.email ?? undefined);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to link:', error);
    return Response.json({ error: 'Failed to link' }, { status: 500 });
  }
}
