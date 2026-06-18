import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

/**
 * Per-user app data (metadata overrides, folders, links, hidden items) stored in
 * a free Redis (Vercel KV / Upstash) so changes persist forever and sync across
 * devices — independent of Google Drive permissions.
 *
 * Set KV_REST_API_URL + KV_REST_API_TOKEN (auto-added by Vercel KV / Upstash).
 * Without them the endpoints no-op and the app falls back to localStorage.
 */
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(command: unknown[]): Promise<unknown> {
  if (!KV_URL || !KV_TOKEN) return null;
  const response = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`KV ${response.status}`);
  return (await response.json()).result;
}

function keyFor(email: string) {
  return `joshbooks:userdata:${email.toLowerCase()}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return Response.json({ data: null, configured: false });
  try {
    const raw = (await redis(['GET', keyFor(email)])) as string | null;
    return Response.json({ data: raw ? JSON.parse(raw) : null, configured: Boolean(KV_URL && KV_TOKEN) });
  } catch (error) {
    console.error('userdata GET failed:', error);
    return Response.json({ data: null, configured: Boolean(KV_URL && KV_TOKEN) });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false }, { status: 401 });
  if (!KV_URL || !KV_TOKEN) return Response.json({ ok: true, configured: false });
  try {
    const body = await request.json();
    await redis(['SET', keyFor(email), JSON.stringify(body)]);
    return Response.json({ ok: true, configured: true });
  } catch (error) {
    console.error('userdata PUT failed:', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
