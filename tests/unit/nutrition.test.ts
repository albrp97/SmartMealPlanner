import { type NutritionLineInput, computeRecipeNutrition } from "@/lib/nutrition";
import { describe, expect, it } from "vitest";

const chicken = {
	isSupplement: false,
	gPerUnit: null,
	densityGPerMl: null,
	kcalPer100g: 165,
	proteinPer100g: 31,
	carbsPer100g: 0,
	fatPer100g: 3.6,
	fiberPer100g: 0,
};

const rice = {
	isSupplement: false,
	gPerUnit: null,
	densityGPerMl: null,
	kcalPer100g: 360,
	proteinPer100g: 7,
	carbsPer100g: 79,
	fatPer100g: 0.6,
	fiberPer100g: 1.3,
};

const onion = {
	isSupplement: false,
	gPerUnit: 150,
	densityGPerMl: null,
	kcalPer100g: 40,
	proteinPer100g: 1.1,
	carbsPer100g: 9.3,
	fatPer100g: 0.1,
	fiberPer100g: 1.7,
};

const wheyScoop = {
	isSupplement: true,
	gPerUnit: null,
	densityGPerMl: null,
	// per-serving (one 30 g scoop)
	kcalPer100g: 120,
	proteinPer100g: 24,
	carbsPer100g: 2,
	fatPer100g: 1.5,
	fiberPer100g: 0,
};

describe("computeRecipeNutrition", () => {
	it("scales per-100g macros for a g-quantity batch and divides by servings", () => {
		const lines: NutritionLineInput[] = [
			{ ingredient: chicken, quantity: 500, unit: "g" }, // 5x
			{ ingredient: rice, quantity: 300, unit: "g" }, // 3x
		];
		const out = computeRecipeNutrition(lines, 4);

		// total kcal = 5*165 + 3*360 = 825 + 1080 = 1905
		expect(out.total.kcal).toBe(1905);
		expect(out.perServing.kcal).toBe(Math.round(1905 / 4));
		expect(out.missing).toBe(false);
	});

	it("converts unit→g via g_per_unit", () => {
		const lines: NutritionLineInput[] = [
			{ ingredient: onion, quantity: 2, unit: "unit" }, // 2 * 150 g = 300 g
		];
		const out = computeRecipeNutrition(lines, 1);
		// 300 g of onion: kcal = 3 * 40 = 120
		expect(out.total.kcal).toBe(120);
		expect(out.missing).toBe(false);
	});

	it("treats supplement quantity as servings", () => {
		const lines: NutritionLineInput[] = [
			{ ingredient: wheyScoop, quantity: 2, unit: "unit" }, // 2 scoops
		];
		const out = computeRecipeNutrition(lines, 1);
		// 2 scoops * 120 kcal = 240
		expect(out.total.kcal).toBe(240);
		expect(out.total.protein).toBe(48);
	});

	it("flags missing data without throwing", () => {
		const noNutr = { ...chicken, kcalPer100g: null };
		const out = computeRecipeNutrition([{ ingredient: noNutr, quantity: 100, unit: "g" }], 1);
		expect(out.total.kcal).toBe(0);
		expect(out.missing).toBe(true);
		expect(out.lines[0].reason).toBe("no_nutrition");
	});

	it("flags unit-priced ingredient missing g_per_unit", () => {
		const noGpu = { ...onion, gPerUnit: null };
		const out = computeRecipeNutrition([{ ingredient: noGpu, quantity: 1, unit: "unit" }], 1);
		expect(out.missing).toBe(true);
		expect(out.lines[0].reason).toBe("missing_g_per_unit");
	});

	it("guards against zero/negative servings", () => {
		const out = computeRecipeNutrition([{ ingredient: rice, quantity: 100, unit: "g" }], 0);
		expect(out.perServing.kcal).toBe(360);
	});
});
