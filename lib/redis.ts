// Tiny dependency-free Upstash Redis REST client. Configured via the env vars
// Vercel KV / Upstash add: KV_REST_API_URL + KV_REST_API_TOKEN. When unset, all
// calls return null so features fall back to localStorage / Drive.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export function kvConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

/** Run a single Redis command, e.g. ['HSET', key, field, value]. */
export async function redis(command: unknown[]): Promise<unknown> {
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
