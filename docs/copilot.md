# JoshBooks — implementation status

Last reviewed: June 2026

## Implemented

### Phase 1 (core reader)
- Google sign-in (NextAuth)
- `GET /api/library` — list books from Drive folders
- `POST /api/library/progress` — reading progress in Drive `appProperties`
- PDF / EPUB / TXT / DOCX readers

### Phase 2 (local sync)
- `scripts/sync-local-books.ps1` and `npm run sync-local-books`

### Metadata & userdata
- Metadata editor with online search; saves to Drive, localStorage, and Vercel KV via `/api/userdata`
- Requires `KV_REST_API_URL` + `KV_REST_API_TOKEN` on Vercel for cross-device sync

### YouTube audiobooks
- Bundled catalog in `lib/youtube-audiobooks.json` (85 entries)
- Catalogue alias matching to Drive ebook filenames
- Editable / removable links (userdata + localStorage)
- Multi-match picker when several YouTube sources apply
- Full vs preview filters and labels

### Other
- Drive audiobooks, manual grouping, audio progress
- Ebook ↔ audiobook linking (Drive + YouTube)
- Virtual collections, import via Google Picker, hide/remove from library
- Online public-domain ebooks (`/read-online`)

### Latest completion

- Homepage renders its complete shell immediately while authentication resolves; recent books load after authentication.
- Manual audiobook playlists are stored in local/userdata state and play as combined track lists without modifying Drive files.
- Library includes a Movies tab with 48 bundled Google Drive movie links, including Harry Potter and Pirates of the Caribbean collections.
- YouTube audiobook catalogue includes curated IT additions covering full YouTube audiobooks, cybersecurity, SRE, architecture, databases, Kubernetes, microservices, DevOps, and engineering leadership.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run validate:catalogues
npm run build
```

## Upgrade backlog

Prioritised upgrades that would materially improve JoshBooks without changing the core single-user design:

1. **Unified media search** — one search surface across ebooks, audiobooks, online audiobooks, online ebooks, and movies, with quick filters by media type.
2. **Movie playback page** — open Drive movies inside JoshBooks with an embedded player page, progress tracking, and a clean fallback link to Google Drive.
3. **Resume hub** — expand Continue Reading into a Continue Watching / Continue Listening / Continue Reading panel covering all media types.
4. **Import/export userdata** — downloadable backup and restore for metadata overrides, hidden items, folders, YouTube edits, movie progress, and manual audiobook groups.
5. **Catalogue health checks** — automated validation for duplicate catalogue IDs, invalid YouTube URLs, invalid Drive links, missing display labels, and stale docs counts.
6. **Better collection rules** — saved smart folders based on source, media type, progress, author, year, title keywords, and hidden/unfiled status.
7. **Offline-friendly cache indicators** — show which reader assets or metadata are locally cached and warn when a media item needs network access.
8. **Bulk edit mode** — select multiple ebooks/audiobooks/movies and apply folders, hide/remove, metadata source, or tags in one action.
9. **Media detail pages** — add canonical detail pages for each book, audiobook, and movie with metadata, links, progress, and related items.
10. **Admin diagnostics page** — authenticated-only page summarising Drive connectivity, cache status, catalogue counts, environment config, and recent API failures.
