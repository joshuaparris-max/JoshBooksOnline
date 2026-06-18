import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stream/[fileId]
 * Authenticated streaming proxy for Drive audio files. Forwards the inbound
 * Range header to Drive so <audio> can seek without downloading the whole file.
 * Optional ?mime= overrides the Content-Type for files Drive serves as
 * application/octet-stream.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { fileId } = await params;
  const range = request.headers.get('range');
  const mimeOverride = new URL(request.url).searchParams.get('mime');

  const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(range ? { Range: range } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response('Upstream error', { status: upstream.status });
  }

  const headers = new Headers();
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');

  const upstreamType = upstream.headers.get('content-type');
  headers.set(
    'content-type',
    mimeOverride || (upstreamType && upstreamType !== 'application/octet-stream' ? upstreamType : 'audio/mpeg')
  );

  return new Response(upstream.body, { status: upstream.status, headers });
}
