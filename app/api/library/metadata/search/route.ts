import { getServerSession } from 'next-auth';
import { searchBookCandidates } from '@/lib/bookMetadata';
import authOptions from '@/lib/auth';

/**
 * POST /api/library/metadata/search
 * Look up candidate metadata matches online WITHOUT persisting anything.
 * The client reviews the candidates before choosing one to save.
 *
 * Request body: { name: string, query?: string }
 * Response: { candidates: BookMetadata[] }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, query } = (await request.json()) as { name?: string; query?: string };

    if (!name && !query) {
      return Response.json({ error: 'Missing required field: name or query' }, { status: 400 });
    }

    const candidates = await searchBookCandidates(name ?? '', query);
    return Response.json({ candidates });
  } catch (error) {
    console.error('Failed to search metadata:', error);
    return Response.json({ error: 'Failed to search metadata' }, { status: 500 });
  }
}
