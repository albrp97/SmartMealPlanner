-- Phase 3: weekly meal planner.
-- One row per (date, slot, recipe) entry. The 'breakfast' slot is normally
-- pre-filled with the constant breakfast_daily recipe by the UI but the
-- table is generic so a future "swap breakfast" feature can override it.
--
-- Apply once via the Supabase SQL Editor.

create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  servings integer not null default 1 check (servings > 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_entries_date_idx on public.meal_plan_entries (date);
create index if not exists meal_plan_entries_recipe_idx on public.meal_plan_entries (recipe_id);

-- Public-read RLS for the personal-use Phase. Tighten in Phase 5 (Auth).
alter table public.meal_plan_entries enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'meal_plan_entries' and policyname = 'meal_plan_entries_anon_all'
  ) then
    create policy "meal_plan_entries_anon_all" on public.meal_plan_entries
      for all using (true) with check (true);
  end if;
end $$;
