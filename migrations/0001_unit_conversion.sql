-- Phase 2 — unit-conversion metadata for the nutrition engine.
--
-- Both columns are nullable; `lib/units.ts` falls back gracefully when missing
-- (density defaults to 1.0; per-unit ingredients without g_per_unit are flagged
-- as "missing data" instead of producing wrong macros).
--
-- Run this in the Supabase SQL Editor.

alter table public.ingredients
	add column if not exists g_per_unit double precision,
	add column if not exists density_g_per_ml double precision;

comment on column public.ingredients.g_per_unit is
	'Grams in one whole item (e.g. egg ≈ 60, onion ≈ 150). Required for unit→g nutrition conversion.';
comment on column public.ingredients.density_g_per_ml is
	'g/ml for liquids when recipes use ml but nutrition is per 100 g (oil ≈ 0.92, milk ≈ 1.03). Defaults to 1.0.';
