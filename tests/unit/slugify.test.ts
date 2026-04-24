import { slugify } from "@/lib/slugify";
import { describe, expect, it } from "vitest";

describe("slugify", () => {
	it("lowercases and joins words with underscores", () => {
		expect(slugify("Chicken Thigh Fillets")).toBe("chicken_thigh_fillets");
	});

	it("strips diacritics", () => {
		expect(slugify("jamón ibérico")).toBe("jamon_iberico");
		expect(slugify("Crème brûlée")).toBe("creme_brulee");
	});

	it("collapses runs of punctuation", () => {
		expect(slugify("  hello---world!!! ")).toBe("hello_world");
	});

	it("returns empty for non-alphanumeric input", () => {
		expect(slugify("---")).toBe("");
		expect(slugify("")).toBe("");
	});
});
