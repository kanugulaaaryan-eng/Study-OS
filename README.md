# StudyOS

StudyOS is a personal learning OS for students and self-taught learners. It is designed around one outcome:

> **Now I finally understand this.**

It is not meant to be a generic AI chatbot with a study-themed interface. StudyOS turns study material into lessons, practice and revision, while the AI Tutor keeps the conversation grounded in what the learner is studying.

## What it does

- **AI Tutor**: context-aware tutoring for school, college, BTech, PG, professional learning and skills such as coding or marketing.
- **Documents**: upload PDF, DOCX and PPTX files and extract their text for study workflows.
- **YouTube learning**: process educational videos and playlists, extract transcripts, save the real video title and turn the material into lessons.
- **Lessons**: simple explanation, detailed explanation, examples, analogies, key terms, revision summary and common mistakes.
- **Quizzes**: generate multiple-choice practice from lessons and save results.
- **Flashcards**: generated or manual cards with real question/answer flipping and spaced repetition.
- **Notes**: generate study notes from a subject or write/edit your own notes with simple rich text formatting and autosave.
- **Revision + progress**: study sessions, review data and progress tracking.
- **AI chat history**: multiple sessions with rename, pin and delete support, plus persistent messages per user.
- **Themes**: 6 curated themes (Glassmorph Light, Sage Green, Sunset Warm, Slate Professional, Dark Neon, Galaxy Purple) with built-in glass surfaces. No separate light/dark toggle — each theme controls its own presentation.
- **PWA**: installable on desktop, Android and iOS/iPadOS through supported browsers.

## Why use it instead of a generic AI chat

A normal AI chat starts with a blank conversation. StudyOS starts with the learner's **study context**.

A subject can contain:

```text
YouTube / PDF / DOCX / PPTX
        ↓
     Lesson
        ↓
  Quiz + Flashcards + Notes
        ↓
   Revision + Progress
        ↓
      AI Tutor
```

The Tutor can use the current subject, lesson, uploaded material, previous chat messages, quiz performance, flashcard activity and study history to make explanations more relevant.

The goal is not to replace ChatGPT, a teacher or a textbook. The goal is to remove the friction between **having information** and **actually understanding it**.

## Authentication and privacy

StudyOS supports account-based authentication with:

- Email + password (scrypt hashing, JWT in httpOnly cookie, remember-me ~30d)
- Google OAuth when Google OAuth credentials are configured

Every subject, document, lesson, quiz, flashcard, note, study session, progress record and AI chat belongs to the authenticated user. Backend procedures scope reads and writes by `userId` so different accounts do not share study data.

For production, use a persistent MySQL/TiDB-compatible database and a strong `JWT_SECRET`.

## AI Provider: NVIDIA NIM (free tier)

The default provider is **NVIDIA NIM** at `integrate.api.nvidia.com/v1` (OpenAI-compatible). Model: **`openai/gpt-oss-120b`** (free, reasoning model).

```env
LLM_PROVIDER=nvidia-nim
NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_NIM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=openai/gpt-oss-120b
NVIDIA_NIM_REASONING_MODEL=openai/gpt-oss-120b
```

Also accepts legacy aliases: `NIM_API_KEY`, `NIM_BASE_URL`, `NIM_MODEL`, `NIM_REASONING_MODEL`.

The model may emit `reasoning_content`. StudyOS sanitizes control characters inside JSON string literals before parsing to ensure structured output (lessons, quizzes, flashcards, notes) works reliably.

Never commit `.env` or a real API key.

## Local development

Requirements:

- Node.js 20+
- pnpm

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Open `http://localhost:3000`.

For persistent data, configure `DATABASE_URL` and run:

```powershell
pnpm db:push
```

Without a database, the project has development in-memory fallbacks for several features. Those fallbacks are useful for UI development but are not a production persistence layer.

## PWA / mobile

StudyOS includes a web app manifest and service worker. On desktop and Android, supported browsers can install it from the browser's install UI. On iPhone/iPad, open StudyOS in Safari and use **Share → Add to Home Screen**.

The application is responsive for desktop, tablet and mobile layouts. Native App Store / Play Store packaging can be added later without rewriting the core application.

## Project structure

```text
client/                 React + Vite frontend
client/src/pages/       StudyOS screens
client/src/components/  Reusable UI
client/src/contexts/    Theme system
server/                 Express + tRPC backend
server/routers/         Feature routers
server/_core/           Auth, LLM and platform plumbing
drizzle/                Database schema and migrations
shared/                 Shared types/constants
BRAIN.md                Project memory for future AI sessions
MASTERPROMPT.md         Product principles and UX rules
ROADMAP.md              Development roadmap
```

## Design principles

- Understanding before memorization.
- Human-first copy.
- Minimal interface.
- Study material before generic answers.
- No robotic filler.
- No generic neon AI aesthetic.
- Glassmorphism is part of the theme, not a feature toggle.
- Every button should have a clear purpose.
- Build the smallest useful interaction first.

## Themes

StudyOS ships with 6 themes, applied app-wide (all pages, auth screens, dashboard):

| Theme | Presentation | Default |
|-------|--------------|---------|
| Glassmorph Light | White/near-white, airy, clean | ✅ Default |
| Sage Green | Light, nature-inspired | |
| Sunset Warm | Light, warm tones | |
| Slate Professional | Dark, professional | |
| Dark Neon | Dark, cyberpunk | |
| Galaxy Purple | Dark, cosmic | |

**No separate Light/Dark/System toggle exists.** Each theme controls its own light-vs-dark presentation. Theme selection persists via `localStorage` and applies the `theme-*` class to `document.documentElement` before first paint to avoid a flash.

Glassmorphism rules follow progressive enhancement:
1. Solid opaque `background-color` first
2. `backdrop-filter` wrapped in `@supports` with `-webkit-` prefix
3. No `mix-blend-mode` — glow/blend via layered gradients
4. Every theme root sets both solid `background-color` AND gradient `background-image`
5. Respects `prefers-reduced-motion`

Smooth transitions on theme change (250ms), interactive states (150-250ms), page mount fade/slide-in, card hover lift, active nav indicator animation — all transform/opacity only, no layout thrashing.

## Environment variables

Create a `.env` at the project root from `.env.example`. Never commit it.

```env
# Database (TiDB Serverless - free, MySQL-compatible)
DATABASE_URL=mysql://user:password@gateway01.region.tidbcloud.com:4000/studyos?ssl=%7B%22rejectUnauthorized%22%3Afalse%7D

# NVIDIA NIM (primary AI provider - free tier)
NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_NIM_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=openai/gpt-oss-120b
NVIDIA_NIM_REASONING_MODEL=openai/gpt-oss-120b
LLM_PROVIDER=nvidia-nim

# Authentication
JWT_SECRET=replace-with-a-long-random-string-32-chars-min
OWNER_OPEN_ID=your_owner_open_id_here

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback

# Server
PORT=3000
NODE_ENV=production

# SSL config for TiDB
SSL_REJECT_UNAUTHORIZED=false
```

**Every variable used by the app** is documented in `.env.example`.

## Google OAuth setup (Google Cloud Console)

1. Go to <https://console.cloud.google.com> → create or pick a project.
2. **APIs & Services → OAuth consent screen** — configure with your app name and a support email. Add scopes `openid`, `email`, `profile`.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. Add an **Authorized redirect URI** that exactly matches your `GOOGLE_REDIRECT_URI`, e.g. `https://your-domain.com/api/auth/google/callback`.
5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
6. The callback route is already implemented in `server/_core/auth.ts` — it exchanges the code, finds or creates the user, opens a StudyOS session and redirects into the app. No blank page.

## Deployment: Free Infrastructure for ~50 Users

### Architecture

| Layer | Service (Free Tier) | Purpose |
|-------|---------------------|---------|
| Frontend (Static) | **Netlify** | Serves React + Vite build, PWA |
| Backend/API | **Render** (or Railway/Fly.io) | Runs Express + tRPC server |
| Database | **TiDB Serverless** (free) | MySQL-compatible, Drizzle ORM |

All three services offer free tiers with no credit card required. Upgrade-friendly when you exceed free limits.

### 1) Push to GitHub

```bash
git init
git add .
git commit -m "StudyOS initial release"
git branch -M main
git remote add origin https://github.com/<you>/Study-OS.git
git push -u origin main
```

Make sure `.env` and `node_modules/` are ignored (see `.gitignore`).

### 2) Create the database (TiDB Serverless)

1. Create a free TiDB Cloud Serverless cluster at <https://tidbcloud.com> → get the MySQL connection string.
2. Set `DATABASE_URL` in your backend host to that connection string. **Important**: TiDB requires TLS. Use `ssl={"rejectUnauthorized":false}` in the URL or set `SSL_REJECT_UNAUTHORIZED=false`.
3. Run migrations from the backend host (or locally): `pnpm db:push`.
4. Verify all 15 tables exist: `users, subjects, documents, lessons, quizQuestions, quizAttempts, flashcards, flashcardReviews, notes, studySessions, progressStats, dailyProgressLog, chatSessions, chatMessages, betaFeedback`.

### 3) Deploy the backend (Render)

1. New **Web Service**, connect the GitHub repo.
2. Build command: `pnpm install && pnpm build`
3. Start command: `node dist/index.js`
4. Set all env vars in the service dashboard (copy from `.env.example`).
5. Note the backend URL (e.g. `https://studyos-api.onrender.com`).

### 4) Deploy the frontend (Netlify)

1. Import the GitHub repo on Netlify.
2. Build command: `pnpm build` (Netlify builds the client bundle via Vite).
3. Publish directory: `dist/public`
4. Add a redirect for SPA routes: create `public/_redirects` with:
   ```
   /*  /index.html  200
   ```
5. Set `GOOGLE_REDIRECT_URI` to the **backend** host (e.g. `https://studyos-api.onrender.com/api/auth/google/callback`).
6. If API calls need a different origin, configure the client's API base URL.

### 5) Point everything at the right URLs

- `GOOGLE_REDIRECT_URI` → backend host (Google redirects there).
- Client is a static build; API base defaults to same-origin `/api/trpc` which works on Render if you proxy `/api` to the backend, or set a custom base in the client.

## Current validation

Before release, run:

```powershell
pnpm check
pnpm test
pnpm build
```

Then manually verify the real environment with a private NIM key and a persistent database:

**login → subject → YouTube/document → transcript → lesson → quiz → flashcards → notes → AI Tutor → revision → progress**

The repository does not contain production secrets. Keep your private `.env` outside anything uploaded to GitHub or shared with an AI tool.
