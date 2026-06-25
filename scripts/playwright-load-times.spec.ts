import { test } from '@playwright/test';

test('page load times', async ({ page }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
  const routes = ['/', '/library', '/audiobooks', '/read-online'];
  for (const route of routes) {
    const url = `${base}${route}`;
    const start = Date.now();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    const duration = Date.now() - start;
    const status = response?.status() ?? null;
    const finalUrl = page.url();
    console.log(JSON.stringify({ route, url, finalUrl, status, duration }));
  }
});
