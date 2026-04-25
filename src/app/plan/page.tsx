/**
 * Phase 3: meal planner — flat one-page version.
 *
 * No calendar. The user picks recipes for lunch + dinner; each entry has
 * `meal_plan_entries.servings` repurposed as **hero packs** (Phase 3.5):
 * the integer number of packages of the recipe's hero ingredient committed
 * to that cook. Servings cooked, per-serving macros and the shopping list
 * all derive from that single number via `src/lib/portion.ts`.
 *
 * Breakfast is constant (`breakfast_daily` × 7) and never stored.
 */
import { ButtonLink } from "@/components/ui/button";
import { type CostLineInput, computeRecipeCost } from "@/lib/cost";
import { createClient } from "@/lib/db/client-server";
import { type Goal, TARGETS, isGoal } from "@/lib/goals";
import {
	type BalanceEntry,
	type BalanceLine,
	classifyIngredient,
	computeMacroScales,
} from "@/lib/macro-balance";
import { type NutritionLineInput, computeRecipeNutrition } from "@/lib/nutrition";
import {
	type PlanRecipeRow,
	aggregateScaledShopping,
	heroQuantityFromPacks,
	toPortionRecipe,
} from "@/lib/plan-portion";
import { findHeroIndex, scalePortion } from "@/lib/portion";
import { applyGoalOverrides, buildOverrideMap } from "@/lib/recipe-overrides";
import { recommend } from "@/lib/recommend";
import Link from "next/link";
import { PLAN_DATE } from "./constants";
import { AddPlanEntry, type PickerRecipe, PlanEntryRow } from "./controls";
import { GoalPills } from "./goal-pills";
import { type RecommendationCard, RecommendationPanel } from "./recommendation-panel";

export const dynamic = "force-dynamic";

interface PlanRow {
	id: string;
	slot: "breakfast" | "lunch" | "dinner";
	servings: number; // = hero packs
	recipe_id: string;
}

interface RecipeRow extends PlanRecipeRow {
	meal_type: "single_meal" | "batch" | "unknown" | null;
	category_id: string | null;
	recipe_ingredients: (PlanRecipeRow["recipe_ingredients"][number] & {
		ingredients:
			| (NonNullable<PlanRecipeRow["recipe_ingredients"][number]["ingredients"]> & {
					is_supplement: boolean;
					density_g_per_ml: number | null;
					kcal_per_100g: number | null;
					protein_per_100g: number | null;
					carbs_per_100g: number | null;
					fat_per_100g: number | null;
					fiber_per_100g: number | null;
					package_price: number | null;
					default_package_price: number | null;
					price_is_default: boolean;
					currency: string;
			  })
			| null;
	})[];
}

const SELECT_RECIPE =
	"id, slug, name, servings, meal_type, category_id, recipe_ingredients(id, quantity, unit, role, ingredients(id, slug, name, is_supplement, divisible, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, package_size, package_unit, package_price, default_package_price, price_is_default, currency))";

function recipeToNutrition(r: RecipeRow): NutritionLineInput[] {
	const out: NutritionLineInput[] = [];
	for (const l of r.recipe_ingredients ?? []) {
		const ing = l.ingredients;
		if (ing === null) continue;
		out.push({
			ingredient: {
				isSupplement: ing.is_supplement,
				gPerUnit: ing.g_per_unit,
				densityGPerMl: ing.density_g_per_ml,
				kcalPer100g: ing.kcal_per_100g,
				proteinPer100g: ing.protein_per_100g,
				carbsPer100g: ing.carbs_per_100g,
				fatPer100g: ing.fat_per_100g,
				fiberPer100g: ing.fiber_per_100g,
			},
			quantity: l.quantity,
			unit: l.unit,
		});
	}
	return out;
}

interface AppliedEntry {
	entryId: string;
	recipe: RecipeRow;
	packs: number;
	servings: number;
	totalKcal: number;
	totalP: number;
	totalC: number;
	totalF: number;
	scaledLines: ScaledIngredient[];
}

interface ScaledIngredient {
	name: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	role: "hero" | "side" | "fixed";
}

export default async function PlanPage({
	searchParams,
}: {
	searchParams: Promise<{ goal?: string }>;
}) {
	const { goal: goalParam } = await searchParams;
	const goal: Goal = isGoal(goalParam) ? goalParam : "maintain";
	const target = TARGETS[goal];

	const supabase = await createClient();
	const [recipesRes, planRes, overridesRes] = await Promise.all([
		supabase.from("recipes").select(SELECT_RECIPE).order("name"),
		supabase
			.from("meal_plan_entries")
			.select("id, slot, servings, recipe_id")
			.eq("date", PLAN_DATE)
			.in("slot", ["lunch", "dinner"]),
		supabase.from("recipe_ingredient_overrides").select("recipe_ingredient_id, goal, quantity"),
	]);

	const recipesRaw = (recipesRes.data ?? []) as unknown as RecipeRow[];
	const plan = (planRes.data ?? []) as unknown as PlanRow[];
	// Phase 3.10: per-goal overrides feed into the balancer. On cut/bulk
	// we apply the override map FIRST (drops zero-quantity lines, swaps
	// in the overridden quantity), then the per-class scalars on top of
	// the resulting baseline. This means goal-specific tweaks (no cheese
	// on cut, double rice on bulk, less olive oil at breakfast) are
	// taken as given and the macro balancer only adjusts what's left.
	const overrides = buildOverrideMap(
		(overridesRes.data ?? []) as {
			recipe_ingredient_id: string;
			goal: "cut" | "bulk";
			quantity: number;
		}[],
	);

	function buildRecipes(scales: { P: number; C: number; F: number }): RecipeRow[] {
		return recipesRaw.map((r) => {
			// Apply per-goal overrides up-front. On maintain this is a no-op.
			const goalApplied = applyGoalOverrides(r.recipe_ingredients, goal, overrides);
			return {
				...r,
				recipe_ingredients: goalApplied.map((li) => {
					// Breakfast is treated as a constant per-day contribution by the
					// macro balancer — don't scale it (overrides on breakfast lines
					// already took effect above).
					if (r.slug === "breakfast_daily") return li;
					// Hero scaling happens in scalePortion via heroFactor (so it
					// doesn't cascade into more servings). Side/fixed lines are
					// scaled here by adjusting the recipe-line quantity.
					if (li.role === "hero") return li;
					const cls = classifyIngredient(ingredientForNutrition(li));
					if (!cls) return li;
					const s = scales[cls];
					if (s === 1) return li;
					return { ...li, quantity: li.quantity * s };
				}),
			};
		});
	}

	function ingredientForNutrition(li: RecipeRow["recipe_ingredients"][number]) {
		const ing = li.ingredients;
		return {
			isSupplement: ing?.is_supplement ?? false,
			gPerUnit: ing?.g_per_unit ?? null,
			densityGPerMl: ing?.density_g_per_ml ?? null,
			kcalPer100g: ing?.kcal_per_100g ?? null,
			proteinPer100g: ing?.protein_per_100g ?? null,
			carbsPer100g: ing?.carbs_per_100g ?? null,
			fatPer100g: ing?.fat_per_100g ?? null,
			fiberPer100g: ing?.fiber_per_100g ?? null,
		};
	}

	// --- Pass 1: baseline (scales = 1) ------------------------------------
	const baselineRecipes = buildRecipes({ P: 1, C: 1, F: 1 });
	const baselineById = new Map(baselineRecipes.map((r) => [r.id, r]));
	const baselineBreakfast = baselineRecipes.find((r) => r.slug === "breakfast_daily") ?? null;
	const baselinePortion = new Map(baselineRecipes.map((r) => [r.id, toPortionRecipe(r)]));
	const baselineEntries: BalanceEntry[] = [];
	for (const e of plan) {
		const r = baselineById.get(e.recipe_id);
		const portion = baselinePortion.get(e.recipe_id);
		if (!r || !portion) continue;
		const packs = Math.max(1, e.servings);
		const heroQty = heroQuantityFromPacks(portion, packs);
		const scaled = scalePortion(portion, heroQty);
		const cookLines: BalanceLine[] = scaled.scaled.map((sl) => {
			const orig = r.recipe_ingredients.find((li) => li.ingredients?.id === sl.ingredientId);
			return {
				role: sl.role,
				quantity: sl.quantity,
				unit: sl.unit,
				ingredient: orig ? ingredientForNutrition(orig) : null,
			};
		});
		baselineEntries.push({ servings: scaled.servings, cookLines });
	}
	const breakfastBaselinePS = baselineBreakfast
		? computeRecipeNutrition(recipeToNutrition(baselineBreakfast), baselineBreakfast.servings)
				.perServing
		: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
	const auto = computeMacroScales({
		breakfastDaily: {
			kcal: breakfastBaselinePS.kcal,
			protein: breakfastBaselinePS.protein,
			carbs: breakfastBaselinePS.carbs,
			fat: breakfastBaselinePS.fat,
		},
		entries: baselineEntries,
		target,
	});

	// --- Pass 2: apply per-class scalars ----------------------------------
	const recipes: RecipeRow[] = buildRecipes(auto.scales);

	const byId = new Map(recipes.map((r) => [r.id, r]));
	const breakfast = recipes.find((r) => r.slug === "breakfast_daily") ?? null;

	const lunchRows = plan.filter((e) => e.slot === "lunch");
	const dinnerRows = plan.filter((e) => e.slot === "dinner");

	// Per-serving macros at the **default** (maintain) plate size — used
	// only for the picker preview. Per-entry macros below are recomputed
	// from the goal-scaled lines.
	const perServing = new Map<string, ReturnType<typeof computeRecipeNutrition>["perServing"]>();
	for (const r of recipes) {
		perServing.set(r.id, computeRecipeNutrition(recipeToNutrition(r), r.servings).perServing);
	}

	// Portion-engine view of every recipe.
	const portionByRecipe = new Map(recipes.map((r) => [r.id, toPortionRecipe(r)]));
	// Cache scalePortion results by entry to reuse for the shopping list.
	const scaledByEntryId = new Map<string, ReturnType<typeof scalePortion>>();

	// Resolve a recipe's hero macro class (P / C / F) and look up the
	// matching scalar; used to scale hero quantity in scalePortion via
	// heroFactor without changing servings. Hero is constrained more
	// tightly than side ingredients (you can add 50 % more chicken to a
	// burrito, but tripling it is not a real-world cook).
	const HERO_FACTOR_MIN = 0.5;
	const HERO_FACTOR_MAX = 1.75;
	function heroFactorFor(r: RecipeRow): number {
		if (r.slug === "breakfast_daily") return 1;
		const heroLine = r.recipe_ingredients.find((li) => li.role === "hero");
		if (!heroLine) return 1;
		const cls = classifyIngredient(ingredientForNutrition(heroLine));
		if (!cls) return 1;
		const raw = auto.scales[cls];
		return Math.min(HERO_FACTOR_MAX, Math.max(HERO_FACTOR_MIN, raw));
	}

	function applyEntry(e: PlanRow): AppliedEntry | null {
		const r = byId.get(e.recipe_id);
		const portion = portionByRecipe.get(e.recipe_id);
		if (!r || !portion) return null;
		const packs = Math.max(1, e.servings);
		const heroQty = heroQuantityFromPacks(portion, packs);
		const scaled = scalePortion(portion, heroQty, heroFactorFor(r));
		scaledByEntryId.set(e.id, scaled);

		// Recompute macros directly from the scaled (whole-cook) lines so
		// the goal multiplier flows through to per-serving values.
		const nutritionLines: NutritionLineInput[] = scaled.scaled.map((sl) => {
			const origLine = r.recipe_ingredients.find((li) => li.ingredients?.id === sl.ingredientId);
			const ing = origLine?.ingredients;
			return {
				quantity: sl.quantity,
				unit: sl.unit,
				ingredient: {
					isSupplement: ing?.is_supplement ?? false,
					gPerUnit: ing?.g_per_unit ?? null,
					densityGPerMl: ing?.density_g_per_ml ?? null,
					kcalPer100g: ing?.kcal_per_100g ?? null,
					proteinPer100g: ing?.protein_per_100g ?? null,
					carbsPer100g: ing?.carbs_per_100g ?? null,
					fatPer100g: ing?.fat_per_100g ?? null,
					fiberPer100g: ing?.fiber_per_100g ?? null,
				},
			};
		});
		const nut = computeRecipeNutrition(nutritionLines, 1);
		const totalKcal = nut.total.kcal;
		const totalP = nut.total.protein;
		const totalC = nut.total.carbs;
		const totalF = nut.total.fat;

		const scaledLines: ScaledIngredient[] = scaled.scaled.map((sl) => ({
			name: sl.ingredientName,
			quantity: sl.quantity,
			unit: sl.unit,
			role: sl.role,
		}));

		return {
			entryId: e.id,
			recipe: r,
			packs,
			servings: scaled.servings,
			totalKcal,
			totalP,
			totalC,
			totalF,
			scaledLines,
		};
	}

	const lunchApplied = lunchRows.map(applyEntry).filter((x): x is AppliedEntry => !!x);
	const dinnerApplied = dinnerRows.map(applyEntry).filter((x): x is AppliedEntry => !!x);

	function totalsFor(applied: AppliedEntry[]) {
		let kcal = 0;
		let protein = 0;
		let carbs = 0;
		let fat = 0;
		let days = 0;
		for (const a of applied) {
			days += a.servings;
			kcal += a.totalKcal;
			protein += a.totalP;
			carbs += a.totalC;
			fat += a.totalF;
		}
		return { kcal, protein, carbs, fat, days };
	}

	const lunchT = totalsFor(lunchApplied);
	const dinnerT = totalsFor(dinnerApplied);
	const breakfastPS = breakfast ? perServing.get(breakfast.id) : undefined;

	const dayKcal =
		(breakfastPS?.kcal ?? 0) +
		(lunchT.days ? lunchT.kcal / lunchT.days : 0) +
		(dinnerT.days ? dinnerT.kcal / dinnerT.days : 0);
	const dayProtein =
		(breakfastPS?.protein ?? 0) +
		(lunchT.days ? lunchT.protein / lunchT.days : 0) +
		(dinnerT.days ? dinnerT.protein / dinnerT.days : 0);
	const dayCarbs =
		(breakfastPS?.carbs ?? 0) +
		(lunchT.days ? lunchT.carbs / lunchT.days : 0) +
		(dinnerT.days ? dinnerT.carbs / dinnerT.days : 0);
	const dayFat =
		(breakfastPS?.fat ?? 0) +
		(lunchT.days ? lunchT.fat / lunchT.days : 0) +
		(dinnerT.days ? dinnerT.fat / dinnerT.days : 0);

	function pctClass(actual: number, t: number) {
		if (t <= 0) return "text-zinc-300";
		const p = actual / t;
		if (p > 1.1) return "text-amber-300";
		if (p < 0.85) return "text-zinc-400";
		return "text-emerald-300";
	}

	// Shopping list — built from scaled lines.
	const packageMeta = new Map<
		string,
		{
			packageSize: number;
			packageUnit: "g" | "ml" | "unit";
			divisible: boolean;
			price: number | null;
			currency: string;
			priceIsDefault: boolean;
		}
	>();
	for (const r of recipes) {
		for (const li of r.recipe_ingredients) {
			if (!li.ingredients) continue;
			if (packageMeta.has(li.ingredients.id)) continue;
			packageMeta.set(li.ingredients.id, {
				packageSize: li.ingredients.package_size,
				packageUnit: li.ingredients.package_unit,
				divisible: li.ingredients.divisible ?? true,
				price: li.ingredients.package_price,
				currency: li.ingredients.currency,
				priceIsDefault: li.ingredients.price_is_default ?? true,
			});
		}
	}

	const scaledByRecipe = [...lunchApplied, ...dinnerApplied].map((a) => ({
		recipeName: a.recipe.name,
		lines: scaledByEntryId.get(a.entryId)?.scaled ?? [],
	}));
	const shop = aggregateScaledShopping(scaledByRecipe, packageMeta);

	let totalConsumed = 0;
	let totalShopping = 0;
	let currency = "CZK";
	for (const it of shop) {
		const meta = packageMeta.get(it.ingredientId);
		if (!meta) continue;
		currency = meta.currency;
		if (meta.price != null) {
			totalConsumed += it.consumedRatio * meta.price;
			const packsToBuy = Math.ceil(meta.divisible ? it.consumedRatio : it.packagesPaid);
			totalShopping += packsToBuy * meta.price;
		}
	}

	const pickerRecipes: PickerRecipe[] = recipes
		.filter((r) => r.slug !== "breakfast_daily")
		.map((r) => {
			const ps = perServing.get(r.id);
			const portion = portionByRecipe.get(r.id);
			const heroIdx = portion ? findHeroIndex(portion) : -1;
			const hero = portion && heroIdx >= 0 ? portion.lines[heroIdx] : null;
			return {
				id: r.id,
				name: r.name,
				category: r.category_id ?? "uncategorised",
				servings: r.servings,
				kcal: ps?.kcal ?? 0,
				protein: ps?.protein ?? 0,
				carbs: ps?.carbs ?? 0,
				fat: ps?.fat ?? 0,
				heroName: hero?.ingredient.name ?? null,
				heroPackageSize: hero?.ingredient.packageSize ?? null,
				heroPackageUnit: hero?.ingredient.packageUnit ?? null,
				heroPerServing: hero ? hero.quantity / Math.max(1, r.servings) : null,
			};
		});

	// --- Recommendations (Phase 3.9) ----------------------------------
	// Build one candidate per non-breakfast recipe with: macros/serving,
	// cost/serving (computeRecipeCost on the unscaled lines, ignoring
	// unit-mismatched ones — they evaluate to 0 and just lose a small
	// thrift bonus), category id, hero slug. Then ask `recommend()` for
	// the top picks per slot, excluding what's already planned and
	// penalising same-category / same-hero clashes against the OTHER
	// slot. UX lives in <RecommendationPanel/>.
	const recommendCandidates = recipes
		.filter((r) => r.slug !== "breakfast_daily")
		.map((r) => {
			const ps = perServing.get(r.id);
			const portion = portionByRecipe.get(r.id);
			const heroIdx = portion ? findHeroIndex(portion) : -1;
			const hero = portion && heroIdx >= 0 ? portion.lines[heroIdx] : null;
			const costLines: CostLineInput[] = r.recipe_ingredients
				.filter((li) => li.ingredients !== null)
				.map((li) => ({
					ingredient: {
						package_price: li.ingredients?.package_price ?? null,
						package_size: li.ingredients?.package_size ?? 0,
						package_unit: li.ingredients?.package_unit ?? "g",
						currency: li.ingredients?.currency ?? "CZK",
					},
					quantity: li.quantity,
					unit: li.unit,
				}));
			const cost = computeRecipeCost(costLines, "CZK", "consumed");
			const costPerServing = r.servings > 0 ? cost.total / r.servings : 0;
			return {
				id: r.id,
				name: r.name,
				categoryId: r.category_id,
				heroSlug: hero?.ingredient.slug ?? null,
				kcalPerServing: ps?.kcal ?? 0,
				proteinPerServing: ps?.protein ?? 0,
				costPerServing,
				heroName: hero?.ingredient.name ?? null,
			};
		});

	const lunchPlannedIds = lunchApplied.map((a) => a.recipe.id);
	const dinnerPlannedIds = dinnerApplied.map((a) => a.recipe.id);
	const allPlannedIds = [...lunchPlannedIds, ...dinnerPlannedIds];
	const lunchCategories = lunchApplied
		.map((a) => a.recipe.category_id)
		.filter((c): c is string => !!c);
	const dinnerCategories = dinnerApplied
		.map((a) => a.recipe.category_id)
		.filter((c): c is string => !!c);
	const lunchHeroes = lunchApplied
		.map((a) => recommendCandidates.find((c) => c.id === a.recipe.id)?.heroSlug ?? null)
		.filter((s): s is string => !!s);
	const dinnerHeroes = dinnerApplied
		.map((a) => recommendCandidates.find((c) => c.id === a.recipe.id)?.heroSlug ?? null)
		.filter((s): s is string => !!s);

	function toCard(c: (typeof recommendCandidates)[number] & { heroName: string | null }) {
		const scored = recommendCandidates.find((x) => x.id === c.id);
		return {
			id: c.id,
			name: c.name,
			categoryName: c.categoryId ?? "uncategorised",
			heroName: c.heroName,
			kcal: scored?.kcalPerServing ?? 0,
			protein: scored?.proteinPerServing ?? 0,
			costPerServing: scored?.costPerServing ?? 0,
			reasons: [] as string[],
		};
	}

	// Score against BOTH slots' planned items so the suggestions
	// diverge from anything currently on the plan (not just the other
	// slot), then split a single ranked list into two disjoint columns
	// so lunch and dinner never show the same recipe.
	const allCategories = [...lunchCategories, ...dinnerCategories];
	const allHeroes = [...lunchHeroes, ...dinnerHeroes];
	const ranked = recommend(
		{
			candidates: recommendCandidates,
			excludeIds: allPlannedIds,
			otherSlotCategoryIds: allCategories,
			otherSlotHeroSlugs: allHeroes,
			goal,
		},
		6,
	);
	// Interleave so each column gets a mix of high- and mid-ranked
	// candidates rather than "lunch=top half, dinner=bottom half".
	const lunchScored = ranked.filter((_, i) => i % 2 === 0).slice(0, 3);
	const dinnerScored = ranked.filter((_, i) => i % 2 === 1).slice(0, 3);

	const heroNameById = new Map(recommendCandidates.map((c) => [c.id, c.heroName]));
	const lunchCards: RecommendationCard[] = lunchScored.map((s) => ({
		...toCard({ ...s, heroName: heroNameById.get(s.id) ?? null }),
		reasons: s.reasons,
	}));
	const dinnerCards: RecommendationCard[] = dinnerScored.map((s) => ({
		...toCard({ ...s, heroName: heroNameById.get(s.id) ?? null }),
		reasons: s.reasons,
	}));
	const lunchCurrentName = lunchApplied[0]?.recipe.name ?? null;
	const dinnerCurrentName = dinnerApplied[0]?.recipe.name ?? null;

	return (
		<main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 3</p>
					<h1 className="text-2xl font-semibold tracking-tight">Meal plan</h1>
					<p className="text-sm text-zinc-400">
						Pick recipes; dial how many <span className="text-zinc-200">hero packs</span> you'll
						commit. Servings, macros and the shopping list all fall out of that.
					</p>
					<p className="font-mono text-[11px] text-zinc-500">
						auto-balance · protein ×
						<span className="text-emerald-300">{auto.scales.P.toFixed(2)}</span>
						{" · carbs ×"}
						<span className="text-emerald-300">{auto.scales.C.toFixed(2)}</span>
						{" · fat ×"}
						<span className="text-emerald-300">{auto.scales.F.toFixed(2)}</span>
						{auto.fallback ? (
							<span className="text-amber-300"> · fallback (single-kcal)</span>
						) : null}
						{auto.clamped ? <span className="text-amber-300"> · clamped</span> : null}
					</p>
				</div>
				<GoalPills active={goal} />
			</header>

			<section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<DayStat
					label="kcal / day"
					value={Math.round(dayKcal)}
					target={target.kcal}
					cls={pctClass(dayKcal, target.kcal)}
				/>
				<DayStat
					label="protein g"
					value={Math.round(dayProtein)}
					target={target.protein}
					cls={pctClass(dayProtein, target.protein)}
				/>
				<DayStat
					label="carbs g"
					value={Math.round(dayCarbs)}
					target={target.carbs}
					cls={pctClass(dayCarbs, target.carbs)}
				/>
				<DayStat
					label="fat g"
					value={Math.round(dayFat)}
					target={target.fat}
					cls={pctClass(dayFat, target.fat)}
				/>
			</section>

			<div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
				<div className="space-y-6">
					<section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
						<header className="mb-2 flex items-center justify-between">
							<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
								Breakfast · pinned × 7 days
							</h2>
							{breakfast ? (
								<Link
									href={`/recipes/${breakfast.slug}`}
									className="text-xs text-zinc-400 hover:text-zinc-200"
								>
									{breakfast.name} →
								</Link>
							) : (
								<span className="text-xs text-rose-300">breakfast_daily not found</span>
							)}
						</header>
						{breakfastPS && (
							<p className="font-mono text-[11px] text-zinc-500">
								{Math.round(breakfastPS.kcal)} kcal · P {Math.round(breakfastPS.protein)} · C{" "}
								{Math.round(breakfastPS.carbs)} · F {Math.round(breakfastPS.fat)} per day
							</p>
						)}
					</section>

					<MealSection
						title="Lunch"
						days={lunchT.days}
						kcalAvg={lunchT.days ? lunchT.kcal / lunchT.days : 0}
						applied={lunchApplied}
						pickerRecipes={pickerRecipes}
						slot="lunch"
					/>

					<MealSection
						title="Dinner"
						days={dinnerT.days}
						kcalAvg={dinnerT.days ? dinnerT.kcal / dinnerT.days : 0}
						applied={dinnerApplied}
						pickerRecipes={pickerRecipes}
						slot="dinner"
					/>

					<RecommendationPanel
						lunch={{ currentName: lunchCurrentName, cards: lunchCards }}
						dinner={{ currentName: dinnerCurrentName, cards: dinnerCards }}
					/>
				</div>

				<aside className="space-y-3">
					<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
						<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
							Shopping list
						</h2>
						<p className="mt-0.5 text-[11px] text-zinc-500">
							Lunch + dinner only · breakfast not included
						</p>
						<div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
							<div>
								<p className="text-zinc-500">Used</p>
								<p className="text-emerald-300">
									{totalConsumed.toFixed(2)} {currency}
								</p>
							</div>
							<div>
								<p className="text-zinc-500">To buy</p>
								<p className="text-sky-300">
									{totalShopping.toFixed(2)} {currency}
								</p>
							</div>
						</div>
					</div>

					{shop.length === 0 ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6 text-center text-xs text-zinc-500">
							Add a lunch or dinner to see the shopping list.
						</div>
					) : (
						<ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
							{shop.map((it) => {
								const meta = packageMeta.get(it.ingredientId);
								const packsToBuy = Math.ceil(meta?.divisible ? it.consumedRatio : it.packagesPaid);
								const cost = meta?.price != null ? packsToBuy * meta.price : null;
								return (
									<li key={it.ingredientId} className="bg-zinc-900/30 px-3 py-2">
										<div className="flex items-baseline justify-between gap-2">
											<span className="text-sm text-zinc-100">{it.ingredientName}</span>
											<span className="font-mono text-[11px] text-zinc-300">
												{packsToBuy}× {it.packageSize}
												{it.packageUnit}
											</span>
										</div>
										<div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-500">
											<span>
												need {it.quantity.toFixed(it.unit === "unit" ? 1 : 0)} {it.unit}
												{meta && !meta.divisible && (
													<span
														className="ml-1 text-amber-400"
														title="non-divisible — pays full pack"
													>
														·fixed
													</span>
												)}
											</span>
											<span className="flex items-center gap-1">
												{cost != null ? `${cost.toFixed(2)} ${meta?.currency ?? ""}` : "—"}
												{meta?.priceIsDefault ? (
													<span
														title="Lidl Prague 2026 estimate"
														className="rounded border border-amber-700/60 bg-amber-900/20 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-300"
													>
														def
													</span>
												) : (
													<span
														title="Real ticket price"
														className="rounded border border-emerald-700/60 bg-emerald-900/20 px-1 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300"
													>
														real
													</span>
												)}
											</span>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</aside>
			</div>

			<footer className="pt-4">
				<ButtonLink href="/recipes" variant="ghost" size="sm">
					← Recipes
				</ButtonLink>
			</footer>
		</main>
	);
}

function DayStat({
	label,
	value,
	target,
	cls,
}: {
	label: string;
	value: number;
	target: number;
	cls: string;
}) {
	const pct = target > 0 ? Math.round((value / target) * 100) : 0;
	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
			<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
			<p className={`mt-1 font-mono text-2xl ${cls}`}>{value}</p>
			<p className="font-mono text-[10px] text-zinc-500">
				/ {target} ({pct}%)
			</p>
		</div>
	);
}

function MealSection({
	title,
	days,
	kcalAvg,
	applied,
	pickerRecipes,
	slot,
}: {
	title: string;
	days: number;
	kcalAvg: number;
	applied: AppliedEntry[];
	pickerRecipes: PickerRecipe[];
	slot: "lunch" | "dinner";
}) {
	const dayLabel = days % 1 === 0 ? days.toString() : days.toFixed(1);
	return (
		<section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
			<header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
					{title}
					<span className="ml-2 text-zinc-200">
						{dayLabel} {days === 1 ? "serving" : "servings"}
					</span>
				</h2>
				{days > 0 && (
					<span className="font-mono text-[11px] text-zinc-500">
						avg {Math.round(kcalAvg)} kcal / serving
					</span>
				)}
			</header>
			<div className="space-y-2">
				{applied.map((a) => (
					<PlanEntryRow
						key={a.entryId}
						id={a.entryId}
						recipeId={a.recipe.id}
						recipeSlug={a.recipe.slug}
						packs={a.packs}
						servings={a.servings}
						totalKcal={a.totalKcal}
						totalP={a.totalP}
						totalC={a.totalC}
						totalF={a.totalF}
						scaledLines={a.scaledLines}
						recipes={pickerRecipes}
					/>
				))}
				<AddPlanEntry slot={slot} recipes={pickerRecipes} />
			</div>
		</section>
	);
}
