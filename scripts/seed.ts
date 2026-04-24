import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
/**
 * One-shot seed script.
 *
 * Reads `seed/recipes.json` + `seed/prices.json` and inserts categories,
 * ingredients, recipes and recipe_ingredients into Supabase. Idempotent:
 * uses `upsert` keyed on the `slug` column so re-running won't duplicate.
 *
 * Run with: pnpm db:seed
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — uses the service role
 * client which bypasses Row Level Security (necessary for writes before any
 * user is authenticated).
 */
import { config as loadEnv } from "dotenv";

// Next.js convention: .env.local overrides .env. Load both, .env.local last.
loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
	process.exit(1);
}

const supabase = createClient(url, serviceKey, {
	auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedRecipeIngredient {
	name: string;
	quantity?: number;
	qty?: number;
	unit: string;
	supplement?: boolean;
	brand?: string;
	note?: string;
}
interface SeedRecipe {
	id: string;
	name: string;
	category_id: string;
	meal_type?: "single_meal" | "batch" | "unknown";
	servings_estimated?: number;
	ingredients: SeedRecipeIngredient[];
	notes?: string[];
}
interface SeedRecipesFile {
	categories: { id: string; name: string }[];
	recipes: SeedRecipe[];
}

interface SeedPriceIngredient {
	id: string;
	name: string;
	category_id: string;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	sold_as?: "package" | "unit";
	package_price: number;
	estimated?: boolean;
	notes?: string;
	brand?: string;
}
interface SeedPricesFile {
	currency: string;
	store: { id: string; name: string; city?: string; country?: string };
	observed_at: string;
	categories: { id: string; name: string }[];
	ingredients: SeedPriceIngredient[];
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

async function main() {
	const recipesFile: SeedRecipesFile = JSON.parse(
		readFileSync(resolve("seed/recipes.json"), "utf-8"),
	);
	const pricesFile: SeedPricesFile = JSON.parse(readFileSync(resolve("seed/prices.json"), "utf-8"));

	console.log("→ Categories");
	const ingCats = pricesFile.categories.map((c) => ({ id: c.id, name: c.name }));
	const recCats = recipesFile.categories.map((c) => ({ id: c.id, name: c.name }));
	{
		const { error } = await supabase.from("ingredient_categories").upsert(ingCats);
		if (error) throw error;
	}
	{
		const { error } = await supabase.from("recipe_categories").upsert(recCats);
		if (error) throw error;
	}

	console.log("→ Stores");
	{
		const { error } = await supabase.from("stores").upsert([pricesFile.store]);
		if (error) throw error;
	}

	console.log("→ Ingredients (from prices.json)");
	const ingredientRows = pricesFile.ingredients.map((i) => ({
		slug: i.id,
		name: i.name,
		category_id: i.category_id,
		sold_as: i.sold_as ?? "package",
		package_size: i.package_size,
		package_unit: i.package_unit,
		package_price: i.package_price,
		currency: pricesFile.currency,
		brand: i.brand ?? null,
		notes: i.notes ?? null,
	}));
	{
		const { error } = await supabase
			.from("ingredients")
			.upsert(ingredientRows, { onConflict: "slug" });
		if (error) throw error;
	}

	console.log("→ Price history (initial seed snapshot)");
	{
		const { data: ings, error } = await supabase
			.from("ingredients")
			.select("id, slug")
			.in(
				"slug",
				ingredientRows.map((r) => r.slug),
			);
		if (error) throw error;
		const slugToId = new Map(ings?.map((r) => [r.slug, r.id]));
		const history = pricesFile.ingredients.map((i) => ({
			ingredient_id: slugToId.get(i.id),
			store_id: pricesFile.store.id,
			package_price: i.package_price,
			currency: pricesFile.currency,
			observed_at: pricesFile.observed_at,
			source: "seed" as const,
		}));
		const { error: histErr } = await supabase.from("price_history").insert(history);
		if (histErr) throw histErr;
	}

	console.log("→ Recipes (auto-discovering missing ingredients from recipes.json)");
	// Some recipe ingredients aren't in prices.json yet — create stubs so the FK works.
	const knownSlugs = new Set(ingredientRows.map((r) => r.slug));
	const stubIngredients: {
		slug: string;
		name: string;
		package_size: number;
		package_unit: string;
		sold_as: string;
		currency: string;
	}[] = [];
	for (const r of recipesFile.recipes) {
		for (const ing of r.ingredients) {
			const slug = slugify(ing.name);
			if (!knownSlugs.has(slug)) {
				knownSlugs.add(slug);
				stubIngredients.push({
					slug,
					name: ing.name,
					package_size: 1,
					package_unit: ing.unit === "ml" ? "ml" : ing.unit === "unit" ? "unit" : "g",
					sold_as: "package",
					currency: pricesFile.currency,
				});
			}
		}
	}
	if (stubIngredients.length > 0) {
		console.log(`  · stubbing ${stubIngredients.length} ingredients without prices yet`);
		const { error } = await supabase
			.from("ingredients")
			.upsert(stubIngredients, { onConflict: "slug" });
		if (error) throw error;
	}

	const recipeRows = recipesFile.recipes.map((r) => ({
		slug: r.id,
		name: r.name,
		category_id: r.category_id,
		servings: r.servings_estimated ?? 1,
		meal_type: r.meal_type ?? "unknown",
		notes: r.notes?.join("\n") ?? null,
	}));
	{
		const { error } = await supabase.from("recipes").upsert(recipeRows, { onConflict: "slug" });
		if (error) throw error;
	}

	console.log("→ Recipe ingredients");
	const { data: allIngs, error: aErr } = await supabase.from("ingredients").select("id, slug");
	if (aErr) throw aErr;
	const slugToIngId = new Map(allIngs?.map((r) => [r.slug, r.id]));
	const { data: allRecs, error: rErr } = await supabase.from("recipes").select("id, slug");
	if (rErr) throw rErr;
	const slugToRecId = new Map(allRecs?.map((r) => [r.slug, r.id]));

	// Replace any existing recipe_ingredients to keep this idempotent.
	for (const r of recipesFile.recipes) {
		const recipeId = slugToRecId.get(r.id);
		if (!recipeId) continue;
		await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
		const rows = r.ingredients
			.map((ing, idx) => {
				const slug = slugify(ing.name);
				const ingredientId = slugToIngId.get(slug);
				if (!ingredientId) return null;
				return {
					recipe_id: recipeId,
					ingredient_id: ingredientId,
					quantity: ing.quantity ?? ing.qty ?? 1,
					unit: ing.unit === "ml" ? "ml" : ing.unit === "unit" ? "unit" : "g",
					notes: ing.note ?? null,
					position: idx,
				};
			})
			.filter((x): x is NonNullable<typeof x> => x !== null);
		if (rows.length > 0) {
			const { error } = await supabase.from("recipe_ingredients").insert(rows);
			if (error) throw error;
		}
	}

	console.log("✓ Seed complete.");
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
