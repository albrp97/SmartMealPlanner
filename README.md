# SmartMealPlanner

> Personal, mobile-first meal planning, recipe costing and macro tracking
> with auto-balanced daily targets. Pick your recipes, pick how many
> "hero packs" to cook, and the planner adjusts side ingredients so kcal
> + protein + carbs + fat all land on your goal.

[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://smart-meal-planner-iota.vercel.app/)
[![Database: Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E)](https://supabase.com)
[![Stack: Next.js](https://img.shields.io/badge/Stack-Next.js%2016-000000)](https://nextjs.org)

Live at **https://smart-meal-planner-iota.vercel.app/**.

---

## What it does

Cooking decisions take time every day:

- *What do I eat today?*
- *Will it hit my calorie + macro target?*
- *How many days of food does one cook last me?*
- *What do I need to buy and in what package sizes?*
- *How much will it cost?*

SmartMealPlanner answers all of that from a single phone-friendly web app.

---

## Core features

| Feature | Description |
|---|---|
| **Recipe library** | ~20 recipes grouped by category. Per recipe: ingredients with `hero` / `side` / `fixed` roles, batch size, kcal/macros per serving, micronutrient RDA bars, cost band. |
| **Ingredient catalogue** | ~50 ingredients with package size, current Lidl Prague price, OpenFoodFacts-backed nutrition + micros. Each price tagged `def` (seed default) or `real` (manually updated from a ticket). |
| **Hero-pack planner** | `/plan` is a flat single-page planner — pick a lunch + dinner recipe and a hero-pack count (one chicken pack, one minced-chicken pack, one tuna can …). Servings cooked, per-serving macros and the shopping list all derive from that single number. |
| **Auto-balance to goal** | Maintain · Cut · Bulk pills target real macro splits (50/20/30 → 45/25/30 on cut). The planner solves three scalars (sP, sC, sF) for protein/carb/fat side ingredients and adjusts the hero quantity per cook so every macro lands on target — typically within ±3 % across all goals. |
| **Recipe recommendations** | A panel under the planner ranks the rest of the catalogue per slot: penalises same-category / same-hero clashes against the other slot, and rewards goal-fit (high protein-per-kcal on cut, calorie-dense on bulk). One click swaps the suggestion in. |
| **Per-goal recipe overrides** | Edit a recipe's cut / maintain / bulk quantities per ingredient (drop cheese on cut, bump rice on bulk). Stored sparsely in `recipe_ingredient_overrides`. |
| **Shopping list** | Aggregated across the planned cooks. Non-divisible items round up to whole packs (one onion, one tortilla pack); divisible items (rice, chicken, oils) charge proportionally. Total in CZK. |
| **PWA-ready** | Mobile-first Tailwind layout. Installable as a PWA pending Serwist wiring. |

---

## User profile (defaults)

| Field | Value |
|---|---|
| Sex | Male |
| Year of birth | 1997 |
| Height | 1.81 m |
| Weight | 70 kg |
| Training | Calisthenics |
| Activity factor | 1.55 (Mifflin-St Jeor) |

Daily goal targets (in [`src/lib/goals.ts`](src/lib/goals.ts)):

| Goal | kcal | Protein | Carbs | Fat |
|---|---|---|---|---|
| Maintain | 2640 | 132 g (20 %) | 330 g (50 %) | 88 g (30 %) |
| Cut (-15 %) | 2240 | 140 g (25 %) | 252 g (45 %) | 75 g (30 %) |
| Bulk (+10 %) | 2900 | 145 g (20 %) | 363 g (50 %) | 97 g (30 %) |

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | **Next.js 16** (App Router, Turbopack) · React 19 · TypeScript 5.9 · **Tailwind 4** |
| UI | Hand-rolled primitives in `src/components/ui/*` |
| Backend | Server Actions (mutations) + RSC (reads) |
| ORM | **Drizzle 0.45** (schema source of truth) |
| DB | **Supabase Postgres** (free tier) — RLS-ready |
| Hosting | **Vercel Hobby** — auto-deploy from `main` |
| Lint + format | **Biome** (Rust) |
| Testing | **Vitest 2** (unit + integration + dev-server smoke) |
| Env validation | `@t3-oss/env-nextjs` |

LLM-based receipt OCR was on the original roadmap and has been **dropped**
— prices and recipe edits are manual, see [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) §4.

---

## How the auto-balancer works

1. Pass 1 builds the day's recipes at scale=1 and measures each macro
   class's daily contribution (P / C / F).
2. The solver picks three scalars by minimising a weighted least-squares
   error across (kcal, P, C, F). Solver is bounded coordinate descent —
   converges fast, can't blow up.
3. Pass 2 rebuilds the recipes with the scalars applied to side
   ingredients and passes `heroFactor` to the portion engine so the hero
   protein quantity is also tuned (without inflating the number of
   servings cooked).

Result: any combination of two recipes lands within a few percent of the
selected goal's targets without touching ingredient quantities by hand.

---

## Quickstart

Requires **Node 22+** and **pnpm 9+** (`corepack enable && corepack prepare pnpm@9 --activate`).

```bash
git clone https://github.com/albrp97/SmartMealPlanner.git
cd SmartMealPlanner
cp .env.example .env.local        # NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (+ SERVICE_ROLE_KEY to seed)
pnpm install
pnpm dev                          # http://localhost:3000 (Turbopack)
```

Database setup (one-off):

1. Create a free Supabase project, copy URL + anon key + service-role key
   into `.env.local`.
2. Open the **SQL Editor** in the Supabase dashboard, paste each file
   under [`migrations/`](migrations/) in order, and Run.
3. `pnpm db:seed` — populates ingredients, recipes and prices from
   `seed/*.json`.

Common scripts:

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server with Turbopack HMR. |
| `pnpm build` | Production build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` / `pnpm format` | Biome. |
| `pnpm test` | Vitest run (unit + non-gated integration). |
| `pnpm db:seed` | Idempotent seed of ingredients/recipes/prices. |
| `pnpm db:backfill-units` | Fill in `g_per_unit` / `density_g_per_ml` for produce. |
| `pnpm db:backfill-nutrition` | OpenFoodFacts lookup for missing kcal/macros. |
| `pnpm db:backfill-micros` | OpenFoodFacts lookup for missing micros. |

Behind a corporate proxy (Zscaler / TLS interception):

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

Deploy:

```bash
vercel link
vercel env pull
vercel --prod
```

---

## Roadmap

See [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) for the full status,
testing strategy and the next-up work (plan-page decongestion, in-page
recommendation system, override-aware balancer).

## License

MIT — personal project, do whatever you want.
