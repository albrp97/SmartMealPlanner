/**
 * One-shot patch:
 *   1. Add new ingredients: banana, frozen red berries, lemon.
 *      Each gets full per-100 g macros + tracked micros + a default
 *      package_price. Their default_package_price is set to the same
 *      seed value so they start as "default" (no real ticket yet for
 *      lemon/berries; banana is from the user-provided ticket but is a
 *      *new* ingredient, so the seed price is also our default).
 *   2. Daily breakfast now also includes "either 1 banana or a cup of
 *      frozen red berries". Modelled as the long-run average:
 *      0.5 banana (~60 g) + 60 g frozen red berries (half cup).
 *   3. Apply real ticket prices for the items the user collected. These
 *      get price_is_default=false, leaving default_package_price untouched
 *      so the UI can show the % delta vs the original estimate.
 *
 * Idempotent: re-running is a no-op for existing inserts and just rewrites
 * the same prices.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const TRACKED_MICROS = ["sodium_mg", "calcium_mg", "iron_mg", "vitamin_c_mg"] as const;

interface NewIngredient {
	slug: string;
	name: string;
	category_id: string;
	sold_as: "package" | "unit";
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	package_price: number;
	currency?: string;
	g_per_unit?: number | null;
	density_g_per_ml?: number | null;
	kcal_per_100g: number;
	protein_per_100g: number;
	carbs_per_100g: number;
	fat_per_100g: number;
	fiber_per_100g: number;
	micros_per_100g: Record<string, number>;
}

const NEW_INGREDIENTS: NewIngredient[] = [
	{
		slug: "banana",
		name: "banana",
		category_id: "produce",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 5.98, // 29.90 / 5 from the ticket
		g_per_unit: 120, // typical medium banana, peeled weight
		kcal_per_100g: 89,
		protein_per_100g: 1.1,
		carbs_per_100g: 23,
		fat_per_100g: 0.3,
		fiber_per_100g: 2.6,
		micros_per_100g: { sodium_mg: 1, calcium_mg: 5, iron_mg: 0.3, vitamin_c_mg: 8.7 },
	},
	{
		slug: "frozen_red_berries",
		name: "frozen red berries",
		category_id: "produce",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 60, // estimated Lidl frozen mixed berries, 500 g
		kcal_per_100g: 50,
		protein_per_100g: 0.8,
		carbs_per_100g: 11,
		fat_per_100g: 0.4,
		fiber_per_100g: 3.5,
		micros_per_100g: { sodium_mg: 1, calcium_mg: 25, iron_mg: 0.5, vitamin_c_mg: 35 },
	},
	{
		slug: "lemon",
		name: "lemon",
		category_id: "produce",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 10,
		g_per_unit: 65, // edible flesh of one lemon, no peel
		kcal_per_100g: 29,
		protein_per_100g: 1.1,
		carbs_per_100g: 9,
		fat_per_100g: 0.3,
		fiber_per_100g: 2.8,
		micros_per_100g: { sodium_mg: 2, calcium_mg: 26, iron_mg: 0.6, vitamin_c_mg: 53 },
	},
];

interface BreakfastLine {
	ingredient_slug: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	notes?: string;
}

const BREAKFAST_NEW_LINES: BreakfastLine[] = [
	// Models the "either 1 banana or a cup of frozen red berries" alternation
	// as the long-run daily average: half of each.
	{
		ingredient_slug: "banana",
		quantity: 0.5,
		unit: "unit",
		notes: "avg of 'banana OR frozen berries'",
	},
	{
		ingredient_slug: "frozen_red_berries",
		quantity: 60,
		unit: "g",
		notes: "avg of 'banana OR frozen berries' (half cup)",
	},
];

interface RealPrice {
	slug: string;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	sold_as: "package" | "unit";
	package_price: number;
	currency?: string;
}

// Real ticket prices supplied by the user. price_is_default => false.
// default_package_price is left intact so the UI can compute the % delta.
const REAL_PRICES: RealPrice[] = [
	// Meat & protein
	{
		slug: "chicken_thigh_fillets",
		sold_as: "package",
		package_size: 850,
		package_unit: "g",
		package_price: 170.26,
	},
	{
		slug: "minced_chicken",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 79.9,
	},
	{
		slug: "pork",
		sold_as: "package",
		package_size: 1100,
		package_unit: "g",
		package_price: 133.09,
	},
	{
		slug: "chorizo",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 67.9,
	},
	{
		slug: "grated_cheese",
		sold_as: "package",
		package_size: 200,
		package_unit: "g",
		package_price: 39.9,
	},

	// Dairy & pantry
	{ slug: "beer", sold_as: "package", package_size: 1, package_unit: "unit", package_price: 21.9 },
	{
		slug: "basmati_rice",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 59.9,
	},
	{
		slug: "tortilla_wraps",
		sold_as: "package",
		package_size: 6,
		package_unit: "unit",
		package_price: 27.9,
	},
	{
		slug: "crushed_tomato",
		sold_as: "package",
		package_size: 700,
		package_unit: "g",
		package_price: 36.9,
	},
	{ slug: "beans", sold_as: "package", package_size: 400, package_unit: "g", package_price: 16.9 },
	{
		slug: "plain_yogurt",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 45,
	},

	// Produce — sold by unit, average weights captured via g_per_unit elsewhere.
	{
		slug: "red_bell_pepper",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 35,
	},
	{
		slug: "vine_tomato",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 13.31,
	},
	{ slug: "onion", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 6 },
	{ slug: "potato", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 3.8 },
	{ slug: "avocado", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 39.95 },
];

async function main() {
	config({ path: ".env.local" });
	const sb = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);

	// Detect whether migration 0003 has been applied.
	const { error: probeErr } = await sb.from("ingredients").select("default_package_price").limit(1);
	const hasDefaultColumn = probeErr === null;
	console.log(`Default-price column present: ${hasDefaultColumn}`);

	// 1. Insert (or upsert) new ingredients.
	for (const ing of NEW_INGREDIENTS) {
		const { data: existing } = await sb
			.from("ingredients")
			.select("id")
			.eq("slug", ing.slug)
			.maybeSingle();
		if (existing) {
			console.log(`= ingredient already exists: ${ing.slug}`);
			continue;
		}
		const insertRow: Record<string, unknown> = {
			slug: ing.slug,
			name: ing.name,
			category_id: ing.category_id,
			sold_as: ing.sold_as,
			package_size: ing.package_size,
			package_unit: ing.package_unit,
			package_price: ing.package_price,
			currency: ing.currency ?? "CZK",
			g_per_unit: ing.g_per_unit ?? null,
			density_g_per_ml: ing.density_g_per_ml ?? null,
			kcal_per_100g: ing.kcal_per_100g,
			protein_per_100g: ing.protein_per_100g,
			carbs_per_100g: ing.carbs_per_100g,
			fat_per_100g: ing.fat_per_100g,
			fiber_per_100g: ing.fiber_per_100g,
			micros_per_100g: ing.micros_per_100g,
			is_supplement: false,
		};
		if (hasDefaultColumn) {
			insertRow.default_package_price = ing.package_price;
			insertRow.price_is_default = true;
		}
		const { error } = await sb.from("ingredients").insert(insertRow);
		if (error) console.error("+ insert", ing.slug, error.message);
		else console.log(`+ inserted ${ing.slug}`);
	}

	// 2. Add the breakfast alternates (idempotent).
	const { data: breakfast } = await sb
		.from("recipes")
		.select("id")
		.eq("slug", "breakfast_daily")
		.single();
	if (!breakfast) {
		console.error("breakfast_daily not found");
	} else {
		const { data: existingLines } = await sb
			.from("recipe_ingredients")
			.select("ingredient_id, ingredients(slug)")
			.eq("recipe_id", breakfast.id);
		const haveSlugs = new Set(
			(existingLines ?? [])
				.map((e) => (e as { ingredients?: { slug?: string } }).ingredients?.slug)
				.filter(Boolean) as string[],
		);
		for (const line of BREAKFAST_NEW_LINES) {
			if (haveSlugs.has(line.ingredient_slug)) {
				console.log(`= breakfast already has ${line.ingredient_slug}`);
				continue;
			}
			const { data: ing } = await sb
				.from("ingredients")
				.select("id")
				.eq("slug", line.ingredient_slug)
				.single();
			if (!ing) {
				console.warn(`breakfast: ingredient ${line.ingredient_slug} not found`);
				continue;
			}
			const { error } = await sb.from("recipe_ingredients").insert({
				recipe_id: breakfast.id,
				ingredient_id: ing.id,
				quantity: line.quantity,
				unit: line.unit,
				notes: line.notes ?? null,
			});
			if (error) console.error("+ breakfast", line.ingredient_slug, error.message);
			else console.log(`+ breakfast: ${line.quantity} ${line.unit} ${line.ingredient_slug}`);
		}
	}

	// 3. Apply real ticket prices.
	for (const p of REAL_PRICES) {
		const patch: Record<string, unknown> = {
			package_size: p.package_size,
			package_unit: p.package_unit,
			sold_as: p.sold_as,
			package_price: p.package_price,
			currency: p.currency ?? "CZK",
		};
		if (hasDefaultColumn) patch.price_is_default = false;
		const { data, error } = await sb
			.from("ingredients")
			.update(patch)
			.eq("slug", p.slug)
			.select("slug,package_price,default_package_price");
		if (error) {
			console.error("price", p.slug, error.message);
			continue;
		}
		if (!data || data.length === 0) {
			console.warn("price", p.slug, "NOT FOUND");
			continue;
		}
		const row = data[0] as { default_package_price?: number | null };
		const def = row.default_package_price;
		const delta =
			def != null && def !== 0 ? `${(((p.package_price - def) / def) * 100).toFixed(0)}%` : "n/a";
		console.log(`$ ${p.slug}: real ${p.package_price} CZK (default ${def ?? "?"} CZK, ${delta})`);
	}

	// 4. Quick coverage check on tracked micros for the new rows.
	const { data: bad } = await sb
		.from("ingredients")
		.select("slug,micros_per_100g")
		.in(
			"slug",
			NEW_INGREDIENTS.map((i) => i.slug),
		);
	for (const r of bad ?? []) {
		const m = (r.micros_per_100g ?? {}) as Record<string, unknown>;
		for (const k of TRACKED_MICROS) {
			if (typeof m[k] !== "number") console.warn(`! ${r.slug} missing ${k}`);
		}
	}

	console.log("\nDone.");
}
main();
