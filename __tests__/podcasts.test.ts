import { PODCASTS } from '@/lib/podcasts';

describe('Podcast catalogue', () => {
  it('contains unique, valid entries', () => {
    expect(PODCASTS.length).toBe(65);
    expect(new Set(PODCASTS.map((item) => item.id)).size).toBe(PODCASTS.length);
    for (const item of PODCASTS) {
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(() => new URL(item.url)).not.toThrow();
    }
  });
});
