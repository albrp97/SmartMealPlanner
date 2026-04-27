# SmartMealPlanner — Developer Guide

Working reference for the people building and operating this app. **Read
this first** if you're picking it back up after a break or onboarding a
collaborator. Updated 2026-04-25.

---

## 0. Conventions

- **Language:** TypeScript everywhere (frontend, Server Actions, Route
  Handlers, scripts). No `any`.
- **Runtime / pkg mgr:** Node 22 + **pnpm 9** (lockfile committed; npm/yarn
  forbidden).
- **Style:** **Biome** (lint + format) — single Rust binary, replaces ESLint
  + Prettier. Enforced on CI.
- **Type safety:** Drizzle (DB) + Zod (boundaries) + `@t3-oss/env-nextjs`
  (env vars).
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/).
- **Branching:** trunk-based — short-lived feature branches → PR → `main`
  → auto-deploy on Vercel.
- **Secrets:** `.env.local` locally, Vercel + GitHub Secrets in CI/prod.
  Never committed.

### Stack snapshot

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) · React 19 · TS 5.9 · Tailwind 4 |
| Hand-rolled UI primitives | `src/components/ui/*` (Button, Card, Input, …) — no shadcn CLI |
| Backend | Server Actions for mutations, RSC for reads, RLS on Supabase Postgres |
| ORM | Drizzle 0.45 (schema source of truth) |
| DB | Supabase Postgres (free tier) |
| Hosting | Vercel Hobby — auto-deploy from `main` |
| Tests | Vitest 2 (unit + integration) — Playwright is pencilled in but not wired |
| Lint/format | Biome |
| LLM | **Removed.** Receipt OCR was on the roadmap; we dropped it. All catalogue, price and recipe edits are manual now. |

---

## 1. Repository layout

```
SmartMealPlanner/
├── DEVELOPER_GUIDE.md           ← you are here
├── README.md
├── .env.example
├── biome.json · drizzle.config.ts · vitest.config.ts · tsconfig.json
├── migrations/                  # SQL migrations (apply via Supabase SQL Editor)
├── seed/
│   ├── recipes.json             # original WhatsApp dump, English-translated
│   └── prices.json              # Lidl Prague pack sizes + prices
├── scripts/                     # one-off node scripts (seed, backfills)
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── recipes/             # /recipes, /recipes/new, /recipes/[slug], /recipes/[slug]/edit
│   │   ├── ingredients/         # /ingredients (+ new/edit)
│   │   └── plan/                # /plan — the daily planner + auto-balance
│   ├── components/ui/           # Button, Card, Input, Label, …
│   └── lib/
│       ├── db/                  # Drizzle schema + Supabase clients
│       ├── env.ts               # @t3-oss/env-nextjs schema
│       ├── nutrition.ts         # per-recipe macro engine
│       ├── units.ts             # g/ml/unit conversions
│       ├── cost.ts              # consumed vs shopping cost
│       ├── portion.ts           # pack-driven serving optimiser (heroFactor)
│       ├── plan-portion.ts      # plumbing between recipe rows + portion engine
│       ├── macro-balance.ts     # 3-scalar P/C/F auto-balancer
│       ├── recipe-overrides.ts  # per-goal cut/bulk quantity overrides
│       ├── goals.ts             # kcal + macro targets per goal
│       └── rda.ts               # micronutrient RDAs
└── tests/
    ├── unit/                    # pure-function tests (run by default)
    └── integration/             # live-DB or live-server tests (gated by SMOKE / env)
```

---

## 2. Local development

Prereqs: Node 22, **pnpm 9** (`corepack enable && corepack prepare pnpm@9 --activate`).

```bash
git clone https://github.com/albrp97/SmartMealPlanner.git
cd SmartMealPlanner
cp .env.example .env.local       # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (+ SERVICE_ROLE_KEY to seed)
pnpm install
pnpm dev                         # http://localhost:3000 (Turbopack)
```

### Behind a corporate proxy (Zscaler / TLS interception)

Every Node command needs the corporate CA bundle:

```bash
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

Common pattern in this repo:

```bash
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt pnpm test
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt pnpm typecheck
```

Direct Postgres on port 5432 is also blocked by Zscaler (resolves to IPv6
only) — see §3 for the migration workflow we use instead.

### Useful scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server with Turbopack HMR. |
| `pnpm build` | Production build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | Biome lint + format check. |
| `pnpm format` | Biome auto-format. |
| `pnpm test` | Vitest run (unit + non-gated integration). |
| `pnpm db:generate` | Regenerate SQL migration from `src/lib/db/schema.ts`. |
| `pnpm db:seed` | Idempotent seed of ingredients/recipes/prices from `seed/*.json`. |
| `pnpm db:backfill-units` | Fill in `g_per_unit` / `density_g_per_ml` for produce/dairy. |
| `pnpm db:backfill-nutrition` | OpenFoodFacts lookup for missing kcal/macros. |
| `pnpm db:backfill-micros` | OpenFoodFacts lookup for missing micros. |

Smoke tests against the live dev server (with the dev server running):

```bash
SMOKE=1 NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
  pnpm vitest run tests/integration/plan-macro-balance-smoke.test.ts \
                  tests/integration/plan-autoscale-smoke.test.ts
```

---

## 3. Database workflow

### Migration workflow (corp network workaround)

Direct Postgres is blocked, so we don't run `drizzle-kit push` locally.
Instead:

1. Edit [`src/lib/db/schema.ts`](src/lib/db/schema.ts).
2. `pnpm db:generate` → produces a new SQL file in `migrations/`.
3. Open Supabase Dashboard → **SQL Editor** → paste the SQL → **Run**.
4. Commit the generated SQL so the next dev / production sees the same
   history.

### Manual data edits via service role

For one-off DB patches (renaming an ingredient, fixing a recipe quantity,
adding a price) write a throwaway Node script that uses the service-role
key:

```js
// _patch.mjs (gitignored — delete after running)
import { createClient } from '@supabase/supabase-js';
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: r } = await s.from('recipes').select('id').eq('slug', 'japanese_curry').single();
const { data: ing } = await s.from('ingredients').select('id').eq('slug', 'chicken').single();
await s.from('recipe_ingredients')
  .update({ quantity: 1000, unit: 'g' })
  .eq('recipe_id', r.id).eq('ingredient_id', ing.id);
```

Run with: `set -a && source .env.local && set +a && node ./_patch.mjs`.
Always include a verification `select` at the end. Delete the script
afterwards (or move under `scripts/` only if it's reusable).

The `recipe_ingredients` table doesn't have anon UPDATE RLS — patch
scripts must use the service-role client. For inserts on
`recipe_ingredient_overrides` either client works.

### Why we have `migrations/` *and* `_patch.mjs`

- **`migrations/`** — schema changes (new tables, new columns, RLS rules).
  Replayable, version-controlled, applied to every environment.
- **`_patch.mjs`** — data fixes for **this** database (a recipe's
  quantities, a price update). Equivalent to manually editing rows in the
  Supabase UI; not replayable, not committed.

If a data fix turns out to be reusable (e.g. a yearly price refresh), move
it to `scripts/` and add an entry under [§2 useful scripts](#useful-scripts).

---

## 4. Recipe & ingredient authoring

This section is the operating manual for **manually** keeping the catalogue
healthy. The receipt-OCR + LLM ingestion plan was scrapped — every change
goes through one of the paths below.

### 4.1 Adding or editing an ingredient

UI: `/ingredients/new` or `/ingredients/[id]/edit`. Required fields:

| Field | Notes |
|---|---|
| `slug` | snake_case, English. Used in code and joins. Don't change once set. |
| `name` | Free-form. Matches what you'd write on a recipe card. |
| `category_id` | One of the built-in categories. |
| `package_size` + `package_unit` | What one whole pack is. Drives the cost engine. |
| `package_price` + `currency` | Default CZK. Update by hand from your last shopping ticket. |
| `kcal_per_100g` + `protein/carbs/fat/fiber_per_100g` | Per 100 g/ml. Use the **Lookup nutrition** button to autofill from OpenFoodFacts. |
| `g_per_unit` | Required for ingredients sold by `unit`. Average weight of one piece (avocado ≈ 200 g, onion ≈ 150 g, tortilla wrap ≈ 50 g). |
| `density_g_per_ml` | Required for ingredients sold/measured in `ml` (cream 1.01, milk 1.03, oil 0.915). |
| `divisible` | **True** if you can portion mid-week without spoilage (raw meat, rice, pasta, oils, milk in cartons). **False** for anything that goes off once opened or that physically can't be split (onions, eggs, cheese bag, beans tin, peppers, stock cubes, tortilla pack). |
| `is_supplement` | True only for GymBeam SKUs measured per-scoop. Bypasses g-conversion. |
| `micros_per_100g` (JSON) | Sparse — only the micros OpenFoodFacts gave us. Edit by hand if you have better data. |

**Why divisibility matters:** it gates two things in the planner.
1. The **shopping list** rounds non-divisibles up to whole packs.
2. The **portion engine** rounds non-divisible side lines that are measured
   in `unit` to integer counts (you can't cook with 0.33 of an onion or
   4.2 tortillas).

### 4.2 Adding or editing a recipe

UI: `/recipes/new` or `/recipes/[slug]/edit`. The form has an embedded
ingredient editor — add/remove rows, set `quantity` + `unit` + `role`.

**Quantity convention (hard rule).** Quantities in `recipe_ingredients`
are for the **whole cook** (the batch), not per plate. A 4-serving curry
stores 1000 g of chicken once, not 250 g per serving. Per-serving values
are computed at render time by dividing by `recipes.servings`.

**Roles.** Every line gets a `role`:

- `hero` — the protein anchor. Drives sizing and the hero-packs counter on
  `/plan`. Exactly one per recipe.
- `side` — scales linearly with the hero (rice with the curry, pasta with
  the meat sauce). The auto-balancer is allowed to scale these.
- `fixed` — stays at recipe default regardless of batch (1 onion, 1 stock
  cube, 1 cheese bag, 6 tortillas). Non-divisible side ingredients
  measured in `unit` are auto-rounded to whole numbers at cook time.

**Sensible recipe shape (lessons learned):**

- Pick a **batch size that lines up with one full hero pack.** Chicken
  comes in 1 kg packs, so a chicken curry should default to 4 servings of
  250 g (or one full pack). Don't make a "100 g chicken / 1 serving"
  recipe — when the user picks 1 hero pack you'll either cook 10 servings
  of curry (absurd) or carry around fractional packs.
- Sides scale **with** the hero. If you 4× the chicken, the rice should
  4× too. Express side amounts in grams per default-batch (e.g.
  "320 g rice for 4 servings", not "80 g per serving").
- Fixed lines are absolute. "1 onion" stays 1 onion whether you cook 4 or
  16 servings. If the recipe really needs more onion at scale, change the
  role to `side` and express the per-batch amount.
- **Don't put fractional non-divisible quantities** like `0.5 onion` or
  `0.3333 bell_pepper` on a fixed line. Either round up to 1 in the
  recipe, or change the role to `side` so it scales.

After saving a recipe, smoke-test it: open `/plan`, plan one cook of the
recipe, verify the per-serving macros and the shopping list look sane.

### 4.3 Per-goal cut/bulk overrides

UI: `/recipes/[slug]` → **Cut · Maintain · Bulk** editor. Rewrites a single
ingredient's quantity for a specific goal. Three semantics:

- Empty input on cut/bulk → `DELETE` the override (revert to maintain).
- `0` → keep the override and *drop the line* at that goal (no cheese on
  cut, no avocado on cut).
- Any other number → use that quantity at that goal.

Maintain edits write back to the baseline `recipe_ingredients.quantity`.

> **Phase 3.8 caveat.** The macro auto-balancer on `/plan` currently
> ignores `recipe_ingredient_overrides`. The override editor is wired and
> persists to the DB, but the planner's macro pipeline rebuilds quantities
> from the baseline + the per-class scalars. If you need cut to behave
> differently (e.g. less olive oil at breakfast), edit the maintain
> baseline or add the missing wiring (see §7.2).

### 4.4 Updating prices manually

When you do a real shop, open `/ingredients` and click each ingredient
that's now cheaper / more expensive. Update `package_price`. The page
shows a `def`/`real` badge so you can see at a glance which prices are
still seed defaults.

For bulk price updates, write a `_patch.mjs` (see §3).

### 4.5 Daily breakfast

`breakfast_daily` is a special recipe — it's pinned ×7 days and treated as
a constant per-day macro contribution by the auto-balancer. Its lines are
NEVER scaled. Currently includes:

- 40 g oatmeal · 30 g cashews · 30 g cranberries · 30 g raisins
- 130 g yogurt 3.9 % · 30 ml milk
- 30 g whey protein · 5 g creatine
- **30 ml olive oil (≈ 2 tbsp)** — covers the daily oil intake
- multivitamin · omega-3 · D3+K2 · magnesium

The 2 tbsp olive oil contributes ~27 g fat / 247 kcal — significant. On
cut goal, fixed breakfast macros use up over half of the 75 g fat target,
which is why the smoke test allows ±25 % drift on fat (vs ±5 % for the
other macros). If you want cut breakfast to be leaner, either edit the
maintain baseline directly or implement §7.2 (rewire overrides into the
balancer).

---

## 5. Current state by module

### 5.1 `/recipes` and `/recipes/[slug]`

- Recipes list grouped by category. Per row: kcal/serving, batch total,
  cost band (consumed → shopping).
- Detail page shows ingredients with quantities, the cost block, the macro
  block (kcal · P · C · F · fibre per serving), the micronutrient RDA
  bars (EU NRV from `src/lib/rda.ts`), and the **goal quantities editor**
  (cut · maintain · bulk per ingredient).

### 5.2 `/ingredients`

- Catalogue table with search. Click through to edit. Shows price
  defaults vs real-from-ticket prices via the `def`/`real` badge.

### 5.3 `/plan` — the meal planner

Single page, no calendar. Renders four sections:

1. **Goal pills** (Maintain · Cut · Bulk) — plain `<a>` links. Clicking
   triggers a hard nav so the RSC payload is rebuilt.
2. **Lunch** + **Dinner** rows. Each row = a recipe pick + a hero-packs
   counter. Auto-saves via Server Actions in
   [`src/app/plan/actions.ts`](src/app/plan/actions.ts).
3. **Recommendation panel** (Phase 3.9) — two columns, one per slot.
   The page builds a single ranked list of 6 candidates via
   [`src/lib/recommend.ts`](src/lib/recommend.ts) (variety-penalised
   against *both* slots' current picks, not just one) and then
   **interleaves** them into the columns — even-indexed candidates go to
   lunch, odd-indexed to dinner. This guarantees the two columns are
   disjoint *and* both get a mix of high- and mid-ranked picks rather
   than "top-half / bottom-half". Click "use as lunch / dinner" to swap
   the suggestion in via `swapOrAddPlanEntry` (replaces the slot's first
   entry, or adds a fresh one if the slot is empty).
4. **Shopping list** (right column on desktop, below on mobile).
   Aggregated across all rows; rounds non-divisibles up to whole packs.

The **macro auto-balancer** (Phase 3.8) runs on every render:
- Pass 1: build recipes at scales=1, measure per-class daily contributions
  (P / C / F).
- Solve a bounded LSQ for three scalars (sP, sC, sF) clamped to [0, 4]
  using coordinate descent.
- Pass 2: rebuild recipes with the scalars applied to side lines, and
  pass `heroFactor = clamp(scales[heroClass], 0.5, 1.75)` to
  `scalePortion` so the hero quantity is tuned without changing servings.

The header shows the chosen scalars: `auto-balance · protein ×1.40 · carbs
×0.68 · fat ×0.72 [· clamped]`.

### 5.4 Auto-balancer math (`src/lib/macro-balance.ts`)

- `classifyIngredient(ing)` → `"P" | "C" | "F" | null`. Picks the macro
  with the highest kcal contribution per gram (P×4, C×4, F×9). Returns
  null for nutrition-less items (salt, water, missing data).
- `computeMacroScales({breakfastDaily, entries, target})` → returns
  `{scales: {P, C, F}, clamped, fallback}`.
- Objective: minimise `Σ wᵢ (target_i - predicted_i)²` where `i ∈ {kcal, P,
  C, F}`. Weights tuned so a 100 kcal miss costs roughly the same as an
  8 g protein miss (`WEIGHTS = {kcal: 1/100, protein: 1/8, carbs: 1/30, fat: 1/12}`).
- Solver: **bounded coordinate descent**. For each class, find the optimal
  scalar holding the others fixed (closed-form for a single variable),
  clamp to `[0, 4]`. Always converges (convex quadratic on a box).

### 5.5 Portion engine (`src/lib/portion.ts`)

- `scalePortion(recipe, heroQuantity, heroFactor=1)` →
  `{servings, heroLineIndex, scaled, feasible, reasons}`.
- `heroQuantity` is in the hero line's recipe unit (g for divisible meat,
  unit for non-divisible heroes).
- Servings = `heroQuantity / heroPerServing`, rounded for non-divisible
  heroes.
- `heroFactor` (default 1) multiplies the hero's quantity AFTER servings
  are derived. Used by the macro balancer to ask for "more chicken per
  cook" without making the cook last more days.
- Side lines scale linearly. Fixed lines stay at recipe default. Both are
  rounded to whole numbers when the ingredient is non-divisible and
  measured in `unit`.

---

## 6. Testing

| Layer | Tool | Notes |
|---|---|---|
| Unit | Vitest | Pure functions in `src/lib/*`. Always run in CI. |
| Integration (live DB) | Vitest + Supabase service-role | Gated by `URL_` + `SERVICE` env vars; skipped without them. |
| Smoke (live dev server) | Vitest | Gated by `SMOKE=1`. Requires `pnpm dev` running. |
| E2E | — | Playwright is configured but no specs yet. |

Current count (2026-04-25): **74 unit/integration passing, 7 skipped**.

CI gates (GitHub Actions, see `.github/workflows/`):
1. `biome ci` (lint + format)
2. `tsc --noEmit`
3. `pnpm test` (unit + non-gated integration)
4. `pnpm build`

The macro-balance smoke test uses **±40 %** tolerance across all four
macros (kcal, protein, carbs, fat); the auto-scale smoke uses **±25 %**
on kcal. Both are deliberately loose because the macro balancer can only
scale **side** ingredients — fixed lines (puff pastry, tortilla packs,
stock cubes, breakfast olive oil + nuts + yogurt) are locked. On any
plan that includes a fat-heavy fixed line (e.g. chicken_pie's 2 puff
pastries contribute ~150 g fat for the batch alone) the balancer simply
can't drag fat down to the goal target. Tightening these tolerances
needs the per-goal override pipeline (§7.2 → done) actually populated
with overrides on the heavy fixed lines (§4.3 manual workflow).

If you want a tight smoke check, run it against a plan composed of
recipes with all-class side coverage (e.g. `chicken_risotto` with rice +
cream sides). Even then, breakfast fat alone uses up ~40 g of fixed fat
which the balancer can't touch.

---

## 7. Roadmap & known limitations

Legend: **[done]** shipped to `main` · **[next]** the work-in-progress
slot · **[idea]** captured but not started.

This is the **closing roadmap** — no new features beyond what's listed
below. The remaining work is finishing scope, not expanding it.

| # | Topic | Status |
|---|---|---|
| 7.1 | Recommendation panel under planner | **[done]** (3.9) |
| 7.2 | Rewire per-goal overrides into the macro balancer | **[done]** (3.10) |
| 7.3 | Daily micronutrient roll-up on `/plan` | **[done]** (3.12) |
| 7.4 | Recipe baseline audit (all ~20 recipes) | **[next]** |
| 7.5 | Investigate "puff pastry shows 0.0 unit" rendering bug | **[next]** |
| 7.6 | UI rework pass | **[next]** |
| 7.7 | Deployment / architecture final touches | **[next]** |
| 7.8 | Things explicitly NOT building (LLM/OCR + dropped features) | locked |

### 7.1 Recommendation system **[done — Phase 3.9]**

[`src/lib/recommend.ts`](src/lib/recommend.ts) +
[`src/app/plan/recommendation-panel.tsx`](src/app/plan/recommendation-panel.tsx) +
`swapOrAddPlanEntry` action.

For each slot, ranks every non-breakfast recipe that isn't already
planned and surfaces the top 3:

```
score(candidate) =
    + goalNutritionFit                // cut: P/kcal×1000; bulk: kcal/10; maintain: flat 30
    − 80 * sameCategoryAsOtherSlot    // hard variety penalty
    − 50 * sameHeroAsOtherSlot        // softer variety penalty
    −  0.5 * costPerServing           // mild thrift bonus
```

Deterministic and pure — fully unit-tested in
[`tests/unit/recommend.test.ts`](tests/unit/recommend.test.ts).

Cost per serving comes from [`computeRecipeCost`](src/lib/cost.ts) on
the unscaled recipe lines (any unit-mismatched line evaluates to 0 cost
— a small thrift bonus, never an error). The "reasons" array on each
card surfaces the active penalties for transparency.

The page builds a single ranked list of 6 candidates (variety-penalised
against *both* slots' current picks) and **interleaves** them into the
two columns — even-indexed → lunch, odd-indexed → dinner. This
guarantees disjoint columns *and* both get a mix of high- and mid-ranked
picks rather than "top half / bottom half".

### 7.2 Override-aware balancer **[done — Phase 3.10]**

[`src/app/plan/page.tsx`](src/app/plan/page.tsx)'s `buildRecipes(scales)`
loads `recipe_ingredient_overrides` once at the top of the page and
feeds the rows through
[`buildOverrideMap`](src/lib/recipe-overrides.ts) +
[`applyGoalOverrides`](src/lib/recipe-overrides.ts) **before** the
per-class scalar multiplication. Effect:

- On **maintain**, `applyGoalOverrides` is a no-op (overrides only carry
  cut/bulk values).
- On **cut/bulk**, each recipe's lines are first replaced with their
  override quantity (or dropped if the override is 0); the macro
  balancer then scales whatever's left.
- Non-breakfast scaling rules are unchanged: hero lines still drive
  servings via `heroFactor`, fixed lines still aren't class-scaled.

**Phase 3.10.1 (kcal-band patch)**: the balancer was overshooting kcal
by 16–31 % on the smoke plan because it was modelling **fixed** lines
(puff pastry, cheese, breakfast olive oil) as scalable. Downstream only
side lines actually scale, so when the balancer picked `sF=0.3` to drop
fat, real sides went to 0.3 but the fixed lines stayed at 1.0 and kcal
stayed high. Two small changes in
[`src/lib/macro-balance.ts`](src/lib/macro-balance.ts):

1. Lines with `role === "fixed"` now go into `nonScalable` instead of
   `classDaily[c]`, so the LSQ prediction matches what `buildRecipes`
   actually emits.
2. The kcal axis of the LSQ target is biased to 95 %
   (`KCAL_TARGET_BIAS`) so the day lands in the user-requested 90–100 %
   band rather than straddling 100 %. P / C / F targets stay nominal.

On the smoke plan (`chicken_risotto` + `chicken_pie`) this lands at
~99 % / ~98 % / ~98 % of the maintain / cut / bulk kcal targets.

**Phase 3.11 (partial decongestion)**: extracted
[`day-macro-card.tsx`](src/app/plan/_components/day-macro-card.tsx) and
[`shopping-list.tsx`](src/app/plan/_components/shopping-list.tsx) into
`src/app/plan/_components/`. Page is down from 814 → 691 lines.
`MealSection` and the two-pass balancer flow stay inline by design (one
keeps the picker wiring local, the other keeps data-fetch + nutrition in
one place). Any further plan-page refactor folds into §7.6.

### 7.3 Daily micronutrient roll-up on `/plan` **[done — Phase 3.12]**

[`src/app/plan/_components/day-micro-rollup.tsx`](src/app/plan/_components/day-micro-rollup.tsx)
renders the same RDA bar pattern as the per-recipe page but fed from a
daily total: `breakfast.perServingMicros + lunch_ps + dinner_ps`. The
section is hidden when no ingredient in the day has any micro data
(graceful degradation for the sparse OpenFoodFacts seed).

Wiring in [`src/app/plan/page.tsx`](src/app/plan/page.tsx):

- Added `micros_per_100g` to the recipe SELECT and the `RecipeRow` type.
- `recipeToNutrition` now passes `microsPer100g` through.
- `applyEntry` calls `computeRecipeNutrition(lines, scaled.servings)` so
  it can emit `perServingMicros` (the macro flow already used
  `nut.total.*` so passing the real serving count doesn't change it).
- A second map `microsPerServing` keeps breakfast's PS micros.
- The day total averages micros across the (usually one) lunch + dinner
  entries so multi-cook days still produce a single per-day number.

Sodium uses the WHO upper-limit colouring (amber over 2300 mg) inherited
from the per-recipe page.

### 7.4 Recipe baseline audit **[next]**

Six recipes were rebased to 1-pack hero baselines in Phase 3.10.1
(`chicken_pie`, `chicken_risotto`, `pasta_with_chicken`, `puchero`,
`rice_with_chicken_livers`, `rice_with_pork`). The remaining ~14
recipes haven't been verified end-to-end. For each one, plan it on
`/plan`, confirm at maintain · cut · bulk that:

- Servings = whole-pack hero quantity ÷ heroPerServing lands at a
  reasonable integer (not 17.6).
- Side lines scale linearly with the hero (rice ratio holds).
- Fixed lines (onion, stock cube, tortillas, puff pastry) stay at their
  recipe defaults and don't collapse to 0 or balloon.
- Per-serving kcal/macros match the recipe page.

Anything off → fix via a `_patch.mjs` per §3 (rebase the recipe to a
1-pack hero baseline) and note the change in the commit body.

### 7.5 Investigate "puff pastry shows 0.0 unit" **[next]**

Reported during 3.10.1 testing: a UI render showed a puff pastry side
line as `0.0 unit`. After the fixed-line bucketing fix in 3.10.1 this
is likely already gone, but it was never reproduced and verified
post-fix. Steps:

1. Plan `chicken_pie` on `/plan` at all three goals.
2. Look for any line that renders `0.0 unit` or a fractional non-divisible
   unit count.
3. If still present: inspect `scalePortion` rounding for non-divisible
   side lines measured in `unit`, and the JSX in
   [`controls.tsx`](src/app/plan/controls.tsx) `PlanEntryRow`.

If the bug is gone, close the item with a smoke screenshot in the
commit body.

### 7.6 UI rework pass **[next]**

A single closing pass on the visual design — no new pages, no new
features. Scope:

- Tighten the `/plan` layout: cleaner spacing, consistent typography,
  the goal pills + auto-balance scalar pill should read as one header
  block.
- Mobile pass: confirm `/plan`, `/recipes/[slug]`, `/ingredients` all
  work on a phone-width viewport; collapse the shopping list aside into
  a `<details>` block on small screens.
- Replace any remaining ad-hoc class strings with the existing UI
  primitives in [`src/components/ui`](src/components/ui).
- Remove debug strings (the `auto-balance · protein ×1.40 …` line can
  go behind a `?debug=1` query toggle).

### 7.7 Deployment / architecture final touches **[next]**

Things to lock in before declaring the project done:

- README "Quickstart" and "Deploy" sections re-verified end-to-end on a
  clean clone.
- `.env.example` matches the env vars the app actually reads (audit
  against [`src/lib/env.ts`](src/lib/env.ts)).
- Confirm CI gates (`biome ci`, `tsc --noEmit`, `pnpm test`,
  `pnpm build`) all run on every PR; add the smoke jobs as a separate
  manual workflow if not already.
- Verify the live deploy at
  https://smart-meal-planner-iota.vercel.app/ tracks `main` and that
  Supabase env vars are set in the Vercel dashboard.
- One-paragraph "post-mortem / handoff" note at the top of this file
  once everything above is green.

### 7.8 Things we explicitly *won't* build

- **Pantry stock**, **shopping-list export**, **auth**, **PWA**,
  **last-week recommendation column**, **ingredient-reuse thrift bonus**,
  **macro-gap recommendation fit** — all previously listed as ideas;
  dropped because the project is feature-complete for the single-user
  use case it was built for.
- **Receipt OCR via LLM.** Originally Phase 4. Removed because: (a) prices
  change rarely enough to update by hand once a month; (b) the LLM-error
  surface (wrong unit, wrong store, hallucinated price) was high enough
  to need a confirmation UI anyway, which is more clicks than just typing
  the new price; (c) we eliminated a runtime dependency + API key + rate
  limit + quota concern.
- **LLM duplicate detection on recipe create.** Same reasoning. The
  catalogue is small (~50 ingredients, ~20 recipes); a `slug` uniqueness
  check is enough.
- **LLM-driven recipe authoring.** Recipes go in by hand, in pair-sessions
  with the assistant in this very chat, following the conventions in §4.

---

## 8. Operational notes

### Production: Vercel (free Hobby plan)

Auto-deploy on push to `main`. Preview deployments on every PR. Env vars
set in the Vercel dashboard.

Live: https://smart-meal-planner-iota.vercel.app/

### Database: Supabase (free)

Migrations applied manually via SQL Editor (see §3). No CI auto-migrate
yet — add one once the schema stabilises.

Daily backups: Supabase free tier keeps 7 days PITR.

### Cost ceiling

| Service | Free tier | Expected usage |
|---|---|---|
| Vercel | 100 GB-hr / 100 GB bandwidth | well under |
| Supabase | 500 MB DB, 1 GB storage | < 50 MB total |

No LLM, no Redis, no Sentry — kept off for now.

---

## 9. Definition of Done (per feature)

A feature is "done" when **all** are true:

1. Code merged to `main`.
2. Unit tests added for any new pure function in `src/lib/*`.
3. If user-visible: opened on the live dev server and visually verified at
   maintain · cut · bulk.
4. Documentation updated (this guide and/or README).
5. Deployed to production via Vercel and re-verified on a phone.
