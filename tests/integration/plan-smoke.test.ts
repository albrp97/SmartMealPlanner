/**
 * Browser-level smoke test: hits the running dev server.
 *
 * 1. Fetch /plan?goal=maintain, capture the kcal/day number.
 * 2. Use the service role to insert a sizable cut override on a side line
 *    of a recipe currently on the plan.
 * 3. Fetch /plan?goal=cut, capture the kcal/day number.
 * 4. Assert: cut kcal/day differs from maintain kcal/day.
 * 5. Cleanup the override row.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.SMOKE_APP_URL ?? "http://localhost:3000";
// Smoke needs a running dev server; opt-in only via SMOKE=1.
const haveEnv = !!(URL_ && SERVICE) && process.env.SMOKE === "1";
const d = haveEnv ? describe : describe.skip;

async function fetchKcalPerDay(goal: "maintain" | "cut" | "bulk"): Promise<number> {
	const res = await fetch(`${APP}/plan?goal=${goal}`, { cache: "no-store" });
	const html = await res.text();
	// The first DayStat is "kcal / day". Find the value: look for "KCAL / DAY"
	// then the next big number. Easier: regex on uppercase label nearby.
	// The structure renders: <div>kcal / day</div><div>2253</div>
	// Match a number that follows "kcal / day".
	const m = html.match(/>kcal<\/p><p[^>]*>(\d{2,5})</i);
	if (!m) throw new Error(`couldn't parse kcal/day for goal=${goal}; html len ${html.length}`);
	return Number(m[1]);
}

d("/plan kcal differs between maintain and cut when an override exists", () => {
	const service = haveEnv ? createClient(URL_!, SERVICE!) : null;
	let overrideId: string | null = null;

	beforeAll(async () => {
		// Find a recipe currently on the plan that has a substantial side line.
		const { data: planRows } = await service!
			.from("meal_plan_entries")
			.select("recipe_id")
			.in("slot", ["lunch", "dinner"]);
		if (!planRows || planRows.length === 0) {
			console.warn("[smoke] no plan rows; the test will be unable to detect a difference.");
			return;
		}
		const recipeIds = [...new Set(planRows.map((p) => p.recipe_id))];
		const { data: recipes } = await service!
			.from("recipes")
			.select(
				"id, slug, recipe_ingredients(id, quantity, unit, role, ingredients(id, name, kcal_per_100g, g_per_unit))",
			)
			.in("id", recipeIds);
		// biome-ignore lint/suspicious/noExplicitAny: live row shape
		const candidates = (recipes ?? []) as any[];
		// Pick the side line with the highest kcal contribution per unit.
		let best: { id: string; kcalDelta: number } | null = null;
		for (const r of candidates) {
			for (const li of r.recipe_ingredients ?? []) {
				if (li.role !== "side") continue;
				if (!li.ingredients?.kcal_per_100g) continue;
				const grams =
					li.unit === "g"
						? li.quantity
						: li.unit === "ml"
							? li.quantity
							: li.quantity * (li.ingredients.g_per_unit ?? 100);
				const kcal = (grams / 100) * li.ingredients.kcal_per_100g;
				if (!best || kcal > best.kcalDelta) {
					best = { id: li.id, kcalDelta: kcal };
				}
			}
		}
		if (!best) throw new Error("no suitable side line on planned recipes");
		overrideId = best.id;
		// Insert a cut override of 0 (drop the line). Pre-clean first.
		await service!
			.from("recipe_ingredient_overrides")
			.delete()
			.eq("recipe_ingredient_id", overrideId);
		await service!
			.from("recipe_ingredient_overrides")
			.insert({ recipe_ingredient_id: overrideId, goal: "cut", quantity: 0 });
	});

	afterAll(async () => {
		if (!service || !overrideId) return;
		await service.from("recipe_ingredient_overrides").delete().eq("recipe_ingredient_id", overrideId);
	});

	it("maintain kcal !== cut kcal", async () => {
		if (!overrideId) {
			console.warn("[smoke] no override seeded — skipping assertion");
			return;
		}
		const m = await fetchKcalPerDay("maintain");
		const c = await fetchKcalPerDay("cut");
		console.log(`[smoke] maintain kcal=${m} · cut kcal=${c}`);
		expect(c).not.toBe(m);
	});
});
