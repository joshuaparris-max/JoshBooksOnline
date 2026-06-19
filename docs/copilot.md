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
- Bundled catalog in `lib/youtube-audiobooks.json` (43 entries)
- Catalogue alias matching to Drive ebook filenames
- Editable / removable links (userdata + localStorage)
- Multi-match picker when several YouTube sources apply
- Full vs preview filters and labels

### Other
- Drive audiobooks, manual grouping, audio progress
- Ebook ↔ audiobook linking (Drive + YouTube)
- Virtual collections, import via Google Picker, hide/remove from library
- Online public-domain ebooks (`/read-online`)

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
