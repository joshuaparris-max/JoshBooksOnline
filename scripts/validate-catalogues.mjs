import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  throw new Error(message);
}

function assertUnique(items, label, selector) {
  const seen = new Set();
  const duplicates = new Set();

  for (const item of items) {
    const value = selector(item);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  if (duplicates.size > 0) {
    fail(`${label} contains duplicate values: ${Array.from(duplicates).join(', ')}`);
  }
}

function validateAudiobooks() {
  const file = path.join(root, 'lib', 'youtube-audiobooks.json');
  const audiobooks = JSON.parse(fs.readFileSync(file, 'utf8'));
  const validAvailability = new Set(['full_public_domain', 'official_preview', 'unknown']);

  if (!Array.isArray(audiobooks)) fail('Audiobook catalogue must be a JSON array.');
  assertUnique(audiobooks, 'Audiobook catalogue ids', (entry) => entry.id);

  for (const entry of audiobooks) {
    if (!entry.id || typeof entry.id !== 'string') fail('Audiobook entry missing string id.');
    if (!entry.title || typeof entry.title !== 'string') fail(`Audiobook ${entry.id} missing title.`);
    if (!entry.author || typeof entry.author !== 'string') fail(`Audiobook ${entry.id} missing author.`);
    const youtubeUrl = entry.youtubeUrl ?? '';
    const isWatchUrl = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[A-Za-z0-9_-]+/.test(youtubeUrl);
    const isPlaylistUrl = /^https:\/\/(www\.)?youtube\.com\/playlist\?list=[A-Za-z0-9_-]+/.test(youtubeUrl);
    if (!isWatchUrl && !isPlaylistUrl) {
      fail(`Audiobook ${entry.id} has an invalid YouTube URL.`);
    }
    if (!Array.isArray(entry.catalogueMatches) || entry.catalogueMatches.length === 0) {
      fail(`Audiobook ${entry.id} must include at least one catalogue match.`);
    }
    if (!validAvailability.has(entry.availabilityType)) {
      fail(`Audiobook ${entry.id} has invalid availabilityType ${entry.availabilityType}.`);
    }
    if (!entry.displayLabel && entry.availabilityType !== 'unknown') {
      fail(`Audiobook ${entry.id} is missing displayLabel.`);
    }
    if (!entry.source) fail(`Audiobook ${entry.id} is missing source.`);
  }

  return audiobooks.length;
}

function extractMovieCalls(source) {
  const calls = [];
  const pattern = /movie\(\s*'([^']+)'\s*,\s*(?:"([^"]+)"|'([^']+)')\s*,\s*'([^']+)'/g;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    calls.push({
      id: match[1],
      title: match[2] ?? match[3],
      driveFileId: match[4],
    });
  }

  return calls;
}

function validateMovies() {
  const file = path.join(root, 'lib', 'movies.ts');
  const movies = extractMovieCalls(fs.readFileSync(file, 'utf8'));

  if (movies.length === 0) fail('Movie catalogue has no movie entries.');
  assertUnique(movies, 'Movie catalogue ids', (movie) => movie.id);
  assertUnique(movies, 'Movie Drive file ids', (movie) => movie.driveFileId);

  for (const movie of movies) {
    if (!movie.title) fail(`Movie ${movie.id} missing title.`);
    if (!/^[A-Za-z0-9_-]+$/.test(movie.driveFileId)) {
      fail(`Movie ${movie.id} has invalid Drive file id.`);
    }
  }

  return movies.length;
}

try {
  const audiobookCount = validateAudiobooks();
  const movieCount = validateMovies();
  console.log(`Catalogue validation passed: ${audiobookCount} audiobooks, ${movieCount} movies.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
