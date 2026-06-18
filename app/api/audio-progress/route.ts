import { getServerSession } from 'next-auth';
import { redis } from '@/lib/redis';
import authOptions from '@/lib/auth';

/**
 * Cross-device audiobook resume, stored in Redis as a per-user hash
 * (audiobookId -> { track, position }). Independent of Drive permissions.
 */
function keyFor(email: string) {
  return `joshbooks:audio:${email.toLowerCase()}`;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return Response.json({ progress: null });
  const id = new URL(request.url).searchParams.get('id');
  try {
    if (id) {
      const raw = (await redis(['HGET', keyFor(email), id])) as string | null;
      return Response.json({ progress: raw ? JSON.parse(raw) : null });
    }
    // No id: return the whole map { id: {track, position} }
    const flat = (await redis(['HGETALL', keyFor(email)])) as unknown;
    const map: Record<string, unknown> = {};
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) {
        try {
          map[String(flat[i])] = JSON.parse(String(flat[i + 1]));
        } catch {
          // skip malformed
        }
      }
    } else if (flat && typeof flat === 'object') {
      for (const [k, v] of Object.entries(flat as Record<string, string>)) {
        try {
          map[k] = JSON.parse(v);
        } catch {
          // skip
        }
      }
    }
    return Response.json({ progress: map });
  } catch (error) {
    console.error('audio-progress GET failed:', error);
    return Response.json({ progress: null });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return Response.json({ ok: false }, { status: 401 });
  try {
    const { id, track, position } = await request.json();
    if (!id) return Response.json({ ok: false, error: 'Missing id' }, { status: 400 });
    await redis([
      'HSET',
      keyFor(email),
      id,
      JSON.stringify({ track: Number(track) || 0, position: Math.max(0, Math.floor(Number(position) || 0)) }),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('audio-progress POST failed:', error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
