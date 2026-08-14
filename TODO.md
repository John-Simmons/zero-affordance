# TODO

Next steps for the loading-perception experiment. Notes are here because most of
these touch more than the one-line summary suggests.

---

## 1. Remove the placeholder survey and experiment

Retire `srv_tech_habits` ("technology-habits") and `exp_button_affordance`
("button-affordance").

Wider than the seed files:

- `src/lib/data/seed.ts` **and** `supabase/seed.sql` — both mirrors
- **A migration** to delete the rows from environments that already ran the old
  seed. `db push` does not run `seed.sql`, so a seed edit alone leaves them live
  on dev and prod.
- `src/lib/data/mock.ts` — the synthetic baselines (`baselineChoice`,
  `baselineScale`, `baselineExperiment`) are keyed by those exact question and
  variant ids
- `src/lib/data/mock.test.ts` — several tests load those ids directly
- `src/features/experiments/experiment-runner.tsx` — `VariantStimulus`
  hard-codes the `solid` and `flat` cases

**Open question:** removing `button-affordance` leaves the entire rating-kind
path — `ExperimentRunner`, `assignVariant`, `recordInteraction`,
`aggregateExperiment`, the `experiment_interactions` table — with no consumer.
Keep it if another rating experiment is coming; otherwise delete it deliberately
rather than leaving it to rot.

Check the home page counts and the surveys index still read sensibly with one or
zero entries.

---

## 2. Fix the global navigation on mobile

`src/components/layout/site-header.tsx` — the `<nav>` is
`hidden items-center gap-1 sm:flex`, and nothing replaces it below `sm`. There
is no menu button, no drawer, no overflow menu.

**This is worse than a missing menu.** `src/components/layout/site-footer.tsx`
carries no links either, so on a phone the wordmark's link to `/` is the _only_
navigation in the entire app. Three of the four routes in `siteConfig.nav` —
`/surveys`, `/experiments`, `/about` — have no entry point at all. Anyone who
lands on an experiment from a shared link is stuck there.

Things to get right:

- **Reach for an installed primitive.** `drawer` is already here (added for the
  indicator preview, so `vaul` is paid for) and `dropdown-menu` has been here
  from the start. `sheet` — shadcn's canonical mobile nav, and a side panel
  rather than a bottom one — is **not** installed but needs no new dependency,
  being built on the Radix `dialog` already present. Any of the three beats
  hand-rolling (non-negotiable #1).
- **Closing on navigation is the classic bug.** A `NavLink` inside an overlay
  navigates without closing it, so the menu stays open over the new page. The
  control has to be driven with `onOpenChange` and closed on select.
- **Keep the active styling.** The desktop nav uses `NavLink`'s `isActive` to
  bold the current route; the mobile menu should say where you are too, not
  just list four links.
- **The trigger needs a name.** An icon-only button must carry an accessible
  label, and vaul warns if a drawer renders without a title.
- **`useMediaQuery` exists now** (`src/hooks/use-media-query.ts`) if a JS-side
  swap is wanted, but a CSS-only `sm:hidden` trigger beside the existing
  `hidden sm:flex` nav is simpler and needs no JS to stay in step. If the JS
  route is taken, `sm` is 40rem.

Verify with `scripts/drive.mjs` using the `size:` step at 390x844, checking that
every route in `siteConfig.nav` is reachable and that the menu closes behind you.

While in here: the vote-button touch-target note under _Smaller, unscheduled_
applies to a nav menu too — hit areas on a phone are the whole point.

---

## Pending database changes

Schema work on this branch has **not** been applied to any environment yet.
`supabase db push` is a separate step from the deploy — migrations do not travel
with the app.

Unapplied migration:

- `supabase/migrations/20260814000000_matchup_durations.sql` — drops
  `experiment_variants.base_duration_ms` and `.jitter_ms`. Durations moved to
  the matchup (`rollMatchupDurations` in `src/lib/data/aggregate.ts`), so
  nothing reads them any more.

**Order matters, and getting it wrong breaks production.** The migration drops
columns the _currently deployed_ Supabase adapter still names in its `select`.
Push it before the new code is live and every experiment page 500s on a request
for columns that no longer exist. So, per environment:

1. Deploy the code that stops selecting those columns.
2. Only then `supabase db push`.

Reversed, the outage lasts until the deploy catches up.

For dev/staging this is one link + push against the dev project; local and all
previews share that database, so it also unblocks anyone reviewing the branch.
For production it is the `dev` → `main` PR **first**, then
`supabase link --project-ref pjcltrrixmuitgykhzbb && supabase db push`.

`supabase/seed.sql` was updated to match, but note it only runs on a fresh or
reset database — it will not retire the columns on an environment that already
has them. That is exactly why the migration exists.

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
