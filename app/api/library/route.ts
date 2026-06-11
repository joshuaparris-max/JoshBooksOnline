import { getServerSession } from 'next-auth';
import { getAllLibraryFiles } from '@/lib/googleDrive';
import authOptions from '@/lib/auth';
import type { BookEntry } from '@/types/books';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  console.log('GET /api/library session exists:', Boolean(session));
  console.log('GET /api/library session.accessToken:', session?.accessToken);

  if (!session?.accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const books: BookEntry[] = await getAllLibraryFiles(session.accessToken);
    return Response.json(books);
  } catch (error) {
    console.error('Failed to fetch library:', error);
    return Response.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    );
  }
}
