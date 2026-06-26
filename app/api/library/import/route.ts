import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import authOptions from '@/lib/auth';
import {
  listFilesInFolderRecursive,
  getFileMetadata,
  addFileToUnsorted,
  getMimeTypeFormat,
  isAudioMimeType,
  importAudioFileToAudiobooks,
  importAudioFolderToAudiobooks,
} from '@/lib/googleDrive';
import { clearLibraryCache } from '@/lib/libraryCache';
import type { BookEntry } from '@/types/books';

export type ImportTarget = 'auto' | 'ebooks' | 'audiobooks';

/**
 * POST /api/library/import
 * Import files/folders from Google Drive Picker selection.
 * Ebooks are linked into Unsorted; audio files/folders into Audiobooks.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized: No access token available' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items, target = 'auto' } = body as {
      items: Array<{
        id: string;
        name: string;
        mimeType: string;
        type: 'file' | 'folder';
      }>;
      target?: ImportTarget;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: items array is required and must not be empty' },
        { status: 400 }
      );
    }

    const importEbooks = target === 'auto' || target === 'ebooks';
    const importAudiobooks = target === 'auto' || target === 'audiobooks';

    const importedFiles: BookEntry[] = [];
    const errors: Array<{ itemName: string; reason: string }> = [];
    let importedAudiobookCount = 0;

    for (const item of items) {
      try {
        if (item.type === 'folder') {
          if (importEbooks) {
            const folderFiles = await listFilesInFolderRecursive(
              session.accessToken,
              item.id,
              'Unsorted'
            );
            for (const book of folderFiles) {
              await addFileToUnsorted(session.accessToken, book.id);
            }
            importedFiles.push(...folderFiles);
          }

          if (importAudiobooks) {
            const audioResult = await importAudioFolderToAudiobooks(session.accessToken, item.id);
            importedAudiobookCount += audioResult.importedCount;
            if (audioResult.importedCount === 0 && audioResult.reason) {
              if (target === 'audiobooks' || !importEbooks) {
                errors.push({ itemName: item.name, reason: audioResult.reason });
              }
            }
          }
        } else if (item.type === 'file') {
          const metadata = await getFileMetadata(session.accessToken, item.id);

          if (!metadata) {
            errors.push({
              itemName: item.name,
              reason: 'Could not retrieve file metadata',
            });
            continue;
          }

          const ebookFormat = getMimeTypeFormat(metadata.mimeType);
          const isAudio = isAudioMimeType(metadata.mimeType);

          if (isAudio && importAudiobooks) {
            const audioResult = await importAudioFileToAudiobooks(session.accessToken, item.id);
            if (audioResult.ok) {
              importedAudiobookCount += 1;
            } else {
              errors.push({
                itemName: item.name,
                reason: audioResult.reason ?? 'Audiobook import failed',
              });
            }
            continue;
          }

          if (ebookFormat && importEbooks) {
            const bookEntry: BookEntry = {
              id: metadata.id,
              name: item.name,
              mimeType: metadata.mimeType,
              size: metadata.size,
              modifiedTime: metadata.modifiedTime,
              source: 'Unsorted',
              format: ebookFormat,
              readingProgress: 0,
              lastLocation: '',
            };

            const linked = await addFileToUnsorted(session.accessToken, metadata.id);
            if (!linked) {
              errors.push({
                itemName: item.name,
                reason: 'Could not add file to Unsorted folder',
              });
              continue;
            }

            importedFiles.push(bookEntry);
            continue;
          }

          const unsupportedReason = isAudio
            ? 'Audio import is only available from the Audiobooks tab'
            : `Unsupported file format: ${metadata.mimeType}. Supported: PDF, EPUB, TXT, DOCX, MP3, M4A, M4B, and other audio types.`;

          errors.push({
            itemName: item.name,
            reason: unsupportedReason,
          });
        }
      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        errors.push({
          itemName: item.name,
          reason: errorMessage,
        });
      }
    }

    await clearLibraryCache(session.accessToken, session.user?.email ?? undefined);

    const importedCount = importedFiles.length;

    return NextResponse.json({
      importedCount,
      importedAudiobookCount,
      files: importedFiles,
      errors,
    });
  } catch (error) {
    console.error('[/api/library/import] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Import failed: ${message}` },
      { status: 500 }
    );
  }
}
