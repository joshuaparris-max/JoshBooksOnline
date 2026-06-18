import { describe, it, expect } from '@jest/globals';
import type { Audiobook } from '@/types/books';
import { deriveBookKey, deriveBookTitle } from '@/lib/googleDrive';

/**
 * Test suite for audiobook functionality
 */

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

    it('should group bare lowercase letter files as the combined C. S. Lewis audiobook', () => {
      const filenames = ['a.mp3', 'b.m4b', 'c.wav', 'z.mp3'];

      expect(filenames.map(deriveBookTitle)).toEqual([
        'The Abolition of Man and The Great Divorce',
        'The Abolition of Man and The Great Divorce',
        'The Abolition of Man and The Great Divorce',
        'The Abolition of Man and The Great Divorce',
      ]);
      expect(new Set(filenames.map(deriveBookKey))).toEqual(
        new Set(['the abolition of man and the great divorce'])
      );
    });

    it('should not group uppercase or multi-letter filenames as the combined C. S. Lewis audiobook', () => {
      expect(deriveBookTitle('A.mp3')).toBe('A');
      expect(deriveBookTitle('ab.mp3')).toBe('ab');
    });

    it('should group Acts chapter files into one audiobook', () => {
      const filenames = ['ACTS.mp3', 'ACTS11.mp3', 'ACTS12.m4b', 'ACTS28.wav'];

      expect(filenames.map(deriveBookTitle)).toEqual(['Acts', 'Acts', 'Acts', 'Acts']);
      expect(new Set(filenames.map(deriveBookKey))).toEqual(new Set(['acts']));
    });

    it('should group leading-numbered Manhood by Biddulph chapters into one audiobook', () => {
      const filenames = [
        'Chapter 1- Manhood by Biddulph.mp3',
        'Chapter 2- Manhood by Biddulph.mp3',
        'Chapter 3- Manhood by Biddulph.mp3',
        'Chapter 4- Manhood by Biddulph.mp3',
        'Chapter 5- Manhood by Biddulph.mp3',
      ];

      expect(filenames.map(deriveBookTitle)).toEqual([
        'Manhood by Biddulph',
        'Manhood by Biddulph',
        'Manhood by Biddulph',
        'Manhood by Biddulph',
        'Manhood by Biddulph',
      ]);
      expect(new Set(filenames.map(deriveBookKey))).toEqual(new Set(['manhood by biddulph']));
    });
  });

  describe('URL Validation', () => {
    it('should extract YouTube ID from standard URL', () => {
      const url = 'https://www.youtube.com/watch?v=inLnzoQZrMs';
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      expect(match?.[1]).toBe('inLnzoQZrMs');
    });

    it('should extract YouTube ID from shortened URL', () => {
      const url = 'https://youtu.be/inLnzoQZrMs';
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      expect(match?.[1]).toBe('inLnzoQZrMs');
    });

    it('should extract YouTube ID from URL with timestamp', () => {
      const url = 'https://www.youtube.com/watch?v=ZUbfskQ-GAY&t=3875s';
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      expect(match?.[1]).toBe('ZUbfskQ-GAY');
    });

    it('should extract YouTube ID from URL with pp parameter', () => {
      const url = 'https://www.youtube.com/watch?v=sNBeqZMyBr0&pp=ygUJYXVkaW9ib29r';
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      expect(match?.[1]).toBe('sNBeqZMyBr0');
    });

    it('should return null for invalid URL', () => {
      const url = 'https://example.com/invalid';
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      expect(match).toBeNull();
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
          catalogueMatches: ['05-OrwellGeorge-1984', 'Nineteen Eighty-Four'],
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

      const unique = Array.from(new Map(audiobooks.map((ab) => [ab.id, ab])).values());
      expect(unique).toHaveLength(1);
      expect(unique[0]?.id).toBe('1984-orwell');
    });

    it('should prevent duplicate URLs for the same catalogue match', () => {
      const audiobooks: Audiobook[] = [
        {
          id: '1984-orwell-v1',
          title: '1984',
          author: 'George Orwell',
          youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
          catalogueMatches: ['05-OrwellGeorge-1984'],
          availabilityType: 'unknown',
        },
        {
          id: '1984-orwell-v2',
          title: '1984',
          author: 'George Orwell',
          youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
          catalogueMatches: ['05-OrwellGeorge-1984'],
          availabilityType: 'unknown',
        },
      ];

      const uniqueByUrl = Array.from(
        new Map(audiobooks.map((ab) => [ab.youtubeUrl, ab])).values()
      );
      expect(uniqueByUrl).toHaveLength(1);
    });
  });

  describe('Alias Matching', () => {
    it('should match audiobook by any catalogue alias', () => {
      const audiobook: Audiobook = {
        id: '1984-orwell',
        title: '1984',
        author: 'George Orwell',
        youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
        catalogueMatches: ['05-OrwellGeorge-1984', 'Nineteen Eighty-Four'],
        availabilityType: 'unknown',
      };

      expect(audiobook.catalogueMatches).toContain('05-OrwellGeorge-1984');
      expect(audiobook.catalogueMatches).toContain('Nineteen Eighty-Four');
    });

    it('should search audiobooks by catalogue match (case-insensitive)', () => {
      const audiobooks: Audiobook[] = [
        {
          id: '1984-orwell',
          title: '1984',
          author: 'George Orwell',
          youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
          catalogueMatches: ['05-OrwellGeorge-1984', 'Nineteen Eighty-Four'],
          availabilityType: 'unknown',
        },
      ];

      const query = 'nineteen eighty-four';
      const results = audiobooks.filter((ab) =>
        ab.catalogueMatches.some((match) =>
          match.toLowerCase().includes(query.toLowerCase())
        )
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('1984-orwell');
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
      expect(audiobook.displayLabel).toBe('Official audiobook preview');
    });
  });

  describe('Unavailable Video Fallback', () => {
    it('should provide fallback for unavailable videos', () => {
      const audiobook: Audiobook = {
        id: 'test-audiobook',
        title: 'Test Book',
        author: 'Test Author',
        youtubeUrl: 'https://www.youtube.com/watch?v=invalid_id',
        catalogueMatches: ['Test Book'],
        availabilityType: 'unknown',
      };

      // URL should always be preserved, even if video becomes unavailable
      expect(audiobook.youtubeUrl).toBe('https://www.youtube.com/watch?v=invalid_id');
      // Should provide external YouTube link as fallback
      const youtubePageUrl = audiobook.youtubeUrl;
      expect(youtubePageUrl).toMatch(/youtube\.com/);
    });
  });

  describe('Search Filtering', () => {
    const testAudiobooks: Audiobook[] = [
      {
        id: '1984-orwell',
        title: '1984',
        author: 'George Orwell',
        youtubeUrl: 'https://www.youtube.com/watch?v=inLnzoQZrMs',
        catalogueMatches: ['05-OrwellGeorge-1984'],
        availabilityType: 'unknown',
      },
      {
        id: 'pride-prejudice',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        youtubeUrl: 'https://www.youtube.com/watch?v=ZhxqauL9WbM',
        catalogueMatches: ['Pride and Prejudice'],
        availabilityType: 'full_public_domain',
      },
    ];

    it('should search by title', () => {
      const results = testAudiobooks.filter((ab) =>
        ab.title.toLowerCase().includes('pride')
      );
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Pride and Prejudice');
    });

    it('should search by author', () => {
      const results = testAudiobooks.filter((ab) =>
        ab.author.toLowerCase().includes('austen')
      );
      expect(results).toHaveLength(1);
      expect(results[0]?.author).toBe('Jane Austen');
    });

    it('should filter by availability type', () => {
      const results = testAudiobooks.filter(
        (ab) => ab.availabilityType === 'full_public_domain'
      );
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Pride and Prejudice');
    });

    it('should return empty array for non-matching search', () => {
      const results = testAudiobooks.filter((ab) =>
        ab.title.toLowerCase().includes('nonexistent')
      );
      expect(results).toHaveLength(0);
    });
  });
});
