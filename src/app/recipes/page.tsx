import { createClient } from "@/lib/db/client-server";
import { type NutritionLineInput, computeRecipeNutrition } from "@/lib/nutrition";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface IngredientForNutrition {
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
	ingredients: IngredientForNutrition | null;
}

interface RecipeListRow {
	id: string;
	slug: string;
	name: string;
	servings: number;
	meal_type: "single_meal" | "batch" | "unknown";
	category_id: string | null;
	recipe_ingredients: RecipeIngredientRow[];
}

export default async function RecipesPage() {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("recipes")
		.select(
			"id, slug, name, servings, meal_type, category_id, recipe_ingredients(quantity, unit, ingredients(is_supplement, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))",
		)
		.order("name");

	const recipes = ((data ?? []) as unknown as RecipeListRow[]).map((r) => {
		const lines: NutritionLineInput[] = (r.recipe_ingredients ?? [])
			.filter(
				(l): l is RecipeIngredientRow & { ingredients: IngredientForNutrition } =>
					l.ingredients !== null,
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
		const nutrition = computeRecipeNutrition(lines, r.servings);
		return { ...r, kcalPerServing: nutrition.perServing.kcal, partial: nutrition.missing };
	});

	const grouped = recipes.reduce<Record<string, typeof recipes>>((acc, r) => {
		const key = r.category_id ?? "uncategorised";
		const bucket = acc[key] ?? [];
		bucket.push(r);
		acc[key] = bucket;
		return acc;
	}, {});

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 1</p>
					<h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
					<p className="text-sm text-zinc-400">{recipes.length} recipes · click for cost preview</p>
				</div>
				<div className="flex gap-2">
					<Link
						href="/ingredients"
						className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
					>
						Ingredients →
					</Link>
					<Link
						href="/recipes/new"
						className="rounded-md border border-emerald-700 bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30"
					>
						+ New
					</Link>
				</div>
			</header>

			{error ? (
				<div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
					Failed to load: {error.message}
				</div>
			) : null}

			<div className="space-y-6">
				{Object.entries(grouped).map(([cat, items]) => (
					<section key={cat}>
						<h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">{cat}</h2>
						<ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
							{items.map((r) => (
								<li key={r.id}>
									<Link
										href={`/recipes/${r.slug}`}
										className="flex items-center justify-between px-3 py-2 hover:bg-zinc-900/30"
									>
										<div>
											<p className="text-sm text-zinc-100">{r.name}</p>
											<p className="font-mono text-[10px] text-zinc-500">
												{r.meal_type} · {r.servings} {r.servings === 1 ? "serving" : "servings"}
											</p>
										</div>
										<div className="flex items-center gap-3 text-right">
											<span className="font-mono text-xs text-sky-300">
												{r.kcalPerServing > 0 ? `${r.kcalPerServing} kcal` : "—"}
												{r.partial ? (
													<span className="ml-1 text-[10px] text-amber-400">*</span>
												) : null}
											</span>
											<span className="text-xs text-zinc-500">→</span>
										</div>
									</Link>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</main>
	);
}
