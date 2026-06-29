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
- Bundled catalog in `lib/youtube-audiobooks.json` (105 entries)
- Catalogue alias matching to Drive ebook filenames
- Editable / removable links (userdata + localStorage)
- Multi-match picker when several YouTube sources apply
- Full vs preview filters and labels

### Other
- Drive audiobooks, manual grouping, audio progress
- Ebook ↔ audiobook linking (Drive + YouTube)
- Virtual collections, import via Google Picker, hide/remove from library
- Online public-domain ebooks (`/read-online`)
- Authenticated admin diagnostics page (`/admin`)

### Latest completion

- Drive audiobook discovery recursively scans category folders. Folders containing loose tracks from multiple books are split using manual group metadata or derived book keys, so categories such as Fiction (Classics) no longer become giant playlist tiles.
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

## Known cleanup backlog

- Review duplicate or legacy Drive audiobook titles and stale browser-saved manual groups (for example repeated track-code titles, duplicate Bible entries, and old mixed groups).
- Expand `/admin` with a live Drive connectivity probe, cache status, and recent API failure history.
- Keep documented catalogue counts synchronized through `npm run validate:catalogues`.

## Upgrade backlog

Prioritised upgrades that would materially improve JoshBooks without changing the core single-user design:

Status: item 10 is implemented as `/admin` for authenticated safe environment checks, catalogue counts, and live-QA guidance. Future expansion can add Drive connectivity probes, cache status, and recent API failure history.

Status: item 9 is implemented as canonical `/media/[kind]/[id]` detail pages for Drive ebooks, Drive audiobooks, movies, online ebooks, and YouTube audiobooks. Library cards and unified search now route through the detail layer before opening readers, players, Drive, or YouTube.

Status: item 8 is implemented as a safe bulk-edit toolbar for visible Drive ebooks, Drive audiobooks, and movies. It supports selecting the active visible set, creating/choosing a folder, adding selected items to that folder, and hiding selected items from the catalogue view.

Status: item 7 is implemented as library-level offline/cache indicators. The header now shows online/offline state, local JoshBooks app-data count, browser cache support, and a warning that streamed Drive, YouTube, and online ebook media still need network access.

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
