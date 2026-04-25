import { describe, expect, it } from "vitest";
import { type AutoScaleInput, computeSideScale } from "@/lib/auto-scale";

const ing = (kcal: number) => ({
	gPerUnit: null,
	densityGPerMl: null,
	isSupplement: false,
	kcalPer100g: kcal,
	proteinPer100g: 0,
	carbsPer100g: 0,
	fatPer100g: 0,
	fiberPer100g: 0,
});

describe("computeSideScale", () => {
	it("scales sides up when target > baseline", () => {
		const input: AutoScaleInput = {
			breakfastDaily: { kcal: 500, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 1,
					cookLines: [
						{ role: "hero", quantity: 100, unit: "g", ingredient: ing(200) }, // 200 kcal
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(100) }, // 100 kcal
					],
				},
			],
			targetKcal: 1000, // need 200 more from side, baseline gives 100
		};
		const r = computeSideScale(input);
		expect(r.sideScale).toBeCloseTo(3, 5); // (1000-500-200)/100 = 3
		expect(r.onTarget).toBe(true);
		expect(r.clamped).toBe(false);
	});

	it("scales sides down when target < baseline", () => {
		const input: AutoScaleInput = {
			breakfastDaily: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 2,
					cookLines: [
						{ role: "hero", quantity: 200, unit: "g", ingredient: ing(100) }, // 200 kcal/cook = 100/day
						{ role: "side", quantity: 200, unit: "g", ingredient: ing(100) }, // 200 kcal/cook = 100/day
					],
				},
			],
			targetKcal: 150, // need 50 from side
		};
		const r = computeSideScale(input);
		expect(r.sideScale).toBeCloseTo(0.5, 5);
		expect(r.onTarget).toBe(true);
	});

	it("returns identity when there are no side lines", () => {
		const input: AutoScaleInput = {
			breakfastDaily: { kcal: 100, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 1,
					cookLines: [
						{ role: "hero", quantity: 100, unit: "g", ingredient: ing(200) },
						{ role: "fixed", quantity: 1, unit: "unit", ingredient: ing(50) },
					],
				},
			],
			targetKcal: 9999,
		};
		const r = computeSideScale(input);
		expect(r.sideScale).toBe(1);
	});

	it("clamps when target is unreachable", () => {
		const input: AutoScaleInput = {
			breakfastDaily: { kcal: 5000, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 1,
					cookLines: [{ role: "side", quantity: 100, unit: "g", ingredient: ing(100) }],
				},
			],
			targetKcal: 2000, // breakfast alone exceeds target
		};
		const r = computeSideScale(input);
		expect(r.sideScale).toBe(0.1); // floor
		expect(r.clamped).toBe(true);
		expect(r.onTarget).toBe(false);
	});
});
