# LICKD

Your people. Your space. Your vibe. A mobile social network for Black queer women, lesbians and queer women.

| Folder | What it is |
|---|---|
| `app/` | Expo (React Native) mobile app, with light and dark themes |
| `admin/` | Web moderation dashboard (Vite + React) for staff |
| `supabase/migrations/` | Postgres schema, security rules (RLS), RPCs, storage, grants |
| `supabase/functions/send-push/` | Edge Function that delivers push notifications |
| `tests/` | Database test suite (224 checks) |
| `docs/` | Setup, architecture, security and launch checklists |

Start with [docs/SETUP.md](docs/SETUP.md).

## Status

- **Database:** applied to a local Postgres 16 and tested (`tests/run.sh`, 224 checks passing).
- **Mobile app and admin dashboard:** written in full but **not yet compiled or run** (the build environment couldn't reach npm). Expect to fix a few type or package-version errors on first run. See "First run" in the setup guide.
- **Legal text:** the Community Guidelines are real. The Terms and Privacy Policy in `app/src/lib/legal.ts` are **drafts that a lawyer must review before launch**.
- **Not in the MVP:** reels, live video, gifts, boosts, ticketing and other Phase 2 items.
