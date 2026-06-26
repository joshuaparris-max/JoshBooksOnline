import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { getBaseYoutubeCatalog } from '@/lib/youtubeCatalog';
import { MOVIES } from '@/lib/movies';

type DiagnosticStatus = 'ok' | 'warn';

function envStatus(name: string, required = true): { name: string; status: DiagnosticStatus; detail: string } {
  const value = process.env[name];
  const configured = Boolean(value && !value.toLowerCase().includes('your_') && value.trim().length > 0);

  return {
    name,
    status: configured || !required ? 'ok' : 'warn',
    detail: configured ? 'Configured' : required ? 'Missing' : 'Optional / not configured',
  };
}

function StatusPill({ status }: { status: DiagnosticStatus }) {
  const className =
    status === 'ok'
      ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
      : 'bg-amber-500/15 text-amber-200 ring-amber-500/30';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {status === 'ok' ? 'OK' : 'Needs attention'}
    </span>
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
  const warnings = allEnv.filter((item) => item.status === 'warn').length;
  const youtubeCount = getBaseYoutubeCatalog().length;
  const movieCount = MOVIES.length;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Admin</p>
              <h1 className="mt-2 text-4xl font-semibold">Diagnostics</h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Safe runtime checks for local setup, catalogues, and authenticated app health. Secret values are never displayed.
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="mt-2 truncate text-lg font-semibold text-white">{session.user.email ?? session.user.name}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">Catalogue entries</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {youtubeCount} YouTube audio · {movieCount} movies
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <p className="text-sm text-slate-400">Configuration warnings</p>
            <p className="mt-2 text-lg font-semibold text-white">{warnings}</p>
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
                  <tr key={item.name}>
                    <td className="px-4 py-3 font-mono text-slate-200">{item.name}</td>
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
            <li>
              Run <span className="font-mono text-slate-100">npm run validate:catalogues</span> after catalogue edits.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
