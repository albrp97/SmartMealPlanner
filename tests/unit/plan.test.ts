import {
	type PlanLineInput,
	aggregateShopping,
	startOfIsoWeek,
	toIso,
	weekDates,
} from "@/lib/plan";
import { describe, expect, it } from "vitest";

describe("plan: ISO-week helpers", () => {
	it("Monday is the start of its own week", () => {
		const mon = new Date(2026, 3, 20); // Mon 20 Apr 2026
		expect(toIso(startOfIsoWeek(mon))).toBe("2026-04-20");
	});

	it("Sunday belongs to the previous Monday", () => {
		const sun = new Date(2026, 3, 26); // Sun 26 Apr 2026
		expect(toIso(startOfIsoWeek(sun))).toBe("2026-04-20");
	});

	it("weekDates returns 7 ISO strings Mon..Sun", () => {
		const dates = weekDates(new Date(2026, 3, 24));
		expect(dates).toEqual([
			"2026-04-20",
			"2026-04-21",
			"2026-04-22",
			"2026-04-23",
			"2026-04-24",
			"2026-04-25",
			"2026-04-26",
		]);
	});
});

describe("plan: aggregateShopping", () => {
	const baseLine: Omit<PlanLineInput, "ingredientId" | "ingredientName" | "quantity"> = {
		recipeId: "r1",
		recipeServings: 2,
		plannedServings: 2,
		unit: "g",
		packageSize: 1000,
		packageUnit: "g",
		packagePrice: 60,
		currency: "CZK",
		priceIsDefault: false,
	};

	it("scales quantities by plannedServings / recipeServings", () => {
		const items = aggregateShopping(
			[{ ...baseLine, ingredientId: "i1", ingredientName: "rice", quantity: 200 }],
			{ r1: "Rice with x" },
		);
		// 200 g per recipe-serving × (2/2) = 200 g needed.
		expect(items[0].totalQuantity).toBe(200);
		expect(items[0].packages).toBe(1);
		expect(items[0].shoppingCost).toBe(60);
		// consumedCost = 200/1000 * 60 = 12
		expect(items[0].consumedCost).toBe(12);
	});

	it("sums ingredients across recipes and rounds packages up", () => {
		const items = aggregateShopping(
			[
				{ ...baseLine, ingredientId: "i1", ingredientName: "rice", quantity: 600 },
				{
					...baseLine,
					recipeId: "r2",
					ingredientId: "i1",
					ingredientName: "rice",
					quantity: 600,
				},
			],
			{ r1: "A", r2: "B" },
		);
		// 1200 g needed, package is 1 kg → 2 packages.
		expect(items[0].totalQuantity).toBe(1200);
		expect(items[0].packages).toBe(2);
		expect(items[0].contributingRecipes).toEqual(["A", "B"]);
	});

	it("flags unit mismatch instead of silently rounding", () => {
		const items = aggregateShopping(
			[
				{
					...baseLine,
					ingredientId: "i9",
					ingredientName: "egg",
					quantity: 3,
					unit: "unit",
					packageSize: 1000,
					packageUnit: "g",
				},
			],
			{ r1: "x" },
		);
		expect(items[0].unitMismatch).toBe(true);
		expect(items[0].packages).toBe(0);
		expect(items[0].shoppingCost).toBe(null);
	});

	it("preserves priceIsDefault for the default-share calculation", () => {
		const items = aggregateShopping(
			[
				{
					...baseLine,
					ingredientId: "i1",
					ingredientName: "rice",
					quantity: 100,
					priceIsDefault: true,
				},
			],
			{ r1: "x" },
		);
		expect(items[0].priceIsDefault).toBe(true);
	});
});
