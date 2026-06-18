import { getServerSession } from 'next-auth';
import { updateAudioProgress } from '@/lib/googleDrive';
import authOptions from '@/lib/auth';

/**
 * POST /api/library/audio-progress
 * Save an audiobook's resume position.
 * Body: { id: string, track: number, position: number }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, track, position } = await request.json();
    if (!id || track === undefined || position === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await updateAudioProgress(session.accessToken, id, Number(track), Number(position));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to save audio progress:', error);
    return Response.json({ error: 'Failed to save progress' }, { status: 500 });
  }
}
