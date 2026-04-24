-- Track default vs real prices.
--   default_package_price : the immutable "Lidl Prague 2026" estimate. Never
--                           overwritten; lets us compute % delta vs whatever
--                           the user enters from a real ticket.
--   price_is_default      : true while package_price still equals the default
--                           estimate. Server-side update from the ingredient
--                           form flips this to false on every manual edit.
--
-- Apply once via the Supabase SQL Editor.

alter table public.ingredients
  add column if not exists default_package_price double precision,
  add column if not exists price_is_default boolean not null default true;

-- Backfill existing rows: whatever they had so far IS the default estimate.
update public.ingredients
   set default_package_price = package_price
 where default_package_price is null
   and package_price is not null;
