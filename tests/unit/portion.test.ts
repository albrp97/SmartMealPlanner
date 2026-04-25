import {
	type PortionIngredient,
	type PortionRecipe,
	findHeroIndex,
	heroPerServing,
	packagesFor,
	scalePortion,
	suggestHeroQuantity,
} from "@/lib/portion";
import { describe, expect, it } from "vitest";

const chicken: PortionIngredient = {
	id: "ing-chicken",
	slug: "chicken",
	name: "Chicken",
	divisible: true,
	packageSize: 1000,
	packageUnit: "g",
	gPerUnit: null,
};
const rice: PortionIngredient = {
	id: "ing-rice",
	slug: "rice",
	name: "Rice",
	divisible: true,
	packageSize: 1000,
	packageUnit: "g",
	gPerUnit: null,
};
const onion: PortionIngredient = {
	id: "ing-onion",
	slug: "onion",
	name: "Onion",
	divisible: false,
	packageSize: 1,
	packageUnit: "unit",
	gPerUnit: 150,
};
const cheeseBag: PortionIngredient = {
	id: "ing-cheese",
	slug: "grated_cheese",
	name: "Cheese bag",
	divisible: false,
	packageSize: 200,
	packageUnit: "g",
	gPerUnit: null,
};
const stockCube: PortionIngredient = {
	id: "ing-stock",
	slug: "stock_cube",
	name: "Stock cube",
	divisible: false,
	packageSize: 1,
	packageUnit: "unit",
	gPerUnit: null,
};

const japaneseCurry: PortionRecipe = {
	id: "r-jc",
	slug: "japanese_curry",
	name: "Japanese curry",
	defaultServings: 1,
	lines: [
		{ role: "hero", quantity: 100, unit: "g", ingredient: chicken },
		{ role: "side", quantity: 80, unit: "g", ingredient: rice },
		{ role: "fixed", quantity: 0.5, unit: "unit", ingredient: onion },
		{ role: "fixed", quantity: 1, unit: "unit", ingredient: stockCube },
	],
};

describe("portion: hero detection", () => {
	it("finds the hero line", () => {
		expect(findHeroIndex(japaneseCurry)).toBe(0);
	});

	it("computes hero per serving", () => {
		// 100 g chicken / 1 serving
		expect(heroPerServing(japaneseCurry)).toBe(100);
	});

	it("returns null when no hero", () => {
		const r: PortionRecipe = { ...japaneseCurry, lines: [] };
		expect(heroPerServing(r)).toBeNull();
	});
});

describe("portion: scalePortion", () => {
	it("derives servings from hero quantity", () => {
		const r = scalePortion(japaneseCurry, 800);
		expect(r.feasible).toBe(true);
		// 800 g chicken / 100 g per serving = 8 servings
		expect(r.servings).toBe(8);
		// hero stays at 800 g
		expect(r.scaled[0].quantity).toBe(800);
		// rice scales linearly: 80 g × 8 = 640 g
		expect(r.scaled[1].quantity).toBe(640);
		// fixed onion: recipe says 0.5 unit but onion is non-divisible — you
		// can't cook with half an onion, so it rounds up to 1 whole onion.
		expect(r.scaled[2].quantity).toBe(1);
		// fixed stock cube stays at 1 unit
		expect(r.scaled[3].quantity).toBe(1);
	});

	it("rounds non-divisible hero to integer servings", () => {
		// puff_pastry as hero, sold per-unit, recipe default = 2 units / 4 servings → 0.5 per serving
		const puffPastry: PortionIngredient = {
			id: "ing-pp",
			slug: "puff_pastry",
			name: "Puff pastry",
			divisible: false,
			packageSize: 1,
			packageUnit: "unit",
			gPerUnit: null,
		};
		const tunaPie: PortionRecipe = {
			id: "r-tp",
			slug: "tuna_pie",
			name: "Tuna pie",
			defaultServings: 4,
			lines: [{ role: "hero", quantity: 2, unit: "unit", ingredient: puffPastry }],
		};
		// 3 units / 0.5 per serving = 6 servings (already integer, ok)
		expect(scalePortion(tunaPie, 3).servings).toBe(6);
	});

	it("non-divisible hero packages round up when paid", () => {
		const r = scalePortion(japaneseCurry, 800);
		// chicken is divisible: 800 / 1000 = 0.8 packs, paid = 0.8
		expect(r.scaled[0].packagesPaid).toBeCloseTo(0.8, 5);
		// stock cube is non-divisible: 1 unit / 1-unit pack = 1 pack
		expect(r.scaled[3].packagesPaid).toBe(1);
	});

	it("falls back to multiplier when there is no hero", () => {
		const r: PortionRecipe = {
			id: "r-pb",
			slug: "pasta_base",
			name: "Pasta base",
			defaultServings: 1,
			lines: [{ role: "side", quantity: 100, unit: "g", ingredient: rice }],
		};
		const out = scalePortion(r, 3);
		expect(out.servings).toBe(3);
		expect(out.scaled[0].quantity).toBe(300);
	});

	it("returns infeasible for zero hero", () => {
		const r = scalePortion(japaneseCurry, 0);
		expect(r.feasible).toBe(false);
		expect(r.servings).toBe(0);
	});
});

describe("portion: packagesFor", () => {
	it("g vs g pack", () => {
		expect(packagesFor(chicken, "g", 500)).toBe(0.5);
	});

	it("returns 0 when an ingredient sold in g-pack is asked in 'unit' without gPerUnit", () => {
		// cheese bag has packageUnit='g' and no gPerUnit — the conversion is
		// undefined, so the helper returns 0 and the caller must treat it as
		// 'pack data missing' rather than 'free'.
		expect(packagesFor(cheeseBag, "unit", 1)).toBe(0);
	});

	it("unit asked, g-pack ingredient using gPerUnit", () => {
		// onion sold per unit (packageUnit unit, packageSize 1), so "unit" matches.
		expect(packagesFor(onion, "unit", 2)).toBe(2);
	});

	it("g asked, unit-pack ingredient using gPerUnit", () => {
		// 150 g of onion / 150 g per onion / 1-unit-pack = 1 pack
		expect(packagesFor(onion, "g", 150)).toBeCloseTo(1, 5);
	});

	it("returns 0 for unconvertible mismatch", () => {
		const weird: PortionIngredient = {
			id: "x",
			slug: "x",
			name: "x",
			divisible: false,
			packageSize: 1,
			packageUnit: "unit",
			gPerUnit: null,
		};
		expect(packagesFor(weird, "g", 200)).toBe(0);
	});
});

describe("portion: suggestHeroQuantity", () => {
	it("scales hero linearly with kcal ratio (divisible)", () => {
		// recipe currently 800 kcal/serving, target 600 kcal/serving → 0.75×
		// hero default = 100 g × 1 serving = 100 g → suggest 75 g
		expect(suggestHeroQuantity(japaneseCurry, 800, 600)).toBe(75);
	});

	it("snaps non-divisible hero to whole packs", () => {
		const puffPastry: PortionIngredient = {
			id: "ing-pp",
			slug: "puff_pastry",
			name: "Puff pastry",
			divisible: false,
			packageSize: 1,
			packageUnit: "unit",
			gPerUnit: null,
		};
		const r: PortionRecipe = {
			id: "r-tp",
			slug: "tuna_pie",
			name: "Tuna pie",
			defaultServings: 4,
			lines: [{ role: "hero", quantity: 2, unit: "unit", ingredient: puffPastry }],
		};
		// kcal 500 → target 700, want = 2 × (700/500) = 2.8 → 3 packs
		expect(suggestHeroQuantity(r, 500, 700)).toBe(3);
	});

	it("returns hero default when inputs are degenerate", () => {
		expect(suggestHeroQuantity(japaneseCurry, 0, 600)).toBe(100);
	});
});
