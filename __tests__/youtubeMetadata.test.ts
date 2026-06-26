import { describe, expect, it } from '@jest/globals';
import {
  formatDurationSeconds,
  normalizeYoutubeUrl,
  parseAudiobookTitle,
  youtubeUrlsMatch,
} from '@/lib/youtubeMetadata';

describe('YouTube metadata helpers', () => {
  it('normalises watch and playlist URLs', () => {
    expect(normalizeYoutubeUrl('https://youtu.be/abc123_XYZ')).toBe(
      'https://www.youtube.com/watch?v=abc123_XYZ'
    );
    expect(
      normalizeYoutubeUrl('https://www.youtube.com/watch?v=abc123_XYZ&pp=ygUtest')
    ).toBe('https://www.youtube.com/watch?v=abc123_XYZ');
    expect(
      normalizeYoutubeUrl('https://www.youtube.com/playlist?list=PL123abc')
    ).toBe('https://www.youtube.com/playlist?list=PL123abc');
  });

  it('formats durations', () => {
    expect(formatDurationSeconds(4523)).toBe('1:15:23');
    expect(formatDurationSeconds(845)).toBe('14:05');
  });

  it('parses common audiobook title patterns', () => {
    expect(
      parseAudiobookTitle(
        'The Phoenix Project by Gene Kim | Full Audiobook',
        'Example Channel'
      )
    ).toEqual({ title: 'The Phoenix Project', author: 'Gene Kim' });

    expect(
      parseAudiobookTitle(
        'Passages from the Life of a Philosopher by Charles BABBAGE Part 1/3 | Full Audio Book',
        'LibriVox Audiobooks'
      )
    ).toEqual({
      title: 'Passages from the Life of a Philosopher',
      author: 'Charles BABBAGE',
    });
  });

  it('matches equivalent YouTube URLs', () => {
    expect(
      youtubeUrlsMatch(
        'https://www.youtube.com/watch?v=abc123_XYZ',
        'https://youtu.be/abc123_XYZ'
      )
    ).toBe(true);
    expect(
      youtubeUrlsMatch(
        'https://www.youtube.com/playlist?list=PL123abc',
        'https://www.youtube.com/playlist?list=PL123abc'
      )
    ).toBe(true);
  });
});
