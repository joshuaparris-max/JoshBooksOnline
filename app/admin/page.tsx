import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { getBaseYoutubeCatalog } from '@/lib/youtubeCatalog';
import { MOVIES } from '@/lib/movies';
import { ONLINE_EBOOKS } from '@/lib/onlineEbooks';

type Severity = 'ok' | 'warn' | 'error';

interface CheckResult {
  id: string;
  label: string;
  status: Severity;
  detail: string;
}

function envStatus(name: string, required = true): CheckResult {
  const value = process.env[name];
  const configured = Boolean(value && !value.toLowerCase().includes('your_') && value.trim().length > 0);
  return {
    id: name,
    label: name,
    status: configured || !required ? 'ok' : 'warn',
    detail: configured ? 'Configured' : required ? 'Missing' : 'Optional / not configured',
  };
}

function runCatalogueChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const youtube = getBaseYoutubeCatalog();

  // Duplicate YouTube IDs
  const ytIds = youtube.map((a) => a.id);
  const ytDupes = ytIds.filter((id, i) => ytIds.indexOf(id) !== i);
  results.push({
    id: 'yt-dupes',
    label: 'YouTube catalogue — duplicate IDs',
    status: ytDupes.length ? 'error' : 'ok',
    detail: ytDupes.length ? `Duplicates: ${ytDupes.join(', ')}` : `${youtube.length} entries, none duplicated`,
  });

  // YouTube entries missing youtubeUrl
  const ytMissingUrl = youtube.filter((a) => !a.youtubeUrl);
  results.push({
    id: 'yt-missing-url',
    label: 'YouTube catalogue — missing youtubeUrl',
    status: ytMissingUrl.length ? 'error' : 'ok',
    detail: ytMissingUrl.length
      ? `${ytMissingUrl.length} entries missing: ${ytMissingUrl.map((a) => a.id).slice(0, 5).join(', ')}${ytMissingUrl.length > 5 ? '…' : ''}`
      : 'All entries have a URL',
  });

  // YouTube URL format validation
  const ytBadUrl = youtube.filter((a) => a.youtubeUrl && !/https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(a.youtubeUrl));
  results.push({
    id: 'yt-bad-url',
    label: 'YouTube catalogue — malformed URLs',
    status: ytBadUrl.length ? 'warn' : 'ok',
    detail: ytBadUrl.length
      ? `${ytBadUrl.length} suspicious: ${ytBadUrl.map((a) => a.id).slice(0, 3).join(', ')}${ytBadUrl.length > 3 ? '…' : ''}`
      : 'All URLs look valid',
  });

  // Duplicate movie IDs
  const movieIds = MOVIES.map((m) => m.id);
  const movieDupes = movieIds.filter((id, i) => movieIds.indexOf(id) !== i);
  results.push({
    id: 'movie-dupes',
    label: 'Movies — duplicate IDs',
    status: movieDupes.length ? 'error' : 'ok',
    detail: movieDupes.length ? `Duplicates: ${movieDupes.join(', ')}` : `${MOVIES.length} movies, none duplicated`,
  });

  // Movies missing driveFileId
  const moviesMissingFile = MOVIES.filter((m) => !m.driveFileId);
  results.push({
    id: 'movie-missing-file',
    label: 'Movies — missing driveFileId',
    status: moviesMissingFile.length ? 'error' : 'ok',
    detail: moviesMissingFile.length
      ? `Missing: ${moviesMissingFile.map((m) => m.id).join(', ')}`
      : 'All movies have a Drive file ID',
  });

  // Duplicate Drive file IDs across movies
  const driveFileIds = MOVIES.map((m) => m.driveFileId).filter(Boolean);
  const driveFileDupes = driveFileIds.filter((id, i) => driveFileIds.indexOf(id) !== i);
  results.push({
    id: 'movie-dupe-drive',
    label: 'Movies — duplicate Drive file IDs',
    status: driveFileDupes.length ? 'warn' : 'ok',
    detail: driveFileDupes.length
      ? `Reused file IDs: ${driveFileDupes.join(', ')}`
      : 'All Drive file IDs are unique',
  });

  // Online ebooks — duplicate IDs
  const ebookIds = ONLINE_EBOOKS.map((e) => e.id);
  const ebookDupes = ebookIds.filter((id, i) => ebookIds.indexOf(id) !== i);
  results.push({
    id: 'ebook-dupes',
    label: 'Online ebooks — duplicate IDs',
    status: ebookDupes.length ? 'error' : 'ok',
    detail: ebookDupes.length
      ? `Duplicates: ${ebookDupes.join(', ')}`
      : `${ONLINE_EBOOKS.length} entries, none duplicated`,
  });

  // Online ebooks missing URL
  const ebookMissingUrl = ONLINE_EBOOKS.filter((e) => !e.url);
  results.push({
    id: 'ebook-missing-url',
    label: 'Online ebooks — missing URL',
    status: ebookMissingUrl.length ? 'error' : 'ok',
    detail: ebookMissingUrl.length
      ? `Missing: ${ebookMissingUrl.map((e) => e.id).join(', ')}`
      : 'All entries have a URL',
  });

  return results;
}

function StatusPill({ status }: { status: Severity }) {
  const cls =
    status === 'ok'
      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
      : status === 'warn'
        ? 'bg-amber-500/15 text-amber-200 ring-amber-500/30'
        : 'bg-rose-500/15 text-rose-200 ring-rose-500/30';
  const label = status === 'ok' ? 'OK' : status === 'warn' ? 'Warning' : 'Error';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}`}>{label}</span>
  );
}

export default async function AdminDiagnosticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/');

  const requiredEnv = [
    envStatus('GOOGLE_CLIENT_ID'),
    envStatus('GOOGLE_CLIENT_SECRET'),
    envStatus('NEXTAUTH_SECRET'),
    envStatus('NEXTAUTH_URL'),
    envStatus('NEXT_PUBLIC_GOOGLE_API_KEY'),
  ];
  const optionalEnv = [envStatus('KV_REST_API_URL', false), envStatus('KV_REST_API_TOKEN', false)];
  const allEnv = [...requiredEnv, ...optionalEnv];
  const envWarnings = allEnv.filter((item) => item.status !== 'ok').length;

  const catalogueChecks = runCatalogueChecks();
  const catalogueIssues = catalogueChecks.filter((c) => c.status !== 'ok').length;

  const youtubeCount = getBaseYoutubeCatalog().length;
  const movieCount = MOVIES.length;
  const onlineEbookCount = ONLINE_EBOOKS.length;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Admin</p>
              <h1 className="mt-2 text-4xl font-semibold">Diagnostics</h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Runtime checks for config, catalogues, and app health. Secret values are never displayed.
              </p>
            </div>
            <Link
              href="/library"
              className="inline-flex items-center justify-center rounded-full bg-slate-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Back to library
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="mt-2 truncate text-base font-semibold text-white">{session.user.email ?? session.user.name}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">YouTube audiobooks</p>
            <p className="mt-2 text-lg font-semibold text-white">{youtubeCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">Movies · Online ebooks</p>
            <p className="mt-2 text-lg font-semibold text-white">{movieCount} · {onlineEbookCount}</p>
          </div>
          <div className={`rounded-3xl border p-6 ${catalogueIssues + envWarnings > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/10 bg-slate-900/80'}`}>
            <p className="text-sm text-slate-400">Issues found</p>
            <p className={`mt-2 text-lg font-semibold ${catalogueIssues + envWarnings > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              {catalogueIssues + envWarnings === 0 ? 'All clear' : `${catalogueIssues + envWarnings} issue${catalogueIssues + envWarnings !== 1 ? 's' : ''}`}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">Catalogue health checks</h2>
          <p className="mt-1 text-sm text-slate-400">
            Validates duplicate IDs, missing URLs, and malformed fields across all static catalogues.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Check</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {catalogueChecks.map((check) => (
                  <tr key={check.id}>
                    <td className="px-4 py-3 text-slate-200">{check.label}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={check.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{check.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">Environment configuration</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Setting</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {allEnv.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-slate-200">{item.label}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <h2 className="text-xl font-semibold text-white">Manual live QA checklist</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>
              Use disposable files named <span className="font-mono text-slate-100">QA_DELETE_ME</span> for import/delete tests.
            </li>
            <li>Verify Drive book open, progress save, metadata save, hide/remove, and Google Picker import.</li>
            <li>Verify audiobook import, group, ungroup, playback, and progress save with test audio only.</li>
            <li>Verify movie playback, progress save/restore, and fallback Drive link.</li>
            <li>
              Run <span className="font-mono text-slate-100">npm run validate:catalogues</span> after catalogue edits.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
