/**
 * Back-fill `ingredients.micros_per_100g` (sparse JSONB blob) from
 * OpenFoodFacts. Same lookup used by `db:backfill-nutrition`, but this one
 * targets ingredients that already have macros and just need micros refreshed.
 *
 * Run with: `pnpm db:backfill-micros`
 *
 * Idempotent: only updates rows where `micros_per_100g IS NULL`.
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
		.select("id, name, micros_per_100g")
		.is("micros_per_100g", null)
		.order("name");
	if (error) {
		console.error("Failed to fetch ingredients:", error.message);
		process.exit(1);
	}
	const rows = data ?? [];
	if (rows.length === 0) {
		console.log("Nothing to do — every ingredient already has micros.");
		return;
	}
	console.log(`Looking up ${rows.length} ingredient(s) for micros…\n`);

	let hits = 0;
	let misses = 0;
	for (const ing of rows) {
		try {
			const hit = await lookupNutrition(ing.name);
			const sparse: Record<string, number> = {};
			if (hit) {
				for (const [k, v] of Object.entries(hit.micros)) {
					if (typeof v === "number" && Number.isFinite(v)) sparse[k] = v;
				}
			}
			if (Object.keys(sparse).length === 0) {
				console.log(`✗ ${ing.name}  (no micros from OFF)`);
				misses++;
			} else {
				const { error: upErr } = await supabase
					.from("ingredients")
					.update({ micros_per_100g: sparse })
					.eq("id", ing.id);
				if (upErr) {
					console.log(`! ${ing.name}  (update failed: ${upErr.message})`);
					misses++;
				} else {
					const summary = Object.entries(sparse)
						.map(([k, v]) => `${k}=${v}`)
						.join(" ");
					console.log(`✓ ${ing.name}  →  ${summary}`);
					hits++;
				}
			}
		} catch (e) {
			console.log(`! ${ing.name}  (error: ${e instanceof Error ? e.message : String(e)})`);
			misses++;
		}
		await new Promise((r) => setTimeout(r, 350));
	}

	console.log(`\nDone. ${hits} matched, ${misses} skipped.`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
