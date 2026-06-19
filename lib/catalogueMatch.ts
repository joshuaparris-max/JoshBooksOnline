/**
 * Normalise a filename or catalogue alias for fuzzy matching.
 */
export function normalizeCatalogueKey(s: string): string {
  return s
    .replace(/\.(pdf|epub|txt|docx|mp3|m4b|wav)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Catalogue keys derived from a Drive ebook file name and optional metadata title. */
export function bookCatalogueKeys(book: { name: string; title?: string }): string[] {
  const keys = new Set<string>();
  const nameKey = normalizeCatalogueKey(book.name);
  if (nameKey) keys.add(nameKey);
  const stem = book.name.replace(/\.(pdf|epub|txt|docx)$/i, '').replace(/[_]+/g, ' ');
  const prettyKey = normalizeCatalogueKey(stem);
  if (prettyKey) keys.add(prettyKey);
  if (book.title?.trim()) keys.add(normalizeCatalogueKey(book.title));
  return [...keys];
}

/** True when any book key matches any catalogue alias (substring either way). */
export function matchesCatalogueAlias(bookKeys: string[], catalogueMatches: string[]): boolean {
  for (const alias of catalogueMatches) {
    const aliasKey = normalizeCatalogueKey(alias);
    if (!aliasKey) continue;
    for (const bk of bookKeys) {
      if (bk === aliasKey || bk.includes(aliasKey) || aliasKey.includes(bk)) return true;
    }
  }
  return false;
}
