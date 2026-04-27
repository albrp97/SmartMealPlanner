/**
 * Phase 3.5: package-driven serving optimiser.
 *
 * The user buys ingredients in fixed packs (chicken 1000 g, minced chicken
 * 500 g, beans tin 400 g, cheese bag 200 g, onion = 1 unit). We don't know
 * how many "servings" a given cook produces until we know how much of the
 * **hero** ingredient (typically the protein) is committed to it.
 *
 * Concepts:
 *   - Each recipe ingredient line gets a `role`:
 *       hero  : drives portion sizing. Servings = hero_qty / hero_per_serving.
 *               One hero per recipe (we pick the first if multiple).
 *       side  : scales linearly with the hero (rice, pasta, oils, cream).
 *       fixed : stays at recipe default regardless of batch size
 *               (1 onion, 1 stock cube, 1 cheese bag).
 *   - Each ingredient has `divisible`. Divisible ingredients (raw meat, raw
 *     rice, pasta, milk) can be portioned mid-cook without spoilage; their
 *     "packs used" is fractional. Non-divisible ones (cheese bag, beans
 *     tin, onion, eggs) round UP to whole packs and the leftover cost is
 *     sunk into this cook.
 *
 * Pure functions only. No DB access — caller passes plain data.
 */

export type Role = "hero" | "side" | "fixed";

export interface PortionIngredient {
	id: string;
	slug: string;
	name: string;
	divisible: boolean;
	packageSize: number;
	packageUnit: "g" | "ml" | "unit";
	gPerUnit: number | null;
}

export interface PortionLine {
	role: Role;
	quantity: number;
	unit: "g" | "ml" | "unit";
	ingredient: PortionIngredient;
}

export interface PortionRecipe {
	id: string;
	slug: string;
	name: string;
	defaultServings: number;
	lines: PortionLine[];
}

export interface PortionResult {
	servings: number;
	heroLineIndex: number | null; // index into recipe.lines, or null if no hero
	heroQuantity: number; // in the line's unit
	scaled: ScaledLine[];
	feasible: boolean;
	reasons: string[];
}

export interface ScaledLine {
	ingredientId: string;
	ingredientSlug: string;
	ingredientName: string;
	role: Role;
	quantity: number; // in `unit`
	unit: "g" | "ml" | "unit";
	packages: number; // fractional for divisible, ceil() for non-divisible
	packagesPaid: number; // = ceil(packages) for non-divisible, == packages for divisible
}

/** Find the hero line. Returns -1 if no `role === 'hero'` line exists. */
export function findHeroIndex(recipe: PortionRecipe): number {
	return recipe.lines.findIndex((l) => l.role === "hero");
}

/** The recipe's default per-serving amount of the hero, in the hero's unit. */
export function heroPerServing(recipe: PortionRecipe): number | null {
	const i = findHeroIndex(recipe);
	if (i < 0) return null;
	const servings = recipe.defaultServings > 0 ? recipe.defaultServings : 1;
	return recipe.lines[i].quantity / servings;
}

/**
 * Scale every line according to the chosen `heroQuantity`.
 *
 * `heroQuantity` is in the hero line's unit (g for divisible meat, "unit"
 * for non-divisible heroes like puff pastry). Sides scale linearly. Fixed
 * lines stay put.
 *
 * Hard invariant: hero quantity is exactly `heroQuantity` (i.e. exactly
 * `packs × packageSize`). The macro auto-balancer is NOT allowed to
 * fudge it. "1 pack = use the whole pack" is a user-promised contract;
 * showing 250g of beef when the user committed a 500g pack is wrong.
 * If macros need adjusting, only side lines move (see macro-balance.ts).
 */
export function scalePortion(recipe: PortionRecipe, heroQuantity: number): PortionResult {
	const heroIndex = findHeroIndex(recipe);
	const reasons: string[] = [];

	// No hero → recipe is "always cook the default": treat heroQuantity as a
	// servings-multiple instead. This keeps the optimiser useful for the
	// few recipes (oatmeal-only breakfast, pasta_base) that have no protein.
	if (heroIndex < 0) {
		const factor = Math.max(0, heroQuantity);
		const servings = (recipe.defaultServings || 1) * factor;
		return {
			servings,
			heroLineIndex: null,
			heroQuantity,
			scaled: recipe.lines.map((l) => buildScaled(l, l.quantity * factor)),
			feasible: factor > 0,
			reasons,
		};
	}

	const hero = recipe.lines[heroIndex];
	const heroDefault = hero.quantity;
	if (heroDefault <= 0) {
		reasons.push("hero default quantity is zero");
		return zero(recipe, heroIndex, heroQuantity, reasons);
	}

	// Servings derived from how much hero is committed.
	const heroPS = heroDefault / Math.max(1, recipe.defaultServings);
	const rawServings = heroQuantity / heroPS;
	const servings = hero.ingredient.divisible ? rawServings : Math.max(0, Math.round(rawServings));

	if (!Number.isFinite(servings) || servings <= 0) {
		reasons.push("computed servings is zero");
		return zero(recipe, heroIndex, heroQuantity, reasons);
	}

	const sideScale = servings / Math.max(1, recipe.defaultServings);
	const scaled = recipe.lines.map((line, i) => {
		if (i === heroIndex) {
			// Hero is exactly what the user committed — no fudging. For
			// non-divisible whole-unit heroes (puff pastry), snap to a
			// whole number so we don't end up with 1.7 sheets.
			const q =
				hero.ingredient.divisible || hero.unit !== "unit"
					? heroQuantity
					: Math.max(1, Math.round(heroQuantity));
			return buildScaled(line, q);
		}
		// Side lines scale with the hero. Fixed lines stay at recipe default.
		// For non-divisible ingredients (a whole onion, a whole tortilla
		// pack, a single egg) round the scaled quantity to a whole number
		// — you can't cook with 0.33 of an onion or 4.2 tortillas.
		const raw = line.role === "fixed" ? line.quantity : line.quantity * sideScale;
		const q = needsWholeUnits(line) ? Math.max(0, Math.round(raw)) : raw;
		return buildScaled(line, q);
	});

	return {
		servings,
		heroLineIndex: heroIndex,
		heroQuantity,
		scaled,
		feasible: true,
		reasons,
	};
}

function zero(
	recipe: PortionRecipe,
	heroIndex: number,
	heroQuantity: number,
	reasons: string[],
): PortionResult {
	return {
		servings: 0,
		heroLineIndex: heroIndex,
		heroQuantity,
		scaled: recipe.lines.map((l) => buildScaled(l, 0)),
		feasible: false,
		reasons,
	};
}

/**
 * True when a line's quantity has to be a whole number of items. Applies
 * to non-divisible ingredients measured in `unit` (one tortilla, one
 * onion, one stock cube). Non-divisible items measured in g/ml (cheese
 * bag, beans tin) can have a fractional grams used out of one whole pack
 * — the leftover is just sunk into the cook cost-wise.
 */
function needsWholeUnits(line: PortionLine): boolean {
	return !line.ingredient.divisible && line.unit === "unit";
}

function buildScaled(line: PortionLine, quantity: number): ScaledLine {
	const packs = packagesFor(line.ingredient, line.unit, quantity);
	const packagesPaid = line.ingredient.divisible ? packs : Math.ceil(packs);
	return {
		ingredientId: line.ingredient.id,
		ingredientSlug: line.ingredient.slug,
		ingredientName: line.ingredient.name,
		role: line.role,
		quantity,
		unit: line.unit,
		packages: packs,
		packagesPaid,
	};
}

/**
 * How many packages of an ingredient does `quantity` of `unit` represent?
 *
 * Handles the unit/g mismatch via `gPerUnit` (eggs are sold by 10/box, but
 * a recipe might ask for "1 egg" or "60 g"). Returns 0 if the conversion
 * is impossible — caller treats missing data as feasible-but-noisy.
 */
export function packagesFor(
	ing: PortionIngredient,
	unit: "g" | "ml" | "unit",
	quantity: number,
): number {
	if (quantity <= 0) return 0;
	if (ing.packageSize <= 0) return 0;
	if (unit === ing.packageUnit) return quantity / ing.packageSize;
	// unit ↔ g via gPerUnit
	if (unit === "unit" && ing.packageUnit === "g" && ing.gPerUnit && ing.gPerUnit > 0) {
		return (quantity * ing.gPerUnit) / ing.packageSize;
	}
	if (unit === "g" && ing.packageUnit === "unit" && ing.gPerUnit && ing.gPerUnit > 0) {
		return quantity / ing.gPerUnit / ing.packageSize;
	}
	// ml ↔ g intentionally not handled here — recipes are authored to match
	// the package_unit for liquids, and density lives in the nutrition
	// engine (where it actually matters).
	return 0;
}

/**
 * Suggest a hero quantity that lands close to a per-serving kcal target.
 *
 * Inputs:
 *   - recipe: the recipe with its hero designated
 *   - kcalPerServing: the recipe's current per-serving kcal (from
 *     nutrition engine, already accounts for sides and fixed)
 *   - targetKcalPerServing: what we want a plate to be
 *
 * Returns a hero quantity. For non-divisible heroes we round to whole
 * packs of the hero's package size.
 */
export function suggestHeroQuantity(
	recipe: PortionRecipe,
	kcalPerServing: number,
	targetKcalPerServing: number,
): number {
	const heroIdx = findHeroIndex(recipe);
	if (heroIdx < 0 || kcalPerServing <= 0 || targetKcalPerServing <= 0) {
		return recipe.lines[heroIdx]?.quantity ?? 0;
	}
	const hero = recipe.lines[heroIdx];
	const heroPS = hero.quantity / Math.max(1, recipe.defaultServings);
	const ratio = targetKcalPerServing / kcalPerServing;
	const want = heroPS * ratio * recipe.defaultServings;
	if (hero.ingredient.divisible) {
		return Math.max(1, Math.round(want));
	}
	// snap to whole packs of the hero
	const pack = hero.ingredient.packageSize;
	const wantPacks = Math.max(1, Math.round(want / pack));
	return wantPacks * pack;
}
