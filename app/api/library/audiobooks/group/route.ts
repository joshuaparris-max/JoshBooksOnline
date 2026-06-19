import { getServerSession } from 'next-auth';
import { groupAudiobooks, ungroupAudiobook } from '@/lib/googleDrive';
import { clearLibraryCache } from '@/lib/libraryCache';
import authOptions from '@/lib/auth';

/**
 * POST /api/library/audiobooks/group
 * Merge loose audiobook files into a named group, or unmerge a manual group.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: 'merge' | 'unmerge';
      ids?: string[];
      id?: string;
      title?: string;
    };

    if (body.action === 'merge') {
      const ids = body.ids ?? [];
      const title = body.title?.trim() ?? '';
      if (ids.length < 2 || !title) {
        return Response.json({ error: 'Select at least two audiobooks and provide a title.' }, { status: 400 });
      }
      await groupAudiobooks(session.accessToken, ids, title);
      clearLibraryCache(session.accessToken);
      return Response.json({ ok: true });
    }

    if (body.action === 'unmerge') {
      if (!body.id) {
        return Response.json({ error: 'Missing audiobook id.' }, { status: 400 });
      }
      await ungroupAudiobook(session.accessToken, body.id);
      clearLibraryCache(session.accessToken);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unsupported grouping action.' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update audiobook group:', error);
    const message = error instanceof Error ? error.message : 'Failed to update audiobook group';
    return Response.json({ error: message }, { status: 500 });
  }
}
