import { google } from 'googleapis';
import type { BookEntry, LibrarySource, BookFormat } from '@/types/books';

/**
 * Google Drive folder IDs for the three fixed library sources
 */
const FIXED_FOLDERS: Record<Exclude<LibrarySource, 'Local Books'>, string> = {
  'IT PD Ebooks': '13bvVMhL0iGxOfFS9nOBk7eGhh6708kbp',
  'Book Club': '1FxuWDsjoRK9DUxdCoPefxea0eqR6EblU',
};

/**
 * Create an OAuth2 client with the given access token
 */
export function getOAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

/**
 * Extract book format from MIME type
 */
function getMimeTypeFormat(mimeType: string): BookFormat | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/epub+zip') return 'epub';
  return null;
}

/**
 * Parse app properties safely, defaulting to sensible values
 */
function parseAppProperties(appProperties?: Record<string, string>) {
  return {
    readingProgress: appProperties?.progressPercentage 
      ? parseInt(appProperties.progressPercentage, 10) 
      : 0,
    lastLocation: appProperties?.lastLocation ?? '',
    lastOpened: appProperties?.lastOpened,
  };
}

/**
 * List all PDF and EPUB files in a specific Drive folder
 * Handles pagination automatically
 */
export async function listFilesInFolder(
  accessToken: string,
  folderId: string,
  source: LibrarySource
): Promise<BookEntry[]> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const books: BookEntry[] = [];
  let pageToken: string | null | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/epub+zip')`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, appProperties)',
      pageSize: 100,
      pageToken: pageToken ?? undefined,
    });

    const files = response.data.files || [];
    for (const file of files) {
      const format = getMimeTypeFormat(file.mimeType!);
      if (!format) continue; // Skip unsupported formats

      const appProps = parseAppProperties(
        file.appProperties as Record<string, string> | undefined
      );

      books.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size ? parseInt(file.size as string, 10) : 0,
        modifiedTime: file.modifiedTime!,
        thumbnailLink: file.thumbnailLink ?? undefined,
        source,
        format,
        readingProgress: appProps.readingProgress,
        lastLocation: appProps.lastLocation,
        lastOpened: appProps.lastOpened,
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return books;
}

/**
 * Find the "Local Books" folder ID owned by the current user
 * Returns null if not found
 */
export async function findLocalBooksFolderId(accessToken: string): Promise<string | null> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: "name = 'Local Books' and mimeType = 'application/vnd.google-apps.folder' and 'me' in owners and trashed = false",
    fields: 'files(id)',
    pageSize: 1,
  });

  const files = response.data.files || [];
  return files.length > 0 ? files[0].id! : null;
}

/**
 * Get all library files from all sources (three fixed folders + Local Books if found)
 * Deduplicates by file ID
 */
export async function getAllLibraryFiles(accessToken: string): Promise<BookEntry[]> {
  const allBooks: BookEntry[] = [];
  const seenIds = new Set<string>();

  // Fetch from the three fixed folders
  for (const [source, folderId] of Object.entries(FIXED_FOLDERS)) {
    try {
      const books = await listFilesInFolder(
        accessToken,
        folderId,
        source as Exclude<LibrarySource, 'Local Books'>
      );
      for (const book of books) {
        if (!seenIds.has(book.id)) {
          allBooks.push(book);
          seenIds.add(book.id);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch from ${source}:`, error);
    }
  }

  // Try to fetch from Local Books if it exists
  try {
    const localBooksId = await findLocalBooksFolderId(accessToken);
    if (localBooksId) {
      const books = await listFilesInFolder(accessToken, localBooksId, 'Local Books');
      for (const book of books) {
        if (!seenIds.has(book.id)) {
          allBooks.push(book);
          seenIds.add(book.id);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch from Local Books:', error);
  }

  return allBooks;
}

/**
 * Update a book's reading progress in Google Drive appProperties
 * Note: appProperties values must be strings
 */
export async function updateBookProgress(
  accessToken: string,
  fileId: string,
  progress: number,
  location: string
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.update({
    fileId,
    requestBody: {
      appProperties: {
        progressPercentage: String(Math.round(progress)),
        lastLocation: location,
        lastOpened: new Date().toISOString(),
      },
    },
  });
}
