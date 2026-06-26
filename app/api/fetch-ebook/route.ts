export const dynamic = 'force-dynamic';

// Only fetch from trusted public-domain ebook hosts (prevents open-proxy abuse).
const ALLOWED_HOSTS = new Set([
  'gutenberg.org',
  'www.gutenberg.org',
  'gutenberg.pglaf.org',
  'standardebooks.org',
  'www.standardebooks.org',
]);
const MAX_REDIRECTS = 5;

function isAllowedTarget(target: URL) {
  return target.protocol === 'https:' && ALLOWED_HOSTS.has(target.hostname);
}

async function fetchAllowedEbook(initialTarget: URL) {
  let target = initialTarget;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isAllowedTarget(target)) throw new Error('Host not allowed');
    const response = await fetch(target.toString(), {
      headers: { 'User-Agent': 'JoshBooksOnline/1.0 (+reader)' },
      redirect: 'manual',
    });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get('location');
    if (!location || redirects === MAX_REDIRECTS) throw new Error('Invalid redirect');
    target = new URL(location, target);
  }
  throw new Error('Too many redirects');
}

/**
 * GET /api/fetch-ebook?url=<whitelisted ebook url>
 * Server-side proxy so the in-app reader can load free ebooks despite CORS.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return new Response('Missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }
  if (!isAllowedTarget(target)) {
    return new Response('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetchAllowedEbook(target);
    if (!upstream.ok) {
      return new Response(`Upstream ${upstream.status}`, { status: upstream.status });
    }

    const headers = new Headers();
    const ct = upstream.headers.get('content-type');
    headers.set('content-type', ct || 'application/octet-stream');
    headers.set('cache-control', 'public, max-age=86400');
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error('fetch-ebook failed:', error);
    return new Response('Fetch failed', { status: 502 });
  }
}
