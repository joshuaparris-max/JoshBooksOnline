import type { BookEntry } from '@/types/books';

export const RECENT_BOOKS_LIMIT = 6;

/** Books with reading activity, most recently opened first. */
export function getRecentBooks(books: BookEntry[], limit = RECENT_BOOKS_LIMIT): BookEntry[] {
  return books
    .filter((book) => Boolean(book.lastOpened) || book.readingProgress > 0)
    .sort((a, b) => {
      const aTime = a.lastOpened ? Date.parse(a.lastOpened) : 0;
      const bTime = b.lastOpened ? Date.parse(b.lastOpened) : 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.readingProgress - a.readingProgress;
    })
    .slice(0, limit);
}

export function prettifyBookName(name: string): string {
  return name.replace(/\.(pdf|epub|txt|docx)$/i, '').replace(/[_]+/g, ' ').trim();
}

export function displayBookTitle(book: BookEntry): string {
  return book.title?.trim() || prettifyBookName(book.name);
}

export function continueLabel(progress: number): string {
  return progress > 0 ? 'Continue' : 'Open';
}
