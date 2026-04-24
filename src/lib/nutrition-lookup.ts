/**
 * OpenFoodFacts client.
 *
 * Free, public, no API key. We use the search endpoint and pick the
 * top-ranked product. The returned macros are per 100 g (or per 100 ml for
 * liquids — OpenFoodFacts is consistent in g/ml regardless of `unit`).
 *
 * We surface only what we need (kcal + the four macros + fibre) and ignore
 * the rest. Keep this file dependency-free so it can run in both Server
 * Actions and the seed script.
 */

export interface MicrosPer100g {
	sodium_mg: number | null;
	calcium_mg: number | null;
	iron_mg: number | null;
	vitamin_c_mg: number | null;
}

export interface NutritionPer100 {
	kcal_per_100g: number | null;
	protein_per_100g: number | null;
	carbs_per_100g: number | null;
	fat_per_100g: number | null;
	fiber_per_100g: number | null;
}

export interface NutritionLookupHit extends NutritionPer100 {
	source: "openfoodfacts";
	matched_product_name: string;
	matched_product_brand: string | null;
	off_code: string | null;
	off_url: string;
	score: number; // 0..1, higher = better match
	micros: MicrosPer100g;
}

const BASE = "https://world.openfoodfacts.org";
// New OFF search engine (Elasticsearch-backed). The legacy `/cgi/search.pl`
// endpoint is being deprecated and frequently returns 503 under load.
const SEARCH_BASE = "https://search.openfoodfacts.org";

interface OffProduct {
	code?: string;
	product_name?: string;
	product_name_en?: string;
	brands?: string | string[];
	nutriments?: Record<string, number | string | undefined>;
	completeness?: number;
}

interface OffSearchResponse {
	hits?: OffProduct[];
}

function num(v: unknown): number | null {
	if (v == null) return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

function pickKcal(n: Record<string, number | string | undefined> | undefined): number | null {
	if (!n) return null;
	// Prefer the explicit kcal field; fall back to converting kJ.
	const kcal = num(n["energy-kcal_100g"]);
	if (kcal != null) return kcal;
	const kj = num(n.energy_100g) ?? num(n["energy-kj_100g"]);
	return kj != null ? Math.round((kj / 4.184) * 10) / 10 : null;
}

/** Search OpenFoodFacts and return the best hit, or null if nothing matches. */
export async function lookupNutrition(
	query: string,
	options: { signal?: AbortSignal } = {},
): Promise<NutritionLookupHit | null> {
	const trimmed = query.trim();
	if (trimmed.length < 2) return null;
	const url = new URL(`${SEARCH_BASE}/search`);
	url.searchParams.set("q", trimmed);
	url.searchParams.set("page_size", "15");
	url.searchParams.set("langs", "en");
	url.searchParams.set(
		"fields",
		"code,product_name,product_name_en,brands,nutriments,completeness",
	);

	// OFF nutriment keys for micros are in grams; convert to mg.
	function mg(v: unknown): number | null {
		const n = num(v);
		return n == null ? null : Math.round(n * 1000 * 10) / 10;
	}

	const res = await fetch(url, {
		signal: options.signal,
		headers: {
			// OFF asks for a User-Agent identifying the app (any string is fine).
			"User-Agent": "SmartMealPlanner/0.1 (https://github.com/albrp97/SmartMealPlanner)",
			Accept: "application/json",
		},
		// OFF is public and read-only.
		cache: "no-store",
	});
	if (!res.ok) return null;
	const data = (await res.json()) as OffSearchResponse;
	const products = data.hits ?? [];
	if (products.length === 0) return null;

	// Score: product is useful only if at least kcal + protein are present.
	const scored = products
		.map((p) => {
			const nut: NutritionPer100 = {
				kcal_per_100g: pickKcal(p.nutriments),
				protein_per_100g: num(p.nutriments?.proteins_100g),
				carbs_per_100g: num(p.nutriments?.carbohydrates_100g),
				fat_per_100g: num(p.nutriments?.fat_100g),
				fiber_per_100g: num(p.nutriments?.fiber_100g),
			};
			const micros: MicrosPer100g = {
				sodium_mg: mg(p.nutriments?.sodium_100g),
				calcium_mg: mg(p.nutriments?.calcium_100g),
				iron_mg: mg(p.nutriments?.iron_100g),
				vitamin_c_mg: mg(p.nutriments?.["vitamin-c_100g"]),
			};
			const filled = [
				nut.kcal_per_100g,
				nut.protein_per_100g,
				nut.carbs_per_100g,
				nut.fat_per_100g,
				nut.fiber_per_100g,
			].filter((v) => v != null).length;
			const completeness = typeof p.completeness === "number" ? p.completeness : 0;
			const score = filled / 5 + completeness * 0.1;
			return { p, nut, micros, filled, score };
		})
		.filter((s) => s.nut.kcal_per_100g != null && s.nut.protein_per_100g != null)
		.sort((a, b) => b.score - a.score);

	const best = scored[0];
	if (!best) return null;

	const name = best.p.product_name_en || best.p.product_name || trimmed;
	const brandsRaw = best.p.brands;
	const firstBrand = Array.isArray(brandsRaw)
		? (brandsRaw[0] ?? null)
		: typeof brandsRaw === "string"
			? (brandsRaw.split(",")[0]?.trim() ?? null)
			: null;
	return {
		...best.nut,
		source: "openfoodfacts",
		matched_product_name: name,
		matched_product_brand: firstBrand,
		off_code: best.p.code ?? null,
		off_url: best.p.code ? `${BASE}/product/${best.p.code}` : `${BASE}/`,
		score: Math.min(1, best.score),
		micros: best.micros,
	};
}
