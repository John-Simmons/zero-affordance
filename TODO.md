# TODO

Next steps for the loading-perception experiment. Notes are here because most of
these touch more than the one-line summary suggests.

---

## Pending database changes

**Dev is fully applied** — all eight migrations, confirmed 2026-08-15 with
`pnpm supabase migration list --linked` against the dev project. Local, staging
and previews all share that database, so nothing is outstanding there. Re-run
that command rather than trusting this paragraph; `supabase db push` is a
separate step from the deploy, and migrations do not travel with the app.

**Production is still at the init migration.** `main` carries only
`20260810000000_init`, so seven are unapplied to prod, oldest first:

- `20260811000000_pairwise_matches`
- `20260811010000_real_loading_indicators`
- `20260814000000_matchup_durations`
- `20260815000000_video_ideas`
- `20260815010000_retire_placeholder_content`
- `20260815020000_idempotent_idea_votes`
- `20260815030000_fix_ambiguous_idea_id`

(Inferred from `main`'s history, not measured. Checking for real means linking
to prod, and a working copy left pointed there turns the next routine
`db push` into a production write — so it is deliberately not done in passing.)

**Order matters, and getting it wrong breaks production.**
`20260814000000` drops `experiment_variants.base_duration_ms` and `.jitter_ms`,
columns the _currently deployed production_ adapter still names in its `select`.
Push it before the new code is live and every experiment page 500s on a request
for columns that no longer exist. So:

1. Merge `dev` → `main` and let the production deploy finish.
2. Only then `supabase link --project-ref pjcltrrixmuitgykhzbb && supabase db push`.

Reversed, the outage lasts until the deploy catches up. Dev went in that order
and came through clean.

Then link back, or the next push meant for dev lands on prod:
`supabase link --project-ref bydjoacdofhzfroegfmc`.

`supabase/seed.sql` only runs on a fresh or reset database — it will not retire
the columns, or seed anything, on an environment that already exists. That is
exactly why the migrations exist.

---

## Smaller, unscheduled

- **Vote buttons are under the touch-target guideline.** They render at 32px
  tall — shadcn's `h-8` default — against the usual 44px minimum. `size="lg"` is
  only 36px, so closing the gap means overriding the design system's default,
  which is a call worth making across the app rather than in the pairwise runner
  alone. Left over from the mobile voting-layout work.
- ~~Dark mode is unverified.~~ The `theme:` step in `scripts/drive.mjs` has now
  been exercised: the results screen, including `--success` deltas and the
  standings table, has been screenshotted in dark mode.
- ~~Four of the six indicators have never been seen rendered.~~ All six have now
  been screenshotted in light mode, driving the experiment with
  `scripts/drive.mjs`.
- **Promote to production** when staging has had a proper play: a `dev` → `main`
  PR **plus** the database step above. See _Pending database changes_ for the
  ordering — there is an unapplied column drop that must land after the deploy,
  not before it.
