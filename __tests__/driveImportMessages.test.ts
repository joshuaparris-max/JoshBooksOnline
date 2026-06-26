import { describe, expect, it } from '@jest/globals';
import { formatDriveImportMessage } from '@/lib/driveImportMessages';

describe('Drive import messages', () => {
  it('summarises ebook and audiobook counts', () => {
    expect(
      formatDriveImportMessage({
        importedCount: 2,
        importedAudiobookCount: 3,
        errors: [],
      })
    ).toBe('Imported 2 ebooks and 3 audiobooks.');
  });

  it('includes skipped file reasons', () => {
    const message = formatDriveImportMessage({
      importedCount: 0,
      importedAudiobookCount: 1,
      errors: [{ itemName: 'notes.pdf', reason: 'Unsupported file format' }],
    });
    expect(message).toContain('1 audiobook');
    expect(message).toContain('notes.pdf');
  });
});
