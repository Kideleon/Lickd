# Launch checklist

**Legal and policy (blocking)**
- [ ] Lawyer reviews Terms of Service and Privacy Policy (`app/src/lib/legal.ts` are drafts).
- [ ] Publish the policies at public URLs; App Store Connect and Play Console require a privacy URL.
- [ ] Name a person responsible for reports and a response-time target (suggest: 24 hours for harassment, hate and underage reports).
- [ ] Decide how underage reports are handled and documented.

**App stores**
- [ ] User-generated content rules in place: report, block, filtering/moderation, contact info. These are all built; point reviewers to Settings > Reports and the admin dashboard in your review notes.
- [ ] Account deletion is in-app (Settings). Mention it in the review notes.
- [ ] Age rating: 17+ because of user-generated content and an optional dating feature.
- [ ] App privacy "nutrition labels" completed from the data the app collects (email, birthdate, profile, content, location text, push token, usage events).
- [ ] Real icon, splash and screenshots.

**Security**
- [ ] CAPTCHA and leaked-password protection on in Supabase Auth.
- [ ] Service-role key stored only in server secrets.
- [ ] Database backups on (Supabase Pro, point-in-time recovery).
- [ ] Error monitoring (Sentry) wired into `app/src/lib/monitoring.ts`.
- [ ] Admin dashboard behind HTTPS and restricted access.
- [ ] Penetration test or at least an external review of the RLS policies.

**Operations**
- [ ] `pg_cron` enabled and jobs visible in `cron.job`.
- [ ] Push webhook tested on a real device.
- [ ] Seed starter groups and a welcome post so new members don't arrive to an empty app.
