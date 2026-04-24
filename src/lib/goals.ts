/**
 * Daily kcal + macro targets by goal.
 *
 * Baseline = Mifflin–St Jeor for the user (male, 70 kg, 182 cm, born 1997)
 * × 1.55 activity multiplier (moderately active) ≈ 2640 kcal maintain.
 *
 * Cut / bulk are deliberately **conservative** so we keep muscle on a cut
 * and limit fat gain on a bulk:
 *   - cut  : −15 % kcal, protein bumped to ~2.0 g/kg
 *   - bulk : +10 % kcal, protein held high
 *
 * These are tunable in one place; later phases can move them to a user
 * profile in the DB.
 */

export type Goal = "maintain" | "cut" | "bulk";
export const GOALS: Goal[] = ["maintain", "cut", "bulk"];

export interface DailyTarget {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

export const TARGETS: Record<Goal, DailyTarget> = {
	maintain: { kcal: 2640, protein: 130, carbs: 384, fat: 65 },
	cut: { kcal: 2240, protein: 140, carbs: 285, fat: 60 },
	bulk: { kcal: 2900, protein: 140, carbs: 416, fat: 75 },
};

export const GOAL_LABEL: Record<Goal, string> = {
	maintain: "Maintain",
	cut: "Cut (−15%)",
	bulk: "Bulk (+10%)",
};

export function isGoal(v: string | null | undefined): v is Goal {
	return v === "maintain" || v === "cut" || v === "bulk";
}

export function pct(value: number, target: number): number {
	if (target <= 0) return 0;
	return Math.round((value / target) * 100);
}
