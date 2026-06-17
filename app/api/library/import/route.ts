import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import authOptions from '@/lib/auth';
import { listFilesInFolderRecursive, getFileMetadata } from '@/lib/googleDrive';
import type { BookEntry } from '@/types/books';

/**
 * POST /api/library/import
 * Import files/folders from Google Drive Picker selection
 * 
 * Request body:
 * {
 *   items: Array<{
 *     id: string;
 *     name: string;
 *     mimeType: string;
 *     type: 'file' | 'folder';
 *   }>
 * }
 * 
 * Response:
 * {
 *   importedCount: number;
 *   files: BookEntry[];
 *   errors: Array<{ itemName: string; reason: string }>;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get the user's session and access token
    const session = await getServerSession(authOptions);
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized: No access token available' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items } = body as {
      items: Array<{
        id: string;
        name: string;
        mimeType: string;
        type: 'file' | 'folder';
      }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: items array is required and must not be empty' },
        { status: 400 }
      );
    }

    const importedFiles: BookEntry[] = [];
    const errors: Array<{ itemName: string; reason: string }> = [];

    // Process each selected item (file or folder)
    for (const item of items) {
      try {
        if (item.type === 'folder') {
          // If it's a folder, list all files within it recursively
          const folderFiles = await listFilesInFolderRecursive(
            session.accessToken,
            item.id,
            'Unsorted' // Default source for imported items
          );
          importedFiles.push(...folderFiles);
        } else if (item.type === 'file') {
          // If it's a file, get its metadata
          const metadata = await getFileMetadata(session.accessToken, item.id);
          
          if (!metadata) {
            errors.push({
              itemName: item.name,
              reason: 'Could not retrieve file metadata',
            });
            continue;
          }

          // Determine if it's a supported format
          const supportedFormats = ['application/pdf', 'application/epub+zip'];
          if (!supportedFormats.includes(metadata.mimeType)) {
            errors.push({
              itemName: item.name,
              reason: `Unsupported file format: ${metadata.mimeType}`,
            });
            continue;
          }

          // Create BookEntry for this file
          const bookEntry: BookEntry = {
            id: metadata.id,
            name: metadata.name,
            mimeType: metadata.mimeType,
            size: metadata.size,
            modifiedTime: metadata.modifiedTime,
            source: 'Unsorted',
            format: metadata.mimeType === 'application/pdf' ? 'pdf' : 'epub',
            readingProgress: 0,
            lastLocation: '',
          };

          importedFiles.push(bookEntry);
        }
      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        errors.push({
          itemName: item.name,
          reason: errorMessage,
        });
      }
    }

    return NextResponse.json({
      importedCount: importedFiles.length,
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
