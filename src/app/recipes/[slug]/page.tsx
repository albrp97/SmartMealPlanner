import { type CostLineInput, computeRecipeCost } from "@/lib/cost";
import { createClient } from "@/lib/db/client-server";
import { GOALS, GOAL_LABEL, type Goal, TARGETS, isGoal, pct } from "@/lib/goals";
import {
	type NutritionLineInput,
	computeLineNutrition,
	computeRecipeNutrition,
} from "@/lib/nutrition";
import { RDA, rdaPercent } from "@/lib/rda";
import { buildOverrideMap } from "@/lib/recipe-overrides";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GoalQuantitiesEditor } from "./goal-quantities-editor";

export const dynamic = "force-dynamic";

/**
 * Variance assumed for ingredients that still carry the seeded estimate
 * instead of a real ticket price. Applied symmetrically to the cost they
 * contribute to the recipe so we can show "between X and Y" until prices
 * are calibrated. ±15% is loose enough to cover most Lidl shelf swings.
 */
const DEFAULT_PRICE_VARIANCE = 0.15;

interface IngredientForCost {
	id: string;
	name: string;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	package_price: number | null;
	default_package_price: number | null;
	price_is_default: boolean;
	currency: string;
	is_supplement: boolean;
	g_per_unit: number | null;
	density_g_per_ml: number | null;
	kcal_per_100g: number | null;
	protein_per_100g: number | null;
	carbs_per_100g: number | null;
	fat_per_100g: number | null;
	fiber_per_100g: number | null;
	micros_per_100g: Record<string, number> | null;
}

interface RecipeIngredientRow {
	id: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	role: "hero" | "side" | "fixed" | null;
	notes: string | null;
	position: number;
	ingredients: IngredientForCost | null;
}

export default async function RecipeDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ goal?: string }>;
}) {
	const { slug } = await params;
	const { goal: goalParam } = await searchParams;
	const goal: Goal = isGoal(goalParam) ? goalParam : "maintain";
	const target = TARGETS[goal];
	const supabase = await createClient();

	const { data: recipe, error: recipeErr } = await supabase
		.from("recipes")
		.select("id, slug, name, servings, meal_type, category_id, instructions_md, notes")
		.eq("slug", slug)
		.maybeSingle();

	if (recipeErr || !recipe) {
		notFound();
	}

	const { data: linesRaw } = await supabase
		.from("recipe_ingredients")
		.select(
			"id, quantity, unit, role, notes, position, ingredients(id, name, package_size, package_unit, package_price, default_package_price, price_is_default, currency, is_supplement, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, micros_per_100g)",
		)
		.eq("recipe_id", recipe.id)
		.order("position");

	const lines = (linesRaw ?? []) as unknown as RecipeIngredientRow[];

	const { data: overridesRaw } = await supabase
		.from("recipe_ingredient_overrides")
		.select("recipe_ingredient_id, goal, quantity")
		.in(
			"recipe_ingredient_id",
			lines.map((l) => l.id),
		);
	const overrides = buildOverrideMap(
		(overridesRaw ?? []) as unknown as {
			recipe_ingredient_id: string;
			goal: "cut" | "bulk";
			quantity: number;
		}[],
	);

	const costInputs: CostLineInput[] = lines
		.filter(
			(l): l is RecipeIngredientRow & { ingredients: IngredientForCost } => l.ingredients !== null,
		)
		.map((l) => ({
			ingredient: {
				package_price: l.ingredients.package_price,
				package_size: l.ingredients.package_size,
				package_unit: l.ingredients.package_unit,
				currency: l.ingredients.currency,
			},
			quantity: l.quantity,
			unit: l.unit,
		}));

	const cost = computeRecipeCost(costInputs);
	const perServing = recipe.servings > 0 ? cost.total / recipe.servings : cost.total;
	const shoppingCost = computeRecipeCost(costInputs, "CZK", "shopping");

	// Cost coming from ingredients that still hold the seeded default price.
	// Used to show a ±variance band on the recipe cost so the user knows how
	// much of the estimate is still uncertain.
	const defaultLinesCost = lines.reduce((acc, l, idx) => {
		if (!l.ingredients) return acc;
		if (!l.ingredients.price_is_default) return acc;
		const c = cost.lines[idx]?.cost ?? 0;
		return acc + c;
	}, 0);
	const costSwing = defaultLinesCost * DEFAULT_PRICE_VARIANCE;
	const costMin = Math.max(0, cost.total - costSwing);
	const costMax = cost.total + costSwing;
	const defaultShare = cost.total > 0 ? Math.round((defaultLinesCost / cost.total) * 100) : 0;

	const nutritionInputs: NutritionLineInput[] = lines
		.filter(
			(l): l is RecipeIngredientRow & { ingredients: IngredientForCost } => l.ingredients !== null,
		)
		.map((l) => ({
			ingredient: {
				isSupplement: l.ingredients.is_supplement,
				gPerUnit: l.ingredients.g_per_unit,
				densityGPerMl: l.ingredients.density_g_per_ml,
				kcalPer100g: l.ingredients.kcal_per_100g,
				proteinPer100g: l.ingredients.protein_per_100g,
				carbsPer100g: l.ingredients.carbs_per_100g,
				fatPer100g: l.ingredients.fat_per_100g,
				fiberPer100g: l.ingredients.fiber_per_100g,
				microsPer100g: l.ingredients.micros_per_100g,
			},
			quantity: l.quantity,
			unit: l.unit,
		}));

	const nutrition = computeRecipeNutrition(nutritionInputs, recipe.servings);

	// --- Day projection ---
	// Query every recipe with its ingredients in one shot, compute per-serving
	// macros for each. Breakfast = the "breakfast_daily" recipe (always eaten);
	// "average other" = mean of every other recipe's per-serving macros, used
	// as a stand-in for the third meal of the day. The current recipe is
	// highlighted in the stacked bars.
	const { data: allRaw } = await supabase
		.from("recipes")
		.select(
			"id, slug, servings, recipe_ingredients(quantity, unit, ingredients(is_supplement, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))",
		);

	interface AllRecipeRow {
		id: string;
		slug: string;
		servings: number;
		recipe_ingredients: {
			quantity: number;
			unit: "g" | "ml" | "unit";
			ingredients: {
				is_supplement: boolean;
				g_per_unit: number | null;
				density_g_per_ml: number | null;
				kcal_per_100g: number | null;
				protein_per_100g: number | null;
				carbs_per_100g: number | null;
				fat_per_100g: number | null;
				fiber_per_100g: number | null;
			} | null;
		}[];
	}

	const allRecipes = ((allRaw ?? []) as unknown as AllRecipeRow[]).map((r) => {
		const ls: NutritionLineInput[] = (r.recipe_ingredients ?? [])
			.filter(
				(
					l,
				): l is (typeof r.recipe_ingredients)[number] & {
					ingredients: NonNullable<(typeof r.recipe_ingredients)[number]["ingredients"]>;
				} => l.ingredients !== null,
			)
			.map((l) => ({
				ingredient: {
					isSupplement: l.ingredients.is_supplement,
					gPerUnit: l.ingredients.g_per_unit,
					densityGPerMl: l.ingredients.density_g_per_ml,
					kcalPer100g: l.ingredients.kcal_per_100g,
					proteinPer100g: l.ingredients.protein_per_100g,
					carbsPer100g: l.ingredients.carbs_per_100g,
					fatPer100g: l.ingredients.fat_per_100g,
					fiberPer100g: l.ingredients.fiber_per_100g,
				},
				quantity: l.quantity,
				unit: l.unit,
			}));
		return { slug: r.slug, ps: computeRecipeNutrition(ls, r.servings).perServing };
	});

	const ZERO_PS = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
	const breakfastPs = allRecipes.find((r) => r.slug === "breakfast_daily")?.ps ?? ZERO_PS;
	const others = allRecipes.filter((r) => r.slug !== "breakfast_daily" && r.slug !== recipe.slug);
	const avgOtherPs = others.length
		? {
				kcal: others.reduce((a, r) => a + r.ps.kcal, 0) / others.length,
				protein: others.reduce((a, r) => a + r.ps.protein, 0) / others.length,
				carbs: others.reduce((a, r) => a + r.ps.carbs, 0) / others.length,
				fat: others.reduce((a, r) => a + r.ps.fat, 0) / others.length,
				fiber: others.reduce((a, r) => a + r.ps.fiber, 0) / others.length,
			}
		: ZERO_PS;
	const thisPs = nutrition.perServing;
	const dayProjection = {
		kcal: breakfastPs.kcal + thisPs.kcal + avgOtherPs.kcal,
		protein: breakfastPs.protein + thisPs.protein + avgOtherPs.protein,
		carbs: breakfastPs.carbs + thisPs.carbs + avgOtherPs.carbs,
		fat: breakfastPs.fat + thisPs.fat + avgOtherPs.fat,
	};
	const isBreakfast = recipe.slug === "breakfast_daily";

	const macroRows = [
		{
			key: "kcal" as const,
			label: "Calories",
			unit: "kcal",
			tgt: target.kcal,
			b: breakfastPs.kcal,
			t: thisPs.kcal,
			o: avgOtherPs.kcal,
			day: dayProjection.kcal,
		},
		{
			key: "protein" as const,
			label: "Protein",
			unit: "g",
			tgt: target.protein,
			b: breakfastPs.protein,
			t: thisPs.protein,
			o: avgOtherPs.protein,
			day: dayProjection.protein,
		},
		{
			key: "carbs" as const,
			label: "Carbs",
			unit: "g",
			tgt: target.carbs,
			b: breakfastPs.carbs,
			t: thisPs.carbs,
			o: avgOtherPs.carbs,
			day: dayProjection.carbs,
		},
		{
			key: "fat" as const,
			label: "Fat",
			unit: "g",
			tgt: target.fat,
			b: breakfastPs.fat,
			t: thisPs.fat,
			o: avgOtherPs.fat,
			day: dayProjection.fat,
		},
	];

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<Link href="/recipes" className="text-xs text-zinc-500 hover:text-zinc-300">
						← Recipes
					</Link>
					<h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
					<p className="font-mono text-xs text-zinc-500">
						{recipe.category_id ?? "uncategorised"} · {recipe.meal_type} · {recipe.servings}{" "}
						{recipe.servings === 1 ? "serving" : "servings"}
					</p>
				</div>
				<Link
					href={`/recipes/${recipe.slug}/edit`}
					className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
				>
					Edit →
				</Link>
			</header>

			<section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
				<div className="flex items-baseline justify-between">
					<h2 className="text-sm font-medium text-zinc-300">Estimated cost</h2>
					{cost.hasUnknown ? (
						<span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
							some prices missing
						</span>
					) : null}
				</div>
				<p className="mt-2 font-mono text-2xl text-emerald-300">
					{cost.total.toFixed(2)} {cost.currency}
				</p>
				<p className="font-mono text-xs text-zinc-500">
					≈ {perServing.toFixed(2)} {cost.currency} / serving
				</p>
				{defaultLinesCost > 0 ? (
					<p className="mt-2 font-mono text-[11px] text-amber-300/90">
						Between {costMin.toFixed(2)} and {costMax.toFixed(2)} {cost.currency} — {defaultShare}%
						of this recipe still uses default Lidl 2026 estimates (±
						{Math.round(DEFAULT_PRICE_VARIANCE * 100)}% assumed).
					</p>
				) : (
					<p className="mt-2 font-mono text-[11px] text-emerald-300/80">
						All line prices come from real tickets.
					</p>
				)}
				<p className="mt-2 font-mono text-[10px] text-zinc-500">
					Shopping (round up to whole packages): {shoppingCost.total.toFixed(2)}{" "}
					{shoppingCost.currency}
				</p>
			</section>

			<section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
				<div className="flex items-baseline justify-between">
					<h2 className="text-sm font-medium text-zinc-300">Nutrition / serving</h2>
					{nutrition.missing ? (
						<span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
							partial — some ingredients missing data
						</span>
					) : null}
				</div>
				<p className="mt-2 font-mono text-2xl text-sky-300">{nutrition.perServing.kcal} kcal</p>
				<dl className="mt-2 grid grid-cols-4 gap-2 font-mono text-xs text-zinc-400">
					<div>
						<dt className="text-[10px] uppercase tracking-wider text-zinc-500">Protein</dt>
						<dd>{nutrition.perServing.protein} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-wider text-zinc-500">Carbs</dt>
						<dd>{nutrition.perServing.carbs} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-wider text-zinc-500">Fat</dt>
						<dd>{nutrition.perServing.fat} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-wider text-zinc-500">Fibre</dt>
						<dd>{nutrition.perServing.fiber} g</dd>
					</div>
				</dl>
				<p className="mt-2 font-mono text-[10px] text-zinc-600">
					Batch total: {nutrition.total.kcal} kcal · {nutrition.total.protein} g P ·{" "}
					{nutrition.total.carbs} g C · {nutrition.total.fat} g F
				</p>
			</section>

			<section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
				<div className="flex items-baseline justify-between">
					<h2 className="text-sm font-medium text-zinc-300">Day projection vs goal</h2>
					<div className="flex gap-1 font-mono text-[10px]">
						{GOALS.map((g) => {
							const active = g === goal;
							return (
								<Link
									key={g}
									href={`/recipes/${recipe.slug}?goal=${g}`}
									className={`rounded-md border px-2 py-0.5 ${
										active
											? "border-sky-600 bg-sky-600/20 text-sky-200"
											: "border-zinc-700 text-zinc-400 hover:border-zinc-500"
									}`}
								>
									{GOAL_LABEL[g]}
								</Link>
							);
						})}
					</div>
				</div>
				<p className="mt-1 font-mono text-[10px] text-zinc-600">
					Stacked bar = breakfast (always) + this recipe (highlighted) + average other recipe (proxy
					for the third meal). Target: {target.kcal} kcal · {target.protein} g P · {target.carbs} g
					C · {target.fat} g F.
				</p>
				<div className="mt-3 space-y-3">
					{macroRows.map((row) => {
						const dayPct = pct(row.day, row.tgt);
						const breakfastPct = Math.min(100, pct(row.b, row.tgt));
						const thisPct = Math.min(100 - breakfastPct, pct(row.t, row.tgt));
						const otherPct = Math.min(100 - breakfastPct - thisPct, pct(row.o, row.tgt));
						const over = dayPct > 110;
						const under = dayPct < 85;
						const statusColor = over
							? "text-amber-400"
							: under
								? "text-zinc-500"
								: "text-emerald-300";
						return (
							<div key={row.key} className="space-y-1">
								<div className="flex justify-between font-mono text-xs text-zinc-400">
									<span>{row.label}</span>
									<span>
										{Math.round(row.day)} / {row.tgt} {row.unit} ·{" "}
										<span className={statusColor}>{dayPct}%</span>
									</span>
								</div>
								<div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800">
									<div
										className="h-full bg-zinc-600"
										style={{ width: `${breakfastPct}%` }}
										title={`Breakfast: ${Math.round(row.b)} ${row.unit}`}
									/>
									<div
										className={`h-full ${isBreakfast ? "bg-zinc-600" : "bg-sky-500"}`}
										style={{ width: `${thisPct}%` }}
										title={`This recipe: ${Math.round(row.t)} ${row.unit}`}
									/>
									<div
										className="h-full bg-zinc-700"
										style={{ width: `${otherPct}%` }}
										title={`Avg other: ${Math.round(row.o)} ${row.unit}`}
									/>
								</div>
								<div className="flex justify-between font-mono text-[10px] text-zinc-600">
									<span>
										☕ {Math.round(row.b)} +{" "}
										<span className={isBreakfast ? "text-zinc-400" : "text-sky-300"}>
											{isBreakfast ? "(breakfast above)" : `🍽 ${Math.round(row.t)}`}
										</span>{" "}
										+ avg {Math.round(row.o)} {row.unit}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</section>

			{Object.keys(nutrition.perServingMicros).length > 0 ? (
				<section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
					<h2 className="text-sm font-medium text-zinc-300">Micronutrients / serving</h2>
					<p className="mt-1 font-mono text-[10px] text-zinc-600">
						% of EU adult Reference Daily Allowance (NRV).
					</p>
					<dl className="mt-3 space-y-2">
						{Object.entries(RDA).map(([key, entry]) => {
							const value = nutrition.perServingMicros[key];
							if (value == null) return null;
							const pct = rdaPercent(key, value) ?? 0;
							const clamped = Math.min(100, pct);
							const over = key === "sodium_mg" && pct > 100;
							return (
								<div key={key} className="space-y-1">
									<div className="flex justify-between font-mono text-xs text-zinc-400">
										<span>{entry.label}</span>
										<span>
											{value} {entry.unit} ·{" "}
											<span className={over ? "text-amber-400" : "text-zinc-300"}>{pct}%</span>
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
										<div
											className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-sky-500"}`}
											style={{ width: `${clamped}%` }}
										/>
									</div>
								</div>
							);
						})}
					</dl>
				</section>
			) : null}

			<GoalQuantitiesEditor
				recipeSlug={recipe.slug}
				rows={lines.map((l) => {
					const ov = overrides.get(l.id);
					return {
						id: l.id,
						name: l.ingredients?.name ?? "(missing)",
						unit: l.unit,
						role: l.role,
						maintain: l.quantity,
						cut: ov?.cut ?? null,
						bulk: ov?.bulk ?? null,
					};
				})}
			/>

			<section>
				<h2 className="mb-2 text-sm font-medium text-zinc-300">Ingredients</h2>
				<p className="mb-2 font-mono text-[10px] text-zinc-600">
					Per-line numbers are computed for the quantity used in this recipe (whole batch, not per
					serving). Hover the price badge to see the source.
				</p>
				<ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
					{lines.map((l, idx) => {
						const lineCost = cost.lines[idx];
						const ing = l.ingredients;
						// Per-line nutrition for the quantity declared in the recipe.
						const lineMacros = ing
							? computeLineNutrition({
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
								}).macros
							: null;
						const isDef = ing?.price_is_default ?? true;
						const def = ing?.default_package_price;
						const real = ing?.package_price;
						const priceDelta =
							!isDef && def != null && real != null && def !== 0
								? `${(((real - def) / def) * 100).toFixed(0)}% vs default`
								: null;
						return (
							<li
								key={`${ing?.id ?? "?"}-${idx}`}
								className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<p className="text-zinc-100">{ing?.name ?? "(missing ingredient)"}</p>
									{l.notes ? <p className="text-xs text-zinc-500">{l.notes}</p> : null}
									{lineMacros ? (
										<p className="mt-1 font-mono text-[10px] text-zinc-500">
											{Math.round(lineMacros.kcal)} kcal · {lineMacros.protein.toFixed(1)} P ·{" "}
											{lineMacros.carbs.toFixed(1)} C · {lineMacros.fat.toFixed(1)} F
										</p>
									) : (
										<p className="mt-1 font-mono text-[10px] text-zinc-600">no nutrition data</p>
									)}
								</div>
								<div className="flex items-center gap-3 text-right">
									<span className="font-mono text-xs text-zinc-400">
										{l.quantity} {l.unit}
									</span>
									<span className="flex items-center justify-end gap-1.5 font-mono text-xs">
										<span className="w-20 text-zinc-300">
											{lineCost.cost != null
												? `${lineCost.cost.toFixed(2)} ${lineCost.currency}`
												: lineCost.reason === "no_price"
													? "no price"
													: "unit ≠"}
										</span>
										{ing && lineCost.cost != null ? (
											isDef ? (
												<span
													title="Lidl Prague 2026 estimate — not from a real receipt yet"
													className="rounded border border-amber-700 bg-amber-900/30 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-300"
												>
													def
												</span>
											) : (
												<span
													title={priceDelta ? `Real price · ${priceDelta}` : "Real price"}
													className="rounded border border-emerald-700 bg-emerald-900/30 px-1 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300"
												>
													real
												</span>
											)
										) : null}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			</section>

			{recipe.instructions_md ? (
				<section>
					<h2 className="mb-2 text-sm font-medium text-zinc-300">Instructions</h2>
					<pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
						{recipe.instructions_md}
					</pre>
				</section>
			) : null}
		</main>
	);
}
