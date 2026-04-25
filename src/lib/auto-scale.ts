/**
 * Phase 3.7: per-goal auto-scaler.
 *
 * Given the current plan (breakfast pinned + N lunch/dinner cooks at chosen
 * hero packs), find a single multiplier `s` such that scaling every
 * **side** ingredient line's quantity by `s` makes the resulting daily
 * kcal total equal the goal target. Hero lines are not touched (they
 * drive servings/cook), neither are fixed lines (1 onion is 1 onion).
 *
 * Why a single scalar and not per-recipe / per-line?
 *   - The user's only knobs on `/plan` are recipe choice and hero packs.
 *     They don't want to tweak ingredients. A uniform side scalar is the
 *     simplest deterministic adjustment that visibly hits the kcal target
 *     and moves macros proportionally with it.
 *   - Per-recipe scalars would be underdetermined (one goal, many recipes)
 *     and would need an arbitrary tie-breaker. Uniform is predictable.
 *
 * The scalar is clamped to [0.1, 5.0] to avoid pathological output if the
 * baseline is very far from the goal (rare; would require absurd plans).
 */
import type { NutritionIngredient } from "@/lib/nutrition";
import { type CookUnit, toGrams } from "@/lib/units";

export interface AutoScaleLine {
	role: "hero" | "side" | "fixed" | null;
	quantity: number;
	unit: CookUnit;
	ingredient: NutritionIngredient | null;
}

export interface AutoScaleEntry {
	/** Number of times this cook contributes per day. = servings cooked. */
	servings: number;
	/**
	 * The recipe lines for the *whole cook* (post hero-packs scaling but
	 * pre per-goal side scaling). Quantities are for the cook, not per
	 * serving — the auto-scaler divides by `servings` internally.
	 */
	cookLines: AutoScaleLine[];
}

export interface AutoScaleInput {
	/** Per-day kcal/macros eaten from breakfast (already divided by 1 day). */
	breakfastDaily: { kcal: number; protein: number; carbs: number; fat: number };
	entries: AutoScaleEntry[];
	targetKcal: number;
}

export interface AutoScaleResult {
	/** The chosen multiplier applied to every side line. */
	sideScale: number;
	/** True if we hit the target within ±0.5 %. */
	onTarget: boolean;
	/** True if the scalar was clamped (goal unreachable from this plan). */
	clamped: boolean;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;

function lineKcal(line: AutoScaleLine): number {
	if (!line.ingredient || line.ingredient.kcalPer100g == null) return 0;
	if (line.ingredient.isSupplement) {
		return line.ingredient.kcalPer100g * line.quantity;
	}
	const conv = toGrams(line.quantity, line.unit, line.ingredient);
	if (conv.grams == null) return 0;
	return (conv.grams / 100) * line.ingredient.kcalPer100g;
}

export function computeSideScale(input: AutoScaleInput): AutoScaleResult {
	const { breakfastDaily, entries, targetKcal } = input;

	// Per-day kcal from non-side sources (breakfast + hero + fixed).
	let nonSideDaily = breakfastDaily.kcal;
	// Per-day kcal from side lines, evaluated at scalar = 1.
	let sideDailyAtOne = 0;

	for (const e of entries) {
		const days = Math.max(1, e.servings);
		for (const line of e.cookLines) {
			const k = lineKcal(line) / days;
			if (line.role === "side") sideDailyAtOne += k;
			else nonSideDaily += k;
		}
	}

	if (sideDailyAtOne <= 0) {
		// Nothing to scale — return identity.
		return { sideScale: 1, onTarget: Math.abs(nonSideDaily - targetKcal) < 1, clamped: false };
	}

	const raw = (targetKcal - nonSideDaily) / sideDailyAtOne;
	const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
	const clamped = clampedScale !== raw;

	const finalKcal = nonSideDaily + clampedScale * sideDailyAtOne;
	const onTarget = Math.abs(finalKcal - targetKcal) / Math.max(1, targetKcal) < 0.005;

	return { sideScale: clampedScale, onTarget, clamped };
}
