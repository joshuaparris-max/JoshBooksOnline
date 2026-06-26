/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

async function run() {
  const base = 'http://127.0.0.1:3001';
  const routes = ['/', '/library', '/audiobooks', '/read-online'];
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];

  for (const route of routes) {
    const url = `${base}${route}`;
    const start = Date.now();
    let status = null;
    let finalUrl = url;
    let error = null;
    try {
      const response = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      const duration = Date.now() - start;
      status = response?.status() ?? null;
      finalUrl = page.url();
      results.push({ route, url, finalUrl, status, duration });
    } catch (err) {
      const duration = Date.now() - start;
      error = err instanceof Error ? err.message : String(err);
      results.push({ route, url, finalUrl, status, duration, error });
    }
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
