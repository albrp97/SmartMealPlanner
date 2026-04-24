/**
 * Recipe nutrition calculator.
 *
 * Convention recap:
 *   - Recipe `quantity` is for the **whole cook** (e.g. pasta with meat for 5
 *     plates lists 500 g pasta). Per-plate values divide by `recipes.servings`.
 *   - Whole foods: macros are stored per 100 g. We convert the recipe quantity
 *     to grams (see `units.ts`) and scale linearly.
 *   - Supplements (`is_supplement = true`): macro fields are per *serving*.
 *     Recipe `quantity` is interpreted as servings (so `1 unit = 1 serving`).
 *
 * Lines with missing data (no kcal_per_100g, or unit→g conversion fails) are
 * tracked via `missing` so the UI can show a "partial nutrition" badge instead
 * of silently underreporting.
 */

import { type CookUnit, type UnitConvertibleIngredient, toGrams } from "@/lib/units";

export interface NutritionMacros {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
	fiber: number;
}

export interface NutritionIngredient extends UnitConvertibleIngredient {
	isSupplement: boolean;
	kcalPer100g: number | null;
	proteinPer100g: number | null;
	carbsPer100g: number | null;
	fatPer100g: number | null;
	fiberPer100g: number | null;
}

export interface NutritionLineInput {
	ingredient: NutritionIngredient;
	quantity: number;
	unit: CookUnit;
}

export interface NutritionLineResult {
	macros: NutritionMacros | null;
	reason?: "no_nutrition" | "missing_g_per_unit";
}

export interface RecipeNutritionResult {
	/** Sum across all lines. */
	total: NutritionMacros;
	/** total / servings, rounded for display. */
	perServing: NutritionMacros;
	lines: NutritionLineResult[];
	/** True if any line could not be computed (missing macros or unit data). */
	missing: boolean;
}

const ZERO: NutritionMacros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

function scale(per100g: number | null, factor: number): number {
	return per100g == null ? 0 : per100g * factor;
}

export function computeLineNutrition(input: NutritionLineInput): NutritionLineResult {
	const { ingredient, quantity, unit } = input;

	if (ingredient.isSupplement) {
		// Per-serving fields; quantity is servings (typically 1 unit = 1 serving).
		// We accept any unit here — supplements rarely use g/ml meaningfully in recipes,
		// but if they do (e.g. 5 g of creatine = 1 scoop) we still treat quantity as servings.
		if (ingredient.kcalPer100g == null) {
			return { macros: null, reason: "no_nutrition" };
		}
		return {
			macros: {
				kcal: scale(ingredient.kcalPer100g, quantity),
				protein: scale(ingredient.proteinPer100g, quantity),
				carbs: scale(ingredient.carbsPer100g, quantity),
				fat: scale(ingredient.fatPer100g, quantity),
				fiber: scale(ingredient.fiberPer100g, quantity),
			},
		};
	}

	if (ingredient.kcalPer100g == null) {
		return { macros: null, reason: "no_nutrition" };
	}

	const conv = toGrams(quantity, unit, ingredient);
	if (conv.grams == null) {
		return { macros: null, reason: "missing_g_per_unit" };
	}
	const factor = conv.grams / 100;
	return {
		macros: {
			kcal: scale(ingredient.kcalPer100g, factor),
			protein: scale(ingredient.proteinPer100g, factor),
			carbs: scale(ingredient.carbsPer100g, factor),
			fat: scale(ingredient.fatPer100g, factor),
			fiber: scale(ingredient.fiberPer100g, factor),
		},
	};
}

function addMacros(a: NutritionMacros, b: NutritionMacros): NutritionMacros {
	return {
		kcal: a.kcal + b.kcal,
		protein: a.protein + b.protein,
		carbs: a.carbs + b.carbs,
		fat: a.fat + b.fat,
		fiber: a.fiber + b.fiber,
	};
}

function roundMacros(m: NutritionMacros): NutritionMacros {
	return {
		kcal: Math.round(m.kcal),
		protein: Math.round(m.protein * 10) / 10,
		carbs: Math.round(m.carbs * 10) / 10,
		fat: Math.round(m.fat * 10) / 10,
		fiber: Math.round(m.fiber * 10) / 10,
	};
}

export function computeRecipeNutrition(
	lines: NutritionLineInput[],
	servings: number,
): RecipeNutritionResult {
	const results = lines.map(computeLineNutrition);
	const total = results.reduce((acc, r) => (r.macros ? addMacros(acc, r.macros) : acc), ZERO);
	const safeServings = servings > 0 ? servings : 1;
	const perServing: NutritionMacros = {
		kcal: total.kcal / safeServings,
		protein: total.protein / safeServings,
		carbs: total.carbs / safeServings,
		fat: total.fat / safeServings,
		fiber: total.fiber / safeServings,
	};
	const missing = results.some((r) => r.macros == null);
	return {
		total: roundMacros(total),
		perServing: roundMacros(perServing),
		lines: results,
		missing,
	};
}
