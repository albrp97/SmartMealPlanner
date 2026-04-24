-- Guarantee every ingredient row has non-null nutrition values.
-- Backfill any remaining nulls (idempotent), then add DB-level defaults so
-- future rows created via SQL inserts also start with zeros instead of NULL.
-- Application code (Drizzle / form actions) already zod-validates these
-- fields, but the DB default acts as a safety net.

update public.ingredients set kcal_per_100g     = 0 where kcal_per_100g     is null;
update public.ingredients set protein_per_100g  = 0 where protein_per_100g  is null;
update public.ingredients set carbs_per_100g    = 0 where carbs_per_100g    is null;
update public.ingredients set fat_per_100g      = 0 where fat_per_100g      is null;
update public.ingredients set fiber_per_100g    = 0 where fiber_per_100g    is null;
update public.ingredients set micros_per_100g   = '{}'::jsonb where micros_per_100g is null;

alter table public.ingredients
  alter column kcal_per_100g    set default 0,
  alter column protein_per_100g set default 0,
  alter column carbs_per_100g   set default 0,
  alter column fat_per_100g     set default 0,
  alter column fiber_per_100g   set default 0,
  alter column micros_per_100g  set default '{}'::jsonb;
