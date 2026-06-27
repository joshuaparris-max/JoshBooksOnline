/**
 * Normalise and split a plain-text string into TTS-friendly chunks.
 * Target: ≤500 chars per chunk, split at paragraph then sentence boundaries.
 */
export function normaliseText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function chunkText(raw: string, maxChars = 500): string[] {
  const text = normaliseText(raw);
  if (!text) return [];

  const chunks: string[] = [];

  for (const para of text.split(/\n\n+/)) {
    const p = para.trim();
    if (!p) continue;

    if (p.length <= maxChars) {
      chunks.push(p);
      continue;
    }

    // Paragraph too long: split at sentence endings
    const sentenceRe = /[^.!?]*[.!?]+[)"']?\s*/g;
    const sentences: string[] = [];
    let lastEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = sentenceRe.exec(p)) !== null) {
      sentences.push(m[0]);
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < p.length) sentences.push(p.slice(lastEnd));

    let current = '';
    for (const s of sentences) {
      if (current.length + s.length > maxChars && current) {
        chunks.push(current.trimEnd());
        current = '';
      }
      // A single sentence longer than maxChars (e.g. no punctuation) — hard-split it
      if (s.length > maxChars) {
        for (let i = 0; i < s.length; i += maxChars) {
          const piece = s.slice(i, i + maxChars).trim();
          if (piece) chunks.push(piece);
        }
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  return chunks.filter((c) => c.trim().length > 0);
}
