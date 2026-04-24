import { toGrams } from "@/lib/units";
import { describe, expect, it } from "vitest";

describe("toGrams", () => {
	it("returns identity for grams", () => {
		expect(toGrams(250, "g", { gPerUnit: null, densityGPerMl: null })).toEqual({
			grams: 250,
		});
	});

	it("uses density for ml when provided", () => {
		expect(toGrams(100, "ml", { gPerUnit: null, densityGPerMl: 0.92 })).toEqual({
			grams: 92,
		});
	});

	it("falls back to 1 g/ml for ml without density and flags it", () => {
		expect(toGrams(200, "ml", { gPerUnit: null, densityGPerMl: null })).toEqual({
			grams: 200,
			assumed: "density_1",
		});
	});

	it("multiplies by g_per_unit for unit", () => {
		expect(toGrams(2, "unit", { gPerUnit: 60, densityGPerMl: null })).toEqual({
			grams: 120,
		});
	});

	it("returns null with reason when g_per_unit missing", () => {
		expect(toGrams(1, "unit", { gPerUnit: null, densityGPerMl: null })).toEqual({
			grams: null,
			reason: "missing_g_per_unit",
		});
	});
});
