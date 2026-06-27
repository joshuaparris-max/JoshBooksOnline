/** Canonical genre/category lists used across the library. */

export const MOVIE_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Musical',
  'Romance',
  'Sci-fi',
  'Thriller',
] as const;

export const AUDIOBOOK_CATEGORIES = [
  'Classic literature',
  'Sci-fi & fantasy',
  'Christian & faith',
  'Philosophy & nonfiction',
  'Tech & IT',
  'Health & wellness',
  'Business & productivity',
] as const;

export type MovieGenre = (typeof MOVIE_GENRES)[number];
export type AudiobookCategory = (typeof AUDIOBOOK_CATEGORIES)[number];

/** Returns true if the item's genres/categories include the selected filter. */
export function matchesGenre(itemGenres: string[] | undefined, selected: string): boolean {
  if (!itemGenres || itemGenres.length === 0) return false;
  return itemGenres.some((g) => g.toLowerCase() === selected.toLowerCase());
}
