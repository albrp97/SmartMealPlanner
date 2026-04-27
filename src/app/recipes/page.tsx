import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
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
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<TermHeading level={1} prompt="$" caret>
						recipes
					</TermHeading>
					<p className="font-mono text-xs text-fg-dim sm:text-sm">
						{recipes.length} recipes · tap for cost &amp; macro preview
					</p>
				</div>
				<div className="flex gap-2">
					<Link
						href="/ingredients"
						className="inline-flex min-h-[40px] items-center rounded-sm border border-grid bg-bg-sunk px-3 py-1.5 font-mono text-xs text-fg-dim hover:border-fg-mute hover:text-fg"
					>
						▣ ingredients →
					</Link>
					<Link
						href="/recipes/new"
						className="inline-flex min-h-[40px] items-center rounded-sm border border-accent/60 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/20"
					>
						+ new
					</Link>
				</div>
			</header>

			{error ? (
				<Surface
					aria-label="Load error"
					className="border-rose/40 bg-rose/10 px-4 py-3 font-mono text-sm text-rose"
				>
					! failed to load: {error.message}
				</Surface>
			) : null}

			<div className="space-y-5 sm:space-y-6">
				{Object.entries(grouped).map(([cat, items]) => (
					<section key={cat}>
						<TermHeading level={2} prompt="◇">
							{cat}
						</TermHeading>
						<ul className="mt-2 divide-y divide-grid rounded-sm border border-grid bg-bg-elev">
							{items.map((r) => (
								<li key={r.id}>
									<Link
										href={`/recipes/${r.slug}`}
										className="flex min-h-[56px] items-center justify-between gap-3 px-3 py-2 hover:bg-bg-sunk"
									>
										<div className="min-w-0">
											<p className="truncate font-mono text-sm text-fg">{r.name}</p>
											<p className="font-mono text-[10px] text-fg-mute">
												{r.meal_type} · {r.servings} {r.servings === 1 ? "srv" : "srvs"}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-3 text-right">
											<span className="font-mono text-xs text-cyan">
												{r.kcalPerServing > 0 ? `${r.kcalPerServing} kcal` : "—"}
												{r.partial ? (
													<span className="ml-1 text-[10px] text-amber">*</span>
												) : null}
											</span>
											<span className="font-mono text-xs text-fg-mute">↗</span>
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
