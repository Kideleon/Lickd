# Setup

## 1. Supabase project
1. Create a project at supabase.com.
2. Apply the migrations in order (`supabase db push` with the CLI, or paste `supabase/migrations/0001…0009` into the SQL editor).
   - `0006` enables Realtime and pg_cron jobs only if those extensions are available. Enable `pg_cron` in Database > Extensions for event reminders, suspension expiry and purge jobs.
3. Authentication > Providers: enable Email. Turn on "Confirm email". Set the Site URL and add the redirect `lickd://reset-password`.
4. Authentication > Rate limits: keep the defaults or tighten them. Sign-up and sign-in throttling is a Supabase Auth setting, not part of these migrations.
5. Authentication > Attack protection: enable CAPTCHA and leaked-password protection.
6. Optional: run `tests/run.sh` against a local Postgres 16 to re-verify the rules.

## 2. Mobile app
```bash
cd app
cp .env.example .env     # EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo install --fix   # aligns package versions with your Expo SDK
npx tsc --noEmit         # fix any type errors reported
npx expo start -c
```
- Only the **anon** key goes in the app. Never put the service-role key in `app/` or `admin/`.
- Push notifications need a real device and a development build, not Expo Go. Run `eas init`, then replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`.
- Replace `assets/icon.png` and `splash.png` with final artwork.

## 3. Push notifications
```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set PUSH_WEBHOOK_SECRET=<long random string>
```
Database > Webhooks > create a webhook on `notifications` INSERT that calls the function URL with the HTTP header `x-webhook-secret: <same string>`.

## 4. Admin dashboard
```bash
cd admin
cp .env.example .env     # VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install && npm run dev
```
Make your first staff account: sign up in the app, then in the SQL editor run
`update profiles set role = 'admin' where username = 'yourname';`
After that, admins promote moderators from the Members tab. Host the built `admin/dist` behind HTTPS and, ideally, an IP allow-list or SSO.

## 5. First run checklist
- Sign up with a birthdate under 18: it must be refused.
- Create two accounts and test follow, friend request, message request, block and report.
- Report something and resolve it from the admin dashboard.
- Switch Settings > Appearance between Match phone, Light and Dark.
