/**
 * Shared types for BookShelf ebook reader
 * Used throughout the app to ensure consistent Book metadata shape
 */

export type LibrarySource =
  | 'IT PD Ebooks'
  | 'Book Club'
  | 'Unsorted'
  | 'Avance KBs'
  | 'ITIL PDFs'
  | 'ITIL'
  | 'ITIL PRINCE COBIT'
  | 'IEC 27001'
  | 'Local Books'
  | 'Audiobooks'
  | 'Fiction – Classics'
  | 'Fiction – General'
  | 'Nonfiction'
  | 'Epub & PDF'
  | 'Outlander';

export type BookFormat = 'pdf' | 'epub' | 'txt' | 'docx';

/** A free public-domain ebook from an online source (read in-app via the proxy). */
export interface OnlineEbook {
  id: string;
  title: string;
  author: string;
  /** 'epub' or 'txt' — opened in the matching reader */
  format: 'epub' | 'txt';
  /** Direct download URL (whitelisted host, fetched via /api/fetch-ebook) */
  url: string;
  coverUrl?: string;
  source: string;
  category: 'Classic literature' | 'Sci-fi & fantasy' | 'Philosophy & nonfiction' | 'Christian & faith';
}

/** A curated movie file stored in Google Drive and opened externally. */
export interface MovieEntry {
  id: string;
  title: string;
  year?: number;
  driveFileId: string;
  driveUrl: string;
  collection?: string;
}

/** A curated podcast show or episode hosted by an external provider. */
export interface PodcastEntry {
  id: string;
  title: string;
  url: string;
  category: string;
  provider: string;
}

/** A single audio file within an audiobook. */
export interface AudioTrack {
  /** Drive file id of the audio track */
  id: string;
  name: string;
  size: number;
}

/**
 * An audiobook: either a Drive folder of audio tracks or a single audio file.
 * Track lists are fetched lazily (see /api/library/audiobook/[id]).
 */
export interface AudiobookEntry {
  /** Drive folder id (multi-track) or file id (single track) */
  id: string;
  title: string;
  source: LibrarySource;
  /** true when this audiobook is a folder of tracks */
  isFolder: boolean;
  /** true when loose tracks were manually merged in JoshBooks */
  isManualGroup?: boolean;
  /** Tracks, when loaded (the list endpoint omits these for speed) */
  tracks?: AudioTrack[];

  // Optional online metadata (reuses the m_* appProperties scheme)
  authors?: string[];
  publishedDate?: string;
  description?: string;
  coverUrl?: string;
  metadataSource?: MetadataSource;

  // Resume position
  audioTrack?: number;
  audioPosition?: number;

  /** Linked text edition (Phase 4) */
  linkedTextId?: string;
}

export type MetadataSource = 'google-books' | 'open-library' | 'manual';

/**
 * Book metadata fetched from an online source (Google Books / Open Library)
 * and persisted to Drive appProperties. All fields optional — a book may be
 * partially matched or not enriched at all.
 */
export interface BookMetadata {
  title?: string;
  authors?: string[];
  publishedDate?: string;
  publisher?: string;
  description?: string;
  categories?: string[];
  series?: string;
  seriesIndex?: number;
  pageCount?: number;
  language?: string;
  isbn?: string;
  /** Reconstructed cover image URL (from a Google Books volume id or Open Library cover id) */
  coverUrl?: string;
  /** Google Books volume id — stored so the cover URL can be reconstructed */
  googleBooksId?: string;
  /** Open Library cover id — stored so the cover URL can be reconstructed */
  openLibraryCoverId?: string;
  metadataSource?: MetadataSource;
}

export type AudiobookAvailabilityType = 'full_public_domain' | 'official_preview' | 'unknown';

export interface Audiobook {
  /** Unique identifier for the audiobook */
  id: string;

  /** Title of the audiobook */
  title: string;

  /** Author of the audiobook */
  author: string;

  /** Full YouTube URL */
  youtubeUrl: string;

  /** Catalogue names/files this audiobook matches */
  catalogueMatches: string[];

  /** Type of availability (full audiobook, preview, or unknown) */
  availabilityType: AudiobookAvailabilityType;

  /** Display label for the UI (e.g., "Full public-domain audiobook", "Official audiobook preview") */
  displayLabel?: string;

  /** Source of the audiobook (e.g., "LibriVox", "Google Play Books") */
  source?: string;

  /** Rights or availability notes */
  rightsNote?: string;

  /** Additional notes about the audiobook */
  notes?: string;

  /** Human-readable runtime when known (e.g. "2:34:56") */
  durationLabel?: string;

  /** True for user-added catalogue entries (not bundled in the app) */
  isCustom?: boolean;
}

export interface BookEntry {
  /** Google Drive file ID */
  id: string;

  /** File name (e.g. "The_Pragmatic_Programmer.pdf") */
  name: string;

  /** MIME type: "application/pdf" or "application/epub+zip" */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Last modified time from Google Drive (ISO 8601 string) */
  modifiedTime: string;

  /** Drive thumbnail URL (may be expired or require auth; use as progressive enhancement only) */
  thumbnailLink?: string;

  /** Which Drive folder this book comes from */
  source: LibrarySource;

  /** File format (derived from mimeType) */
  format: BookFormat;

  /** Reading progress as a percentage (0–100, from appProperties.progressPercentage) */
  readingProgress: number;

  /**
   * Last location where user stopped reading.
   * For EPUB: EPUB CFI (Canonical Fragment Identifier) string
   * For PDF: page number as a string (e.g. "42")
   */
  lastLocation: string;

  /** ISO 8601 timestamp of when user last opened this book (from appProperties.lastOpened) */
  lastOpened?: string;

  // --- Online metadata (from Google Books / Open Library, persisted in appProperties) ---
  title?: string;
  authors?: string[];
  publishedDate?: string;
  publisher?: string;
  description?: string;
  categories?: string[];
  series?: string;
  seriesIndex?: number;
  pageCount?: number;
  language?: string;
  isbn?: string;
  /** Reconstructed cover image URL */
  coverUrl?: string;
  /** Which source enriched this book; undefined means not yet enriched */
  metadataSource?: MetadataSource;
}
