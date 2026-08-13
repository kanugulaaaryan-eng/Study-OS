# StudyOS Phase 6 — Public Beta

## Completed in this checkpoint

- Beta feedback page with rating, category, and free-form feedback.
- Portable JSON data export from the authenticated beta area.
- Security baseline headers and dependency-free API rate limiting.
- Existing Phase 5 AI, theme, landing-page, and dashboard behavior preserved.
- Release checklist documented below.

## Before inviting friends

1. Keep `.env` private and never upload it.
2. Set a persistent `DATABASE_URL` for real beta data.
3. Run `pnpm db:push`.
4. Run `pnpm check`, `pnpm test`, and `pnpm build`.
5. Test upload → lesson → quiz → flashcards → notes → tutor → revision → progress.
6. Test logout/login and protected routes.
7. Download a backup from `/beta-feedback`.
8. Test on desktop and mobile.
9. Rotate any API key that has ever been exposed outside your private machine.

## Analytics

The beta keeps analytics lightweight and privacy-conscious. Existing Umami integration remains optional. Do not make analytics a dependency of core study workflows.
