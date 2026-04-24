import { type CostLineInput, computeRecipeCost } from "@/lib/cost";
import { createClient } from "@/lib/db/client-server";
import { type NutritionLineInput, computeRecipeNutrition } from "@/lib/nutrition";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface IngredientForCost {
	id: string;
	name: string;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	package_price: number | null;
	currency: string;
	is_supplement: boolean;
	g_per_unit: number | null;
	density_g_per_ml: number | null;
	kcal_per_100g: number | null;
	protein_per_100g: number | null;
	carbs_per_100g: number | null;
	fat_per_100g: number | null;
	fiber_per_100g: number | null;
}

interface RecipeIngredientRow {
	quantity: number;
	unit: "g" | "ml" | "unit";
	notes: string | null;
	position: number;
	ingredients: IngredientForCost | null;
}

export default async function RecipeDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
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
			"quantity, unit, notes, position, ingredients(id, name, package_size, package_unit, package_price, currency, is_supplement, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g)",
		)
		.eq("recipe_id", recipe.id)
		.order("position");

	const lines = (linesRaw ?? []) as unknown as RecipeIngredientRow[];

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
			},
			quantity: l.quantity,
			unit: l.unit,
		}));

	const nutrition = computeRecipeNutrition(nutritionInputs, recipe.servings);

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

			<section>
				<h2 className="mb-2 text-sm font-medium text-zinc-300">Ingredients</h2>
				<ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
					{lines.map((l, idx) => {
						const lineCost = cost.lines[idx];
						return (
							<li
								key={`${l.ingredients?.id ?? "?"}-${idx}`}
								className="flex items-center justify-between px-3 py-2 text-sm"
							>
								<div>
									<p className="text-zinc-100">{l.ingredients?.name ?? "(missing ingredient)"}</p>
									{l.notes ? <p className="text-xs text-zinc-500">{l.notes}</p> : null}
								</div>
								<div className="flex items-center gap-4 text-right">
									<span className="font-mono text-xs text-zinc-400">
										{l.quantity} {l.unit}
									</span>
									<span className="w-24 font-mono text-xs text-zinc-500">
										{lineCost.cost != null
											? `${lineCost.cost.toFixed(2)} ${lineCost.currency}`
											: lineCost.reason === "no_price"
												? "no price"
												: "unit ≠"}
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
