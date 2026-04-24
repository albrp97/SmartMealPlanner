-- Phase 1: no auth yet. Allow anon (and authenticated) clients to read the
-- catalogue tables so the SSR pages can render. Writes still require the
-- service-role key (used by server actions through createServiceClient or by
-- a future authenticated user policy).
--
-- Run this in the Supabase SQL Editor.

do $$
declare
	t text;
begin
	foreach t in array array[
		'ingredients',
		'recipes',
		'recipe_ingredients',
		'recipe_categories',
		'stores',
		'price_snapshots'
	]
	loop
		execute format('alter table public.%I enable row level security;', t);
		execute format(
			'drop policy if exists "public read %1$s" on public.%1$I;',
			t
		);
		execute format(
			'create policy "public read %1$s" on public.%1$I for select to anon, authenticated using (true);',
			t
		);
	end loop;
end $$;
