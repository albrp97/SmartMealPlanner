/**
 * Glue between `/plan` page data and the Phase 3.5 portion optimiser.
 *
 * The planner stores `meal_plan_entries.servings` as **hero packs** — the
 * integer number of packages of the recipe's hero ingredient committed to
 * this cook. Everything else (servings cooked, per-serving macros, the
 * shopping list) is derived from that single number plus the recipe data.
 *
 * Recipes with no hero (e.g. `pasta_base`) fall back to the legacy
 * "batches" interpretation inside `scalePortion`.
 */
import type { PortionLine, PortionRecipe, ScaledLine } from "@/lib/portion";
import { findHeroIndex, scalePortion } from "@/lib/portion";

export interface PlanRecipeRow {
	id: string;
	slug: string;
	name: string;
	servings: number;
	recipe_ingredients: {
		id: string;
		quantity: number;
		unit: "g" | "ml" | "unit";
		role: "hero" | "side" | "fixed" | null;
		ingredients: {
			id: string;
			slug: string;
			name: string;
			divisible: boolean | null;
			package_size: number;
			package_unit: "g" | "ml" | "unit";
			g_per_unit: number | null;
		} | null;
	}[];
}

export function toPortionRecipe(r: PlanRecipeRow): PortionRecipe {
	const lines: PortionLine[] = [];
	for (const li of r.recipe_ingredients) {
		if (!li.ingredients) continue;
		lines.push({
			role: li.role ?? "side",
			quantity: li.quantity,
			unit: li.unit,
			ingredient: {
				id: li.ingredients.id,
				slug: li.ingredients.slug,
				name: li.ingredients.name,
				divisible: li.ingredients.divisible ?? true,
				packageSize: li.ingredients.package_size,
				packageUnit: li.ingredients.package_unit,
				gPerUnit: li.ingredients.g_per_unit,
			},
		});
	}
	return {
		id: r.id,
		slug: r.slug,
		name: r.name,
		defaultServings: r.servings,
		lines,
	};
}

/**
 * Convert "N hero packs" into the hero quantity expressed in the hero
 * line's recipe unit.
 *
 * Examples:
 *   - chicken pack = 1000 g, recipe asks "chicken 100 g"  →  packs * 1000
 *   - puff_pastry pack = 1 unit, recipe asks "puff_pastry 2 unit" → packs * 1
 *   - chorizo pack = 1 unit (whole sausage ~250 g) but recipe asks "chorizo 80 g"
 *     → packs * gPerUnit (if set) else packs * packageSize (assume 1 unit pack)
 *
 * For recipes without a hero, returns `packs` directly (used as a
 * legacy-style multiplier inside `scalePortion`).
 */
export function heroQuantityFromPacks(recipe: PortionRecipe, packs: number): number {
	const i = findHeroIndex(recipe);
	if (i < 0) return packs;
	const hero = recipe.lines[i];
	const ing = hero.ingredient;
	if (hero.unit === ing.packageUnit) {
		return packs * ing.packageSize;
	}
	// unit mismatch: try gPerUnit conversion.
	if (hero.unit === "g" && ing.packageUnit === "unit" && ing.gPerUnit) {
		return packs * ing.packageSize * ing.gPerUnit;
	}
	if (hero.unit === "unit" && ing.packageUnit === "g" && ing.gPerUnit) {
		return (packs * ing.packageSize) / ing.gPerUnit;
	}
	// Last-ditch: scale the recipe's default hero quantity by packs.
	return packs * hero.quantity;
}

/**
 * Aggregate the shopping list directly from already-scaled lines.
 *
 * For each ingredient: sum the consumed quantity, sum the packs paid for
 * (which honours `divisible` — non-divisible ingredients always round up).
 */
export interface ShoppingItem {
	ingredientId: string;
	ingredientName: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	packageSize: number;
	packageUnit: "g" | "ml" | "unit";
	packagesPaid: number; // integer for non-divisible, fractional for divisible (rendered as ceil for cost)
	consumedRatio: number; // packagesPaid for divisible, sum(quantity)/packageSize for non-divisible
	contributingRecipes: string[];
}

export function aggregateScaledShopping(
	scaledByRecipe: { recipeName: string; lines: ScaledLine[] }[],
	packageMeta: Map<
		string,
		{ packageSize: number; packageUnit: "g" | "ml" | "unit"; divisible: boolean }
	>,
): ShoppingItem[] {
	const buckets = new Map<string, ShoppingItem>();
	for (const { recipeName, lines } of scaledByRecipe) {
		for (const l of lines) {
			const meta = packageMeta.get(l.ingredientId);
			if (!meta) continue;
			const existing = buckets.get(l.ingredientId);
			if (existing) {
				existing.quantity += l.quantity;
				if (!existing.contributingRecipes.includes(recipeName)) {
					existing.contributingRecipes.push(recipeName);
				}
			} else {
				buckets.set(l.ingredientId, {
					ingredientId: l.ingredientId,
					ingredientName: l.ingredientName,
					quantity: l.quantity,
					unit: l.unit,
					packageSize: meta.packageSize,
					packageUnit: meta.packageUnit,
					packagesPaid: 0,
					consumedRatio: 0,
					contributingRecipes: [recipeName],
				});
			}
		}
	}
	const out: ShoppingItem[] = [];
	for (const it of buckets.values()) {
		const meta = packageMeta.get(it.ingredientId);
		if (!meta) continue;
		// Compute packs from the aggregate, not by summing per-recipe ceilings
		// (which would double-count fractional waste across recipes).
		const ratio = meta.packageSize > 0 ? it.quantity / meta.packageSize : 0;
		it.packagesPaid = meta.divisible ? ratio : Math.ceil(ratio);
		it.consumedRatio = ratio;
		out.push(it);
	}
	out.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
	return out;
}
