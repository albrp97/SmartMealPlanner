/**
 * Recipe cost calculator.
 *
 * Costing model: a recipe needs `quantity` of an ingredient (in `unit`),
 * but the ingredient is sold as a fixed-size package at `package_price`.
 * Cost contribution = (needed / package_size) * package_price, **without
 * rounding up** — at the recipe level we want the proportional cost of what
 * was actually used, not what had to be bought.
 *
 * The shopping-list generator (Phase 2) will be the place that rounds *up*
 * to whole packages across many recipes.
 *
 * Returns `null` for an item if its package_price is unknown OR units don't
 * line up (e.g. recipe asks "g" but ingredient is sold per "unit"). The total
 * is the sum of known costs and a flag tells callers if anything was missing.
 */

export interface CostIngredient {
	package_price: number | null;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	currency: string;
}

export interface CostLineInput {
	ingredient: CostIngredient;
	quantity: number;
	unit: "g" | "ml" | "unit";
}

export interface CostLineResult {
	cost: number | null;
	currency: string;
	reason?: "no_price" | "unit_mismatch";
}

export interface RecipeCostResult {
	currency: string;
	total: number;
	lines: CostLineResult[];
	hasUnknown: boolean;
}

export function computeLineCost(input: CostLineInput): CostLineResult {
	const { ingredient, quantity, unit } = input;
	if (ingredient.package_price == null) {
		return { cost: null, currency: ingredient.currency, reason: "no_price" };
	}
	if (unit !== ingredient.package_unit) {
		return { cost: null, currency: ingredient.currency, reason: "unit_mismatch" };
	}
	if (ingredient.package_size <= 0) {
		return { cost: null, currency: ingredient.currency, reason: "unit_mismatch" };
	}
	const cost = (quantity / ingredient.package_size) * ingredient.package_price;
	return { cost, currency: ingredient.currency };
}

export function computeRecipeCost(lines: CostLineInput[], currency = "CZK"): RecipeCostResult {
	const results = lines.map(computeLineCost);
	const total = results.reduce((acc, r) => acc + (r.cost ?? 0), 0);
	const hasUnknown = results.some((r) => r.cost == null);
	return { currency, total, lines: results, hasUnknown };
}
