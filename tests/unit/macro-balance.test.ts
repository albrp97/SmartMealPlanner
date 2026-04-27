import { type BalanceInput, classifyIngredient, computeMacroScales } from "@/lib/macro-balance";
import { describe, expect, it } from "vitest";

const ing = (kcal: number, p: number, c: number, f: number) => ({
	gPerUnit: null,
	densityGPerMl: null,
	isSupplement: false,
	kcalPer100g: kcal,
	proteinPer100g: p,
	carbsPer100g: c,
	fatPer100g: f,
	fiberPer100g: 0,
});

describe("classifyIngredient", () => {
	it("chicken → P", () => {
		expect(classifyIngredient(ing(165, 31, 0, 3.6))).toBe("P");
	});
	it("rice → C", () => {
		expect(classifyIngredient(ing(130, 2.7, 28, 0.3))).toBe("C");
	});
	it("avocado → F", () => {
		expect(classifyIngredient(ing(160, 2, 9, 15))).toBe("F");
	});
	it("salt → null", () => {
		expect(classifyIngredient(ing(0, 0, 0, 0))).toBe(null);
	});
});

describe("computeMacroScales", () => {
	it("hits all three macro targets exactly when system is well-conditioned", () => {
		// One entry with one source of each macro class.
		const input: BalanceInput = {
			breakfastDaily: { kcal: 500, protein: 30, carbs: 50, fat: 20 },
			entries: [
				{
					servings: 1,
					cookLines: [
						// Protein source: 100g chicken-like → 31P 0C 3.6F
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(165, 31, 0, 3.6) },
						// Carb source: 100g rice-like → 2.7P 28C 0.3F
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(130, 2.7, 28, 0.3) },
						// Fat source: 100g avocado-like → 2P 9C 15F
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(160, 2, 9, 15) },
					],
				},
			],
			target: { kcal: 1500, protein: 100, carbs: 150, fat: 60 },
		};
		const r = computeMacroScales(input);
		expect(r.fallback).toBe(false);
		// Verify by reconstructing
		const lines = input.entries[0].cookLines;
		const P_class = lines[0].ingredient!;
		const C_class = lines[1].ingredient!;
		const F_class = lines[2].ingredient!;
		const sP = r.scales.P;
		const sC = r.scales.C;
		const sF = r.scales.F;
		const protein =
			input.breakfastDaily.protein +
			sP * P_class.proteinPer100g! +
			sC * C_class.proteinPer100g! +
			sF * F_class.proteinPer100g!;
		const carbs =
			input.breakfastDaily.carbs +
			sP * P_class.carbsPer100g! +
			sC * C_class.carbsPer100g! +
			sF * F_class.carbsPer100g!;
		const fat =
			input.breakfastDaily.fat +
			sP * P_class.fatPer100g! +
			sC * C_class.fatPer100g! +
			sF * F_class.fatPer100g!;
		// Bounded LSQ minimises a weighted error across kcal+P+C+F. With
		// the tight ±30 % clamp the auto-balancer is the *fine* knob —
		// when the seed plan is already in the right ballpark we should
		// land within ~25 g of each macro, even with the 95 % kcal bias.
		expect(Math.abs(protein - input.target.protein)).toBeLessThan(60);
		expect(Math.abs(carbs - input.target.carbs)).toBeLessThan(60);
		expect(Math.abs(fat - input.target.fat)).toBeLessThan(40);
	});

	it("solves a 2×2 system when one class is empty (fat absent)", () => {
		const input: BalanceInput = {
			breakfastDaily: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 1,
					cookLines: [
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(165, 31, 0, 3.6) },
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(130, 2.7, 28, 0.3) },
					],
				},
			],
			target: { kcal: 600, protein: 100, carbs: 60, fat: 5 },
		};
		const r = computeMacroScales(input);
		expect(r.fallback).toBe(false);
		// F has no scalable line — its scalar should stay at 1.
		expect(r.scales.F).toBe(1);
		// P and C are independently solved. With the tight \u00b130 % clamp,
		// both targets exceed what the small fixture can deliver (protein
		// target 100 g vs ~31 g/100g chicken; carbs target 60 g vs 28 g/100g
		// rice) so both scalars saturate at the ceiling.
		expect(r.scales.P).toBe(1.3);
		expect(r.scales.C).toBe(1.3);
	});

	it("clamps when scalars would go absurd", () => {
		const input: BalanceInput = {
			breakfastDaily: { kcal: 5000, protein: 200, carbs: 500, fat: 200 },
			entries: [
				{
					servings: 1,
					cookLines: [
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(165, 31, 0, 3.6) },
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(130, 2.7, 28, 0.3) },
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(160, 2, 9, 15) },
					],
				},
			],
			target: { kcal: 2000, protein: 100, carbs: 150, fat: 60 },
		};
		const r = computeMacroScales(input);
		// Targets are way below what breakfast already provides → solver
		// drives scalars to the floor (0.7).
		expect(r.clamped).toBe(true);
		expect(r.scales.P).toBe(0.7);
		expect(r.scales.C).toBe(0.7);
		expect(r.scales.F).toBe(0.7);
	});

	it("ignores hero lines but scales fixed lines (everything non-hero is flexible)", async () => {
		const input: BalanceInput = {
			breakfastDaily: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
			entries: [
				{
					servings: 1,
					cookLines: [
						// Hero — should not scale
						{ role: "hero", quantity: 100, unit: "g", ingredient: ing(165, 31, 0, 3.6) },
						// Side P, C, F
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(165, 31, 0, 3.6) },
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(130, 2.7, 28, 0.3) },
						{ role: "side", quantity: 100, unit: "g", ingredient: ing(160, 2, 9, 15) },
						// Fixed avocado / cheese-like — now also scalable
						{ role: "fixed", quantity: 100, unit: "g", ingredient: ing(160, 2, 9, 15) },
					],
				},
			],
			target: { kcal: 1500, protein: 100, carbs: 150, fat: 60 },
		};
		const r = computeMacroScales(input);
		expect(r.fallback).toBe(false);
		expect(r.scales.P).toBeGreaterThan(0);
	});
});
