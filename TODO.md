# TODO

Next steps for the loading-perception experiment. Notes are here because most of
these touch more than the one-line summary suggests.

---

## 1. Increase the lorem ipsum length

`src/features/experiments/loaded-content.tsx` — the article that arrives after
each loading state is a title, byline and two short paragraphs, sized back when
the canvas was `h-64`. The frame is now `h-112` (~412px during playback), so the
content leaves a lot of empty space below it.

**Coupled file:** `src/features/experiments/indicators/skeleton-loader.tsx`
mirrors this layout block for block, and that correspondence is the whole premise
of a skeleton screen. Edit both together, or the skeleton stops predicting what
actually arrives.

---

## 2. Show whether each matchup vote was right or wrong

After voting, tell the participant whether they picked the one that was actually
shorter — making it a perception game as well as a data-collection exercise.

The data already exists: `MatchInput` carries `durationAMs` and `durationBMs`, so
this is decidable client-side with no schema change.

**Decide first — what counts as correct for a "too close to call" vote?**
Durations differ by at most 400ms on a 2500ms base, and anything under roughly
125ms is below the just-noticeable difference for waits this long. A tie is often
the genuinely right answer. Options: correct when the gap is under a threshold,
always neutral, or never correct.

**Also worth thinking about:** does revealing the answer mid-run teach people to
game later matchups? That would bias the Elo data this experiment exists to
collect. Showing the verdict only at the end would avoid it, at the cost of the
moment-to-moment feedback that makes it fun.

---

## 3. Add a perception-accuracy score to the standings

A running tally — "you called 9 of 15 correctly". Depends on the same definition
as #2, so settle that first.

- Only meaningful for someone who played. Skippers have no matches, so omit it
  exactly as the per-variant deltas already are.
- **Frame it carefully.** A low score is the interesting result, not a failure —
  it is direct evidence that presentation beats duration, which is the
  hypothesis. Wording that reads as "you got these wrong" undersells the finding.
- No new data needed; the runner already keeps `myMatches` with both durations
  and the outcome.

---

## 4. Remove the placeholder survey and experiment

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

## Smaller, unscheduled

- **Dark mode is unverified.** `scripts/drive.mjs` has a `theme:` step that has
  never been exercised. The `--success` token and the logo's `currentColor` flip
  have only ever been seen in light mode.
- **Four of the six indicators have never been seen rendered** — only the
  skeleton, progress bar and blank have been screenshotted.
- **Promote to production** when staging has had a proper play: a `dev` → `main`
  PR **plus** `supabase link --project-ref pjcltrrixmuitgykhzbb && db push`.
  Migrations do not travel with the deploy.
