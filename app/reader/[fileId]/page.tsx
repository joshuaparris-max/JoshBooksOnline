'use client';

import dynamic from 'next/dynamic';

const EpubReader = dynamic(() => import('@/components/EpubReader'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      Loading EPUB reader…
    </div>
  ),
});

const PdfReader = dynamic(() => import('@/components/PdfReader'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      Loading PDF reader…
    </div>
  ),
});

const ReaderShell = dynamic(() => import('@/components/ReaderShell'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      Preparing reader…
    </div>
  ),
});

export default function ReaderPage({ params }: { params: { fileId: string } }) {
  return <ReaderShell fileId={params.fileId} EpubReader={EpubReader} PdfReader={PdfReader} />;
}
