# SmartMealPlanner — Developer Guide

End-to-end guide for building, testing, deploying and improving the app. Read this **before** writing code.

---

## 0. Conventions

- **Language:** TypeScript everywhere (frontend, Server Actions, Route Handlers, scripts).
- **Runtime / pkg mgr:** Node 20 LTS + **pnpm 9** (lockfile committed; `npm` and `yarn` forbidden).
- **Style:** **Biome** (lint + format) — single Rust binary, replaces ESLint + Prettier. Enforced on CI.
- **Type safety end-to-end:** Drizzle (DB) + Zod (boundaries) + `@t3-oss/env-nextjs` (env). No `any`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:` …), enforced via `commitlint` + Husky pre-commit.
- **Branching:** trunk-based — short-lived feature branches → PR → `main` → auto-deploy.
- **Issue tracker:** GitHub Issues, labelled by phase (`phase-0`, `phase-1`, …).
- **Secrets:** never commit. Use `.env.local` locally, Vercel + GitHub Secrets in CI/prod.

### Why this stack (and why not Rust)

Rust was evaluated as a backend language and rejected for this project. The hot path is `phone → Vercel → Supabase → Gemini → Vercel → phone`, dominated by network latency (1–3 s for the LLM call). A Rust API would save < 1 % of total request time at the cost of doubling the language surface and losing Vercel's zero-config Next.js deploy. We capture the upside of Rust through tooling instead: **Turbopack** (Next dev bundler), **SWC** (TS compiler), **Biome** (lint+format), and **oxc**-based dependencies as they mature.

---

## 1. Repository layout (target)

```
SmartMealPlanner/
├── README.md
├── DEVELOPER_GUIDE.md           ← you are here
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── biome.json                   # lint + format (replaces .eslintrc + .prettierrc)
├── drizzle.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── public/
│   ├── icons/                   # PWA icons
│   └── manifest.webmanifest
├── migrations/                  # SQL migrations (Supabase CLI)
│   └── 0001_init.sql
├── seed/
│   ├── ingredients.csv
│   ├── recipes.json             # the seed recipes from your message
│   └── seed.ts
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (marketing)/page.tsx
│   │   ├── (app)/
│   │   │   ├── recipes/
│   │   │   ├── ingredients/
│   │   │   ├── plan/
│   │   │   ├── shopping/
│   │   │   ├── receipts/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── recipes/route.ts
│   │       ├── ingredients/route.ts
│   │       ├── plans/route.ts
│   │       ├── shopping/route.ts
│   │       ├── receipts/route.ts        # POST image, returns parsed JSON
│   │       └── prices/route.ts
│   ├── components/              # shadcn/ui + custom
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts        # Drizzle + Supabase client (server)
│   │   │   └── schema.ts        # Drizzle table definitions (source of truth)
│   │   ├── env.ts               # @t3-oss/env-nextjs schema
│   │   ├── auth.ts
│   │   ├── ratelimit.ts         # Upstash Redis + ratelimit
│   │   ├── llm/
│   │   │   ├── gemini.ts        # vision call via Vercel AI SDK
│   │   │   └── prompts.ts
│   │   ├── nutrition.ts         # Mifflin-St Jeor, macro split
│   │   ├── shopping.ts          # aggregation + package rounding
│   │   └── units.ts             # g/ml/unit conversions
│   ├── domain/                  # pure types & business rules
│   │   ├── ingredient.ts
│   │   ├── recipe.ts
│   │   ├── plan.ts
│   │   └── receipt.ts
│   └── styles/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 2. Phased delivery plan

Each phase ends in a **deployable, demoable increment**.

### Phase 0 — Bootstrap (foundation only) — ✅ done

Goal: empty app deployable to Vercel, CI green, DB connected.

- [x] Scaffold Next.js 16 + TS + Tailwind 4 + Turbopack via `create-next-app`, pnpm-only.
- [x] Biome configured (`biome.json`) with `lint` / `format` / `ci:check` scripts.
- [x] Core deps installed: `@tanstack/react-query`, `zod`, `@t3-oss/env-nextjs`, `lucide-react`.
- [x] `src/lib/env.ts` validates env vars at boot via `@t3-oss/env-nextjs` + Zod.
- [x] `src/lib/query-provider.tsx` wired into `RootLayout`.
- [x] Vitest configured with `@/*` alias; first unit test (`tests/unit/phases.test.ts`).
- [x] GitHub Actions CI: install → Biome → typecheck → test → build.
- [x] `.env.example` with all keys validated by `lib/env.ts`.
- [ ] Create Supabase project, save URL + anon + service keys (deferred to Phase 1 boundary).
- [ ] Create Upstash Redis instance (deferred to Phase 4 boundary).
- [ ] Connect repo to Vercel; verify `https://smart-meal-planner.vercel.app` works.
- [ ] Init `shadcn/ui` (deferred until first real UI work in Phase 1).
- [ ] Configure PWA with **Serwist**: manifest + icons + service worker (deferred to Phase 5).
- [ ] Set up Husky + commitlint for Conventional Commits (optional polish).

> **Why some items are deferred:** they require external accounts (Supabase, Upstash, Vercel) or only become useful when their consumer feature ships. The bootstrap is "deployable" and "CI-green" without them.

### Phase 1 — Ingredient & recipe catalogue (read/write)

Goal: full CRUD on ingredients and recipes, seeded from the user’s list.

- [ ] Migration `0001_init.sql` with all tables from README §6.
- [ ] Seed script: ingest `seed/recipes.json` (parsed from the original message).
- [ ] Pages:
  - `/ingredients` — table + add/edit drawer (name, unit, package size, default price, macros per 100 g, micronutrients per 100 g as JSON, `is_supplement` flag + brand).
  - `/recipes` — list grouped by category; recipe detail with ingredients editor.
- [ ] API routes with Zod validation.
- [ ] Unit cost preview on recipe detail (uses current `default_price`).

**Seed example (parsed from the message):**
```json
{
  "category": "Curry",
  "name": "Indio",
  "servings": 2,
  "ingredients": [
    {"name": "arroz", "qty": 80, "unit": "g"},
    {"name": "pollo", "qty": 100, "unit": "g"},
    {"name": "tomate frito", "qty": 1, "unit": "unit"},
    {"name": "cerveza", "qty": 1, "unit": "unit"},
    {"name": "yogurt", "qty": 1, "unit": "unit"},
    {"name": "zanahoria", "qty": 1, "unit": "unit"}
  ]
}
```

### Phase 2 — Costing, macros & micronutrients engine

Goal: every recipe shows €/recipe, €/plate, kcal/plate, macros/plate **and** micronutrients/plate.

- [ ] `lib/units.ts`: convert between g/ml/unit using ingredient metadata.
- [ ] `lib/nutrition.ts`:
  - per-recipe nutrition (macros + fibre + micros);
  - per-plate division;
  - supplements use **per-serving** values (not per-100 g) when `is_supplement = true`.
- [ ] `lib/cost.ts`: per-recipe cost, accounting for **package rounding** when `mode = "shopping"` vs raw cost when `mode = "consumed"`.
- [ ] Display on recipe page: badge with €/plate, kcal/plate, and a collapsible micro panel (% of RDA bars).
- [ ] Seed micronutrient data from **OpenFoodFacts** / **USDA FDC** for whole foods, and from **GymBeam product pages** for supplements.

### Phase 3 — Meal planner & shopping list

Goal: plan a week → generate a real shopping list.

- [ ] `/plan` — weekly calendar (mobile: vertical list of days).
- [ ] Drag/drop or tap-to-add recipes to slots; choose servings.
- [ ] Daily macro **and micronutrient** summary bar with target vs actual; flag deficiencies (red) and excesses (amber, e.g. sodium).
- [ ] `/shopping` — `Generate from plan` button:
  - aggregates `recipe_ingredients × servings`
  - subtracts pantry stock (if Phase 6 done, else skip)
  - rounds up to package size → `packages_to_buy`
  - estimates total cost
- [ ] Export: copy as text, share to WhatsApp/Notes.

### Phase 4 — Receipt OCR (LLM vision)

Goal: photo of a ticket → updated price catalogue.

- [ ] `/receipts/new` — camera capture or file upload.
- [ ] `POST /api/receipts`:
  1. Upload image to Supabase Storage.
  2. Call Gemini 2.0 Flash with this **strict** JSON schema:
     ```ts
     {
       store: string,
       city: string | null,
       date: string,                  // ISO
       currency: "EUR",
       items: Array<{
         raw_text: string,
         normalized_name: string,     // lowercased, no brand
         quantity: number,
         unit: "g"|"ml"|"unit"|"kg"|"l",
         total_price: number,
         unit_price: number
       }>
     }
     ```
  3. Fuzzy-match `normalized_name` to `ingredients.name` (use `pg_trgm` similarity ≥ 0.6, otherwise prompt user).
  4. Insert into `price_history`; update `ingredients.default_price` only if newer than current default.
- [ ] Confirmation UI: show diff (old → new), let user approve/reject per row.
- [ ] Cache prompt and few-shot examples in `lib/llm/prompts.ts`.

### Phase 5 — Auth & multi-device sync

- [ ] Supabase magic-link login.
- [ ] Row-level security on every table (`user_id = auth.uid()`).
- [ ] Test on phone via installed PWA.

### Phase 6 — Pantry / stock (optional, recommended)

- [ ] `pantry_items` table (`ingredient_id`, `qty`, `unit`, `expires_at`).
- [ ] On shopping-list generation, subtract pantry quantities first.
- [ ] After shopping, "Mark as bought" pushes items into pantry.
- [ ] After cooking a planned meal, decrement pantry.

### Phase 7 — Smart suggestions

- [ ] Suggest a weekly plan that hits macro **and micronutrient** targets and minimises € by reusing perishable ingredients.
- [ ] Use a simple LP / greedy solver in `lib/planner.ts`; LLM only for natural-language tweaks ("more protein this week").

### Phase 8 — Polish

- [ ] Empty states, skeletons, optimistic updates.
- [ ] Dark mode.
- [ ] i18n (ES + EN); user’s recipes are in Spanish, UI English by default.
- [ ] Accessibility pass (axe).

---

## 3. Local development

Prereqs: Node 20+, **pnpm 9+** (`corepack enable && corepack prepare pnpm@9 --activate`). Supabase CLI and a Gemini API key are only needed from Phase 1 / Phase 4 respectively.

```bash
# 1. install
pnpm install

# 2. run dev server (Turbopack)
pnpm dev

# Phase 1+ (not yet wired):
# supabase start            # local Postgres + storage stack
# pnpm db:migrate           # drizzle-kit push / migrate
# pnpm db:seed              # tsx scripts/seed.ts
```

### Behind a corporate proxy (e.g. Zscaler / Artifactory)

If `pnpm install` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` you are behind a TLS-intercepting proxy. Point pnpm at the corporate registry instead:

```bash
pnpm config set registry https://artifactory.insim.biz/artifactory/api/npm/nn-npm/
# (auth token already lives in ~/.npmrc on managed laptops)
```

`.env.local` keys (all validated at build time by [`src/lib/env.ts`](src/lib/env.ts) — add a key there *before* adding it to `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                       # direct Postgres URL for Drizzle (Supabase pooled)
GOOGLE_GENERATIVE_AI_API_KEY=       # Gemini, read by @ai-sdk/google
OPENAI_API_KEY=                     # optional fallback, read by @ai-sdk/openai
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=                         # optional
NEXT_PUBLIC_POSTHOG_KEY=            # optional
```

For Phase 0 / development you can leave them all empty — every key is `.optional()` in `lib/env.ts`. Set `SKIP_ENV_VALIDATION=1` to bypass validation entirely (used by CI builds).

---

## 4. Testing strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | **Vitest** | Pure functions: `units.ts`, `nutrition.ts`, `cost.ts`, `shopping.ts`. Target ≥ 90 % coverage on `lib/`. |
| Component | **Vitest + React Testing Library** | Recipe form, shopping list table. |
| Integration | **Vitest** against a local Supabase | API routes hit a real Postgres; reset between tests. |
| Contract | **Zod schemas + golden JSON** | LLM receipt parser must match schema; replay recorded responses. |
| E2E | **Playwright** | Critical flows: add recipe → plan week → generate list → upload receipt → price updated. Run on mobile viewport (Pixel 7). |
| Visual | **Playwright screenshots** | Catch layout regressions on mobile. |
| Manual | Real phone | Once per phase, install PWA and use it for a real shopping trip. |

**LLM testing rule:** never call the live model in CI. Record fixtures with `npm run llm:record`, replay them in tests.

CI gates (GitHub Actions):

1. `biome ci` (lint + format check, single Rust binary)
2. `typecheck` (`tsc --noEmit`)
3. `test:unit`
4. `test:integration` (spins up Supabase service container)
5. `build`
6. `test:e2e` (only on PR to `main`)

All jobs use `pnpm/action-setup` + actions/cache for the pnpm store; cold install is < 30 s.

---

## 5. Deployment

### Production: Vercel (free Hobby plan)

1. Push to GitHub.
2. Import repo in Vercel → framework auto-detected as Next.js.
3. Add env vars (same as `.env.local` but production keys).
4. Vercel auto-deploys on every push to `main`.
5. Preview deployments on every PR.

### Database: Supabase (free)

- Migrations applied via GitHub Action `db-migrate.yml` on push to `main`, using `supabase db push`.
- Daily backups: Supabase free tier keeps 7 days of point-in-time recovery; additionally a weekly `pg_dump` artifact uploaded to GitHub Releases.

### Mobile install

- Open the Vercel URL on the phone → "Add to Home Screen" → installs as PWA.
- Camera access works via the standard `<input type="file" accept="image/*" capture="environment">`.

### Cost ceiling

| Service | Free tier | Expected usage |
|---------|-----------|----------------|
| Vercel | 100 GB-hr / 100 GB bandwidth | well under |
| Supabase | 500 MB DB, 1 GB storage | < 50 MB total |
| Gemini 2.0 Flash | 1 500 req/day | < 10/day (only on receipts) |

If Gemini free tier ever lapses → switch to OpenAI `gpt-4o-mini` (~ €0.0001 per receipt).

---

## 6. Security & privacy

- All data scoped to `auth.uid()` via Supabase RLS.
- Receipt images stored in a **private** bucket; signed URLs only.
- No PII sent to LLMs beyond the receipt image itself.
- Rate-limit `/api/receipts` (Vercel KV or Upstash free tier) to prevent abuse.
- Secrets only via Vercel env vars + GitHub Encrypted Secrets.
- Dependabot enabled; weekly `npm audit` in CI.

---

## 7. Observability

- **Vercel Analytics** for traffic and Web Vitals.
- **Sentry** for runtime errors (frontend + API).
- Structured logs in API routes via `pino` (JSON to Vercel log drain).
- Custom metric: `receipt.parse.success_rate` — alert if < 80 % over 24 h.

---

## 8. Future improvements (post-v1)

- Barcode scanning to add ingredients faster.
- Voice input ("añade pollo en salsa al martes").
- Nutritionix / OpenFoodFacts / USDA FDC integration to autofill macros and micronutrients.
- Auto-import GymBeam supplement nutrition facts via product-page scraping.
- Multi-store price comparison ("cheapest store for this week’s list").
- Telegram/WhatsApp bot for shopping reminders.
- Export plan to Google Calendar.
- Sharing plans with a partner / family (multi-user already supported by schema).
- Native wrapper via Capacitor if PWA limitations bite.

---

## 9. Definition of Done (per feature)

A feature is "done" when **all** are true:

1. Code merged to `main`.
2. Unit + integration tests added; CI green.
3. E2E flow updated if user-visible.
4. Documentation updated (README and/or this guide).
5. Deployed to production and manually verified on a real phone.
6. No new Sentry errors in the first 24 h.

---

## 10. Getting started checklist (Phase 0)

- [ ] Create GitHub repo `SmartMealPlanner` (private at first).
- [ ] Push these two docs.
- [ ] Open issue per phase, link from this guide.
- [ ] Run `npx create-next-app` and commit the bootstrap.
- [ ] Wire Vercel + Supabase.
- [ ] Tag `v0.0.1` once the empty app is live.

Then proceed to Phase 1.
