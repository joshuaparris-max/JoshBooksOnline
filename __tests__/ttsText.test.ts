import { chunkText, normaliseText } from '@/lib/tts/chunkText';

describe('normaliseText', () => {
  it('trims surrounding whitespace', () => {
    expect(normaliseText('  hello  ')).toBe('hello');
  });

  it('collapses 3+ blank lines to 2', () => {
    expect(normaliseText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('collapses multiple spaces/tabs', () => {
    expect(normaliseText('hello   world\t!')).toBe('hello world !');
  });

  it('normalises CRLF and bare CR', () => {
    expect(normaliseText('a\r\nb\rc')).toBe('a\nb\nc');
  });
});

describe('chunkText', () => {
  it('returns empty array for empty / whitespace-only input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
    expect(chunkText('\n\n\n')).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'Hello, world!';
    expect(chunkText(text)).toEqual([text]);
  });

  it('keeps short paragraphs as individual chunks', () => {
    const text = 'First para.\n\nSecond para.\n\nThird para.';
    const chunks = chunkText(text, 500);
    expect(chunks).toHaveLength(3);
  });

  it('splits long paragraphs at sentence boundaries', () => {
    const sentence = 'This is a sentence. ';
    const long = sentence.repeat(30); // 600 chars
    const chunks = chunkText(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(250);
  });

  it('does not split a paragraph that fits within maxChars', () => {
    const text = 'First. Second. Third.';
    expect(chunkText(text, 500)).toHaveLength(1);
  });

  it('falls back to hard-split when no sentence markers exist', () => {
    const long = 'word '.repeat(120); // 600 chars, no punctuation
    const chunks = chunkText(long, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('filters out whitespace-only chunks', () => {
    const text = 'Hello.\n\n   \n\nWorld.';
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });
});
