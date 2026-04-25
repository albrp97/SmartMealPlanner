/**
 * Daily kcal + macro targets by goal.
 *
 * Baseline = Mifflin–St Jeor for the user (male, 70 kg, 182 cm, born 1997)
 * × 1.55 activity multiplier (moderately active) ≈ 2640 kcal maintain.
 *
 * Macro split: **20 % protein / 50 % carbs / 30 % fat** by kcal at maintain
 * (1 g P/C = 4 kcal, 1 g F = 9 kcal). On a cut we keep protein around
 * 2 g/kg to spare muscle, which lifts protein's kcal share to ~25 %; the
 * remainder is split 45 % C / 30 % F.
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
	// 2640 kcal · 20 % P (132 g) · 50 % C (330 g) · 30 % F (88 g)
	maintain: { kcal: 2640, protein: 132, carbs: 330, fat: 88 },
	// 2240 kcal · ~25 % P (140 g) · 45 % C (252 g) · 30 % F (75 g)
	cut: { kcal: 2240, protein: 140, carbs: 252, fat: 75 },
	// 2900 kcal · 20 % P (145 g) · 50 % C (363 g) · 30 % F (97 g)
	bulk: { kcal: 2900, protein: 145, carbs: 363, fat: 97 },
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
