# Project conventions

Companion site to the Zero Affordance YouTube channel (UX / HCI / psychology).
Vite + React + TypeScript SPA, shadcn/ui, Supabase behind an abstraction.

## Non-negotiables

1. **shadcn-first UI.** Build from the primitives in `src/components/ui`. Add new
   ones with `pnpm dlx shadcn@latest add <name>` rather than hand-rolling styled
   elements. Only write bespoke components when nothing in the system fits, and
   compose them from `ui` primitives + Tailwind.
2. **Never import Supabase (or any backend) from components.** All data access
   goes through the React Query hooks in `src/lib/data/hooks.ts`, which delegate
   to the `DataProvider` contract (`src/lib/data/provider.ts`). New data
   operations = add a method to `DataProvider`, implement it in every adapter
   (`mock.ts`, `supabase.ts`), then expose a hook.
3. **Keep adapters behaviour-identical.** Shared, backend-agnostic logic (e.g.
   aggregation) lives in pure modules like `src/lib/data/aggregate.ts` and is
   reused by every adapter.
4. **Path alias `@/`** maps to `src/`. Use it for all intra-src imports.

## TypeScript notes

- `verbatimModuleSyntax` is on → use `import type { … }` for type-only imports.
- `erasableSyntaxOnly` is on → **no `enum`s / namespaces**. Model closed sets as
  string-literal unions + `const` maps (see `types.ts`).
- Strict unused checks are on (`noUnusedLocals` / `noUnusedParameters`).

## Where things live

```
src/
  components/ui/     shadcn primitives (generated)
  components/layout/ header, footer, container, theme toggle
  features/          feature UIs (surveys/, experiments/)
  routes/            page components (one per route) + root-layout
  router.tsx         route table
  providers/         theme + query providers (compose in app-providers.tsx)
  hooks/             cross-feature React hooks (feature-specific ones stay put)
  lib/data/          the data abstraction (see README)
  config/site.ts     site name, nav, external links
```

## Backend

Runs on the localStorage mock with no config. Supabase turns on automatically
when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set. Schema + seed live
in `supabase/`; schema changes go through **migrations** (`supabase/migrations/`),
applied with the `supabase` CLI — never hand-edit tables for schema changes.

## Branching & environments

`main` = production (protected), `dev` = staging. Flow: `feat/*` → PR → `dev` →
PR → `main`. Local dev, `dev`, and all previews use the **dev** Supabase project;
only production uses prod. Full details in `CONTRIBUTING.md`.

## Before committing

`pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`
should all pass (CI runs the same on every PR). `pnpm format` fixes the
formatting failures.
