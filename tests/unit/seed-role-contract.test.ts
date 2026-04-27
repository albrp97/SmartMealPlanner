/**
 * Static contract test for seed/recipes.json.
 *
 * Every non-empty, complete recipe MUST declare exactly one hero ingredient.
 * If this test fails, the planner will silently fall back to the "no hero"
 * code path in scalePortion which lets the macro auto-balancer rewrite the
 * hero quantity \u2014 producing nonsense like "650g of beef" when the user
 * committed a 500g pack. See commit message for the bug history.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SeedIng {
	name: string;
	role?: "hero" | "side" | "fixed";
	quantity?: number;
	unit?: string;
}
interface SeedRecipe {
	id: string;
	name: string;
	completeness?: "complete" | "partial" | "empty";
	ingredients: SeedIng[];
}

const SEED = JSON.parse(
	readFileSync(resolve(process.cwd(), "seed/recipes.json"), "utf-8"),
) as { recipes: SeedRecipe[] };

describe("seed/recipes.json role contract", () => {
	const eligible = SEED.recipes.filter(
		(r) => r.completeness !== "empty" && r.ingredients.length > 0,
	);

	it("has at least one eligible recipe to validate", () => {
		expect(eligible.length).toBeGreaterThan(0);
	});

	it.each(eligible.map((r) => ({ id: r.id, name: r.name, recipe: r })))(
		"$id declares exactly one hero",
		({ recipe }) => {
			const heroes = recipe.ingredients.filter((i) => i.role === "hero");
			// Heroless by design:
			//   - pasta_base   : carb-only template, no protein anchor.
			//   - breakfast_daily : pinned daily contribution, scaled via per-line
			//                       cut/bulk overrides not packs.
			//   - shish_kebab  : completeness=partial; the meat (and therefore the
			//                    hero) is in the missing[] list.
			const heroless = new Set(["pasta_base", "breakfast_daily", "shish_kebab"]);
			if (heroless.has(recipe.id)) {
				expect(heroes.length).toBe(0);
				return;
			}
			expect(heroes.length, `${recipe.id} must declare exactly one hero`).toBe(1);
		},
	);

	it.each(eligible.flatMap((r) => r.ingredients.map((i) => ({ recipe: r.id, ing: i }))))(
		"$recipe :: $ing.name has a recognised role",
		({ ing }) => {
			expect(["hero", "side", "fixed"]).toContain(ing.role);
		},
	);
});
