import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
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
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1 min-w-0">
					<Link
						href="/recipes"
						className="font-mono text-xs text-fg-mute hover:text-fg"
					>
						← recipes
					</Link>
					<TermHeading level={1} prompt="$" caret>
						{recipe.name}
					</TermHeading>
					<p className="font-mono text-xs text-fg-mute">
						{recipe.category_id ?? "uncategorised"} · {recipe.meal_type} · {recipe.servings}{" "}
						{recipe.servings === 1 ? "srv" : "srvs"}
					</p>
				</div>
				<Link
					href={`/recipes/${recipe.slug}/edit`}
					className="inline-flex min-h-[40px] items-center rounded-sm border border-grid bg-bg-sunk px-3 py-1.5 font-mono text-xs text-fg-dim hover:border-fg-mute hover:text-fg"
				>
					edit ↗
				</Link>
			</header>

			<Surface aria-label="Estimated cost" className="p-4">
				<div className="flex items-baseline justify-between">
					<TermHeading level={2} prompt="€">
						estimated cost
					</TermHeading>
					{cost.hasUnknown ? (
						<span className="font-mono text-[10px] uppercase tracking-widest text-amber">
							some prices missing
						</span>
					) : null}
				</div>
				<p className="mt-2 font-mono text-2xl text-accent">
					{cost.total.toFixed(2)} {cost.currency}
				</p>
				<p className="font-mono text-xs text-fg-mute">
					≈ {perServing.toFixed(2)} {cost.currency} / srv
				</p>
				{defaultLinesCost > 0 ? (
					<p className="mt-2 font-mono text-[11px] text-amber">
						between {costMin.toFixed(2)} and {costMax.toFixed(2)} {cost.currency} — {defaultShare}%
						still uses default Lidl 2026 estimates (±{Math.round(DEFAULT_PRICE_VARIANCE * 100)}%
						assumed).
					</p>
				) : (
					<p className="mt-2 font-mono text-[11px] text-accent">
						all line prices come from real tickets.
					</p>
				)}
				<p className="mt-2 font-mono text-[10px] text-fg-mute">
					shopping (round up to whole packages): {shoppingCost.total.toFixed(2)}{" "}
					{shoppingCost.currency}
				</p>
			</Surface>

			<Surface aria-label="Nutrition per serving" className="p-4">
				<div className="flex items-baseline justify-between">
					<TermHeading level={2} prompt="μ">
						nutrition / srv
					</TermHeading>
					{nutrition.missing ? (
						<span className="font-mono text-[10px] uppercase tracking-widest text-amber">
							partial — some ingredients missing data
						</span>
					) : null}
				</div>
				<p className="mt-2 font-mono text-2xl text-cyan">{nutrition.perServing.kcal} kcal</p>
				<dl className="mt-2 grid grid-cols-4 gap-2 font-mono text-xs text-fg-dim">
					<div>
						<dt className="text-[10px] uppercase tracking-widest text-fg-mute">protein</dt>
						<dd>{nutrition.perServing.protein} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-widest text-fg-mute">carbs</dt>
						<dd>{nutrition.perServing.carbs} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-widest text-fg-mute">fat</dt>
						<dd>{nutrition.perServing.fat} g</dd>
					</div>
					<div>
						<dt className="text-[10px] uppercase tracking-widest text-fg-mute">fibre</dt>
						<dd>{nutrition.perServing.fiber} g</dd>
					</div>
				</dl>
				<p className="mt-2 font-mono text-[10px] text-fg-mute">
					batch total: {nutrition.total.kcal} kcal · {nutrition.total.protein} g P ·{" "}
					{nutrition.total.carbs} g C · {nutrition.total.fat} g F
				</p>
			</Surface>

			<Surface aria-label="Day projection vs goal" className="p-4">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<TermHeading level={2} prompt="Δ">
						day projection vs goal
					</TermHeading>
					<div className="flex gap-1 font-mono text-[10px]">
						{GOALS.map((g) => {
							const active = g === goal;
							return (
								<Link
									key={g}
									href={`/recipes/${recipe.slug}?goal=${g}`}
									className={`inline-flex min-h-[28px] items-center rounded-sm border px-2 py-0.5 ${
										active
											? "border-cyan/60 bg-cyan/10 text-cyan"
											: "border-grid text-fg-dim hover:border-fg-mute"
									}`}
								>
									{GOAL_LABEL[g]}
								</Link>
							);
						})}
					</div>
				</div>
				<p className="mt-1 font-mono text-[10px] text-fg-mute">
					stacked = breakfast (always) + this recipe (highlighted) + avg other recipe (proxy for the
					third meal). target: {target.kcal} kcal · {target.protein} g P · {target.carbs} g C ·{" "}
					{target.fat} g F.
				</p>
				<div className="mt-3 space-y-3">
					{macroRows.map((row) => {
						const dayPct = pct(row.day, row.tgt);
						const breakfastPct = Math.min(100, pct(row.b, row.tgt));
						const thisPct = Math.min(100 - breakfastPct, pct(row.t, row.tgt));
						const otherPct = Math.min(100 - breakfastPct - thisPct, pct(row.o, row.tgt));
						const over = dayPct > 110;
						const under = dayPct < 85;
						const statusColor = over ? "text-magenta" : under ? "text-fg-mute" : "text-accent";
						return (
							<div key={row.key} className="space-y-1">
								<div className="flex justify-between font-mono text-xs text-fg-dim">
									<span>{row.label}</span>
									<span>
										{Math.round(row.day)} / {row.tgt} {row.unit} ·{" "}
										<span className={statusColor}>{dayPct}%</span>
									</span>
								</div>
								<div className="flex h-2 w-full overflow-hidden rounded-sm bg-bg-sunk">
									<div
										className="h-full bg-fg-mute/40"
										style={{ width: `${breakfastPct}%` }}
										title={`Breakfast: ${Math.round(row.b)} ${row.unit}`}
									/>
									<div
										className={`h-full ${isBreakfast ? "bg-fg-mute/40" : "bg-cyan"}`}
										style={{ width: `${thisPct}%` }}
										title={`This recipe: ${Math.round(row.t)} ${row.unit}`}
									/>
									<div
										className="h-full bg-fg-mute/20"
										style={{ width: `${otherPct}%` }}
										title={`Avg other: ${Math.round(row.o)} ${row.unit}`}
									/>
								</div>
								<div className="font-mono text-[10px] text-fg-mute">
									breakfast {Math.round(row.b)} +{" "}
									<span className={isBreakfast ? "text-fg-dim" : "text-cyan"}>
										{isBreakfast ? "(breakfast above)" : `this ${Math.round(row.t)}`}
									</span>{" "}
									+ avg {Math.round(row.o)} {row.unit}
								</div>
							</div>
						);
					})}
				</div>
			</Surface>

			{Object.keys(nutrition.perServingMicros).length > 0 ? (
				<Surface aria-label="Micronutrients per serving" className="p-4">
					<TermHeading level={2} prompt="μ">
						micros / srv
					</TermHeading>
					<p className="mt-1 font-mono text-[10px] text-fg-mute">
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
									<div className="flex justify-between font-mono text-xs text-fg-dim">
										<span>{entry.label}</span>
										<span>
											{value} {entry.unit} ·{" "}
											<span className={over ? "text-magenta" : "text-fg"}>{pct}%</span>
										</span>
									</div>
									<div className="h-1.5 w-full overflow-hidden rounded-sm bg-bg-sunk">
										<div
											className={`h-full ${over ? "bg-magenta" : "bg-cyan"}`}
											style={{ width: `${clamped}%` }}
										/>
									</div>
								</div>
							);
						})}
					</dl>
				</Surface>
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
				<TermHeading level={2} prompt="▣">
					ingredients
				</TermHeading>
				<p className="mb-2 mt-1 font-mono text-[10px] text-fg-mute">
					per-line numbers are computed for the quantity used in this recipe (whole batch, not per
					serving). hover the price badge to see the source.
				</p>
				<ul className="divide-y divide-grid rounded-sm border border-grid bg-bg-elev">
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
						const roleGlyph =
							l.role === "hero" ? "◆" : l.role === "fixed" ? "▣" : l.role === "side" ? "◇" : "·";
						const roleColor =
							l.role === "hero"
								? "text-accent"
								: l.role === "fixed"
									? "text-amber"
									: "text-fg-mute";
						return (
							<li
								key={`${ing?.id ?? "?"}-${idx}`}
								className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<p className="font-mono text-fg">
										<span aria-hidden className={`mr-1 ${roleColor}`}>
											{roleGlyph}
										</span>
										{ing?.name ?? "(missing ingredient)"}
									</p>
									{l.notes ? (
										<p className="font-mono text-xs text-fg-mute">{l.notes}</p>
									) : null}
									{lineMacros ? (
										<p className="mt-1 font-mono text-[10px] text-fg-mute">
											{Math.round(lineMacros.kcal)} kcal · {lineMacros.protein.toFixed(1)} P ·{" "}
											{lineMacros.carbs.toFixed(1)} C · {lineMacros.fat.toFixed(1)} F
										</p>
									) : (
										<p className="mt-1 font-mono text-[10px] text-fg-mute">no nutrition data</p>
									)}
								</div>
								<div className="flex items-center gap-3 text-right">
									<span className="font-mono text-xs text-fg-dim">
										{l.quantity} {l.unit}
									</span>
									<span className="flex items-center justify-end gap-1.5 font-mono text-xs">
										<span className="w-20 text-fg">
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
													className="rounded-sm border border-amber/40 bg-amber/10 px-1 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber"
												>
													def
												</span>
											) : (
												<span
													title={priceDelta ? `Real price · ${priceDelta}` : "Real price"}
													className="rounded-sm border border-accent/40 bg-accent/10 px-1 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent"
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
					<TermHeading level={2} prompt="›">
						instructions
					</TermHeading>
					<pre className="mt-2 whitespace-pre-wrap rounded-sm border border-grid bg-bg-elev p-4 font-mono text-sm text-fg-dim">
						{recipe.instructions_md}
					</pre>
				</section>
			) : null}
		</main>
	);
}
