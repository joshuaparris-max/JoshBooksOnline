import { google } from 'googleapis';
import type {
  BookEntry,
  BookMetadata,
  LibrarySource,
  BookFormat,
  MetadataSource,
  AudiobookEntry,
  AudioTrack,
} from '@/types/books';

/**
 * Google Drive folder IDs for the three fixed library sources
 */
const FIXED_FOLDERS: Record<string, string> = {
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
 * Permanent ebook collection folders, listed recursively. These are scanned for
 * pdf/epub/txt/docx files (audio files inside them are ignored here).
 */
const EBOOK_FOLDERS: Record<string, string> = {
  'Fiction – Classics': '1nJAAlrhzyVdQp4d36WUJ2MjQziqe9O6l',
  'Fiction – General': '1MD7HO7lZzDApANdYjD6j0b989aST7p4K',
  Nonfiction: '1o2tU1SKcvcuToRxQ-yILZuxWrMvmvH-W',
  'Epub & PDF': '1Ot_Z2si9vnKAGoz_jjwCU056h6zkYypP',
};

/**
 * Permanent audiobook collection folders. Their immediate children become
 * audiobooks (a sub-folder = a multi-track audiobook; a loose audio file = a
 * single-track audiobook).
 */
const AUDIOBOOK_FOLDERS: Record<string, string> = {
  Audiobooks: '1NRY6dXCpILRzfG4yYTpisGqLnqx2ECEQ',
  Outlander: '1SBqmfghmj5gqxWRnCrxbHP65I23ohlcQ',
};

const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/m4b',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
]);

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function isAudioMime(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  return AUDIO_MIME_TYPES.has(mimeType) || mimeType.startsWith('audio/');
}

/** Natural sort so "Track 2" comes before "Track 10". */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

const LILITH_CHAPTER_TITLES = new Set(
  [
    'The Library',
    'The Mirror',
    'The Raven',
    'Somewhere or Nowhere?',
    'The Old Church',
    "The Sexton's Cottage",
    'The Cemetery',
    "My Father's Manuscript",
    'I Repent',
    'The Bad Burrow',
    'Friends and Foes',
    'The Little Ones',
    'A Crisis',
    'The Princess',
    'The Leopardess',
    'The Vane',
    'The House of Vane',
    'The Magic Mirror',
    'The skeleton House',
    'The Giant',
    'Mr. Raven',
    'The Microcosm',
    'The Valley of Spores',
    'The Death of the Shadow',
    'The Palace of Lilith',
    'The Mirror of Death',
    'The Supper',
    'The Battle',
    'The Great Letter',
    'The Woman',
    'The Sleep',
    'The Shadow',
    'The Regained Paradise',
    "The Women's War",
    'The Rescue',
    'The Buried Moon',
    'The Night of Evil',
    'The Morning of Grief',
    'The White Leopardess',
    'The Sea of Life',
    'The Restoration',
    'The New Name',
    'The House of Death',
    'The New Dawn',
    'The Journey Home',
    'The City',
    'The Endless Ending',
  ].map(normaliseTitle)
);

const CS_LEWIS_COMBINED_AUDIOBOOK_TITLE = 'The Abolition of Man and The Great Divorce';

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function manualAudioGroupKey(props?: Record<string, string>): string | undefined {
  return props?.m_audio_group ? `manual:${props.m_audio_group}` : undefined;
}

function audioGroupTitle(file: { name: string; props?: Record<string, string> }): string {
  return file.props?.m_audio_group_title?.trim() || deriveBookTitle(file.name);
}

function lilithTitleFromChapterOnlyName(base: string): string | undefined {
  const match = base.match(/^\s*chapter\s+[ivxlcdm\d]+\s*[:\-_.]\s*(.+?)\s*$/i);
  if (!match) return undefined;
  const chapterTitle = match[1]?.trim();
  if (!chapterTitle) return undefined;
  return LILITH_CHAPTER_TITLES.has(normaliseTitle(chapterTitle)) ? 'Lilith' : undefined;
}

/**
 * Strip chapter/track/part/disc markers and trailing numbers from a filename
 * base so that "Sapiens - Chapter 03" and "Sapiens - Chapter 04" reduce to
 * "Sapiens", and "Wool L01 T01" reduces to "Wool".
 */
function stripChapterSuffix(base: string): string {
  let s = base;
  // Leading track numbers, with or without a separator and even attached to the
  // title word: "01 - Title", "01. Title", "01 1 Title", "01PSALM" -> "Title"/"PSALM".
  s = s.replace(/^[\s\-_.]*(?:\d+[\s\-_.]*)+/, '');
  let prev = '';
  while (s !== prev) {
    prev = s;
    // story chapters: digit OR roman numeral — "Chapter 12", "Chapter XLVII", "Part IV"
    s = s.replace(
      /[\s\-_.]*[([]?\s*(chapter|chap|chp|ch|part|pt|section|sec|episode|ep|book|bk|vol|volume)\s*\.?\s*(?:\d+|[ivxlcdm]+)\s*[)\]]?\s*$/i,
      ''
    );
    // disc/track codes: digits only — "Track 5", "Disc 1", "L01", "T03", "CD2"
    s = s.replace(/[\s\-_.]*[([]?\s*(track|trk|disc|disk|cd|side|l|t|d)\s*\.?\s*\d+\s*[)\]]?\s*$/i, '');
    s = s.replace(/[\s\-_.]*[([]\s*\d{1,3}\s*[)\]]\s*$/, ''); // "(03)" "[03]"
    s = s.replace(/[\s\-_.]+\d{1,3}\s*$/, ''); // trailing bare number
  }
  // tidy leftover edge separators (e.g. "Lilith -" -> "Lilith")
  return s.replace(/^[\s\-_.]+/, '').replace(/[\s\-_.]+$/, '').trim();
}

/** True when a name is purely track codes with no real title (e.g. "L01 T01", "CD2 Track 5"). */
function isTrackCodeName(base: string): boolean {
  const tokens = base.trim().split(/[\s\-_.]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(
    (t) =>
      /^[a-z]{1,3}\d{1,4}$/i.test(t) || // L01, T01, CD2
      /^\d{1,4}$/.test(t) || // 01
      /^(disc|disk|cd|part|pt|track|trk|vol|volume|book|bk|side|chapter|chap|ch|l|t|d)$/i.test(t) // bare marker word
  );
}

/** Pattern skeleton for title-less names: "L01 T01" and "L10 T04" -> "L## T##". */
function patternSkeleton(base: string): string {
  return base
    .replace(/\d+/g, '##')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Songs', 'Isaiah',
  'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark',
  'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy',
  'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation',
] as const;

const BIBLE_BOOK_ALIASES = new Map<string, number>();
BIBLE_BOOKS.forEach((book, index) => BIBLE_BOOK_ALIASES.set(book.toLowerCase(), index + 1));
BIBLE_BOOK_ALIASES.set('psalm', 19);
BIBLE_BOOK_ALIASES.set('song of solomon', 22);
BIBLE_BOOK_ALIASES.set('songs', 22);
BIBLE_BOOK_ALIASES.set('2 corinthains', 47); // common misspelling in filenames

/** Detect Bible-book audio files (e.g. "19 19 Psalms"); returns the book ordinal or null. */
function getBibleBookOrder(filename: string): number | null {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const leadingNumbers = base.match(/^\d{1,3}(?:\s+\d{1,3})*/)?.[0];
  if (!leadingNumbers) return null;
  const ordinals = leadingNumbers.split(/\s+/).map((n) => Number(n));
  const title = base
    .replace(/^\d{1,3}(?:\s+\d{1,3})*\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const ordinal = BIBLE_BOOK_ALIASES.get(title);
  if (!ordinal || !ordinals.includes(ordinal)) return null;
  return ordinal;
}

// Single-token Bible book names/abbreviations (letters only, uppercase). Covers
// the "<BOOK><chapter>" filename scheme, e.g. ACTS11, FCOR1 (1 Cor), 01PSALM.
const BIBLE_TOKENS = new Set<string>([
  'GEN', 'GENESIS', 'EXO', 'EXOD', 'EXODUS', 'LEV', 'LEVITICUS', 'NUM', 'NUMB', 'NUMBERS',
  'DEU', 'DEUT', 'DEUTERONOMY', 'JOS', 'JOSH', 'JOSHUA', 'JDG', 'JUDG', 'JUDGES', 'RUT', 'RUTH',
  'FSAM', 'FSAMUEL', 'SSAM', 'SSAMUEL', 'FKING', 'FKINGS', 'SKING', 'SKINGS',
  'FCHR', 'FCHRON', 'FCHRONICLES', 'SCHR', 'SCHRON', 'SCHRONICLES', 'EZR', 'EZRA',
  'NEH', 'NEHEMIAH', 'EST', 'ESTH', 'ESTHER', 'JOB', 'PS', 'PSA', 'PSLM', 'PSALM', 'PSALMS',
  'PRO', 'PRV', 'PROV', 'PROVERBS', 'ECC', 'ECCL', 'ECCLES', 'ECCLESIASTES',
  'SONG', 'SONGS', 'SOS', 'SONGOFSOLOMON', 'SONGOFSONGS', 'ISA', 'ISAIAH', 'JER', 'JEREMIAH',
  'LAM', 'LAMENT', 'LAMENTATIONS', 'EZE', 'EZK', 'EZEK', 'EZEKIEL', 'DAN', 'DANIEL',
  'HOS', 'HOSEA', 'JOE', 'JOEL', 'AMO', 'AMOS', 'OBA', 'OBAD', 'OBADIAH', 'JON', 'JNH', 'JONAH',
  'MIC', 'MICAH', 'NAH', 'NAHUM', 'HAB', 'HABAKKUK', 'ZEP', 'ZEPH', 'ZEPHANIAH',
  'HAG', 'HAGGAI', 'ZEC', 'ZECH', 'ZECHARIAH', 'MAL', 'MALACHI',
  'MT', 'MAT', 'MATT', 'MATTHEW', 'MK', 'MRK', 'MARK', 'LK', 'LUK', 'LUKE', 'JN', 'JHN', 'JOHN',
  'ACT', 'ACTS', 'ROM', 'RMN', 'ROMANS', 'FCOR', 'FCORINTHIANS', 'FCORINTHAINS',
  'SCOR', 'SCORINTHIANS', 'SCORINTHAINS', 'GAL', 'GALATIANS', 'EPH', 'EPHESIANS',
  'PHP', 'PHIL', 'PHILIP', 'PHILIPPIANS', 'COL', 'COLOS', 'COLOSSIANS',
  'FTHES', 'FTHESS', 'FTHESSALONIANS', 'STHES', 'STHESS', 'STHESSALONIANS',
  'FTIM', 'FTIMOTHY', 'STIM', 'STIMOTHY', 'TIT', 'TITUS', 'PHM', 'PHLM', 'PHILEM', 'PHILEMON',
  'HEB', 'HEBR', 'HEBREWS', 'JAS', 'JAM', 'JAMES', 'FPET', 'FPTR', 'FPETER', 'SPET', 'SPTR', 'SPETER',
  'FJN', 'FJHN', 'FJOHN', 'SJN', 'SJHN', 'SJOHN', 'TJN', 'TJHN', 'TJOHN',
  'JUD', 'JUDE', 'REV', 'RVL', 'REVELATION', 'REVELATIONS',
]);

/**
 * True when a filename is a Bible-book audio file. Spaced names (e.g. "029 MARK")
 * must pass the leading-number == book-ordinal check; single-token names
 * (e.g. "ACTS11", "FCOR1", "01PSALM") are matched against known book tokens.
 */
function isBibleFile(filename: string): boolean {
  const base = filename.replace(/\.[^.]+$/, '').trim();
  if (/\s/.test(base)) return getBibleBookOrder(filename) !== null;
  // Single token: strip leading/trailing chapter digits, keep letters only
  const core = base.replace(/^\d+/, '').replace(/\d+$/, '').replace(/[^a-z]/gi, '').toUpperCase();
  return core.length > 0 && BIBLE_TOKENS.has(core);
}

/** Files named as a single lowercase letter (a, b, c … z) are sequential parts. */
function isSingleLetterPart(base: string): boolean {
  return /^[a-z]$/.test(base.trim());
}

function isActsFile(filename: string): boolean {
  return /^acts\d*$/i.test(filename.replace(/\.[^.]+$/, '').trim());
}

function stripLeadingChapterPrefix(base: string): string {
  return base
    .replace(/^\s*chapter\s+\d+\s*[-:_.]\s*/i, '')
    .trim();
}

/** Human-friendly book title derived from a chapter filename. */
export function deriveBookTitle(filename: string): string {
  if (isActsFile(filename)) return 'Acts';
  if (isBibleFile(filename)) return 'Bible';
  const base = filename.replace(/\.[^.]+$/, '');
  if (isSingleLetterPart(base)) return CS_LEWIS_COMBINED_AUDIOBOOK_TITLE;
  const knownChapterBook = lilithTitleFromChapterOnlyName(base);
  if (knownChapterBook) return knownChapterBook;
  if (isSingleLetterPart(base)) return 'Combined Audiobook (a–z)';
  const stripped = stripChapterSuffix(stripLeadingChapterPrefix(base));
  if (stripped && /[a-z]/i.test(stripped)) {
    return stripped.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // No real title left — show the numbering pattern (e.g. "L## T##")
  if (isTrackCodeName(base)) return patternSkeleton(base);
  return base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Normalised grouping key: files of the same book/playlist share this key. */
export function deriveBookKey(filename: string): string {
  if (isActsFile(filename)) return 'acts';
  if (isBibleFile(filename)) return 'bible';
  const base = filename.replace(/\.[^.]+$/, '');
  if (isSingleLetterPart(base)) return normaliseTitle(CS_LEWIS_COMBINED_AUDIOBOOK_TITLE);
  const knownChapterBook = lilithTitleFromChapterOnlyName(base);
  if (knownChapterBook) return normaliseTitle(knownChapterBook);
  if (isSingleLetterPart(base)) return 'pat:lettered';
  const stripped = stripChapterSuffix(stripLeadingChapterPrefix(base));
  if (stripped && /[a-z]/i.test(stripped)) {
    return stripped.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  // Title-less track codes group by their numbering skeleton
  if (isTrackCodeName(base)) return `pat:${patternSkeleton(base).toLowerCase()}`;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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

  // Fetch from the three fixed folders in parallel.
  const fixedFolderResults = await Promise.all(
    Object.entries(FIXED_FOLDERS).map(async ([source, folderId]) => {
      try {
        const books = await listFilesInFolder(
          accessToken,
          folderId,
          source as Exclude<LibrarySource, 'Local Books'>
        );
        return { source, books };
      } catch (error) {
        console.error(`Failed to fetch from ${source}:`, error);
        return { source, books: [] as BookEntry[] };
      }
    })
  );

  for (const { books } of fixedFolderResults) {
    for (const book of books) {
      if (!seenIds.has(book.id)) {
        allBooks.push(book);
        seenIds.add(book.id);
      }
    }
  }

  // Fetch recursively from the permanent ebook collection folders
  await Promise.all(
    Object.entries(EBOOK_FOLDERS).map(async ([source, folderId]) => {
      try {
        const books = await listFilesInFolderRecursive(accessToken, folderId, source as LibrarySource);
        for (const book of books) {
          if (!seenIds.has(book.id)) {
            allBooks.push(book);
            seenIds.add(book.id);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source}:`, error);
      }
    })
  );

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

/** Parse audiobook metadata + resume position from a folder/file's appProperties. */
function parseAudiobookProps(props?: Record<string, string>): Partial<AudiobookEntry> {
  const meta = parseBookMetadata(props);
  const track = props?.m_audio_track ? Number(props.m_audio_track) : undefined;
  const pos = props?.m_audio_pos ? Number(props.m_audio_pos) : undefined;
  return {
    authors: meta.authors,
    publishedDate: meta.publishedDate,
    description: meta.description,
    coverUrl: meta.coverUrl,
    metadataSource: meta.metadataSource,
    audioTrack: Number.isFinite(track) ? track : undefined,
    audioPosition: Number.isFinite(pos) ? pos : undefined,
    linkedTextId: props?.m_link_text || undefined,
    isManualGroup: Boolean(props?.m_audio_group),
  };
}

/**
 * List audiobooks: the immediate children of the permanent audiobook folders.
 * A child folder becomes a multi-track audiobook; a loose audio file becomes a
 * single-track audiobook. Track lists are NOT loaded here (see getAudiobookTracks).
 */
export async function getAudiobooks(accessToken: string): Promise<AudiobookEntry[]> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  const audiobooks: AudiobookEntry[] = [];
  const seen = new Set<string>();

  await Promise.all(
    Object.entries(AUDIOBOOK_FOLDERS).map(async ([source, rootId]) => {
      type Child = { id: string; name: string; props?: Record<string, string> };
      const folders: Child[] = [];
      const looseAudio: Child[] = [];
      let pageToken: string | null | undefined;
      try {
        do {
          const response = await drive.files.list({
            q: `'${rootId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, name, mimeType, appProperties)',
            pageSize: 200,
            pageToken: pageToken ?? undefined,
          });

          for (const file of response.data.files || []) {
            const props = file.appProperties as Record<string, string> | undefined;
            if (props?.m_hidden === '1') continue;
            const child: Child = { id: file.id!, name: file.name!, props };
            if (file.mimeType === FOLDER_MIME) folders.push(child);
            else if (isAudioMime(file.mimeType)) looseAudio.push(child);
          }

          pageToken = response.data.nextPageToken;
        } while (pageToken);

        // A sub-folder is one audiobook (chapters gathered lazily as tracks)
        for (const f of folders) {
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          audiobooks.push({
            id: f.id,
            title: f.name,
            source: source as LibrarySource,
            isFolder: true,
            ...parseAudiobookProps(f.props),
          });
        }

        // Loose audio files are grouped into one audiobook per derived book title,
        // so individual chapter files no longer show up as separate audiobooks.
        const groups = new Map<string, Child[]>();
        for (const file of looseAudio) {
          const key = manualAudioGroupKey(file.props) || deriveBookKey(file.name) || file.id;
          const group = groups.get(key);
          if (group) group.push(file);
          else groups.set(key, [file]);
        }
        for (const group of groups.values()) {
          group.sort((a, b) => naturalCompare(a.name, b.name));
          const rep = group[0];
          if (seen.has(rep.id)) continue;
          seen.add(rep.id);
          audiobooks.push({
            id: rep.id,
            title: audioGroupTitle(rep),
            source: source as LibrarySource,
            isFolder: false,
            ...parseAudiobookProps(rep.props),
          });
        }
      } catch (error) {
        console.error(`Failed to list audiobooks in ${source}:`, error);
      }
    })
  );

  audiobooks.sort((a, b) => naturalCompare(a.title, b.title));
  return audiobooks;
}

/**
 * Recursively gather the audio tracks for one audiobook. For a folder id this
 * walks all nested folders (e.g. per-disc subfolders); for a single audio file
 * it returns just that file.
 */
export async function getAudiobookTracks(
  accessToken: string,
  id: string,
  isFolder: boolean
): Promise<AudioTrack[]> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });

  if (!isFolder) {
    // A loose-file audiobook is represented by its first chapter. Gather all of
    // its sibling chapters (same parent folder + same derived book key) as tracks.
    const file = await drive.files.get({ fileId: id, fields: 'id, name, size, parents, appProperties' });
    const parent = file.data.parents?.[0];
    const props = file.data.appProperties as Record<string, string> | undefined;
    const key = manualAudioGroupKey(props) || deriveBookKey(file.data.name!);

    if (!parent) {
      return [
        {
          id: file.data.id!,
          name: file.data.name!,
          size: file.data.size ? parseInt(file.data.size as string, 10) : 0,
        },
      ];
    }

    const siblings: AudioTrack[] = [];
    let pageToken: string | null | undefined;
    do {
      const response = await drive.files.list({
        q: `'${parent}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, appProperties)',
        pageSize: 200,
        pageToken: pageToken ?? undefined,
      });
      for (const f of response.data.files || []) {
        if (!isAudioMime(f.mimeType)) continue;
        const siblingProps = f.appProperties as Record<string, string> | undefined;
        const siblingKey = manualAudioGroupKey(siblingProps) || deriveBookKey(f.name!);
        if (siblingKey !== key) continue;
        siblings.push({
          id: f.id!,
          name: f.name!,
          size: f.size ? parseInt(f.size as string, 10) : 0,
        });
      }
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    siblings.sort((a, b) => naturalCompare(a.name, b.name));
    return siblings.length > 0
      ? siblings
      : [
          {
            id: file.data.id!,
            name: file.data.name!,
            size: file.data.size ? parseInt(file.data.size as string, 10) : 0,
          },
        ];
  }

  const tracks: AudioTrack[] = [];
  const subFolders: { id: string; name: string }[] = [];
  let pageToken: string | null | undefined;
  do {
    const response = await drive.files.list({
      q: `'${id}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 200,
      pageToken: pageToken ?? undefined,
    });
    for (const file of response.data.files || []) {
      if (file.mimeType === FOLDER_MIME) {
        subFolders.push({ id: file.id!, name: file.name! });
      } else if (isAudioMime(file.mimeType)) {
        tracks.push({
          id: file.id!,
          name: file.name!,
          size: file.size ? parseInt(file.size as string, 10) : 0,
        });
      }
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  // Recurse into sub-folders (per-disc), ordered naturally
  subFolders.sort((a, b) => naturalCompare(a.name, b.name));
  for (const sub of subFolders) {
    const nested = await getAudiobookTracks(accessToken, sub.id, true);
    tracks.push(...nested);
  }

  // Files directly in this folder, ordered naturally, come before nested ones
  // only matters when both exist; keep a stable natural order overall.
  tracks.sort((a, b) => naturalCompare(a.name, b.name));
  return tracks;
}

/** Fetch one audiobook's title + metadata + resume position by id. */
export async function getAudiobookMeta(
  accessToken: string,
  id: string
): Promise<{ title: string; isFolder: boolean } & Partial<AudiobookEntry>> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.get({ fileId: id, fields: 'id, name, mimeType, appProperties' });
  const isFolder = file.data.mimeType === FOLDER_MIME;
  const props = file.data.appProperties as Record<string, string> | undefined;
  const title = isFolder ? file.data.name! : audioGroupTitle({ name: file.data.name!, props });
  return {
    title,
    isFolder,
    ...parseAudiobookProps(props),
  };
}

function makeManualAudioGroupId(title: string): string {
  const slug = normaliseTitle(title).replace(/\s+/g, '-').slice(0, 80) || 'audio-group';
  return `${slug}-${Date.now().toString(36)}`;
}

/** Merge selected loose-file audiobook entries into one named group. */
export async function groupAudiobooks(
  accessToken: string,
  ids: string[],
  title: string
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  const cleanTitle = title.trim();
  if (ids.length < 2 || !cleanTitle) throw new Error('A group needs at least two audiobooks and a title.');

  const trackIds = new Set<string>();
  for (const id of ids) {
    const meta = await getAudiobookMeta(accessToken, id);
    if (meta.isFolder) throw new Error('Only loose audio files can be merged.');
    const tracks = await getAudiobookTracks(accessToken, id, false);
    for (const track of tracks) trackIds.add(track.id);
  }

  if (trackIds.size < 2) throw new Error('A group needs at least two audio files.');

  const groupId = makeManualAudioGroupId(cleanTitle);
  await Promise.all(
    [...trackIds].map((fileId) =>
      drive.files.update({
        fileId,
        requestBody: {
          appProperties: {
            m_audio_group: groupId,
            m_audio_group_title: cleanTitle,
          },
        },
        fields: 'id',
      })
    )
  );
}

/** Remove a manual loose-file audiobook grouping created by groupAudiobooks. */
export async function ungroupAudiobook(accessToken: string, id: string): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.get({ fileId: id, fields: 'id, name, parents, appProperties, mimeType' });
  if (file.data.mimeType === FOLDER_MIME) throw new Error('Drive folders cannot be unmerged.');
  const props = file.data.appProperties as Record<string, string> | undefined;
  const groupId = props?.m_audio_group;
  const parent = file.data.parents?.[0];
  if (!groupId || !parent) throw new Error('This audiobook is not a manual group.');

  const groupedIds: string[] = [];
  let pageToken: string | null | undefined;
  do {
    const response = await drive.files.list({
      q: `'${parent}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, mimeType, appProperties)',
      pageSize: 200,
      pageToken: pageToken ?? undefined,
    });
    for (const sibling of response.data.files || []) {
      if (!isAudioMime(sibling.mimeType)) continue;
      const siblingProps = sibling.appProperties as Record<string, string> | undefined;
      if (siblingProps?.m_audio_group === groupId) groupedIds.push(sibling.id!);
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  await Promise.all(
    groupedIds.map((fileId) =>
      drive.files.update({
        fileId,
        requestBody: {
          appProperties: {
            m_audio_group: '',
            m_audio_group_title: '',
          },
        },
        fields: 'id',
      })
    )
  );
}

/**
 * Best-effort: record a link between an ebook and an audiobook in both files'
 * appProperties so it can sync across devices. Pass audioId=null to unlink.
 */
export async function linkEbookAudio(
  accessToken: string,
  ebookId: string,
  audioId: string | null
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.update({
    fileId: ebookId,
    requestBody: { appProperties: { m_link_audio: audioId } as unknown as Record<string, string> },
  });
  if (audioId) {
    await drive.files.update({
      fileId: audioId,
      requestBody: { appProperties: { m_link_text: ebookId } },
    });
  }
}

/** Save audiobook resume position (track index + seconds) to appProperties. */
export async function updateAudioProgress(
  accessToken: string,
  id: string,
  track: number,
  position: number
): Promise<void> {
  const auth = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.update({
    fileId: id,
    requestBody: {
      appProperties: {
        m_audio_track: String(Math.max(0, Math.round(track))),
        m_audio_pos: String(Math.max(0, Math.round(position))),
        lastOpened: new Date().toISOString(),
      },
    },
  });
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
