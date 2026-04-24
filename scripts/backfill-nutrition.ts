/**
 * Back-fill `ingredients.{kcal,protein,carbs,fat,fiber}_per_100g` from
 * OpenFoodFacts for any rows that are missing them.
 *
 * Run with: `pnpm db:backfill-nutrition`
 *
 * Idempotent: only updates ingredients where `kcal_per_100g IS NULL`.
 * Polite: 350 ms delay between OFF queries.
 */
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { lookupNutrition } from "../src/lib/nutrition-lookup";

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

async function main() {
	const { data, error } = await supabase
		.from("ingredients")
		.select("id, name, kcal_per_100g")
		.is("kcal_per_100g", null)
		.order("name");

	if (error) {
		console.error("Failed to fetch ingredients:", error.message);
		process.exit(1);
	}
	const rows = data ?? [];
	if (rows.length === 0) {
		console.log("Nothing to do — every ingredient already has kcal_per_100g.");
		return;
	}
	console.log(`Looking up ${rows.length} ingredient(s) on OpenFoodFacts…\n`);

	let hits = 0;
	let misses = 0;
	for (const ing of rows) {
		try {
			const hit = await lookupNutrition(ing.name);
			if (!hit) {
				console.log(`✗ ${ing.name}  (no match)`);
				misses++;
			} else {
				const { error: upErr } = await supabase
					.from("ingredients")
					.update({
						kcal_per_100g: hit.kcal_per_100g,
						protein_per_100g: hit.protein_per_100g,
						carbs_per_100g: hit.carbs_per_100g,
						fat_per_100g: hit.fat_per_100g,
						fiber_per_100g: hit.fiber_per_100g,
					})
					.eq("id", ing.id);
				if (upErr) {
					console.log(`! ${ing.name}  (update failed: ${upErr.message})`);
					misses++;
				} else {
					console.log(
						`✓ ${ing.name}  →  ${hit.matched_product_name} ` +
							`(kcal=${hit.kcal_per_100g} P=${hit.protein_per_100g} ` +
							`C=${hit.carbs_per_100g} F=${hit.fat_per_100g})`,
					);
					hits++;
				}
			}
		} catch (e) {
			console.log(`! ${ing.name}  (error: ${e instanceof Error ? e.message : String(e)})`);
			misses++;
		}
		// Be polite to OFF.
		await new Promise((r) => setTimeout(r, 350));
	}

	console.log(`\nDone. ${hits} matched, ${misses} skipped.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
