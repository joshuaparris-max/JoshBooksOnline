'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

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

export default function ReaderPage() {
  const params = useParams() as Record<string, string> | null;
  const fileId = params?.fileId;

  // Temporary debug log to verify route param resolution in-browser
  console.log('Resolved fileId:', fileId);

  return <ReaderShell fileId={fileId} EpubReader={EpubReader} PdfReader={PdfReader} />;
}
