# StudyOS Brain

Read this before changing the project.

## Current status

**Public beta hardening / real-environment validation.**

The project has completed the planned Phase 1–6 implementation and is now being hardened around the issues found during browser testing.

### Current hardening changes

- AI Tutor is study-first and can teach academic and practical skills, including coding, without becoming a coding/debugging agent.
- AI Tutor uses NVIDIA NIM with `meta/llama-3.1-8b-instruct` by default for a faster conversational path. The Tutor explicitly avoids reasoning-mode requests so simple study questions do not wait for unnecessary hidden reasoning.
- AI Tutor keeps multiple user-owned chat sessions and supports rename, pin, delete and persistent message history.
- Tutor context includes the current subject/lesson, recent messages, uploaded sources, weak topics, quiz performance, flashcard activity, notes and study history where available.
- The Tutor must infer references such as “this topic” from the current context instead of repeatedly asking the student to restate it.
- Lessons now have a student-facing overview and readable sections instead of exposing raw JSON.
- Lessons support rename and delete from the subject page.
- Flashcards use a real front/back 3D flip and support manual edit/delete.
- Notes support generated notes, manual notes, simple rich text editing and debounced autosave.
- YouTube sources use the actual video title when available, reject obvious non-study content, support educational playlist preview/selection, and save transcript text as the study source.
- Document downloads are explicit: the current button downloads the extracted study text as a `.txt` file.
- Authentication now supports email/password accounts and Google OAuth when Google credentials are configured. Sessions are signed and user-owned instead of being tied to a single local NIM user.
- User names are account data. Logout clears local onboarding state so a second account on the same browser does not inherit the previous user's name.
- Backend study records are scoped by `userId` and chat sessions are scoped by both session id and user id.
- The PWA manifest and service worker are included. Development unregisters stale service workers so an old broken worker cannot interfere with localhost.
- Eight visual themes are available with built-in glass surfaces. There is no separate glassmorphism setting.
- Duplicate nested project copies are removed from the working source tree.

## Architecture

### Frontend

- React + Vite + TypeScript
- Wouter routing
- TanStack Query through tRPC
- Radix UI primitives
- Tailwind CSS v4
- Framer Motion
- Lucide icons
- Cytoscape / Graphify for Brain visualization

### Backend

- Express
- tRPC
- Drizzle ORM
- MySQL/TiDB when `DATABASE_URL` is configured
- In-memory fallbacks for local development where implemented
- Current storage abstraction with local development fallback

### AI

`server/_core/llm.ts` is the provider-agnostic interface.

Current default provider:

```env
LLM_PROVIDER=nim
NIM_API_KEY=...
NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NIM_MODEL=meta/llama-3.1-8b-instruct
```

Canonical names are also accepted:

```env
NVIDIA_NIM_API_KEY=...
NVIDIA_NIM_API_URL=...
NVIDIA_NIM_MODEL=meta/llama-3.1-8b-instruct
```

Never commit `.env` or real API keys.

## Core workflow

```text
PDF / DOCX / PPTX / educational YouTube
        ↓
text extraction / transcript
        ↓
student-facing lesson
        ↓
understanding
        ↓
quiz + flashcards + notes
        ↓
revision + progress
        ↓
context-aware AI Tutor
```

## AI Tutor rules

The Tutor is a teacher, not a generic coding assistant.

It should:

- teach in small steps
- infer “this topic” from context
- use examples and analogies
- check understanding
- adapt when the student is confused
- use the student's name occasionally
- never call the user “Student”
- avoid generic AI filler
- prioritize the student's study material
- clearly distinguish source-grounded answers from general knowledge

Good style:

- “Let's make this click.”
- “Try this one before I show you the answer.”
- “You're close. The missing piece is…”
- “Let's look at the same idea from another angle.”

Avoid:

- “How can I assist you?”
- “I'm excited to dive in…”
- “Student, I'm here to help…”
- repeated fake encouragement
- long information dumps when a smaller explanation would teach better

## Authentication

The app supports:

- Email/password signup and login
- Google OAuth when configured
- signed session cookies
- account-level user names
- user-scoped study data

Production requires a persistent database and a strong `JWT_SECRET`.

## YouTube rules

YouTube processing is for study content, not a general entertainment transcriber.

Preferred sources:

- lectures
- tutorials
- courses
- educational explainers
- exam preparation
- university/school material
- coding and professional learning tutorials

The UI supports playlist preview so the learner can choose which videos to process. Do not automatically process an entire playlist without user selection.

## Themes

Current themes:

1. Ink & Paper
2. Forest & Linen
3. Espresso & Cream
4. Midnight & Brass
5. Obsidian & Sage
6. Ocean Glass
7. Aurora Plum
8. Rose Dusk

Each theme has light/dark variants and built-in glass surfaces. Do not add a separate glassmorphism toggle.

## PWA

- `client/public/manifest.webmanifest`
- `client/public/sw.js`
- service worker registration is production-only
- development unregisters stale workers
- responsive desktop/tablet/mobile layouts are required

## Validation

Run:

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Then manually test:

1. signup with a new account
2. logout and signup/login as a second account
3. verify data isolation
4. verify name in sidebar and Tutor behavior
5. switch themes/light/dark
6. create a subject
7. upload PDF/DOCX/PPTX
8. paste an educational YouTube video
9. preview/process a playlist
10. generate a lesson
11. rename/delete a lesson
12. generate/take a quiz
13. generate/edit/review flashcards
14. generate/write/edit notes
15. create/rename/pin/delete Tutor sessions
16. ask a context-dependent Tutor question
17. verify fast NIM response
18. verify revision/progress
19. test mobile/PWA installation

Live NIM, YouTube and OAuth behavior require network credentials and cannot be honestly marked verified from static code inspection.

## Rules for future AI sessions

1. Read this file first.
2. Read `MASTERPROMPT.md` and `ROADMAP.md` before architectural changes.
3. Preserve working features.
4. Fix the smallest correct layer instead of rewriting the application.
5. Never add secrets to commits, ZIPs, prompts or documentation.
6. Run check → tests → build after changes.
7. Reproduce browser issues before changing architecture.
