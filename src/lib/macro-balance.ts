/**
 * Phase 3.8: per-goal three-scalar auto-balancer.
 *
 * The plan page picks recipes + hero packs. To make any plan land on the
 * goal's kcal+P+C+F targets without touching ingredient quantities by
 * hand, we classify each scalable ingredient line by its dominant macro
 * (protein / carb / fat source) and solve for three scalars (sP, sC, sF)
 * so that scaling each class's lines hits the target macros simultaneously.
 *
 * Why three scalars and not one? A single scalar can hit kcal but never
 * balances macros — bulking past target on carbs while still being short
 * on protein, etc. Three classes give us three degrees of freedom for
 * three constraints (P, C, F target grams). kcal falls out automatically
 * because kcal = 4P + 4C + 9F.
 *
 * Hero and fixed lines are NEVER scaled (hero is set by hero packs;
 * fixed = 1 onion / 1 stock cube). Only side lines participate.
 *
 * Each scalar is clamped to [0.25, 4.0] so a wildly mismatched plan
 * doesn't produce absurd quantities. If the linear system is singular
 * (e.g. no fat-source side line in the whole plan) we fall back to a
 * single-kcal scalar.
 */
import type { NutritionIngredient } from "@/lib/nutrition";
import { type CookUnit, toGrams } from "@/lib/units";

export type MacroClass = "P" | "C" | "F" | null;

export interface BalanceLine {
	role: "hero" | "side" | "fixed" | null;
	quantity: number;
	unit: CookUnit;
	ingredient: NutritionIngredient | null;
}

export interface BalanceEntry {
	servings: number;
	cookLines: BalanceLine[];
}

export interface BalanceTarget {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

export interface BalanceInput {
	breakfastDaily: BalanceTarget;
	entries: BalanceEntry[];
	target: BalanceTarget;
}

export interface BalanceResult {
	scales: { P: number; C: number; F: number };
	clamped: boolean;
	/** True if we fell back to a single-kcal scalar (degenerate plan). */
	fallback: boolean;
}

const MIN_SCALE = 0;
const MAX_SCALE = 4.0;
/**
 * Aim slightly under the kcal target so the resulting plan lands in the
 * 90–100 % band (the user's preferred range — better to be a touch
 * under than over). Only the kcal axis of the LSQ target is biased;
 * protein/carbs/fat targets stay nominal.
 */
const KCAL_TARGET_BIAS = 0.95;
/**
 * Weights for the least-squares objective. kcal matters most (energy
 * balance), then protein (body comp), then carbs and fat. Tuned so a
 * 100-kcal miss costs about as much as an 8 g protein miss.
 */
const WEIGHTS = { kcal: 1 / 100, protein: 1 / 8, carbs: 1 / 30, fat: 1 / 12 } as const;

/**
 * Classify an ingredient by which macro contributes the most kcal/100g.
 * Returns null for nutrition-less items (e.g. salt, water, missing data).
 */
export function classifyIngredient(ing: NutritionIngredient | null): MacroClass {
	if (!ing) return null;
	const p = (ing.proteinPer100g ?? 0) * 4;
	const c = (ing.carbsPer100g ?? 0) * 4;
	const f = (ing.fatPer100g ?? 0) * 9;
	const total = p + c + f;
	if (total <= 0) return null;
	if (p >= c && p >= f) return "P";
	if (c >= f) return "C";
	return "F";
}

interface Macros {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

function lineMacros(line: BalanceLine): Macros {
	const ing = line.ingredient;
	if (!ing || ing.kcalPer100g == null) return ZERO;
	let factor: number;
	if (ing.isSupplement) {
		factor = line.quantity;
	} else {
		const conv = toGrams(line.quantity, line.unit, ing);
		if (conv.grams == null) return ZERO;
		factor = conv.grams / 100;
	}
	return {
		kcal: (ing.kcalPer100g ?? 0) * factor,
		protein: (ing.proteinPer100g ?? 0) * factor,
		carbs: (ing.carbsPer100g ?? 0) * factor,
		fat: (ing.fatPer100g ?? 0) * factor,
	};
}

function add(a: Macros, b: Macros): Macros {
	return {
		kcal: a.kcal + b.kcal,
		protein: a.protein + b.protein,
		carbs: a.carbs + b.carbs,
		fat: a.fat + b.fat,
	};
}

export function computeMacroScales(input: BalanceInput): BalanceResult {
	// Per-day macros from non-scalable sources (breakfast + hero
	// + neutral-class lines like salt/spices).
	let nonScalable: Macros = {
		kcal: input.breakfastDaily.kcal,
		protein: input.breakfastDaily.protein,
		carbs: input.breakfastDaily.carbs,
		fat: input.breakfastDaily.fat,
	};
	// Per-day macros contributed by each class at scale = 1.
	const classDaily: Record<"P" | "C" | "F", Macros> = {
		P: { ...ZERO },
		C: { ...ZERO },
		F: { ...ZERO },
	};

	for (const e of input.entries) {
		const days = Math.max(1, e.servings);
		for (const line of e.cookLines) {
			const m = lineMacros(line);
			const perDay: Macros = {
				kcal: m.kcal / days,
				protein: m.protein / days,
				carbs: m.carbs / days,
				fat: m.fat / days,
			};
			// Fixed lines (1 onion, 2 puff pastries, breakfast olive oil) are
			// NEVER scaled by the planner — see DEVELOPER_GUIDE §4.2. Bucket
			// them into nonScalable so the balancer's prediction matches what
			// actually happens at render time. Heroes ARE scaled (clamped
			// downstream by heroFactor 0.5–1.75) and sides are scaled by the
			// class scalar; both go into classDaily.
			if (line.role === "fixed") {
				nonScalable = add(nonScalable, perDay);
				continue;
			}
			const cls = classifyIngredient(line.ingredient);
			if (cls) {
				classDaily[cls] = add(classDaily[cls], perDay);
				continue;
			}
			nonScalable = add(nonScalable, perDay);
		}
	}

	const allClasses: ("P" | "C" | "F")[] = ["P", "C", "F"];
	const macroKeys: ("kcal" | "protein" | "carbs" | "fat")[] = ["kcal", "protein", "carbs", "fat"];
	const active = allClasses.filter((c) => classDaily[c].kcal > 1e-6);

	const scales: Record<"P" | "C" | "F", number> = { P: 1, C: 1, F: 1 };

	if (active.length === 0) {
		return { scales, clamped: false, fallback: true };
	}

	// Bounded coordinate-descent least squares. For each class in turn,
	// find the optimal scalar that minimises the weighted squared error
	// across (kcal, P, C, F), holding the other two fixed. Closed form
	// for a single variable; clamp to [MIN_SCALE, MAX_SCALE]. Always
	// converges (objective is convex quadratic on a box).
	for (let iter = 0; iter < 100; iter++) {
		let maxDelta = 0;
		for (const c of active) {
			// Predicted macro_i with current scales = nonScalable_i + Σ s_c' * classDaily[c']_i
			// Holding other classes fixed, the residual K_i = target_i - (nonScalable_i + Σ_{c'≠c} s_c' * classDaily[c']_i)
			// We want to minimise Σ w_i (K_i - s_c * a_i)^2 where a_i = classDaily[c]_i.
			// Optimal s_c = (Σ w_i a_i K_i) / (Σ w_i a_i^2).
			let num = 0;
			let den = 0;
			for (const mk of macroKeys) {
				let predOther = nonScalable[mk];
				for (const cp of active) {
					if (cp === c) continue;
					predOther += scales[cp] * classDaily[cp][mk];
				}
				// Bias kcal target down so we land in the 90–100 % band rather
				// than straddling 100 %. Overshoot is the worse failure mode
				// because of fat-heavy fixed lines (puff pastry, cheese,
				// breakfast olive oil) the balancer can't touch.
				const aimed = mk === "kcal" ? input.target[mk] * KCAL_TARGET_BIAS : input.target[mk];
				const K = aimed - predOther;
				const a = classDaily[c][mk];
				const w = WEIGHTS[mk];
				num += w * a * K;
				den += w * a * a;
			}
			if (den < 1e-12) continue;
			const raw = num / den;
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
			maxDelta = Math.max(maxDelta, Math.abs(next - scales[c]));
			scales[c] = next;
		}
		if (maxDelta < 1e-5) break;
	}

	const clamped = active.some((c) => scales[c] === MIN_SCALE || scales[c] === MAX_SCALE);

	return { scales, clamped, fallback: false };
}
