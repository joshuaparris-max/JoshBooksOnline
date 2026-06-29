# JoshBooks — Personal Media Library

A single-user library for reading ebooks, listening to Drive and YouTube audiobooks, and browsing movies. JoshBooks combines Google Drive media with local catalogue data, metadata editing, progress tracking, folders, search, and backup tools.

## Tech Stack

- **Framework**: Next.js 16.2.9 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: NextAuth v4 with Google OAuth
- **Rendering**: pdfjs-dist (PDF), epubjs (EPUB), streamed Drive audio/video
- **Deployment**: Vercel (server features required)

## Google Cloud Setup

This app uses an **Internal** Google Workspace OAuth app in the `cornerstone.edu.au` organization.

### 1. Confirm the GCP project

- Project ID: `bookshelf-499102`
- Google Drive API: enabled
- OAuth consent screen: **Internal**
- OAuth Client ID: `369014421608-mvokv1jp2avd998jsps7vcv1f1pvjitj.apps.googleusercontent.com`
- Authorized redirect URI (dev): `http://localhost:3000/api/auth/callback/google`

### 2. Enable the Google Drive API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **Google Drive API**
3. Click on it and press **ENABLE**

### 3. Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Confirm the app type is **Internal**
3. Confirm the app has the scope:
   - `https://www.googleapis.com/auth/drive`
4. Make sure the signing-in account is your Workspace account (`joshua.parris@cornerstone.edu.au`)

### 4. Create or verify OAuth Credentials

1. In the left sidebar, go to **APIs & Services** → **Credentials**
2. Ensure the OAuth Client ID exists for the internal app
3. If needed, create **OAuth client ID** → **Web application**
4. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
5. Save the **Client ID** and **Client Secret** securely

### 5. Internal Workspace notes

- No external test users are required for an internal app
- No unverified app warning should appear for Workspace users in the same org
- OAuth refresh tokens do not expire every 7 days in this configuration

### Troubleshooting

If sign-in succeeds but Drive API calls return **"access blocked by administrator"**, fix this in Admin Console:

1. Go to [admin.google.com](https://admin.google.com/)
2. Navigate to **Security** → **API Controls**
3. Open **App Access Control**
4. Mark the Client ID as **trusted**

## Local Setup

### 1. Set Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```
GOOGLE_CLIENT_ID=<your_client_id_from_step_4>
GOOGLE_CLIENT_SECRET=<your_client_secret_from_step_4>
NEXTAUTH_SECRET=<generate_a_random_string>
NEXTAUTH_URL=http://localhost:3000
```

To generate `NEXTAUTH_SECRET`, run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Sign in with Google**.

## Current features

- PDF, EPUB, TXT, and DOCX reading with progress tracking
- Recursive Google Drive ebook and audiobook discovery
- Multi-track Drive audiobooks, loose-track grouping, manual playlists, and listening progress
- Curated YouTube audiobooks with matching, editing, and source selection
- Movie catalogue and playback pages
- Metadata search and editing
- Virtual folders, bulk actions, unified search, and hide/remove controls
- Drive import plus userdata export/import
- Authenticated diagnostics at `/admin`

## Project Structure

```
app/
  api/
    auth/[...nextauth]/    # NextAuth routes
    library/               # Drive library, import, metadata, and progress APIs
  library/                 # Unified ebooks, audiobooks, and movies library
  media/                   # Canonical media detail pages
  reader/                  # Ebook reader
  listen/                  # Drive audiobook player
  admin/                   # Authenticated diagnostics
  page.tsx                 # Homepage and recent-media shell
  layout.tsx               # Root layout with AuthProvider
  providers.tsx            # Client SessionProvider wrapper
lib/
  googleDrive.ts          # Drive helper functions
types/
  books.ts                # Shared BookEntry types
proxy.ts                  # Protect /library and /reader routes
```

## Quality gates

Run the complete gate before merging:

```bash
npm run lint
npm run typecheck
npm test
npm run validate:catalogues
npm run build
```

## Phase 2 — Local book sync ✅

Run the sync script from the repository root with PowerShell:

```powershell
$env:LOCAL_BOOKS_ROOT = 'C:\dev\Books'
$env:GOOGLE_CLIENT_ID = '<your_google_client_id>'
$env:GOOGLE_CLIENT_SECRET = '<your_google_client_secret>'
$env:GOOGLE_REFRESH_TOKEN = '<your_refresh_token>'
npm run sync-local-books
```

The script creates the Drive folder `Local Books` if it does not already exist and uploads supported files recursively.

## Additional features

- **Metadata editor** with Google Books / Open Library search, persisted to Drive `appProperties`, localStorage, and Vercel KV (`/api/userdata`)
- **YouTube audiobook catalog** with catalogue alias matching, editable/removable links, and multi-source picker
- **Drive audiobooks**, ebook↔audiobook linking, virtual collections, online public-domain reads
- **Admin diagnostics** for environment configuration and catalogue health

