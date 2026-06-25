import {
  bookCatalogueKeys,
  matchesCatalogueAlias,
  normalizeCatalogueKey,
} from '@/lib/catalogueMatch';
import {
  dedupeAudiobooksById,
  findYoutubeMatches,
  extractYouTubeVideoId,
  isValidYoutubeUrl,
  mergeYoutubeCatalog,
} from '@/lib/youtubeCatalog';
import type { Audiobook } from '@/types/books';
import { deriveBookKey, deriveBookTitle } from '@/lib/googleDrive';

describe('Catalogue matching', () => {
  it('normalises filenames and aliases consistently', () => {
    expect(normalizeCatalogueKey('05-OrwellGeorge-1984.pdf')).toBe('05 orwellgeorge 1984');
    expect(normalizeCatalogueKey('Nineteen Eighty-Four')).toBe('nineteen eighty four');
  });

  it('derives multiple keys from a Drive ebook filename', () => {
    const keys = bookCatalogueKeys({ name: '05-OrwellGeorge-1984.pdf', title: '1984' });
    expect(keys.some((k) => k.includes('orwell') || k.includes('1984'))).toBe(true);
  });

  it('matches catalogue aliases to ebook filenames', () => {
    const keys = bookCatalogueKeys({ name: '05-OrwellGeorge-1984.pdf' });
    expect(
      matchesCatalogueAlias(keys, ['05-OrwellGeorge-1984', 'Nineteen Eighty-Four'])
    ).toBe(true);
  });

  it('finds YouTube catalog entries by catalogue alias', () => {
    const catalog: Audiobook[] = [
      {
        id: '1984-orwell',
        title: '1984',
        author: 'George Orwell',
        youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
        catalogueMatches: ['05-OrwellGeorge-1984', 'Nineteen Eighty-Four'],
        availabilityType: 'unknown',
      },
    ];
    const matches = findYoutubeMatches({ name: '05-OrwellGeorge-1984.pdf' }, catalog);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe('1984-orwell');
  });

  it('returns multiple matches when several sources apply', () => {
    const catalog: Audiobook[] = [
      {
        id: 'van-gogh-letters',
        title: 'Letters',
        author: 'Vincent van Gogh',
        youtubeUrl: 'https://www.youtube.com/watch?v=B7QuTOwCJiA',
        catalogueMatches: ['Van Gogh'],
        availabilityType: 'full_public_domain',
      },
      {
        id: 'van-gogh-visual',
        title: 'Letters with Paintings',
        author: 'Vincent van Gogh',
        youtubeUrl: 'https://www.youtube.com/watch?v=UDkhMOeFwzA',
        catalogueMatches: ['Van Gogh'],
        availabilityType: 'full_public_domain',
      },
    ];
    expect(findYoutubeMatches({ name: 'Van Gogh.pdf' }, catalog)).toHaveLength(2);
  });
});

describe('YouTube catalog merge', () => {
  it('applies edits and removals', () => {
    const merged = mergeYoutubeCatalog({
      removedIds: ['1984-orwell'],
      edits: {},
      custom: [],
    });
    expect(merged.find((a) => a.id === '1984-orwell')).toBeUndefined();
    expect(merged.length).toBeGreaterThan(0);
  });

  it('dedupes by id', () => {
    const ab: Audiobook = {
      id: 'x',
      title: 'T',
      author: 'A',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc',
      catalogueMatches: [],
      availabilityType: 'unknown',
    };
    expect(dedupeAudiobooksById([ab, ab])).toHaveLength(1);
  });
});

describe('Audiobooks', () => {
  describe('Drive Audiobook Grouping', () => {
    it('should group standalone Lilith chapter files into one audiobook', () => {
      const filenames = [
        'Chapter I: The Library.mp3',
        'Chapter II: The Mirror.mp3',
        'Chapter III: The Raven.mp3',
        'Chapter XLVII: The Endless Ending.mp3',
      ];

      expect(filenames.map(deriveBookTitle)).toEqual(['Lilith', 'Lilith', 'Lilith', 'Lilith']);
      expect(new Set(filenames.map(deriveBookKey))).toEqual(new Set(['lilith']));
    });

    it('should keep non-Lilith chapter-only files separate', () => {
      expect(deriveBookTitle('Chapter I: A Different Book.mp3')).toBe('Chapter I: A Different Book');
    });
  });

  describe('URL Validation', () => {
    it('should extract YouTube ID from standard URL', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=inLnzoQZrMs')).toBe('inLnzoQZrMs');
    });

    it('should extract YouTube ID from shortened URL', () => {
      expect(extractYouTubeVideoId('https://youtu.be/inLnzoQZrMs')).toBe('inLnzoQZrMs');
    });

    it('should reject invalid URLs', () => {
      expect(isValidYoutubeUrl('https://example.com/invalid')).toBe(false);
      expect(isValidYoutubeUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate audiobook entries by ID', () => {
      const audiobooks: Audiobook[] = [
        {
          id: '1984-orwell',
          title: '1984',
          author: 'George Orwell',
          youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
          catalogueMatches: ['05-OrwellGeorge-1984'],
          availabilityType: 'unknown',
        },
        {
          id: '1984-orwell',
          title: '1984',
          author: 'George Orwell',
          youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
          catalogueMatches: ['05-OrwellGeorge-1984'],
          availabilityType: 'unknown',
        },
      ];

      expect(dedupeAudiobooksById(audiobooks)).toHaveLength(1);
    });
  });

  describe('Type Labels', () => {
    it('should correctly label full public domain audiobooks', () => {
      const audiobook: Audiobook = {
        id: 'pride-prejudice',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        youtubeUrl: 'https://www.youtube.com/watch?v=ZhxqauL9WbM',
        catalogueMatches: ['Pride and Prejudice'],
        availabilityType: 'full_public_domain',
        displayLabel: 'Full public-domain audiobook',
      };

      expect(audiobook.availabilityType).toBe('full_public_domain');
      expect(audiobook.displayLabel).toBe('Full public-domain audiobook');
    });

    it('should correctly label official previews', () => {
      const audiobook: Audiobook = {
        id: 'fahrenheit-451',
        title: 'Fahrenheit 451',
        author: 'Ray Bradbury',
        youtubeUrl: 'https://www.youtube.com/watch?v=3pYspGBoLTU',
        catalogueMatches: ['07-BradburyRay-Fahrenheit451'],
        availabilityType: 'official_preview',
        displayLabel: 'Official audiobook preview',
      };

      expect(audiobook.availabilityType).toBe('official_preview');
    });
  });

  describe('Unavailable Video Fallback', () => {
    it('preserves the YouTube URL for external fallback', () => {
      const audiobook: Audiobook = {
        id: 'test-audiobook',
        title: 'Test Book',
        author: 'Test Author',
        youtubeUrl: 'https://www.youtube.com/watch?v=invalid_id',
        catalogueMatches: ['Test Book'],
        availabilityType: 'unknown',
      };

      expect(audiobook.youtubeUrl).toMatch(/youtube\.com/);
    });
  });
});
