'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { DrivePicker } from '@/components/DrivePicker';
import MetadataEditor from '@/components/MetadataEditor';
import type { BookEntry, BookMetadata, AudiobookEntry } from '@/types/books';

const SOURCE_BADGES: Record<string, string> = {
  'IT PD Ebooks': 'bg-amber-500 text-slate-950',
  'Book Club': 'bg-indigo-500 text-white',
  Unsorted: 'bg-slate-500 text-white',
  'Avance KBs': 'bg-cyan-500 text-slate-950',
  'ITIL PDFs': 'bg-violet-500 text-white',
  ITIL: 'bg-fuchsia-500 text-white',
  'ITIL PRINCE COBIT': 'bg-rose-500 text-white',
  'IEC 27001': 'bg-emerald-500 text-slate-950',
  'Local Books': 'bg-emerald-500 text-slate-950',
};

const FORMAT_BADGES: Record<string, string> = {
  pdf: 'bg-red-600 text-white',
  epub: 'bg-teal-600 text-white',
  txt: 'bg-slate-600 text-white',
  docx: 'bg-blue-600 text-white',
};

type SortField =
  | 'title'
  | 'author'
  | 'published'
  | 'added'
  | 'lastOpened'
  | 'progress'
  | 'size'
  | 'format'
  | 'source'
  | 'series';

type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'table';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'published', label: 'Publish date' },
  { value: 'series', label: 'Series' },
  { value: 'added', label: 'Date added' },
  { value: 'lastOpened', label: 'Last opened' },
  { value: 'progress', label: 'Progress' },
  { value: 'size', label: 'Size' },
  { value: 'format', label: 'Format' },
  { value: 'source', label: 'Source' },
];

function prettifyName(name: string) {
  return name.replace(/\.(pdf|epub|txt|docx)$/i, '').replace(/[_]+/g, ' ').trim();
}

function displayTitle(book: BookEntry) {
  return book.title?.trim() || prettifyName(book.name);
}

function displayAuthors(book: BookEntry) {
  return book.authors && book.authors.length > 0 ? book.authors.join(', ') : '';
}

/** Pull the metadata fields out of a BookEntry (for pre-filling the editor). */
function extractMetadata(book: BookEntry): BookMetadata {
  return {
    title: book.title,
    authors: book.authors,
    publishedDate: book.publishedDate,
    publisher: book.publisher,
    description: book.description,
    categories: book.categories,
    series: book.series,
    seriesIndex: book.seriesIndex,
    pageCount: book.pageCount,
    language: book.language,
    isbn: book.isbn,
    coverUrl: book.coverUrl,
    metadataSource: book.metadataSource,
  };
}

function getInitials(title: string) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function getColorFromTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 60%, 35%)`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function formatTime(iso?: string) {
  if (!iso) return 'Never opened';
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function formatDateShort(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(iso));
}

/** Sort key for a field. Returns '' / undefined for "missing" values, which always sort last. */
function sortKey(book: BookEntry, field: SortField): string | number | undefined {
  switch (field) {
    case 'title':
      return displayTitle(book).toLowerCase();
    case 'author':
      return book.authors?.[0]?.toLowerCase();
    case 'published': {
      if (!book.publishedDate) return undefined;
      const ts = Date.parse(book.publishedDate);
      return Number.isNaN(ts) ? book.publishedDate : ts;
    }
    case 'series':
      return book.series?.toLowerCase();
    case 'added':
      return book.modifiedTime ? Date.parse(book.modifiedTime) : undefined;
    case 'lastOpened':
      return book.lastOpened ? Date.parse(book.lastOpened) : undefined;
    case 'progress':
      return book.readingProgress;
    case 'size':
      return book.size;
    case 'format':
      return book.format;
    case 'source':
      return book.source;
    default:
      return undefined;
  }
}

function compareBooks(a: BookEntry, b: BookEntry, field: SortField, dir: SortDir) {
  const ka = sortKey(a, field);
  const kb = sortKey(b, field);
  const missingA = ka === undefined || ka === '';
  const missingB = kb === undefined || kb === '';
  if (missingA && missingB) return 0;
  if (missingA) return 1; // missing values always last, regardless of direction
  if (missingB) return -1;

  let cmp: number;
  if (typeof ka === 'number' && typeof kb === 'number') {
    cmp = ka - kb;
  } else {
    cmp = String(ka).localeCompare(String(kb));
  }
  return dir === 'asc' ? cmp : -cmp;
}

function Cover({ book, className }: { book: BookEntry; className: string }) {
  const [failed, setFailed] = useState(false);
  const title = displayTitle(book);

  if (book.coverUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverUrl}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: getColorFromTitle(title) }}
    >
      {getInitials(title)}
    </div>
  );
}

/**
 * Table column definitions. `title` is always shown; the rest can be toggled
 * via the column editor. `sortField` (when set) makes the header clickable.
 */
const TABLE_COLUMNS: {
  key: string;
  label: string;
  sortField?: SortField;
  align?: 'left' | 'right';
  locked?: boolean;
  cell: (book: BookEntry) => React.ReactNode;
}[] = [
  {
    key: 'title',
    label: 'Title',
    sortField: 'title',
    locked: true,
    cell: (book) => (
      <div className="max-w-[24rem]">
        <Link href={`/reader/${book.id}`} className="block truncate font-medium text-white hover:text-sky-300">
          {displayTitle(book)}
        </Link>
        {book.series && (
          <div className="truncate text-xs text-slate-500">
            {book.series}
            {book.seriesIndex !== undefined ? ` #${book.seriesIndex}` : ''}
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'author',
    label: 'Author',
    sortField: 'author',
    cell: (book) => <div className="max-w-[14rem] truncate text-slate-300">{displayAuthors(book) || '—'}</div>,
  },
  {
    key: 'published',
    label: 'Published',
    sortField: 'published',
    cell: (book) => <span className="whitespace-nowrap text-slate-400">{book.publishedDate ?? '—'}</span>,
  },
  {
    key: 'publisher',
    label: 'Publisher',
    cell: (book) => <div className="max-w-[12rem] truncate text-slate-400">{book.publisher ?? '—'}</div>,
  },
  {
    key: 'series',
    label: 'Series',
    sortField: 'series',
    cell: (book) => (
      <span className="text-slate-400">
        {book.series ? `${book.series}${book.seriesIndex !== undefined ? ` #${book.seriesIndex}` : ''}` : '—'}
      </span>
    ),
  },
  {
    key: 'pages',
    label: 'Pages',
    align: 'right',
    cell: (book) => <span className="text-slate-400">{book.pageCount ?? '—'}</span>,
  },
  {
    key: 'language',
    label: 'Lang',
    cell: (book) => <span className="text-slate-400">{book.language?.toUpperCase() ?? '—'}</span>,
  },
  {
    key: 'format',
    label: 'Format',
    sortField: 'format',
    cell: (book) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${FORMAT_BADGES[book.format] ?? 'bg-slate-500 text-white'}`}>
        {book.format.toUpperCase()}
      </span>
    ),
  },
  {
    key: 'source',
    label: 'Source',
    sortField: 'source',
    cell: (book) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${SOURCE_BADGES[book.source] ?? 'bg-slate-500 text-white'}`}>
        {book.source}
      </span>
    ),
  },
  {
    key: 'size',
    label: 'Size',
    sortField: 'size',
    align: 'right',
    cell: (book) => <span className="whitespace-nowrap text-slate-400">{formatBytes(book.size)}</span>,
  },
  {
    key: 'progress',
    label: 'Progress',
    sortField: 'progress',
    align: 'right',
    cell: (book) => <span className="text-slate-300">{Math.round(book.readingProgress)}%</span>,
  },
  {
    key: 'added',
    label: 'Added',
    sortField: 'added',
    cell: (book) => <span className="whitespace-nowrap text-slate-400">{formatDateShort(book.modifiedTime)}</span>,
  },
  {
    key: 'lastOpened',
    label: 'Last opened',
    sortField: 'lastOpened',
    cell: (book) => <span className="whitespace-nowrap text-slate-400">{book.lastOpened ? formatDateShort(book.lastOpened) : '—'}</span>,
  },
];

const DEFAULT_COLUMNS = ['title', 'author', 'published', 'format', 'source', 'size', 'progress', 'added'];

// --- Audiobook sorting + table columns (parallel to the ebook config above) ---

type AudioSortField = 'title' | 'author' | 'published' | 'source';

const AUDIO_SORT_OPTIONS: { value: AudioSortField; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'published', label: 'Publish date' },
  { value: 'source', label: 'Source' },
];

function audioSortKey(a: AudiobookEntry, field: AudioSortField): string | undefined {
  switch (field) {
    case 'title':
      return a.title.toLowerCase();
    case 'author':
      return a.authors?.[0]?.toLowerCase();
    case 'published':
      return a.publishedDate;
    case 'source':
      return a.source;
    default:
      return undefined;
  }
}

function compareAudiobooks(a: AudiobookEntry, b: AudiobookEntry, field: AudioSortField, dir: SortDir) {
  const ka = audioSortKey(a, field);
  const kb = audioSortKey(b, field);
  const missingA = ka === undefined || ka === '';
  const missingB = kb === undefined || kb === '';
  if (missingA && missingB) return 0;
  if (missingA) return 1;
  if (missingB) return -1;
  const cmp = String(ka).localeCompare(String(kb));
  return dir === 'asc' ? cmp : -cmp;
}

function extractAudioMetadata(a: AudiobookEntry): BookMetadata {
  return {
    title: a.title,
    authors: a.authors,
    publishedDate: a.publishedDate,
    description: a.description,
    coverUrl: a.coverUrl,
    metadataSource: a.metadataSource,
  };
}

const AUDIO_TABLE_COLUMNS: {
  key: string;
  label: string;
  sortField?: AudioSortField;
  locked?: boolean;
  cell: (a: AudiobookEntry) => React.ReactNode;
}[] = [
  {
    key: 'title',
    label: 'Title',
    sortField: 'title',
    locked: true,
    cell: (a) => (
      <div className="max-w-[24rem]">
        <Link href={`/listen/${a.id}`} className="block truncate font-medium text-white hover:text-sky-300">
          {a.title}
        </Link>
      </div>
    ),
  },
  {
    key: 'author',
    label: 'Author',
    sortField: 'author',
    cell: (a) => <div className="max-w-[14rem] truncate text-slate-300">{a.authors?.join(', ') || '—'}</div>,
  },
  {
    key: 'published',
    label: 'Published',
    sortField: 'published',
    cell: (a) => <span className="whitespace-nowrap text-slate-400">{a.publishedDate ?? '—'}</span>,
  },
  {
    key: 'kind',
    label: 'Type',
    cell: (a) => <span className="whitespace-nowrap text-slate-400">{a.isFolder ? 'Audiobook' : 'Single file'}</span>,
  },
  {
    key: 'source',
    label: 'Source',
    sortField: 'source',
    cell: (a) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${SOURCE_BADGES[a.source] ?? 'bg-slate-500 text-white'}`}>
        {a.source}
      </span>
    ),
  },
];

const DEFAULT_AUDIO_COLUMNS = ['title', 'author', 'published', 'kind', 'source'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function LibraryPage() {
  const [books, setBooks] = useState<BookEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [enrich, setEnrich] = useState<{ running: boolean; done: number; total: number; message: string }>({
    running: false,
    done: 0,
    total: 0,
    message: '',
  });
  // Fetched-but-unsaved suggestions awaiting the user's review, keyed by file id.
  const [pending, setPending] = useState<Record<string, BookMetadata>>({});
  const [editingBook, setEditingBook] = useState<BookEntry | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BookEntry | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'ebooks' | 'audiobooks'>('ebooks');
  const [audiobooks, setAudiobooks] = useState<AudiobookEntry[] | null>(null);
  const [audiobooksLoading, setAudiobooksLoading] = useState(false);
  const [audioSortField, setAudioSortField] = useState<AudioSortField>('title');
  const [audioSortDir, setAudioSortDir] = useState<SortDir>('asc');
  const [visibleAudioColumns, setVisibleAudioColumns] = useState<string[]>(DEFAULT_AUDIO_COLUMNS);
  const [showAudioColumnEditor, setShowAudioColumnEditor] = useState(false);
  const [editingAudio, setEditingAudio] = useState<AudiobookEntry | null>(null);
  const [confirmDeleteAudio, setConfirmDeleteAudio] = useState<AudiobookEntry | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });

  // Restore persisted view + sort preferences
  useEffect(() => {
    const storedView = window.localStorage.getItem('joshbooks-view') as ViewMode | null;
    const storedField = window.localStorage.getItem('joshbooks-sort-field') as SortField | null;
    const storedDir = window.localStorage.getItem('joshbooks-sort-dir') as SortDir | null;
    if (storedView === 'grid' || storedView === 'table') setViewMode(storedView);
    if (storedField && SORT_OPTIONS.some((o) => o.value === storedField)) setSortField(storedField);
    if (storedDir === 'asc' || storedDir === 'desc') setSortDir(storedDir);

    const storedHidden = window.localStorage.getItem('joshbooks-hidden');
    if (storedHidden) {
      try {
        const ids = JSON.parse(storedHidden) as string[];
        if (Array.isArray(ids)) setHiddenIds(new Set(ids));
      } catch {
        // ignore malformed stored value
      }
    }

    const storedColumns = window.localStorage.getItem('joshbooks-columns');
    if (storedColumns) {
      try {
        const parsed = JSON.parse(storedColumns) as string[];
        const valid = parsed.filter((key) => TABLE_COLUMNS.some((c) => c.key === key));
        if (valid.length > 0) setVisibleColumns(valid.includes('title') ? valid : ['title', ...valid]);
      } catch {
        // ignore malformed stored value
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('joshbooks-view', viewMode);
  }, [viewMode]);
  useEffect(() => {
    window.localStorage.setItem('joshbooks-sort-field', sortField);
  }, [sortField]);
  useEffect(() => {
    window.localStorage.setItem('joshbooks-sort-dir', sortDir);
  }, [sortDir]);
  useEffect(() => {
    window.localStorage.setItem('joshbooks-columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const refreshLibrary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/library', { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? 'Failed to load library');
        setBooks([]);
        return;
      }

      const data = (await response.json()) as BookEntry[];
      setBooks(data);
    } catch {
      setError('Unable to fetch library. Please check your connection.');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshAudiobooks = async () => {
    setAudiobooksLoading(true);
    try {
      const response = await fetch('/api/library/audiobooks', { cache: 'no-store' });
      if (!response.ok) {
        setAudiobooks([]);
        return;
      }
      setAudiobooks((await response.json()) as AudiobookEntry[]);
    } catch {
      setAudiobooks([]);
    } finally {
      setAudiobooksLoading(false);
    }
  };

  // Lazy-load audiobooks the first time the tab is opened
  useEffect(() => {
    if (tab === 'audiobooks' && audiobooks === null && !audiobooksLoading) {
      refreshAudiobooks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleImportStart = () => {
    setImportStatus({ type: 'loading', message: 'Importing files...' });
  };

  const handleImportComplete = (count: number) => {
    setImportStatus({
      type: 'success',
      message: `Successfully imported ${count} file${count !== 1 ? 's' : ''}.`,
    });
    setTimeout(() => {
      setImportStatus({ type: 'idle', message: '' });
      refreshLibrary();
    }, 2000);
  };

  const handleImportError = (errorMessage: string) => {
    setImportStatus({ type: 'error', message: errorMessage });
    setTimeout(() => {
      setImportStatus({ type: 'idle', message: '' });
    }, 5000);
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  /** Fetch the top online suggestion for an item and stage it (no write). Returns true if found. */
  const stageById = async (id: string, name: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/library/metadata/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { candidates: BookMetadata[] };
      const top = data.candidates?.[0];
      if (top) {
        setPending((prev) => ({ ...prev, [id]: top }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  /** Bulk: stage suggestions for every un-enriched, not-yet-staged book for review. */
  const fetchAllMetadata = async () => {
    if (!books) return;
    const targets = books.filter((b) => !b.metadataSource && !pending[b.id]);
    if (targets.length === 0) {
      setEnrich({ running: false, done: 0, total: 0, message: 'Nothing new to fetch.' });
      setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 4000);
      return;
    }

    setEnrich({ running: true, done: 0, total: targets.length, message: `Fetching 0/${targets.length}…` });
    let done = 0;
    let matched = 0;
    for (const book of targets) {
      const ok = await stageById(book.id, book.name);
      if (ok) matched += 1;
      done += 1;
      setEnrich((s) => ({ ...s, done, message: `Fetching ${done}/${targets.length}…` }));
      await sleep(300); // be gentle with the public APIs
    }
    setEnrich({
      running: false,
      done,
      total: targets.length,
      message: `Fetched ${matched} suggestion${matched !== 1 ? 's' : ''} — review and approve each below.`,
    });
    setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 8000);
  };

  /** Bulk: stage suggestions for every un-enriched audiobook for review. */
  const fetchAllAudioMetadata = async () => {
    if (!audiobooks) return;
    const targets = audiobooks.filter((a) => !a.metadataSource && !pending[a.id]);
    if (targets.length === 0) {
      setEnrich({ running: false, done: 0, total: 0, message: 'Nothing new to fetch.' });
      setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 4000);
      return;
    }
    setEnrich({ running: true, done: 0, total: targets.length, message: `Fetching 0/${targets.length}…` });
    let done = 0;
    let matched = 0;
    for (const a of targets) {
      const ok = await stageById(a.id, a.title);
      if (ok) matched += 1;
      done += 1;
      setEnrich((s) => ({ ...s, done, message: `Fetching ${done}/${targets.length}…` }));
      await sleep(300);
    }
    setEnrich({
      running: false,
      done,
      total: targets.length,
      message: `Fetched ${matched} suggestion${matched !== 1 ? 's' : ''} — review and approve each below.`,
    });
    setTimeout(() => setEnrich((s) => ({ ...s, message: '' })), 8000);
  };

  /** Persist explicit metadata (an approved suggestion or an edited form) to Drive. */
  const saveMetadata = async (fileId: string, metadata: BookMetadata) => {
    setSavingId(fileId);
    try {
      const response = await fetch('/api/library/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, metadata }),
      });
      if (!response.ok) throw new Error('save failed');
      // Patch whichever collection the id belongs to
      setBooks((prev) => (prev ? prev.map((b) => (b.id === fileId ? { ...b, ...metadata } : b)) : prev));
      setAudiobooks((prev) =>
        prev ? prev.map((a) => (a.id === fileId ? { ...a, ...metadata } : a)) : prev
      );
      setPending((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    } finally {
      setSavingId(null);
    }
  };

  const discardPending = (fileId: string) => {
    setPending((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  };

  /**
   * Remove a book from the library (file stays in Drive). The hidden list is the
   * source of truth and lives in localStorage, so removal always works even when
   * the file lives in a shared folder we can't write to. The Drive call is a
   * best-effort sync that won't block the UI if it fails.
   */
  const removeBook = (book: BookEntry) => {
    setRemovingId(book.id);

    // Authoritative, always-works local hide
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(book.id);
      window.localStorage.setItem('joshbooks-hidden', JSON.stringify([...next]));
      return next;
    });
    setBooks((prev) => (prev ? prev.filter((b) => b.id !== book.id) : prev));
    discardPending(book.id);
    setConfirmDelete(null);
    setRemovingId(null);

    // Best-effort: also hide in Drive so it syncs to other devices (ignore failure)
    fetch('/api/library/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: book.id, source: book.source }),
    }).catch(() => {});
  };

  /** Remove an audiobook from the library (same local-first approach as removeBook). */
  const removeAudiobook = (a: AudiobookEntry) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(a.id);
      window.localStorage.setItem('joshbooks-hidden', JSON.stringify([...next]));
      return next;
    });
    setAudiobooks((prev) => (prev ? prev.filter((x) => x.id !== a.id) : prev));
    discardPending(a.id);
    setConfirmDeleteAudio(null);
    fetch('/api/library/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: a.id, source: a.source }),
    }).catch(() => {});
  };

  const sortedBooks = useMemo(() => {
    if (!books) return [];
    const query = search.trim().toLowerCase();
    const visible = books.filter((book) => !hiddenIds.has(book.id));

    const filtered = query
      ? visible.filter((book) => {
          return (
            displayTitle(book).toLowerCase().includes(query) ||
            displayAuthors(book).toLowerCase().includes(query) ||
            book.name.toLowerCase().includes(query) ||
            book.source.toLowerCase().includes(query) ||
            book.format.toLowerCase().includes(query)
          );
        })
      : visible;

    return filtered.sort((a, b) => compareBooks(a, b, sortField, sortDir));
  }, [books, search, sortField, sortDir, hiddenIds]);

  const filteredAudiobooks = useMemo(() => {
    if (!audiobooks) return [];
    const query = search.trim().toLowerCase();
    const visible = audiobooks.filter((a) => !hiddenIds.has(a.id));
    const list = query
      ? visible.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            (a.authors?.join(', ').toLowerCase().includes(query) ?? false) ||
            a.source.toLowerCase().includes(query)
        )
      : visible;
    return [...list].sort((a, b) => compareAudiobooks(a, b, audioSortField, audioSortDir));
  }, [audiobooks, search, hiddenIds, audioSortField, audioSortDir]);

  const activeAudioColumns = AUDIO_TABLE_COLUMNS.filter(
    (col) => col.locked || visibleAudioColumns.includes(col.key)
  );

  const toggleAudioSort = (field: AudioSortField) => {
    if (audioSortField === field) {
      setAudioSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAudioSortField(field);
      setAudioSortDir('asc');
    }
  };

  const audioSortArrow = (field: AudioSortField) =>
    audioSortField === field ? (audioSortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const toggleAudioColumn = (key: string) => {
    setVisibleAudioColumns((cols) =>
      cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]
    );
  };

  const audioFetchTargetCount = audiobooks
    ? audiobooks.filter((a) => !a.metadataSource && !pending[a.id]).length
    : 0;

  const pendingCount = Object.keys(pending).length;
  const fetchTargetCount = books ? books.filter((b) => !b.metadataSource && !pending[b.id]).length : 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortArrow = (field: SortField) => (sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const toggleColumn = (key: string) => {
    setVisibleColumns((cols) => (cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]));
  };

  // Render columns in the canonical TABLE_COLUMNS order, keeping only visible ones.
  const activeColumns = TABLE_COLUMNS.filter((col) => col.locked || visibleColumns.includes(col.key));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Library</h1>
              <p className="mt-2 text-slate-400 max-w-2xl">
                Browse books from your mapped Drive folders, then open them in the reader.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <DrivePicker
                onImportStart={handleImportStart}
                onImportComplete={handleImportComplete}
                onImportError={handleImportError}
              />
              <button
                type="button"
                onClick={fetchAllMetadata}
                disabled={enrich.running || !books || fetchTargetCount === 0}
                title="Fetches online suggestions for review — nothing is saved until you approve each one"
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {enrich.running
                  ? `Fetching… ${enrich.done}/${enrich.total}`
                  : `Fetch suggestions${fetchTargetCount ? ` (${fetchTargetCount})` : ''}`}
              </button>
              <button
                type="button"
                onClick={refreshLibrary}
                className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Refresh Library
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('ebooks')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === 'ebooks' ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              📚 Ebooks
            </button>
            <button
              type="button"
              onClick={() => setTab('audiobooks')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === 'audiobooks' ? 'bg-slate-200 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              🎧 Audiobooks
            </button>
          </div>

          {tab === 'audiobooks' && (
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search audiobooks by title or author"
                className="w-full flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={fetchAllAudioMetadata}
                  disabled={enrich.running || !audiobooks || audioFetchTargetCount === 0}
                  title="Fetch online suggestions for audiobooks — nothing is saved until you approve each one"
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {enrich.running
                    ? `Fetching… ${enrich.done}/${enrich.total}`
                    : `Fetch suggestions${audioFetchTargetCount ? ` (${audioFetchTargetCount})` : ''}`}
                </button>

                <div className="flex items-center gap-2">
                  <label htmlFor="audio-sort" className="text-sm text-slate-400">
                    Sort
                  </label>
                  <select
                    id="audio-sort"
                    value={audioSortField}
                    onChange={(event) => setAudioSortField(event.target.value as AudioSortField)}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                  >
                    {AUDIO_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAudioSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
                  >
                    {audioSortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
                  </button>
                </div>

                <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                  >
                    Table
                  </button>
                </div>

                {viewMode === 'table' && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAudioColumnEditor((v) => !v)}
                      className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
                    >
                      Columns ▾
                    </button>
                    {showAudioColumnEditor && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowAudioColumnEditor(false)} />
                        <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-xl shadow-black/40">
                          <p className="px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Visible columns</p>
                          {AUDIO_TABLE_COLUMNS.map((col) => (
                            <label
                              key={col.key}
                              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${col.locked ? 'text-slate-500' : 'cursor-pointer text-slate-200 hover:bg-slate-800'}`}
                            >
                              <input
                                type="checkbox"
                                checked={col.locked || visibleAudioColumns.includes(col.key)}
                                disabled={col.locked}
                                onChange={() => toggleAudioColumn(col.key)}
                                className="h-4 w-4 accent-sky-500"
                              />
                              {col.label}
                              {col.locked && <span className="ml-auto text-xs text-slate-600">always</span>}
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={() => setVisibleAudioColumns(DEFAULT_AUDIO_COLUMNS)}
                            className="mt-1 w-full rounded-xl px-2 py-1.5 text-left text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                          >
                            Reset to default
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={refreshAudiobooks}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Refresh
                </button>
                <div className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                  {audiobooks ? filteredAudiobooks.length : '...'} audiobooks
                </div>
              </div>
            </div>
          )}

          {tab === 'ebooks' && (
          <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author, source, or format"
              className="w-full flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
            />

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="sort" className="text-sm text-slate-400">
                  Sort
                </label>
                <select
                  id="sort"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as SortField)}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
                  title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
                </button>
              </div>

              <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'grid' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-xl px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-slate-200 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  Table
                </button>
              </div>

              {viewMode === 'table' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColumnEditor((v) => !v)}
                    className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
                  >
                    Columns ▾
                  </button>
                  {showColumnEditor && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowColumnEditor(false)} />
                      <div className="absolute right-0 z-40 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-xl shadow-black/40">
                        <p className="px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Visible columns</p>
                        {TABLE_COLUMNS.map((col) => (
                          <label
                            key={col.key}
                            className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${col.locked ? 'text-slate-500' : 'cursor-pointer text-slate-200 hover:bg-slate-800'}`}
                          >
                            <input
                              type="checkbox"
                              checked={col.locked || visibleColumns.includes(col.key)}
                              disabled={col.locked}
                              onChange={() => toggleColumn(col.key)}
                              className="h-4 w-4 accent-sky-500"
                            />
                            {col.label}
                            {col.locked && <span className="ml-auto text-xs text-slate-600">always</span>}
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => setVisibleColumns(DEFAULT_COLUMNS)}
                          className="mt-1 w-full rounded-xl px-2 py-1.5 text-left text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                        >
                          Reset to default
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-400">
                {books ? sortedBooks.length : '...'} books
              </div>
            </div>
          </div>
          )}
        </section>

        {(importStatus.type !== 'idle' || enrich.message) && (
          <section
            className={`rounded-3xl border p-6 ${
              importStatus.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : importStatus.type === 'error'
                ? 'border-rose-500/30 bg-rose-500/5 text-rose-100'
                : 'border-sky-500/30 bg-sky-500/5 text-sky-100'
            }`}
          >
            <p className="font-medium">{importStatus.type !== 'idle' ? importStatus.message : enrich.message}</p>
            {enrich.running && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${enrich.total ? (enrich.done / enrich.total) * 100 : 0}%` }}
                />
              </div>
            )}
          </section>
        )}

        {tab === 'ebooks' && (loading ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-white/10 bg-slate-900/80 p-6">
                <div className="h-48 rounded-3xl bg-slate-800" />
                <div className="mt-4 h-6 w-3/4 rounded-full bg-slate-800" />
                <div className="mt-3 h-4 w-1/2 rounded-full bg-slate-800" />
                <div className="mt-6 h-3 rounded-full bg-slate-800" />
              </div>
            ))}
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 text-rose-100">
            <h2 className="text-2xl font-semibold">Unable to load library</h2>
            <p className="mt-2 text-slate-300">{error}</p>
            <button
              type="button"
              onClick={refreshLibrary}
              className="mt-4 rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              Try again
            </button>
          </section>
        ) : sortedBooks.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
            <p className="text-xl font-medium">No books match your search.</p>
            <p className="mt-2">Try a broader search or refresh the library.</p>
          </section>
        ) : viewMode === 'grid' ? (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {sortedBooks.map((book) => (
              <article
                key={book.id}
                className="group flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/10 transition hover:border-slate-500/40 hover:bg-slate-800/70 hover:shadow-black/20"
              >
                <Link href={`/reader/${book.id}`} className="flex gap-4">
                  <Cover book={book} className="h-28 w-20 shrink-0 overflow-hidden rounded-2xl text-2xl" />
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-lg font-semibold text-white">{displayTitle(book)}</h2>
                    {displayAuthors(book) && (
                      <p className="mt-1 truncate text-sm text-slate-300">{displayAuthors(book)}</p>
                    )}
                    {book.publishedDate && (
                      <p className="mt-0.5 text-xs text-slate-500">{book.publishedDate}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 ${SOURCE_BADGES[book.source] ?? 'bg-slate-500 text-white'}`}>
                        {book.source}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 ${FORMAT_BADGES[book.format] ?? 'bg-slate-500 text-white'}`}>
                        {book.format.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="mt-5 space-y-4 text-slate-300">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Size</span>
                      <span>{formatBytes(book.size)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Added</span>
                      <span>{formatDateShort(book.modifiedTime)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Last opened</span>
                      <span>{book.lastOpened ? formatTime(book.lastOpened) : 'Never'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                      <span>Progress</span>
                      <span>{Math.round(book.readingProgress)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-sky-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, book.readingProgress))}%` }}
                      />
                    </div>
                  </div>
                  {pending[book.id] ? (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Suggested — review</p>
                      <p className="mt-1 truncate text-sm font-medium text-white">{pending[book.id].title}</p>
                      <p className="truncate text-xs text-slate-300">
                        {pending[book.id].authors?.join(', ') || 'Unknown author'}
                        {pending[book.id].publishedDate ? ` · ${pending[book.id].publishedDate}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveMetadata(book.id, pending[book.id])}
                          disabled={savingId === book.id}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {savingId === book.id ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBook(book)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                        >
                          Edit…
                        </button>
                        <button
                          type="button"
                          onClick={() => discardPending(book.id)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBook(book)}
                        className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                      >
                        Edit metadata
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(book)}
                        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Cover</th>
                  {activeColumns.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortField ? () => toggleSort(col.sortField!) : undefined}
                      className={`whitespace-nowrap px-4 py-3 font-medium ${col.align === 'right' ? 'text-right' : ''} ${
                        col.sortField ? 'cursor-pointer select-none hover:text-white' : ''
                      }`}
                    >
                      {col.label}
                      {col.sortField ? sortArrow(col.sortField) : ''}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedBooks.map((book) => {
                  const suggestion = pending[book.id];
                  return (
                    <tr
                      key={book.id}
                      className={`transition hover:bg-slate-800/60 ${suggestion ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/reader/${book.id}`}>
                          <Cover book={book} className="h-14 w-10 overflow-hidden rounded-md text-xs" />
                        </Link>
                      </td>
                      {activeColumns.map((col) => (
                        <td key={col.key} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}>
                          {col.cell(book)}
                          {col.key === 'title' && suggestion && (
                            <div className="mt-1 max-w-[24rem] truncate text-xs text-amber-300">
                              Suggested: {suggestion.title}
                              {suggestion.authors?.[0] ? ` — ${suggestion.authors[0]}` : ''}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {suggestion && (
                            <>
                              <button
                                type="button"
                                onClick={() => saveMetadata(book.id, suggestion)}
                                disabled={savingId === book.id}
                                title="Approve suggestion"
                                className="rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => discardPending(book.id)}
                                title="Discard suggestion"
                                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                              >
                                ✕
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingBook(book)}
                            title="Edit metadata"
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(book)}
                            title="Remove from library"
                            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        {tab === 'audiobooks' &&
          (audiobooksLoading ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-3xl border border-white/10 bg-slate-900/80" />
              ))}
            </section>
          ) : filteredAudiobooks.length === 0 ? (
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
              <p className="text-xl font-medium">No audiobooks found.</p>
              <p className="mt-2">Add audio to your Audiobooks or Outlander Drive folders, then refresh.</p>
            </section>
          ) : viewMode === 'grid' ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAudiobooks.map((book) => {
                const suggestion = pending[book.id];
                return (
                  <article
                    key={book.id}
                    className="flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/10 transition hover:border-slate-500/40 hover:bg-slate-800/70"
                  >
                    <Link href={`/listen/${book.id}`} className="flex items-center gap-4">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={book.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-2xl">
                          🎧
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="line-clamp-2 font-semibold text-white">{book.title}</h2>
                        {book.authors && <p className="truncate text-sm text-slate-400">{book.authors.join(', ')}</p>}
                        {book.publishedDate && <p className="text-xs text-slate-500">{book.publishedDate}</p>}
                        <p className="mt-1 text-xs text-slate-500">
                          {book.isFolder ? 'Audiobook' : 'Single file'} · {book.source}
                        </p>
                        {book.audioPosition !== undefined && book.audioPosition > 0 && (
                          <span className="mt-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                            Resume
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="mt-4">
                      {suggestion ? (
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Suggested — review</p>
                          <p className="mt-1 truncate text-sm font-medium text-white">{suggestion.title}</p>
                          <p className="truncate text-xs text-slate-300">
                            {suggestion.authors?.join(', ') || 'Unknown author'}
                            {suggestion.publishedDate ? ` · ${suggestion.publishedDate}` : ''}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveMetadata(book.id, suggestion)}
                              disabled={savingId === book.id}
                              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {savingId === book.id ? 'Saving…' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAudio(book)}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                            >
                              Edit…
                            </button>
                            <button
                              type="button"
                              onClick={() => discardPending(book.id)}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingAudio(book)}
                            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                          >
                            Edit metadata
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAudio(book)}
                            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="overflow-x-auto rounded-3xl border border-white/10 bg-slate-900/80 shadow-xl shadow-black/10">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Cover</th>
                    {activeAudioColumns.map((col) => (
                      <th
                        key={col.key}
                        onClick={col.sortField ? () => toggleAudioSort(col.sortField!) : undefined}
                        className={`whitespace-nowrap px-4 py-3 font-medium ${col.sortField ? 'cursor-pointer select-none hover:text-white' : ''}`}
                      >
                        {col.label}
                        {col.sortField ? audioSortArrow(col.sortField) : ''}
                      </th>
                    ))}
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAudiobooks.map((book) => {
                    const suggestion = pending[book.id];
                    return (
                      <tr key={book.id} className={`transition hover:bg-slate-800/60 ${suggestion ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-4 py-3">
                          <Link href={`/listen/${book.id}`}>
                            {book.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={book.coverUrl} alt="" className="h-14 w-10 rounded-md object-cover" />
                            ) : (
                              <div className="flex h-14 w-10 items-center justify-center rounded-md bg-sky-600 text-lg">🎧</div>
                            )}
                          </Link>
                        </td>
                        {activeAudioColumns.map((col) => (
                          <td key={col.key} className="px-4 py-3">
                            {col.cell(book)}
                            {col.key === 'title' && suggestion && (
                              <div className="mt-1 max-w-[24rem] truncate text-xs text-amber-300">
                                Suggested: {suggestion.title}
                                {suggestion.authors?.[0] ? ` — ${suggestion.authors[0]}` : ''}
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {suggestion && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveMetadata(book.id, suggestion)}
                                  disabled={savingId === book.id}
                                  title="Approve suggestion"
                                  className="rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => discardPending(book.id)}
                                  title="Discard suggestion"
                                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingAudio(book)}
                              title="Edit metadata"
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteAudio(book)}
                              title="Remove from library"
                              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/20"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
      </div>

      {editingBook && (
        <MetadataEditor
          book={editingBook}
          initial={pending[editingBook.id] ?? extractMetadata(editingBook)}
          onClose={() => setEditingBook(null)}
          onSave={(metadata) => saveMetadata(editingBook.id, metadata)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Remove from library?</h2>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-medium text-white">{displayTitle(confirmDelete)}</span> will be removed from
              your library. The file itself stays in your Google Drive — this only hides it here.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={removingId === confirmDelete.id}
                className="rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeBook(confirmDelete)}
                disabled={removingId === confirmDelete.id}
                className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {removingId === confirmDelete.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAudio && (
        <MetadataEditor
          book={{ name: editingAudio.title }}
          initial={pending[editingAudio.id] ?? extractAudioMetadata(editingAudio)}
          onClose={() => setEditingAudio(null)}
          onSave={(metadata) => saveMetadata(editingAudio.id, metadata)}
        />
      )}

      {confirmDeleteAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Remove from library?</h2>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-medium text-white">{confirmDeleteAudio.title}</span> will be removed from your
              library. The audio stays in your Google Drive — this only hides it here.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteAudio(null)}
                className="rounded-full bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeAudiobook(confirmDeleteAudio)}
                className="rounded-full bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
