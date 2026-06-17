import type { BookMetadata } from '@/types/books';

/**
 * Turn a messy Drive filename into a reasonable search query.
 * e.g. "The_Pragmatic_Programmer_(2nd_Edition)_z-lib.org.pdf"
 *   -> "The Pragmatic Programmer"
 */
export function cleanFilenameToQuery(name: string): string {
  let q = name;

  // Strip a trailing file extension
  q = q.replace(/\.(pdf|epub|txt|docx)$/i, '');

  // Normalise separators to spaces
  q = q.replace(/[_.+]/g, ' ');

  // Drop common noise tokens
  q = q
    .replace(/\bz-?lib(\.org)?\b/gi, ' ')
    .replace(/\b(annas?[- ]archive|libgen|epub|ebook|retail|true ?pdf)\b/gi, ' ')
    .replace(/\(\s*\d{4}\s*\)/g, ' ') // year in parens
    .replace(/\b\d{4}\b(?=\s*$)/g, ' ') // trailing year
    .replace(/\b(\d+(st|nd|rd|th)\s+edition|edition)\b/gi, ' ')
    .replace(/[\[\](){}]/g, ' ');

  // Collapse whitespace and stray dashes
  q = q.replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();

  return q;
}

/** Detect a 10- or 13-digit ISBN inside a filename, ignoring separators. */
export function detectIsbn(name: string): string | null {
  const compact = name.replace(/[\s-]/g, '');
  const match = compact.match(/(97[89]\d{10}|\d{9}[\dXx])/);
  return match ? match[1].toUpperCase() : null;
}

interface GoogleBooksVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
    description?: string;
    categories?: string[];
    pageCount?: number;
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
}

function googleCoverUrl(volumeId: string): string {
  return `https://books.google.com/books/content?id=${volumeId}&printsec=frontcover&img=1&zoom=1`;
}

async function fetchFromGoogleBooks(query: string, isIsbn = false): Promise<BookMetadata | null> {
  const q = isIsbn ? `isbn:${query}` : query;
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&country=US` +
    (apiKey ? `&key=${apiKey}` : '');

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;

  const data = (await response.json()) as { items?: GoogleBooksVolume[] };
  const volume = data.items?.[0];
  const info = volume?.volumeInfo;
  if (!volume || !info?.title) return null;

  const isbn =
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier;

  const title = info.subtitle ? `${info.title}: ${info.subtitle}` : info.title;

  return {
    title,
    authors: info.authors,
    publishedDate: info.publishedDate,
    publisher: info.publisher,
    description: info.description,
    categories: info.categories,
    pageCount: info.pageCount,
    language: info.language,
    isbn,
    coverUrl: googleCoverUrl(volume.id),
    googleBooksId: volume.id,
    metadataSource: 'google-books',
  };
}

interface OpenLibraryDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
}

async function fetchFromOpenLibrary(query: string, isIsbn = false): Promise<BookMetadata | null> {
  const param = isIsbn ? `isbn=${encodeURIComponent(query)}` : `q=${encodeURIComponent(query)}`;
  const url = `https://openlibrary.org/search.json?${param}&limit=1&fields=title,author_name,first_publish_year,publisher,language,number_of_pages_median,cover_i,isbn`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;

  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  const doc = data.docs?.[0];
  if (!doc?.title) return null;

  return {
    title: doc.title,
    authors: doc.author_name,
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
    publisher: doc.publisher?.[0],
    language: doc.language?.[0],
    pageCount: doc.number_of_pages_median,
    isbn: doc.isbn?.[0],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    openLibraryCoverId: doc.cover_i ? String(doc.cover_i) : undefined,
    metadataSource: 'open-library',
  };
}

/**
 * Enrich a book by its filename: Google Books first, fall back to Open Library.
 * Returns null when neither source produces a usable match.
 */
export async function enrichBookMetadata(name: string): Promise<BookMetadata | null> {
  const isbn = detectIsbn(name);
  const query = cleanFilenameToQuery(name);

  // Prefer an ISBN lookup when we can find one in the filename
  if (isbn) {
    const byIsbn =
      (await fetchFromGoogleBooks(isbn, true).catch(() => null)) ??
      (await fetchFromOpenLibrary(isbn, true).catch(() => null));
    if (byIsbn) return byIsbn;
  }

  if (!query) return null;

  const fromGoogle = await fetchFromGoogleBooks(query).catch(() => null);
  if (fromGoogle) return fromGoogle;

  const fromOpenLibrary = await fetchFromOpenLibrary(query).catch(() => null);
  return fromOpenLibrary;
}
