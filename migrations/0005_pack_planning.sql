-- Phase 3.5: package-driven serving optimiser.
--
-- Two cheap additive columns:
--   * ingredients.divisible — can the SKU be portioned during cooking
--     without spoiling the rest? (raw meat, rice, pasta, oils → true;
--     onions, cheese bag, beans tin, stock cubes → false).
--   * recipe_ingredients.role — how does this line scale with the recipe?
--       hero  : drives portion sizing (typically the protein)
--       side  : scales linearly with the hero
--       fixed : stays put regardless of batch size (1 onion, 1 stock cube)
--
-- Both default to safe values so the migration is non-breaking — existing
-- code keeps working, the new optimiser is opt-in until we backfill.
--
-- Apply manually in the Supabase SQL Editor.

alter table public.ingredients
  add column if not exists divisible boolean not null default true;

alter table public.recipe_ingredients
  add column if not exists role text not null default 'side'
  check (role in ('hero', 'side', 'fixed'));
