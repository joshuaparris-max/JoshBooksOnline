# BookShelf — Personal Ebook Reader

A single-user ebook reader web app for PDFs and EPUBs stored in Google Drive. Features a library view like Calibre and reading views powered by pdf.js and epubjs, with reading progress synced back to Drive via appProperties.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: NextAuth v4 with Google OAuth
- **Rendering**: pdfjs-dist (PDF), epubjs (EPUB)
- **Deployment**: Vercel (server features required)

## Google Cloud Setup

Before running the app locally, you must set up OAuth credentials in Google Cloud Console. **This is a required manual step.**

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project selector dropdown at the top
3. Click **NEW PROJECT**
4. Name: `BookShelf`
5. Click **CREATE**
6. Wait for the project to be created, then select it

### 2. Enable the Google Drive API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **Google Drive API**
3. Click on it and press **ENABLE**

### 3. Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type and click **CREATE**
3. Fill the form:
   - **App name**: `BookShelf`
   - **User support email**: Your email
   - Scroll to bottom, **Developer contact information**: Your email
4. Click **SAVE AND CONTINUE**
5. On **Scopes** step, click **ADD OR REMOVE SCOPES**
6. Search for and add: `https://www.googleapis.com/auth/drive`
7. Click **UPDATE** and **SAVE AND CONTINUE**
8. On **Test users** step, click **ADD USERS**
9. Add your email address as a test user
10. Click **SAVE AND CONTINUE**, then **BACK TO DASHBOARD**

### 4. Create OAuth Credentials

1. In the left sidebar, go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Choose **Web application**
4. Under **Authorized redirect URIs**, add both:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<YOUR_VERCEL_URL>/api/auth/callback/google`
   
   (You can add the Vercel URL later once you deploy; start with localhost)
5. Click **CREATE**
6. Copy the **Client ID** and **Client Secret** and save them somewhere safe

### 5. Important: Testing Mode Token Expiry

Because your app is in Google Cloud's **Testing** status (not production), OAuth refresh tokens expire **every 7 days**. This is an accepted tradeoff for a personal app:
- **Solution**: Simply sign in again after 7 days (takes 10 seconds)
- **Why**: Publishing to production requires additional Google verification we don't need for personal use

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

## Project Structure

```
app/
  api/
    auth/[...nextauth]/    # NextAuth routes
    library/               # GET /api/library (list books)
    library/progress/      # POST /api/library/progress (save progress)
  page.tsx                 # Sign-in landing page
  layout.tsx               # Root layout with AuthProvider
  providers.tsx            # Client SessionProvider wrapper
lib/
  googleDrive.ts          # Drive helper functions
types/
  books.ts                # Shared BookEntry types
middleware.ts             # Protect /library and /reader routes
```

## Acceptance Criteria — Phase 1

✅ `npm run build` passes with no TypeScript errors
✅ Sign in with Google works
✅ GET `/api/library` returns real files from Drive folders
✅ POST `/api/library/progress` writes appProperties visible in Drive

## Next Phase

Phase 2 (PowerShell sync script) will upload local books from `C:\dev\Books` to the "Local Books" folder in Drive.

