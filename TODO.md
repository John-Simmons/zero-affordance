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

## 2. Change the mobile nav menu location

The menu works but sits on the wrong side. `MobileNav` is currently the last
child of the header's right icon cluster in
`src/components/layout/site-header.tsx`, and its sheet is `side="right"`.

Wanted: the hamburger as the **first** child of the `Container` row, before the
wordmark, with the sheet opening from the **left** — the near-universal mobile
convention, and it keeps the trigger and the panel on the same edge.

- Both halves live in `src/components/layout/mobile-nav.tsx`; moving the
  `<MobileNav />` element in the header and flipping `side="left"` is the whole
  change. `sm:hidden` is on the trigger button itself, so it travels with it.
- **Optical alignment will need a nudge.** `Container` is `px-4`, and a ghost
  icon button carries its own padding, so the glyph will read inset from the
  gutter the wordmark currently sits on. Expect a small negative margin
  (`-ml-1.5`ish); confirm against a screenshot rather than by eye in code.
- The wordmark shifts right by roughly the button's width. Check the header
  still breathes at 320px, where "Zero Affordance" is already close to the
  YouTube and theme buttons.
- `site-header.test.tsx` queries by role and accessible name, not by position,
  so the existing tests should survive the move — but they are the proof, so
  re-run them rather than assuming.
- Verify at 390x844 with `scripts/drive.mjs`. Note its `click:TEXT` step cannot
  press this trigger: the step matches on `textContent` and an icon-only button
  named by `aria-label` has none. Drive it with
  `eval:document.querySelector('[aria-haspopup=dialog]').click()` — that
  selector is unique to this trigger, since the theme toggle is
  `aria-haspopup="menu"`.

---

## 3. Add a video topic survey

A survey covering two things: which video topics people actually want, and
enough demographics to say who "people" were. Deliberately a mix of question
types — `multiple_choice`, `scale` and `text` are all supported end to end by
`src/features/surveys/survey-runner.tsx` and `survey-results.tsx`, so this is
seed data and copy, not new UI.

Wider than it looks:

- `src/lib/data/seed.ts` **and** `supabase/seed.sql` — both mirrors, as always.
- **A migration.** `seed.sql` only runs on a fresh or reset database, so a seed
  edit alone leaves dev and prod without the survey. Same lesson as the duration
  column drop.

Two things to decide before writing the questions:

- **Free text is barely aggregated.** `aggregateSurvey` keeps
  `.slice(-5).reverse()` — the five most recent answers — and then reports
  `total: textSamples.length`, so a text question with four hundred responses
  displays a total of 5. That is fine for a pull-quote and useless for ranking
  suggested topics or summarising an open-ended demographic. If free text needs
  to be countable, that is aggregation work in `src/lib/data/aggregate.ts`, not
  something the seed can fix.
- **Demographics versus the anonymity promise.** `src/routes/about.tsx` states
  "Nothing requires an account; participation is anonymous". Demographic
  questions should not quietly erode that: `required` is opt-in per question, so
  leave them optional, and give choice questions a "prefer not to say" option.
  Enough narrow demographics combined can identify someone even without a name.

Sequencing: item 1 retires the placeholder survey `srv_tech_habits`. Land this
one first, or the surveys index is empty in between.
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
