# Contributing & development workflow

Solo-friendly workflow with real guardrails: production data is never touched by
local dev or previews.

## Environments

| Environment | Git branch         | Supabase project    | URL                          |
| ----------- | ------------------ | ------------------- | ---------------------------- |
| Production  | `main` (protected) | prod                | https://www.zeroaffordance.com |
| Staging     | `dev`              | dev                 | https://staging.zeroaffordance.com |
| PR previews | `feat/*` (via PR)  | dev                 | per-deployment `*.vercel.app` |
| Local       | working copy       | dev                 | http://localhost:5173        |

Only **Production** reads/writes the prod database. Local dev, the `dev` branch, and
all PR previews use the **dev** Supabase project (via Vercel's Preview-scoped env vars
and your local `.env.local`).

## Branching model

```
feat/my-change  →  PR  →  dev  (auto-preview on dev DB)  →  PR  →  main  (production)
```

- Never commit directly to `main` (branch protection blocks it; open a PR).
- `dev` is the integration/staging branch — merge features here first and verify on
  `staging.zeroaffordance.com` before promoting to `main`.

## Local setup

```bash
nvm use                 # Node 20
pnpm install
cp .env.example .env.local   # then fill in the DEV Supabase URL + anon key
pnpm dev                # http://localhost:5173  (footer shows "Supabase")
```

`.env.local` must point at the **dev** project, never prod. It's gitignored.

## Everyday checks (what CI runs)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) runs these on every PR and on pushes to `main`/`dev`.
The build is hermetic — it falls back to the mock provider when Supabase env vars are
absent, so no secrets are needed in CI.

## Database schema changes (Supabase migrations)

Migrations in `supabase/migrations/` are the source of truth. Never hand-edit tables in
the dashboard for schema changes — write a migration so every environment stays in sync.

```bash
pnpm supabase login                         # one-time, interactive

# create a new migration file, edit the generated SQL
pnpm supabase migration new add_something

# apply to DEV, test on staging, then apply to PROD
pnpm supabase link --project-ref <dev-ref>
pnpm supabase db push
# ...verify on staging.zeroaffordance.com...
pnpm supabase link --project-ref pjcltrrixmuitgykhzbb   # prod
pnpm supabase db push
```

`supabase/seed.sql` holds the starter survey/experiment definitions (safe to re-run —
uses `on conflict do nothing`).

## Deploys

Vercel auto-deploys: pushes to `main` → production; `dev` → staging; PRs → preview URLs.
No manual deploy step.

## Security notes

- Only the Supabase **anon/publishable** key goes in `VITE_*` vars (client bundles are
  public; it's protected by RLS). **Never** expose the `service_role` key.
- Keep `.env.example` updated when adding new env vars.
