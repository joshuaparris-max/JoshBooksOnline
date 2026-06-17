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

function normaliseGoogleVolume(volume: GoogleBooksVolume): BookMetadata | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;

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

async function fetchFromGoogleBooks(query: string, isIsbn = false, max = 5): Promise<BookMetadata[]> {
  const q = isIsbn ? `isbn:${query}` : query;
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${max}&country=US` +
    (apiKey ? `&key=${apiKey}` : '');

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];

  const data = (await response.json()) as { items?: GoogleBooksVolume[] };
  return (data.items ?? []).map(normaliseGoogleVolume).filter((m): m is BookMetadata => m !== null);
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

function normaliseOpenLibraryDoc(doc: OpenLibraryDoc): BookMetadata | null {
  if (!doc.title) return null;
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

async function fetchFromOpenLibrary(query: string, isIsbn = false, max = 5): Promise<BookMetadata[]> {
  const param = isIsbn ? `isbn=${encodeURIComponent(query)}` : `q=${encodeURIComponent(query)}`;
  const url = `https://openlibrary.org/search.json?${param}&limit=${max}&fields=title,author_name,first_publish_year,publisher,language,number_of_pages_median,cover_i,isbn`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];

  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? []).map(normaliseOpenLibraryDoc).filter((m): m is BookMetadata => m !== null);
}

function dedupeCandidates(candidates: BookMetadata[]): BookMetadata[] {
  const seen = new Set<string>();
  const out: BookMetadata[] = [];
  for (const c of candidates) {
    const key = `${c.title?.toLowerCase()}|${c.authors?.[0]?.toLowerCase() ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Search both sources for candidate matches (Google Books first, then Open
 * Library). Returns an ordered, de-duplicated list for the user to review.
 * `explicitQuery` overrides the filename-derived query (used by manual search).
 */
export async function searchBookCandidates(
  name: string,
  explicitQuery?: string
): Promise<BookMetadata[]> {
  const query = (explicitQuery ?? cleanFilenameToQuery(name)).trim();
  const isbn = !explicitQuery ? detectIsbn(name) : null;

  const results: BookMetadata[] = [];

  if (isbn) {
    results.push(...(await fetchFromGoogleBooks(isbn, true, 3).catch(() => [])));
    results.push(...(await fetchFromOpenLibrary(isbn, true, 3).catch(() => [])));
  }

  if (query) {
    results.push(...(await fetchFromGoogleBooks(query, false, 5).catch(() => [])));
    results.push(...(await fetchFromOpenLibrary(query, false, 5).catch(() => [])));
  }

  return dedupeCandidates(results).slice(0, 10);
}

/**
 * Best-effort single match for a filename (the top candidate), used to stage a
 * suggestion for review. Returns null when nothing is found.
 */
export async function enrichBookMetadata(name: string): Promise<BookMetadata | null> {
  const candidates = await searchBookCandidates(name);
  return candidates[0] ?? null;
}
