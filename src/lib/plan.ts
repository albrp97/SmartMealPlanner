/**
 * Weekly meal-planner helpers.
 *
 * Pure functions only — no DB calls live here. The `/plan` and `/shopping`
 * pages do the I/O and use these helpers for date math, aggregation and
 * shopping-list rounding.
 *
 * Conventions:
 *   - Dates are ISO strings (`YYYY-MM-DD`). All comparisons / arithmetic
 *     happen via `Date` then back through `toIso()` to keep timezone-related
 *     bugs out of the UI layer.
 *   - The week starts on Monday (ISO 8601). The user explicitly said "3
 *     meals per day, breakfast is always the same"; the planner UI seeds the
 *     breakfast slot from the constant `breakfast_daily` recipe.
 */

export const SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
	breakfast: "Breakfast",
	lunch: "Lunch",
	dinner: "Dinner",
};

/** Format a Date as `YYYY-MM-DD` in the local timezone. */
export function toIso(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Return the Monday of the week that contains `d` (local time, ISO 8601). */
export function startOfIsoWeek(d: Date): Date {
	const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const dow = out.getDay(); // 0 = Sun … 6 = Sat
	const offset = dow === 0 ? -6 : 1 - dow; // shift back to Monday
	out.setDate(out.getDate() + offset);
	return out;
}

/** 7 ISO date strings (Mon..Sun) for the week containing `d`. */
export function weekDates(d: Date): string[] {
	const start = startOfIsoWeek(d);
	return Array.from({ length: 7 }, (_, i) => {
		const day = new Date(start);
		day.setDate(start.getDate() + i);
		return toIso(day);
	});
}

/** Pretty short label like "Mon 28". */
export function shortDayLabel(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(y, m - 1, d);
	const wd = date.toLocaleDateString("en-US", { weekday: "short" });
	return `${wd} ${d}`;
}

/**
 * Aggregate a set of recipes (with their per-batch ingredient lines) into a
 * flat shopping list keyed by ingredient. Quantities scale by
 * `(servings_planned / recipe.servings)` so the result represents what the
 * user will actually consume across the plan.
 *
 * Lines whose unit doesn't match the ingredient's package_unit are kept as
 * a separate group so the UI can call them out (we never silently convert).
 */
export interface PlanLineInput {
	recipeId: string;
	recipeServings: number;
	plannedServings: number;
	ingredientId: string;
	ingredientName: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	packageSize: number;
	packageUnit: "g" | "ml" | "unit";
	packagePrice: number | null;
	currency: string;
	priceIsDefault: boolean;
}

export interface ShoppingItem {
	ingredientId: string;
	ingredientName: string;
	totalQuantity: number;
	unit: "g" | "ml" | "unit";
	packageSize: number;
	packageUnit: "g" | "ml" | "unit";
	packages: number; // rounded up
	consumedCost: number | null;
	shoppingCost: number | null;
	currency: string;
	priceIsDefault: boolean;
	unitMismatch: boolean;
	contributingRecipes: string[];
}

export function aggregateShopping(
	lines: PlanLineInput[],
	recipeNamesById: Record<string, string>,
): ShoppingItem[] {
	const buckets = new Map<string, ShoppingItem>();
	for (const l of lines) {
		const factor = l.recipeServings > 0 ? l.plannedServings / l.recipeServings : l.plannedServings;
		const needed = l.quantity * factor;
		const unitMismatch = l.unit !== l.packageUnit;
		const existing = buckets.get(l.ingredientId);
		const recipeName = recipeNamesById[l.recipeId] ?? "(recipe)";
		if (existing) {
			existing.totalQuantity += needed;
			if (!existing.contributingRecipes.includes(recipeName)) {
				existing.contributingRecipes.push(recipeName);
			}
			if (unitMismatch) existing.unitMismatch = true;
		} else {
			buckets.set(l.ingredientId, {
				ingredientId: l.ingredientId,
				ingredientName: l.ingredientName,
				totalQuantity: needed,
				unit: l.unit,
				packageSize: l.packageSize,
				packageUnit: l.packageUnit,
				packages: 0,
				consumedCost: null,
				shoppingCost: null,
				currency: l.currency,
				priceIsDefault: l.priceIsDefault,
				unitMismatch,
				contributingRecipes: [recipeName],
			});
		}
	}

	// Compute packages + cost in a second pass once all quantities are summed.
	const out: ShoppingItem[] = [];
	for (const item of buckets.values()) {
		// Look up the original line that owned the price for this ingredient
		// (any of them — they all carry the same package metadata).
		const sample = lines.find((l) => l.ingredientId === item.ingredientId);
		const price = sample?.packagePrice ?? null;
		if (item.unitMismatch || item.packageSize <= 0) {
			item.packages = 0;
			item.consumedCost = null;
			item.shoppingCost = null;
		} else {
			const ratio = item.totalQuantity / item.packageSize;
			item.packages = Math.ceil(ratio);
			item.consumedCost = price != null ? +(ratio * price).toFixed(2) : null;
			item.shoppingCost = price != null ? +(item.packages * price).toFixed(2) : null;
		}
		out.push(item);
	}
	out.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
	return out;
}
