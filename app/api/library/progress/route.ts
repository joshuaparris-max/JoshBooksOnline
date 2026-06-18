import { getServerSession } from 'next-auth';
import { updateBookProgress } from '@/lib/googleDrive';
import authOptions from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileId, progress, location } = await request.json();

    if (!fileId || progress === undefined || !location) {
      return Response.json(
        { error: 'Missing required fields: fileId, progress, location' },
        { status: 400 }
      );
    }

    await updateBookProgress(session.accessToken, fileId, progress, location);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to update progress:', error);
    return Response.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}
