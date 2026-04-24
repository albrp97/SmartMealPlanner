import { computeLineCost, computeRecipeCost } from "@/lib/cost";
import { describe, expect, it } from "vitest";

const flour = {
	package_price: 30,
	package_size: 1000,
	package_unit: "g" as const,
	currency: "CZK",
};
const milk = {
	package_price: 25,
	package_size: 1000,
	package_unit: "ml" as const,
	currency: "CZK",
};
const onion = {
	package_price: 6,
	package_size: 1,
	package_unit: "unit" as const,
	currency: "CZK",
};
const noPrice = { ...flour, package_price: null };

describe("computeLineCost", () => {
	it("scales price proportionally to needed quantity", () => {
		const r = computeLineCost({ ingredient: flour, quantity: 250, unit: "g" });
		// 250/1000 * 30 = 7.5
		expect(r.cost).toBeCloseTo(7.5, 5);
		expect(r.reason).toBeUndefined();
	});

	it("returns null for missing price", () => {
		const r = computeLineCost({ ingredient: noPrice, quantity: 100, unit: "g" });
		expect(r.cost).toBeNull();
		expect(r.reason).toBe("no_price");
	});

	it("returns null on unit mismatch (no implicit conversion)", () => {
		const r = computeLineCost({ ingredient: flour, quantity: 100, unit: "ml" });
		expect(r.cost).toBeNull();
		expect(r.reason).toBe("unit_mismatch");
	});

	it("handles unit-priced items", () => {
		const r = computeLineCost({ ingredient: onion, quantity: 3, unit: "unit" });
		expect(r.cost).toBeCloseTo(18, 5);
	});
});

describe("computeRecipeCost", () => {
	it("sums known costs and flags unknowns", () => {
		const result = computeRecipeCost([
			{ ingredient: flour, quantity: 500, unit: "g" }, // 15
			{ ingredient: milk, quantity: 200, unit: "ml" }, // 5
			{ ingredient: noPrice, quantity: 100, unit: "g" }, // null
		]);
		expect(result.total).toBeCloseTo(20, 5);
		expect(result.hasUnknown).toBe(true);
		expect(result.lines).toHaveLength(3);
	});

	it("totals to zero with no lines and is not flagged", () => {
		const r = computeRecipeCost([]);
		expect(r.total).toBe(0);
		expect(r.hasUnknown).toBe(false);
	});
});

describe("computeRecipeCost — shopping mode", () => {
	it("rounds up to whole packages and reports count", () => {
		// 250 g of flour out of a 1 kg bag = 1 whole bag (30 CZK)
		const r = computeRecipeCost(
			[{ ingredient: flour, quantity: 250, unit: "g" }],
			"CZK",
			"shopping",
		);
		expect(r.mode).toBe("shopping");
		expect(r.total).toBeCloseTo(30, 5);
		expect(r.lines[0].packages).toBe(1);
	});

	it("rounds 1.2 packages up to 2", () => {
		const r = computeRecipeCost(
			[{ ingredient: flour, quantity: 1200, unit: "g" }], // 1.2 bags
			"CZK",
			"shopping",
		);
		expect(r.total).toBeCloseTo(60, 5);
		expect(r.lines[0].packages).toBe(2);
	});

	it("matches consumed-mode total when quantities are whole packages", () => {
		const lines = [
			{ ingredient: flour, quantity: 1000, unit: "g" as const },
			{ ingredient: onion, quantity: 3, unit: "unit" as const },
		];
		const consumed = computeRecipeCost(lines, "CZK", "consumed");
		const shopping = computeRecipeCost(lines, "CZK", "shopping");
		expect(shopping.total).toBeCloseTo(consumed.total, 5);
	});
});
