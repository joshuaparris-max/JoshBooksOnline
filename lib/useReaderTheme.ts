'use client';

import { useEffect, useState } from 'react';

export type ReaderTheme = 'light' | 'dark' | 'sepia';

/** Shared localStorage key so every reader (pdf/txt/docx/epub) stays in sync. */
export const READER_THEME_KEY = 'joshbooks-reader-theme';

export const READER_THEMES: ReaderTheme[] = ['light', 'dark', 'sepia'];

/** Tailwind classes for the page/content surface of a flow reader. */
export const READER_THEME_SURFACE: Record<ReaderTheme, string> = {
  light: 'bg-white text-slate-900',
  dark: 'bg-slate-900 text-slate-100',
  sepia: 'bg-[#f5e8d0] text-[#2b2541]',
};

/**
 * Reader theme state backed by a shared localStorage key. Returns the current
 * theme and a setter that persists it. Defaults to 'light'.
 */
export function useReaderTheme(): [ReaderTheme, (t: ReaderTheme) => void] {
  const [theme, setThemeState] = useState<ReaderTheme>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem(READER_THEME_KEY) as ReaderTheme | null;
    if (stored && READER_THEMES.includes(stored)) setThemeState(stored);
  }, []);

  const setTheme = (t: ReaderTheme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(READER_THEME_KEY, t);
    } catch {
      // ignore storage failures
    }
  };

  return [theme, setTheme];
}
