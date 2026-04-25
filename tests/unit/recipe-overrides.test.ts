import { applyGoalOverrides, buildOverrideMap } from "@/lib/recipe-overrides";
import { describe, expect, it } from "vitest";

const lines = [
	{ id: "li-1", name: "rice", quantity: 100 },
	{ id: "li-2", name: "cheese", quantity: 30 },
	{ id: "li-3", name: "chicken", quantity: 500 },
];

describe("recipe-overrides", () => {
	it("returns the original lines for maintain", () => {
		const out = applyGoalOverrides(lines, "maintain", new Map());
		expect(out).toEqual(lines);
	});

	it("applies cut overrides and drops zero-quantity lines", () => {
		const overrides = buildOverrideMap([
			{ recipe_ingredient_id: "li-1", goal: "cut", quantity: 60 },
			{ recipe_ingredient_id: "li-2", goal: "cut", quantity: 0 }, // quit cheese
		]);
		const out = applyGoalOverrides(lines, "cut", overrides);
		expect(out).toHaveLength(2); // cheese dropped
		expect(out.find((l) => l.id === "li-1")?.quantity).toBe(60);
		expect(out.find((l) => l.id === "li-3")?.quantity).toBe(500); // unchanged
	});

	it("applies bulk overrides independently from cut", () => {
		const overrides = buildOverrideMap([
			{ recipe_ingredient_id: "li-1", goal: "cut", quantity: 60 },
			{ recipe_ingredient_id: "li-1", goal: "bulk", quantity: 150 },
		]);
		const cutOut = applyGoalOverrides(lines, "cut", overrides);
		const bulkOut = applyGoalOverrides(lines, "bulk", overrides);
		expect(cutOut.find((l) => l.id === "li-1")?.quantity).toBe(60);
		expect(bulkOut.find((l) => l.id === "li-1")?.quantity).toBe(150);
	});

	it("falls back to baseline when no override exists for the goal", () => {
		const overrides = buildOverrideMap([
			{ recipe_ingredient_id: "li-1", goal: "cut", quantity: 60 },
		]);
		// asking for bulk: line 1 has no bulk override, so baseline 100 wins
		const out = applyGoalOverrides(lines, "bulk", overrides);
		expect(out.find((l) => l.id === "li-1")?.quantity).toBe(100);
	});
});
