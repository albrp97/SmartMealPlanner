/**
 * Back-fill `ingredients.g_per_unit` and `ingredients.density_g_per_ml` with
 * sensible defaults so the nutrition engine can convert unit/ml quantities
 * to grams.
 *
 * Strategy: a hand-curated lookup table keyed by ingredient slug for the
 * ingredients we know we use. Anything not in the table is left null and
 * the recipe page will keep showing the "partial — some ingredients
 * missing data" badge until the user enters a value via the form.
 *
 * Idempotent: only writes columns that are currently NULL.
 *
 * Run with: `pnpm db:backfill-units`
 */
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

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

/** Average grams per whole item. Conservative kitchen estimates. */
const G_PER_UNIT: Record<string, number> = {
	// Produce
	avocado: 170,
	bell_pepper: 150,
	red_bell_pepper: 150,
	cabbage: 900,
	carrot: 80,
	mushrooms: 250, // a small punnet
	onion: 150,
	potato: 200,
	tomato: 120,
	vine_tomato: 100,
	// Eggs / dairy
	egg: 60,
	yogurt: 125, // small pot
	yogurt_3_9_fat: 125,
	plain_yogurt: 125,
	cream: 200, // small carton (also has density)
	grated_cheese: 200, // small bag
	// Pantry / canned
	tuna: 80, // canned, drained
	beans: 400, // 1 jar/can
	tomato_sauce: 400, // 1 jar
	crushed_tomato_rustica: 400,
	stock_cube: 10,
	golden_curry_paste: 20, // 1 cube
	puff_pastry: 230, // 1 ready-rolled sheet
	tortilla_wraps: 50,
	chorizo: 250, // 1 small chub
	beer: 330, // 1 can/bottle (ml ≈ g for our purposes)
	honey: 5, // 1 teaspoon (when given in 'unit')
	seasoning: 5,
	// Supplements (1 unit = 1 capsule/tablet — ignored by nutrition engine
	// because is_supplement=true uses per-serving fields)
};

/** g/ml for the few liquids we use that aren't ~water. */
const DENSITY_G_PER_ML: Record<string, number> = {
	cream: 1.01,
	milk_3_5_fat: 1.03,
	beer: 1.01,
	honey: 1.42,
	tomato_sauce: 1.05,
};

async function main() {
	const { data, error } = await supabase
		.from("ingredients")
		.select("id, slug, g_per_unit, density_g_per_ml")
		.order("slug");
	if (error) {
		console.error("Failed to fetch ingredients:", error.message);
		process.exit(1);
	}

	const rows = data ?? [];
	let updated = 0;
	let skipped = 0;
	const unmatched: string[] = [];

	for (const row of rows) {
		const patch: { g_per_unit?: number; density_g_per_ml?: number } = {};
		const gpu = G_PER_UNIT[row.slug];
		const dens = DENSITY_G_PER_ML[row.slug];

		if (gpu != null && row.g_per_unit == null) patch.g_per_unit = gpu;
		if (dens != null && row.density_g_per_ml == null) patch.density_g_per_ml = dens;

		if (Object.keys(patch).length === 0) {
			if (gpu == null && dens == null && row.g_per_unit == null && row.density_g_per_ml == null) {
				unmatched.push(row.slug);
			} else {
				skipped++;
			}
			continue;
		}

		const { error: upErr } = await supabase.from("ingredients").update(patch).eq("id", row.id);
		if (upErr) {
			console.error(`✗ ${row.slug}: ${upErr.message}`);
			continue;
		}
		updated++;
		console.log(
			`✓ ${row.slug}  ${patch.g_per_unit ? `g_per_unit=${patch.g_per_unit}` : ""} ${
				patch.density_g_per_ml ? `density=${patch.density_g_per_ml}` : ""
			}`.trim(),
		);
	}

	console.log(`\nDone. ${updated} updated, ${skipped} already set.`);
	if (unmatched.length) {
		console.log(
			`\n${unmatched.length} ingredient(s) have no default in the table — set via the app form:`,
		);
		for (const s of unmatched) console.log(`  - ${s}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
