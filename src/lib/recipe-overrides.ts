/**
 * Phase 3.6: per-goal ingredient quantity overrides.
 *
 * Maintain is the baseline — every line uses its `recipe_ingredients.quantity`.
 * Cut and bulk store sparse overrides keyed by `recipe_ingredient_id`; a row
 * with `quantity = 0` means "drop this line at this goal" (e.g. quit cheese
 * on cut). Pure functions only; the DB layer hands us the override map.
 */
import type { Goal } from "@/lib/goals";

export type Overrides = Map<string, { cut?: number; bulk?: number }>;

/**
 * Apply per-goal overrides to a list of recipe ingredient lines. Returns
 * the effective lines for the chosen goal, with `quantity = 0` lines
 * filtered out. The line shape is preserved — only `quantity` is touched.
 */
export function applyGoalOverrides<L extends { id: string; quantity: number }>(
	lines: L[],
	goal: Goal,
	overrides: Overrides,
): L[] {
	if (goal === "maintain") return lines;
	const out: L[] = [];
	for (const l of lines) {
		const ov = overrides.get(l.id);
		const q = goal === "cut" ? ov?.cut : ov?.bulk;
		const effective = q ?? l.quantity;
		if (effective <= 0) continue; // skipped at this goal
		out.push({ ...l, quantity: effective });
	}
	return out;
}

/**
 * Build an `Overrides` map from a flat list of DB rows. Used by both the
 * planner and the recipe-edit page so the data shape is consistent.
 */
export function buildOverrideMap(
	rows: { recipe_ingredient_id: string; goal: "cut" | "bulk"; quantity: number }[],
): Overrides {
	const m: Overrides = new Map();
	for (const r of rows) {
		const e = m.get(r.recipe_ingredient_id) ?? {};
		if (r.goal === "cut") e.cut = r.quantity;
		else e.bulk = r.quantity;
		m.set(r.recipe_ingredient_id, e);
	}
	return m;
}
