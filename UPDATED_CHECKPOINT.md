# StudyOS Updated Checkpoint

This archive is the full replacement project for the current StudyOS checkpoint.

## Main fixes in this checkpoint

- Email/password authentication and Google OAuth remain supported.
- Added Remember me behavior: checked = 30-day session, unchecked = 12-hour session.
- Fixed the tRPC auth mismatch so `/api/auth/*` JWT sessions and protected tRPC procedures use the same authenticated user.
- Restored the missing beta router required by the current app.
- AI Tutor no longer hardcodes the old Llama model name. It uses the configured NIM model.
- AI Tutor now uses an optional reasoning model for deeper questions and falls back safely when a provider call fails.
- LLM HTTP retries are bounded and requests have a timeout, preventing multi-minute hangs from repeated retries.
- Tutor attachments are extracted and the extracted study text is retained as chat context without persisting raw base64.
- Lesson generation retries once and keeps the source saved if generation fails.
- YouTube sources now keep their actual video title.
- Added YouTube playlist preview with educational filtering.
- Updated StudyOS to six selectable themes:
  - Glassmorph Light
  - Dark Neon
  - Slate Professional
  - Sage Green
  - Sunset Warm
  - Galaxy Purple
- Theme selection is independent from Light/Dark mode. Glass surfaces are built into the themes.
- Reworked dashboard copy so it does not use the old "Your notes are waiting" / "Ready when you are" block.
- Updated `BRAIN.md`, `ROADMAP.md`, `# STUDYOS_MASTER_PROMPT.md`, and Graphify sync documentation.

## Environment

Do not copy a real `.env` into source control. Configure the local `.env` using `.env.example`.

Important AI variables:

- `NVIDIA_NIM_API_KEY`
- `NVIDIA_NIM_API_URL`
- `NVIDIA_NIM_MODEL`
- `NVIDIA_NIM_REASONING_MODEL` (optional)

Google OAuth variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Verification on Windows

From the project root:

```powershell
pnpm install
pnpm check
pnpm test
pnpm build
pnpm dev
```

Then test the real flows:

1. Sign up and sign in.
2. Test Remember me.
3. Test Google login after OAuth credentials are configured.
4. Upload PDF, DOCX and PPTX.
5. Open the source and generate a lesson.
6. Paste a YouTube video.
7. Paste a YouTube playlist and select videos.
8. Generate a lesson from a YouTube source.
9. Open AI Tutor and send a normal message.
10. Attach a study file and ask the tutor about it.
11. Ask a multi-step question and verify the configured reasoning model is used when available.
12. Reopen the chat and ask about the previously attached material.
13. Switch all six themes and Light/Dark mode.
