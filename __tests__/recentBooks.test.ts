import type { BookEntry } from '@/types/books';
import {
  continueLabel,
  displayBookTitle,
  getRecentBooks,
} from '@/lib/recentBooks';

function book(partial: Partial<BookEntry> & Pick<BookEntry, 'id' | 'name'>): BookEntry {
  return {
    mimeType: 'application/pdf',
    size: 0,
    modifiedTime: '2026-01-01T00:00:00.000Z',
    source: 'Local Books',
    format: 'pdf',
    readingProgress: 0,
    lastLocation: '',
    ...partial,
  };
}

describe('getRecentBooks', () => {
  it('returns recently opened books first, up to the limit', () => {
    const books: BookEntry[] = [
      book({
        id: '1',
        name: 'old.pdf',
        lastOpened: '2026-01-01T10:00:00.000Z',
        readingProgress: 50,
      }),
      book({
        id: '2',
        name: 'new.pdf',
        lastOpened: '2026-06-01T10:00:00.000Z',
        readingProgress: 10,
      }),
      book({
        id: '3',
        name: 'never-opened.pdf',
        readingProgress: 0,
      }),
    ];

    const recent = getRecentBooks(books, 6);
    expect(recent.map((b) => b.id)).toEqual(['2', '1']);
  });

  it('includes in-progress books without lastOpened', () => {
    const books: BookEntry[] = [
      book({ id: '1', name: 'started.pdf', readingProgress: 25 }),
      book({ id: '2', name: 'fresh.pdf', readingProgress: 0 }),
    ];

    expect(getRecentBooks(books)).toHaveLength(1);
    expect(getRecentBooks(books)[0]?.id).toBe('1');
  });
});

describe('displayBookTitle', () => {
  it('prefers metadata title over filename', () => {
    expect(displayBookTitle(book({ id: '1', name: 'file.pdf', title: 'Clean Title' }))).toBe(
      'Clean Title'
    );
  });
});

describe('continueLabel', () => {
  it('uses Continue when progress is above zero', () => {
    expect(continueLabel(42)).toBe('Continue');
    expect(continueLabel(0)).toBe('Open');
  });
});
