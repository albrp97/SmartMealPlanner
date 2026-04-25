/**
 * /plan recipe recommendations (Phase 3.9).
 *
 * Pure scoring function — given the day's currently-planned recipes,
 * rank the rest of the catalogue as candidates for a given slot
 * (lunch or dinner).
 *
 * V1 design (no history yet — `meal_plan_entries.date` is a sentinel):
 *
 *   score(candidate, slot, otherSlot) =
 *     + goalNutritionFit         goal-aware bonus (cut → high P/kcal,
 *                                bulk → high kcal/serving, maintain
 *                                → balanced flat bonus)
 *     − wRedundantCategory       same category as ANY other-slot recipe
 *     − wRedundantHero           same hero ingredient as ANY other-slot recipe
 *     − wThriftCost              mild penalty for high cost/serving
 *
 * Candidates already planned in *either* slot are filtered out so the
 * panel only suggests genuine swap targets.
 *
 * The scoring weights are tuned so:
 *  - the variety penalties dominate (you should almost never see
 *    "curry + curry" or "chicken + chicken" suggested);
 *  - the goal-fit bonus is the main tie-breaker;
 *  - cost is a tiny secondary signal.
 *
 * Future (when meal-plan history exists, see DEVELOPER_GUIDE §7.3):
 *   + bonus for `daysSinceLastCooked(candidate)` (variety over time)
 *   + bonus for `ingredientReuseWithCurrentPlan` (shared onion = thrifty)
 */

export type Goal = "maintain" | "cut" | "bulk";

export interface RecommendCandidate {
	id: string;
	name: string;
	categoryId: string | null;
	heroSlug: string | null;
	kcalPerServing: number;
	proteinPerServing: number;
	costPerServing: number;
}

export interface RecommendInput {
	candidates: RecommendCandidate[];
	/** Recipe ids currently planned in any slot — excluded from results. */
	excludeIds: string[];
	/** Categories currently planned in slots OTHER than the target one. */
	otherSlotCategoryIds: string[];
	/** Hero ingredient slugs currently planned in slots OTHER than the target one. */
	otherSlotHeroSlugs: string[];
	goal: Goal;
}

export interface ScoredCandidate extends RecommendCandidate {
	score: number;
	reasons: string[];
}

const W_REDUNDANT_CATEGORY = 80;
const W_REDUNDANT_HERO = 50;
const W_COST = 0.5;

export function scoreCandidate(
	c: RecommendCandidate,
	otherCategoryIds: ReadonlySet<string>,
	otherHeroSlugs: ReadonlySet<string>,
	goal: Goal,
): ScoredCandidate {
	let score = 0;
	const reasons: string[] = [];

	// Goal-aware nutrition fit.
	if (goal === "cut") {
		const pPerKcal = c.kcalPerServing > 0 ? c.proteinPerServing / c.kcalPerServing : 0;
		score += pPerKcal * 1000;
		if (pPerKcal >= 0.08) reasons.push("high protein density");
	} else if (goal === "bulk") {
		score += c.kcalPerServing / 10;
		if (c.kcalPerServing >= 600) reasons.push("calorie-dense");
	} else {
		score += 30;
	}

	// Variety penalties — dominant signal.
	if (c.categoryId && otherCategoryIds.has(c.categoryId)) {
		score -= W_REDUNDANT_CATEGORY;
		reasons.push("same category as other slot");
	}
	if (c.heroSlug && otherHeroSlugs.has(c.heroSlug)) {
		score -= W_REDUNDANT_HERO;
		reasons.push("same hero as other slot");
	}

	// Mild thrift bonus (lower cost = higher score).
	score -= c.costPerServing * W_COST;

	return { ...c, score, reasons };
}

export function recommend(input: RecommendInput, limit = 3): ScoredCandidate[] {
	const exclude = new Set(input.excludeIds);
	const otherCategoryIds = new Set(input.otherSlotCategoryIds);
	const otherHeroSlugs = new Set(input.otherSlotHeroSlugs);

	const scored: ScoredCandidate[] = [];
	for (const c of input.candidates) {
		if (exclude.has(c.id)) continue;
		scored.push(scoreCandidate(c, otherCategoryIds, otherHeroSlugs, input.goal));
	}
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.name.localeCompare(b.name);
	});
	return scored.slice(0, limit);
}
