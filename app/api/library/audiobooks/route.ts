import { getServerSession } from 'next-auth';
import { getAudiobooks } from '@/lib/googleDrive';
import { getCachedAudiobooks, setCachedAudiobooks } from '@/lib/libraryCache';
import authOptions from '@/lib/auth';
import type { AudiobookEntry } from '@/types/books';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (!forceRefresh) {
      const cached = getCachedAudiobooks(session.accessToken);
      if (cached) {
        return Response.json(cached);
      }
    }

    const audiobooks: AudiobookEntry[] = await getAudiobooks(session.accessToken);
    setCachedAudiobooks(session.accessToken, audiobooks);
    return Response.json(audiobooks);
  } catch (error) {
    console.error('Failed to fetch audiobooks:', error);
    return Response.json({ error: 'Failed to fetch audiobooks' }, { status: 500 });
  }
}
