import { expect, test } from '@playwright/test';

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';

test.describe('JoshBooks smoke checks', () => {
  test('homepage loads and shows app title', async ({ page }) => {
    await page.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('text=BookShelf')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Sign in with Google' })).toBeVisible();
  });

  test('library route redirects to sign-in when unauthenticated', async ({ page }) => {
    await page.goto(`${base}/library`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('text=BookShelf')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Sign in with Google' })).toBeVisible();
  });

  test('audiobooks page loads and shows audiobooks heading', async ({ page }) => {
    await page.goto(`${base}/audiobooks`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.getByRole('heading', { name: 'Audiobooks' })).toBeVisible();
    await expect(page.locator('input[type=search]')).toBeVisible();
  });

  test('read-online page shows missing-book error when no url is provided', async ({ page }) => {
    await page.goto(`${base}/read-online`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('text=Unable to open book')).toBeVisible();
    await expect(page.locator('text=No book specified.')).toBeVisible();
  });

  test('listen invalid audiobook id shows an error state', async ({ page }) => {
    await page.goto(`${base}/listen/invalid-id`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('text=Unable to load this audiobook.')).toBeVisible();
  });
});
