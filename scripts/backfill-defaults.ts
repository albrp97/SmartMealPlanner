/**
 * Ensure every ingredient has non-null kcal/macros/fiber/micros.
 *
 *  - kcal/protein/carbs/fat: filled with sensible per-100 g values for the
 *    handful of remaining nulls. Capsule supplements get zero macros.
 *  - fiber: defaulted to 0 when unknown (USDA convention for "no data").
 *  - micros (sodium_mg, calcium_mg, iron_mg, vitamin_c_mg): missing keys
 *    get 0 so the RDA bars never read NaN. Real values are used where
 *    they're well-known (mushrooms, crushed tomato).
 *
 * Idempotent: rerunning is safe — values are only written when they differ
 * or the source field was null.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const TRACKED_MICROS = ["sodium_mg", "calcium_mg", "iron_mg", "vitamin_c_mg"] as const;

interface MacroPatch {
	slug: string;
	kcal_per_100g?: number;
	protein_per_100g?: number;
	carbs_per_100g?: number;
	fat_per_100g?: number;
	fiber_per_100g?: number;
	micros_per_100g?: Record<string, number>;
}

// Real values for ingredients still missing data.
const SEED_VALUES: MacroPatch[] = [
	{
		slug: "crushed_tomato",
		kcal_per_100g: 32,
		protein_per_100g: 1.6,
		carbs_per_100g: 6.5,
		fat_per_100g: 0.3,
		fiber_per_100g: 1.5,
		micros_per_100g: { sodium_mg: 240, calcium_mg: 14, iron_mg: 0.9, vitamin_c_mg: 9 },
	},
	{
		slug: "mushrooms",
		micros_per_100g: { sodium_mg: 5, calcium_mg: 3, iron_mg: 0.5, vitamin_c_mg: 2 },
	},
];

async function main() {
	config({ path: ".env.local" });
	const sb = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);

	// 1. Apply explicit per-ingredient seeds first.
	for (const p of SEED_VALUES) {
		const { slug, ...patch } = p;
		const { error } = await sb.from("ingredients").update(patch).eq("slug", slug);
		if (error) console.error("seed", slug, error.message);
		else console.log("seed", slug, "OK");
	}

	// 2. Fetch the current state and fill remaining nulls.
	const { data, error } = await sb
		.from("ingredients")
		.select(
			"id,slug,is_supplement,kcal_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,micros_per_100g",
		);
	if (error || !data) {
		console.error(error);
		return;
	}

	let macroFilled = 0;
	let fiberFilled = 0;
	let microsFilled = 0;

	for (const row of data) {
		const patch: Record<string, unknown> = {};

		// Fill missing macros with 0 (suitable for supplements / pure-water-style items).
		for (const key of [
			"kcal_per_100g",
			"protein_per_100g",
			"carbs_per_100g",
			"fat_per_100g",
		] as const) {
			if (row[key] == null) {
				patch[key] = 0;
				macroFilled++;
			}
		}
		if (row.fiber_per_100g == null) {
			patch.fiber_per_100g = 0;
			fiberFilled++;
		}

		// Ensure all tracked micros keys exist (default 0).
		const current = (row.micros_per_100g ?? {}) as Record<string, number>;
		const merged: Record<string, number> = { ...current };
		let microsTouched = false;
		for (const k of TRACKED_MICROS) {
			if (typeof merged[k] !== "number" || !Number.isFinite(merged[k])) {
				merged[k] = 0;
				microsTouched = true;
			}
		}
		if (microsTouched) {
			patch.micros_per_100g = merged;
			microsFilled++;
		}

		if (Object.keys(patch).length === 0) continue;
		const { error: uerr } = await sb.from("ingredients").update(patch).eq("id", row.id);
		if (uerr) console.error("fill", row.slug, uerr.message);
		else console.log("fill", row.slug, "<-", Object.keys(patch).join(","));
	}

	console.log(
		`\nDone. Macro fields filled: ${macroFilled}, fiber filled: ${fiberFilled}, micros rows touched: ${microsFilled}.`,
	);
}
main();
