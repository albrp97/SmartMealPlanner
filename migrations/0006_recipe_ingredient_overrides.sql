-- Phase 3.6: per-goal ingredient quantity overrides.
--
-- Design: maintain is the baseline (the existing
-- recipe_ingredients.quantity). cut / bulk store *sparse* overrides — one
-- row per (recipe_ingredient, goal) only when the quantity differs from
-- maintain. quantity = 0 means "skip this line on this goal" (e.g. quit
-- cheese on cut). The hero line itself is overridable too: a cut burrito
-- can pivot around 400g of minced chicken instead of 500g, which the
-- portion engine respects when computing servings.
--
-- Apply manually in the Supabase SQL Editor.

create table if not exists public.recipe_ingredient_overrides (
  recipe_ingredient_id uuid not null
    references public.recipe_ingredients(id) on delete cascade,
  goal text not null check (goal in ('cut', 'bulk')),
  quantity double precision not null check (quantity >= 0),
  primary key (recipe_ingredient_id, goal)
);

create index if not exists recipe_ingredient_overrides_ri_idx
  on public.recipe_ingredient_overrides (recipe_ingredient_id);

alter table public.recipe_ingredient_overrides enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'recipe_ingredient_overrides'
       and policyname = 'recipe_ingredient_overrides_anon_all'
  ) then
    create policy "recipe_ingredient_overrides_anon_all"
      on public.recipe_ingredient_overrides
      for all using (true) with check (true);
  end if;
end $$;
