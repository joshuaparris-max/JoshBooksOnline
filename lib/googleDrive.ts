import { google } from 'googleapis';
import type { BookEntry, BookMetadata, LibrarySource, BookFormat, MetadataSource } from '@/types/books';

/**
 * Google Drive folder IDs for the three fixed library sources
 */
const FIXED_FOLDERS: Record<Exclude<LibrarySource, 'Local Books'>, string> = {
  'IT PD Ebooks': '13bvVMhL0iGxOfFS9nOBk7eGhh6708kbp',
  'Book Club': '1FxuWDsjoRK9DUxdCoPefxea0eqR6EblU',
  Unsorted: '0B9UqG6BQI95fb0xsOElucWx3LUE',
  'Avance KBs': '1VXFuTGxm489hBUeEuFT6I5NWVlfJzAdm',
  'ITIL PDFs': '1v9IfBvQpIlimDsRvVul3Fzcxeq5Ml3yt',
  ITIL: '161BcIPlUqoqUKa5rE-Roniy6qiSnm9XZ',
  'ITIL PRINCE COBIT': '1bpLjo9ZIcGdx2R7uuw0qBPv5Vz2UWUyy',
  'IEC 27001': '1X70Y14d15t3nqw5AxZ9V3XGGBUmRvTdZ',
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

const TXT_MIME = 'text/plain';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * MIME types of the formats this reader supports
 */
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/epub+zip',
  TXT_MIME,
  DOCX_MIME,
] as const;

/**
 * Drive query fragment matching any supported book MIME type
 */
const SUPPORTED_MIME_QUERY = SUPPORTED_MIME_TYPES.map((m) => `mimeType = '${m}'`).join(' or ');

/**
 * Extract book format from MIME type
 */
export function getMimeTypeFormat(mimeType: string): BookFormat | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/epub+zip') return 'epub';
  if (mimeType === TXT_MIME) return 'txt';
  if (mimeType === DOCX_MIME) return 'docx';
  return null;
}

/**
 * Reconstruct a cover image URL from the compact ids we persist
 * (Drive's 124-byte property limit makes storing full URLs unreliable).
 */
function reconstructCoverUrl(props?: Record<string, string>): string | undefined {
  if (props?.m_gbid) {
    return `https://books.google.com/books/content?id=${props.m_gbid}&printsec=frontcover&img=1&zoom=1`;
  }
  if (props?.m_olcid) {
    return `https://covers.openlibrary.org/b/id/${props.m_olcid}-M.jpg`;
  }
  if (props?.m_cover) {
    return props.m_cover;
  }
  return undefined;
}

/**
 * Build the online-metadata fields of a BookEntry from stored appProperties.
 * Returns an empty object when the book has not been enriched.
 */
function parseBookMetadata(props?: Record<string, string>): Partial<BookEntry> {
  if (!props?.m_src) return {};

  const seriesIndex = props.m_seriesIdx ? Number(props.m_seriesIdx) : undefined;
  const pageCount = props.m_pages ? Number(props.m_pages) : undefined;

  return {
    title: props.m_title || undefined,
    authors: props.m_authors ? props.m_authors.split('; ').filter(Boolean) : undefined,
    publishedDate: props.m_published || undefined,
    publisher: props.m_publisher || undefined,
    description: props.m_desc || undefined,
    categories: props.m_categories ? props.m_categories.split('; ').filter(Boolean) : undefined,
    series: props.m_series || undefined,
    seriesIndex: Number.isFinite(seriesIndex) ? seriesIndex : undefined,
    pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
    language: props.m_lang || undefined,
    isbn: props.m_isbn || undefined,
    coverUrl: reconstructCoverUrl(props),
    metadataSource: props.m_src as MetadataSource,
  };
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
    metadata: parseBookMetadata(appProperties),
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
      q: `'${folderId}' in parents and trashed = false and (${SUPPORTED_MIME_QUERY})`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, appProperties)',
      pageSize: 100,
      pageToken: pageToken ?? undefined,
    });

    const files = response.data.files || [];
    for (const file of files) {
      const format = getMimeTypeFormat(file.mimeType!);
      if (!format) continue; // Skip unsupported formats

      // Skip books the user has removed from the library (hidden, file left in Drive)
      if ((file.appProperties as Record<string, string> | undefined)?.m_hidden === '1') continue;

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
        ...appProps.metadata,
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

/**
 * Truncate a property value so that key + value stays within Drive's 124-byte
 * (UTF-8) per-property limit. Returns the value clipped on a UTF-8 boundary.
 */
function truncateForProperty(key: string, value: string): string {
  const budget = 124 - Buffer.byteLength(key, 'utf8');
  if (budget <= 0) return '';
  let out = value;
  while (Buffer.byteLength(out, 'utf8') > budget) {
    out = out.slice(0, -1);
  }
  return out;
}

/**
 * Persist online metadata to a file's appProperties.
 * Uses a partial update (Drive merges appProperties), so existing reading
 * progress keys are preserved. Large URLs are stored as compact ids; the
 * description is stored as a short preview.
 */
export async function updateBookMetadata(
  accessToken: string,
  fileId: string,
  metadata: BookMetadata
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  // Resolve the cover into one of three storage forms (compact ids preferred,
  // raw URL only as a fallback for manually-entered covers that fit).
  let gbid = metadata.googleBooksId;
  let olcid = metadata.openLibraryCoverId;
  let coverRaw: string | undefined;
  if (!gbid && !olcid && metadata.coverUrl) {
    const gbMatch = metadata.coverUrl.match(/books\.google\.[^/]+\/books\/content\?id=([^&]+)/);
    const olMatch = metadata.coverUrl.match(/covers\.openlibrary\.org\/b\/id\/(\d+)/);
    if (gbMatch) gbid = gbMatch[1];
    else if (olMatch) olcid = olMatch[1];
    else if (Buffer.byteLength(`m_cover${metadata.coverUrl}`, 'utf8') <= 124) coverRaw = metadata.coverUrl;
  }

  // Build the full m_* map. Empty/undefined values become null so Drive DELETES
  // that property — this lets manual edits clear a field rather than leave a stale value.
  const raw: Record<string, string | undefined> = {
    m_title: metadata.title,
    m_authors: metadata.authors?.join('; '),
    m_published: metadata.publishedDate,
    m_publisher: metadata.publisher,
    m_desc: metadata.description,
    m_categories: metadata.categories?.join('; '),
    m_series: metadata.series,
    m_seriesIdx: metadata.seriesIndex !== undefined ? String(metadata.seriesIndex) : undefined,
    m_pages: metadata.pageCount !== undefined ? String(metadata.pageCount) : undefined,
    m_lang: metadata.language,
    m_isbn: metadata.isbn,
    m_gbid: gbid,
    m_olcid: olcid,
    m_cover: coverRaw,
    m_src: metadata.metadataSource ?? 'manual',
  };

  const appProperties: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(raw)) {
    appProperties[key] = value === undefined || value === '' ? null : truncateForProperty(key, value);
  }

  await drive.files.update({
    fileId,
    // appProperties accepts null values to delete keys; the typed client omits null from its type.
    requestBody: { appProperties: appProperties as unknown as Record<string, string> },
  });
}

/**
 * Remove a book from the library without deleting the underlying Drive file.
 * Best-effort detaches the file from its library folder, and always marks it
 * hidden (m_hidden) so it no longer appears in listings. The file itself stays
 * in the user's Google Drive.
 */
export async function removeBookFromLibrary(
  accessToken: string,
  fileId: string,
  source: LibrarySource
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  // Work out which library folder this book was listed under
  let folderId: string | undefined;
  if (source === 'Local Books') {
    folderId = (await findLocalBooksFolderId(accessToken)) ?? undefined;
  } else {
    folderId = FIXED_FOLDERS[source as Exclude<LibrarySource, 'Local Books'>];
  }

  // Best-effort: detach from the library folder. This can fail on shared folders
  // the user can't reorganise — in that case the hidden flag below still removes it.
  if (folderId) {
    try {
      await drive.files.update({ fileId, removeParents: folderId });
    } catch (error) {
      console.warn(`Could not detach ${fileId} from ${source}; hiding instead.`, error);
    }
  }

  // Always hide it from the library view
  await drive.files.update({
    fileId,
    requestBody: { appProperties: { m_hidden: '1' } },
  });
}

/**
 * Get metadata for a specific file by its ID
 * Used for importing files selected from the Google Picker
 */
export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<{ id: string; name: string; mimeType: string; size: number; modifiedTime: string } | null> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime',
    });

    if (!response.data) {
      return null;
    }

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      size: response.data.size ? parseInt(response.data.size as string, 10) : 0,
      modifiedTime: response.data.modifiedTime!,
    };
  } catch (error) {
    console.error(`Failed to get metadata for file ${fileId}:`, error);
    return null;
  }
}

/**
 * Add an imported file to the Unsorted folder by making Unsorted a parent
 * This ensures the file appears in the library listing without moving it
 */
export async function addFileToUnsorted(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Get current parents
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'parents',
    });

    const currentParents = (fileInfo.data.parents || []).join(',');
    const unsortedFolderId = FIXED_FOLDERS['Unsorted'];

    // Check if already in Unsorted
    if (currentParents.includes(unsortedFolderId)) {
      return true;
    }

    // Add Unsorted as a parent (file can have multiple parents in Drive)
    await drive.files.update({
      fileId,
      addParents: unsortedFolderId,
      fields: 'id, parents',
    });

    return true;
  } catch (error) {
    console.error(`Failed to add file ${fileId} to Unsorted folder:`, error);
    return false;
  }
}

/**
 * List files in a folder (recursively if folder is selected)
 * Handles both individual files and folders from the Picker
 */
export async function listFilesInFolderRecursive(
  accessToken: string,
  folderId: string,
  source: LibrarySource = 'Unsorted'
): Promise<BookEntry[]> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const books: BookEntry[] = [];
  let pageToken: string | null | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (${SUPPORTED_MIME_QUERY} or mimeType = 'application/vnd.google-apps.folder')`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, appProperties)',
      pageSize: 100,
      pageToken: pageToken ?? undefined,
    });

    const files = response.data.files || [];
    for (const file of files) {
      // If it's a folder, recursively list files within it
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const nestedBooks = await listFilesInFolderRecursive(accessToken, file.id!, source);
        books.push(...nestedBooks);
        continue;
      }

      const format = getMimeTypeFormat(file.mimeType!);
      if (!format) continue; // Skip unsupported formats

      // Skip books the user has removed from the library (hidden, file left in Drive)
      if ((file.appProperties as Record<string, string> | undefined)?.m_hidden === '1') continue;

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
        ...appProps.metadata,
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return books;
}
