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
