/**
 * Deterministic snake_case slug generator.
 *
 * Strips diacritics, lowercases, collapses non-alphanumeric runs into a single
 * underscore, trims leading/trailing underscores. Empty input -> empty string
 * (callers should validate before persisting).
 */
export function slugify(input: string): string {
	return input
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}
