import { MOVIES } from '@/lib/movies';

describe('Movie catalogue', () => {
  it('contains every supplied movie link', () => {
    expect(MOVIES).toHaveLength(48);
    expect(MOVIES.map((movie) => movie.driveFileId)).toContain('1zCUnfLvC8tVAq-wm0fLRom6hnI3KaNNk');
    expect(MOVIES.map((movie) => movie.driveFileId)).toContain('1qZDKLECyGYTwjtL3kCk53fNRIxVtHgvD');
  });

  it('keeps series entries grouped by collection', () => {
    expect(MOVIES.filter((movie) => movie.collection === 'Harry Potter')).toHaveLength(6);
    expect(MOVIES.filter((movie) => movie.collection === 'Pirates of the Caribbean')).toHaveLength(3);
  });
});
