import { getServerSession } from 'next-auth';
import { getAllLibraryFiles } from '@/lib/googleDrive';
import { getCachedLibrary, setCachedLibrary } from '@/lib/libraryCache';
import authOptions from '@/lib/auth';
import type { BookEntry } from '@/types/books';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';

    if (!forceRefresh) {
      const cached = getCachedLibrary(session.accessToken);
      if (cached) {
        return Response.json(cached);
      }
    }

    const books: BookEntry[] = await getAllLibraryFiles(session.accessToken);
    setCachedLibrary(session.accessToken, books);
    return Response.json(books);
  } catch (error) {
    console.error('Failed to fetch library:', error);
    return Response.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    );
  }
}
