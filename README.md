# SmartMealPlanner

> Personal, mobile-first meal planning, recipe costing, macro & micronutrient tracking and grocery shopping automation — with receipt-photo price ingestion powered by an LLM.

[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Database: Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E)](https://supabase.com)
[![Stack: Next.js](https://img.shields.io/badge/Stack-Next.js%2015-000000)](https://nextjs.org)

---

## 1. Why this project?

Cooking decisions take time every single day:

- *What do I eat today?*
- *Do I have the ingredients?*
- *How much will this recipe cost me?*
- *How much per plate?*
- *How many days of food do I have left?*
- *What do I need to buy, and in what package sizes?*
- *Does it match my calorie / macro / micronutrient targets?*

**SmartMealPlanner** automates all of it from a single mobile-friendly web app.

---

## 2. Core features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Recipe library** | Hierarchical categories (e.g. `Curry → Indio`, `Arroz con carne → Risotto`). Each recipe stores ingredients, quantities per ingredient, servings produced, prep/cook time, and nutrition. |
| 2 | **Ingredient catalogue** | Master list with default unit, package size sold in store, and current price. |
| 3 | **Price history** | Every price update is timestamped + tagged with store + city, so we keep a full historical record. |
| 4 | **Receipt OCR** | Take a photo of a supermarket ticket → LLM (vision) extracts items, quantities and prices → ingredient prices auto-update. |
| 5 | **Cost per recipe / per plate** | Computed from current default prices, with a breakdown per ingredient. |
| 6 | **Shopping list generator** | Given a meal plan (e.g. "next 7 days"), aggregates ingredients, rounds up to real package sizes, and outputs a buy-list with estimated total cost. |
| 7 | **Macro & micronutrient tracking** | Targets calculated from user profile (age, sex, weight, height, activity = calisthenics). Each plan shows daily kcal, protein/carbs/fat **and** key micros (vitamins A, C, D, E, K, B-complex, iron, calcium, magnesium, zinc, potassium, sodium, omega-3, fibre). Supplements (e.g. GymBeam multivitamin, D3+K2, omega-3, magnesium) contribute to the totals. |
| 8 | **Meal planner** | Weekly drag-and-drop calendar with auto-suggestions that respect macro targets and pantry stock. |
| 9 | **Pantry / stock** | Optional inventory tracking so the shopping list only includes what is actually missing. |
| 10 | **PWA** | Installable on mobile, works offline for browsing recipes. |

---

## 3. User profile (defaults baked in)

| Field | Value |
|-------|-------|
| Sex | Male |
| Year of birth | 1997 |
| Height | 1.81 m |
| Weight | 70 kg |
| Training | Calisthenics (3–5 sessions/week) |
| Goal | Maintenance / lean — avoid weight gain |

These power the default macro targets:

- **TDEE** ≈ Mifflin-St Jeor × activity factor (1.55).
- **Protein**: 1.6–2.0 g/kg → ~120–140 g/day.
- **Fat**: 0.8–1.0 g/kg → ~60–70 g/day.
- **Carbs**: remainder of calories.
- **Fibre**: ≥ 30 g/day.

And the default **micronutrient** targets (EFSA / NIH RDAs for an adult male, can be overridden in Settings):

| Nutrient | Target | Nutrient | Target |
|----------|--------|----------|--------|
| Vitamin A | 900 µg | Iron | 8 mg |
| Vitamin C | 90 mg | Calcium | 1000 mg |
| Vitamin D | 15 µg (600 IU) | Magnesium | 400 mg |
| Vitamin E | 15 mg | Zinc | 11 mg |
| Vitamin K | 120 µg | Potassium | 3500 mg |
| B1 / B2 / B3 | 1.2 / 1.3 / 16 mg | Sodium | ≤ 2300 mg |
| B6 / B9 / B12 | 1.7 mg / 400 µg / 2.4 µg | Omega-3 (EPA+DHA) | 250–500 mg |

All values are editable in the Settings screen.

---

## 4. Tech stack (100% free tier, 2026-modern)

> Design rule: **TypeScript app code, Rust-powered tooling underneath.** Rust as the app language was considered and rejected — the bottleneck here is LLM and DB I/O, not CPU, and a JS frontend is unavoidable for a PWA. Rust appears via Biome, Turbopack and SWC, which give us the speed without the dev-velocity hit.

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **Next.js 15** (App Router, **Turbopack** dev) + **TypeScript 5.x** + **Tailwind CSS 4** + **shadcn/ui** | Mobile-first, SSR + PWA, free on Vercel; Turbopack (Rust) for instant HMR. |
| State / data | **TanStack Query v5** + **Zod 3** | Type-safe data fetching & validation. |
| Backend | **Server Actions** (mutations) + **Route Handlers** (`/app/api/*` for public/webhook endpoints) | Less boilerplate, end-to-end type safety, one repo, one deploy. |
| ORM | **Drizzle ORM** (over Supabase Postgres) | Type-safe SQL, edge-compatible, lighter than Prisma, plays well with RLS. |
| DB | **Supabase Postgres** (free 500 MB) | Row-level security, generous free tier. |
| Auth | **Supabase Auth** (magic-link / Google) | Single-user first, multi-user ready. |
| Storage | **Supabase Storage** | Receipt images, signed URLs. |
| LLM (vision) | **Google Gemini 2.5 Flash** via **Vercel AI SDK** — fallback **OpenAI gpt-4o-mini** | First-class structured output, easy provider swap, free tier. |
| Rate limiting | **Upstash Redis + `@upstash/ratelimit`** | Edge-compatible, free tier, protects `/api/receipts`. |
| Env validation | **`@t3-oss/env-nextjs`** | Build-time check that all env vars exist and are well-typed. |
| Hosting | **Vercel Hobby** (free) | Instant deploy from GitHub, mobile URL. |
| Package manager | **pnpm 9** | Faster installs, strict dep resolution, content-addressable store. |
| Lint + format | **Biome** (Rust) — replaces ESLint + Prettier | One tool, ~25× faster, zero config. |
| Testing | **Vitest 2** + **Playwright** | Vitest is Vite-native (Rust-powered esbuild + SWC). |
| CI | **GitHub Actions** | Lint, type-check, test, build on PR. |
| Observability | **Sentry** (errors) + **PostHog** (product analytics, session replay) + **Vercel Analytics** (Web Vitals) | All free tier. |
| PWA | **Serwist** (Workbox-based, maintained successor to `next-pwa`) | `next-pwa` is unmaintained; Serwist supports App Router properly. |

---

## 5. High-level architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Mobile / Desktop                        │
│              Next.js PWA (React + Tailwind + shadcn)           │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼─────────────────────────────────┐
│                Next.js API Routes (Vercel Edge/Node)           │
│  - /api/recipes      - /api/ingredients     - /api/plans       │
│  - /api/shopping     - /api/receipts/ocr    - /api/prices      │
└──────┬───────────────────────┬────────────────────────┬────────┘
       │                       │                        │
       ▼                       ▼                        ▼
┌─────────────┐        ┌────────────────┐      ┌────────────────┐
│ Supabase DB │        │ Supabase Stor. │      │  Gemini / GPT  │
│ (Postgres)  │        │ (receipt imgs) │      │  (vision LLM)  │
└─────────────┘        └────────────────┘      └────────────────┘
```

Receipt flow:

```
phone camera → upload to /api/receipts → store image in Supabase
            → call Gemini Vision with strict JSON schema
            → match parsed items against ingredient catalogue
            → insert rows in price_history
            → update ingredients.default_price
            → return diff to UI for user confirmation
```

---

## 6. Data model (summary)

```
users
  id, email, profile_json (sex, dob, height_cm, weight_kg, activity, goals)

ingredient_categories         (carbs, protein, dairy, vegetables, …)
ingredients
  id, name, category_id, base_unit (g/ml/unit),
  package_size, package_unit,
  default_price, default_price_currency,
  kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g,
  micros_per_100g jsonb        -- { vit_a_ug, vit_c_mg, vit_d_ug, vit_e_mg, vit_k_ug,
                               --   b1_mg, b2_mg, b3_mg, b6_mg, b9_ug, b12_ug,
                               --   iron_mg, calcium_mg, magnesium_mg, zinc_mg,
                               --   potassium_mg, sodium_mg, omega3_mg, ... }
  is_supplement boolean, brand text   -- e.g. GymBeam; supplements use per-serving values

recipe_categories             (curry, pasta, arroz_con_carne, …)
recipes
  id, name, category_id, servings, instructions_md,
  prep_minutes, cook_minutes
recipe_ingredients
  recipe_id, ingredient_id, quantity, unit, notes

stores                        (Mercadona-Centro, Lidl-Norte, …)
price_history
  id, ingredient_id, store_id, city, price, currency, observed_at, source ('receipt'|'manual')

receipts
  id, image_path, raw_ocr_json, parsed_at, status

meal_plans
  id, user_id, week_start_date
meal_plan_entries
  id, plan_id, date, meal_slot ('lunch'|'dinner'|…), recipe_id, servings

shopping_lists
  id, plan_id, generated_at, total_cost
shopping_list_items
  id, list_id, ingredient_id, needed_qty, needed_unit,
  packages_to_buy, package_size, estimated_cost
```

Full DDL lives in [migrations/](migrations/) (created in Phase 1).

---

## 7. Quickstart

Requires **Node 20+** and **pnpm 9+** (`corepack enable && corepack prepare pnpm@9 --activate`).

```bash
git clone https://github.com/albrp97/SmartMealPlanner.git
cd SmartMealPlanner
cp .env.example .env.local        # fill in NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (and SERVICE_ROLE_KEY if you want to seed)
pnpm install
pnpm dev                          # http://localhost:3000 (Turbopack)
```

Database setup (one-off):

1. Create a free Supabase project, copy the URL + anon key + `service_role` key into `.env.local`.
2. Open the **SQL Editor** in the Supabase dashboard, paste the contents of [migrations/0000_tiny_masque.sql](migrations/0000_tiny_masque.sql), and Run.
   *(Direct `drizzle-kit push` is not used because corp networks often block port 5432.)*
3. `pnpm db:seed` — populates ingredients, recipes and prices from `seed/*.json`.

Useful scripts:

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server with Turbopack HMR. |
| `pnpm build` | Production build. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm lint` | Biome lint + format check. |
| `pnpm format` | Biome auto-format. |
| `pnpm test` | Vitest (run mode). |
| `pnpm ci:check` | What CI runs (Biome). |
| `pnpm db:generate` | Regenerate SQL migration from `src/lib/db/schema.ts`. |
| `pnpm db:seed` | Idempotent seed of ingredients/recipes/prices via Supabase REST. |

Deploy:

```bash
vercel link
vercel env pull
vercel --prod
```

---

## 8. Roadmap

See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for the phased plan, testing strategy and deployment runbook.

---

## 9. License

MIT — personal project, do whatever you want.
