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
  | 'Local Books';

export type BookFormat = 'pdf' | 'epub';

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
}
