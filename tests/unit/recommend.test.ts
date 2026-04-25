import { type RecommendCandidate, recommend } from "@/lib/recommend";
import { describe, expect, it } from "vitest";

function mk(over: Partial<RecommendCandidate>): RecommendCandidate {
	return {
		id: "x",
		name: "X",
		categoryId: "curry",
		heroSlug: "chicken",
		kcalPerServing: 500,
		proteinPerServing: 30,
		costPerServing: 40,
		...over,
	};
}

describe("recommend", () => {
	it("filters out excluded ids", () => {
		const out = recommend({
			candidates: [mk({ id: "a", name: "A" }), mk({ id: "b", name: "B" })],
			excludeIds: ["a"],
			otherSlotCategoryIds: [],
			otherSlotHeroSlugs: [],
			goal: "maintain",
		});
		expect(out.map((c) => c.id)).toEqual(["b"]);
	});

	it("penalises same category as other slot", () => {
		const out = recommend({
			candidates: [
				mk({ id: "c1", name: "Curry", categoryId: "curry" }),
				mk({ id: "p1", name: "Pasta", categoryId: "pasta" }),
			],
			excludeIds: [],
			otherSlotCategoryIds: ["curry"],
			otherSlotHeroSlugs: [],
			goal: "maintain",
		});
		expect(out[0].id).toBe("p1");
		const curry = out.find((c) => c.id === "c1");
		expect(curry?.reasons).toContain("same category as other slot");
	});

	it("penalises same hero as other slot", () => {
		const out = recommend({
			candidates: [
				mk({ id: "ch", name: "Chicken dish", heroSlug: "chicken" }),
				mk({ id: "be", name: "Beef dish", heroSlug: "beef" }),
			],
			excludeIds: [],
			otherSlotCategoryIds: [],
			otherSlotHeroSlugs: ["chicken"],
			goal: "maintain",
		});
		expect(out[0].id).toBe("be");
	});

	it("on cut, ranks higher protein-per-kcal first", () => {
		const out = recommend({
			candidates: [
				mk({ id: "lean", name: "Lean", kcalPerServing: 400, proteinPerServing: 50 }), // 0.125
				mk({ id: "fatty", name: "Fatty", kcalPerServing: 700, proteinPerServing: 25 }), // 0.036
			],
			excludeIds: [],
			otherSlotCategoryIds: [],
			otherSlotHeroSlugs: [],
			goal: "cut",
		});
		expect(out[0].id).toBe("lean");
	});

	it("on bulk, ranks higher kcal/serving first", () => {
		const out = recommend({
			candidates: [
				mk({ id: "small", name: "Small", kcalPerServing: 300 }),
				mk({ id: "big", name: "Big", kcalPerServing: 800 }),
			],
			excludeIds: [],
			otherSlotCategoryIds: [],
			otherSlotHeroSlugs: [],
			goal: "bulk",
		});
		expect(out[0].id).toBe("big");
	});

	it("category penalty outweighs cost", () => {
		// Same-category recipe is much cheaper but should still rank lower.
		const out = recommend({
			candidates: [
				mk({ id: "cheap", name: "Cheap curry", categoryId: "curry", costPerServing: 10 }),
				mk({ id: "pricey", name: "Pricey pasta", categoryId: "pasta", costPerServing: 80 }),
			],
			excludeIds: [],
			otherSlotCategoryIds: ["curry"],
			otherSlotHeroSlugs: [],
			goal: "maintain",
		});
		expect(out[0].id).toBe("pricey");
	});

	it("respects the limit", () => {
		const out = recommend(
			{
				candidates: Array.from({ length: 10 }, (_, i) =>
					mk({ id: `r${i}`, name: `R${i}`, kcalPerServing: 500 + i }),
				),
				excludeIds: [],
				otherSlotCategoryIds: [],
				otherSlotHeroSlugs: [],
				goal: "bulk",
			},
			3,
		);
		expect(out).toHaveLength(3);
	});

	it("ties break alphabetically by name", () => {
		const out = recommend({
			candidates: [
				mk({ id: "z", name: "Zucchini" }),
				mk({ id: "a", name: "Apple" }),
				mk({ id: "m", name: "Mango" }),
			],
			excludeIds: [],
			otherSlotCategoryIds: [],
			otherSlotHeroSlugs: [],
			goal: "maintain",
		});
		// All have identical scoring inputs → score ties → alphabetical
		expect(out.map((c) => c.id)).toEqual(["a", "m", "z"]);
	});

	it("missing categoryId / heroSlug are not falsely matched", () => {
		const out = recommend({
			candidates: [
				mk({ id: "n", name: "Nullish", categoryId: null, heroSlug: null }),
				mk({ id: "c", name: "Curry", categoryId: "curry", heroSlug: "chicken" }),
			],
			excludeIds: [],
			otherSlotCategoryIds: ["curry"],
			otherSlotHeroSlugs: ["chicken"],
			goal: "maintain",
		});
		// Nullish should win: no category/hero clash penalty.
		expect(out[0].id).toBe("n");
	});
});
