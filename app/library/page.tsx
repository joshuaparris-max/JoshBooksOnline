import Link from 'next/link';

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">Library</h1>
        <p className="mb-6 text-slate-300">
          You are signed in. The library page exists now at <code>/library</code>.
        </p>
        <Link
          href="/"
          className="inline-flex rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
