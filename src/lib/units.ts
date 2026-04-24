/**
 * Unit conversion for the nutrition engine.
 *
 * Recipes store quantities in `g | ml | unit`. Ingredient nutrition is
 * stored *per 100 g* (or per-serving for supplements). To compute macros
 * for a recipe line we must convert the recipe quantity into grams.
 *
 * Conversion rules (in priority order):
 *   - g                           → grams (identity)
 *   - ml + density_g_per_ml       → grams (multiply)
 *   - ml + no density             → grams (assume 1.0 g/ml, e.g. water/stock)
 *   - unit + g_per_unit           → grams (multiply)
 *   - unit + no g_per_unit        → null (caller decides how to flag it)
 *
 * Supplements bypass this entirely: nutrition fields are per *serving* and
 * `quantity` is interpreted as servings (1 unit = 1 serving). See
 * `nutrition.ts`.
 */

export type CookUnit = "g" | "ml" | "unit";

export interface UnitConvertibleIngredient {
	gPerUnit: number | null;
	densityGPerMl: number | null;
}

export type ToGramsResult =
	| { grams: number; assumed?: "density_1" }
	| { grams: null; reason: "missing_g_per_unit" };

/**
 * Convert a recipe quantity into grams using ingredient metadata.
 *
 * `assumed: "density_1"` is set when we used the 1.0 g/ml fallback, so the
 * UI can surface a soft warning ("approx., density not set").
 */
export function toGrams(
	quantity: number,
	unit: CookUnit,
	ingredient: UnitConvertibleIngredient,
): ToGramsResult {
	if (unit === "g") return { grams: quantity };

	if (unit === "ml") {
		const d = ingredient.densityGPerMl;
		if (d != null && d > 0) return { grams: quantity * d };
		return { grams: quantity, assumed: "density_1" };
	}

	// unit === "unit"
	const gpu = ingredient.gPerUnit;
	if (gpu != null && gpu > 0) return { grams: quantity * gpu };
	return { grams: null, reason: "missing_g_per_unit" };
}
