import { getServerSession } from 'next-auth';
import { getAudiobooks } from '@/lib/googleDrive';
import authOptions from '@/lib/auth';
import type { AudiobookEntry } from '@/types/books';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const audiobooks: AudiobookEntry[] = await getAudiobooks(session.accessToken);
    return Response.json(audiobooks);
  } catch (error) {
    console.error('Failed to fetch audiobooks:', error);
    return Response.json({ error: 'Failed to fetch audiobooks' }, { status: 500 });
  }
}
