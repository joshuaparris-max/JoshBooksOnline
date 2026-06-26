import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { fetchYoutubeMetadata } from '@/lib/youtubeMetadata';

/**
 * POST /api/youtube/metadata
 * Look up title, author, duration and thumbnail from a YouTube URL.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url?.trim()) {
      return Response.json({ error: 'Missing required field: url' }, { status: 400 });
    }

    const metadata = await fetchYoutubeMetadata(url);
    return Response.json({ metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to look up YouTube metadata.';
    const status = message.includes('valid YouTube') || message.includes('could not be found') ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
