export type DriveImportResult = {
  importedCount: number;
  importedAudiobookCount: number;
  errors: Array<{ itemName: string; reason: string }>;
};

export function formatDriveImportMessage(result: DriveImportResult): string {
  const parts: string[] = [];
  if (result.importedCount > 0) {
    parts.push(`${result.importedCount} ebook${result.importedCount === 1 ? '' : 's'}`);
  }
  if (result.importedAudiobookCount > 0) {
    parts.push(
      `${result.importedAudiobookCount} audiobook${result.importedAudiobookCount === 1 ? '' : 's'}`
    );
  }

  let message =
    parts.length > 0 ? `Imported ${parts.join(' and ')}.` : 'No files were imported.';

  if (result.errors.length > 0) {
    const preview = result.errors
      .slice(0, 2)
      .map((entry) => `${entry.itemName}: ${entry.reason}`)
      .join('; ');
    const suffix =
      result.errors.length > 2 ? ` (+${result.errors.length - 2} more)` : '';
    message += ` ${result.errors.length} skipped — ${preview}${suffix}`;
  }

  return message;
}
