# Zero Affordance

Companion website to the **Zero Affordance** YouTube channel — interactive
surveys and experiments about UX design, human–computer interaction, and
psychology. Built as a Vite + React SPA with a backend-agnostic data layer: it
runs fully offline against a local mock, and switches to Supabase the moment
credentials are provided.

## Stack

| Concern      | Choice                                       |
| ------------ | -------------------------------------------- |
| Framework    | Vite + React + TypeScript (SPA)              |
| UI           | shadcn/ui + Tailwind v4 (Radix primitives)   |
| Routing      | React Router (data router)                   |
| Server state | TanStack Query                               |
| Backend      | Supabase — behind a `lib/data` abstraction   |
| Charts       | Recharts (via shadcn `chart`)                |
| Forms        | React Hook Form                              |
| Hosting      | Vercel (SPA rewrite in `vercel.json`)        |
| Tooling      | oxlint · Prettier · Vitest + Testing Library |

Requires **Node 20+** (see `.nvmrc`). This repo uses **pnpm**.

## Getting started

```bash
nvm use            # Node 20
pnpm install
pnpm dev           # http://localhost:5173
```

With no environment variables set, the app uses the **local mock provider**
(localStorage) — surveys and experiments work and persist immediately, no
backend required. The footer shows which data source is active.

## Scripts

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | Start the dev server                     |
| `pnpm build`     | Type-check (`tsc -b`) + production build |
| `pnpm preview`   | Preview the production build             |
| `pnpm typecheck` | Type-check only                          |
| `pnpm lint`      | oxlint                                   |
| `pnpm format`    | Prettier write                           |
| `pnpm test`      | Vitest run                               |

## Connecting Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` then `supabase/seed.sql` in the SQL
   editor (or `supabase db push` with the CLI).
3. Copy `.env.example` → `.env.local` and fill in:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

4. Restart `pnpm dev`. The app now reads/writes Supabase — **no component
   changes needed**. Aggregate charts update in realtime via Supabase channels.

## Architecture: the data layer

The core design goal is **flexibility to change the backend later**. Components
and hooks never talk to Supabase directly — they depend on a typed contract:

```
src/lib/data/
  types.ts       Domain model (Survey, Experiment, aggregates, …)
  provider.ts    DataProvider interface — the single seam
  aggregate.ts   Pure aggregation shared by every adapter
  mock.ts        localStorage adapter (default, offline, tests)
  supabase.ts    Supabase adapter
  index.ts       getDataProvider() — picks an adapter from env
  hooks.ts       React Query hooks used by the UI
```

To move to a different backend, write one new file implementing `DataProvider`
and wire it in `index.ts`. Nothing else changes.

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <component>
```

Components land in `src/components/ui`. **Build UI from these primitives** — see
`CLAUDE.md` for conventions.

## Deploying to Vercel

Import the repo in Vercel (framework preset: Vite). Add the `VITE_SUPABASE_*`
env vars. `vercel.json` already rewrites all paths to `index.html` so client-side
deep links work on refresh.
