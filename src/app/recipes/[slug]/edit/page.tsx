import { createClient } from "@/lib/db/client-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm, type RecipeInitial } from "../../recipe-form";

export const dynamic = "force-dynamic";

interface LineRow {
	ingredient_id: string;
	quantity: number;
	unit: "g" | "ml" | "unit";
	notes: string | null;
	position: number;
}

export default async function EditRecipePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const supabase = await createClient();

	const [{ data: recipe }, { data: opts }] = await Promise.all([
		supabase
			.from("recipes")
			.select(
				"id, slug, name, category_id, servings, meal_type, prep_minutes, cook_minutes, instructions_md, notes",
			)
			.eq("slug", slug)
			.maybeSingle(),
		supabase.from("ingredients").select("id, name, package_unit").order("name"),
	]);

	if (!recipe) notFound();

	const { data: linesRaw } = await supabase
		.from("recipe_ingredients")
		.select("ingredient_id, quantity, unit, notes, position")
		.eq("recipe_id", recipe.id)
		.order("position");

	const lines = (linesRaw ?? []) as LineRow[];

	const initial: RecipeInitial = {
		id: recipe.id,
		slug: recipe.slug,
		name: recipe.name,
		category_id: recipe.category_id ?? null,
		servings: recipe.servings,
		meal_type: recipe.meal_type,
		prep_minutes: recipe.prep_minutes,
		cook_minutes: recipe.cook_minutes,
		instructions_md: recipe.instructions_md ?? null,
		notes: recipe.notes ?? null,
		ingredients: lines.map((l) => ({
			ingredient_id: l.ingredient_id,
			quantity: l.quantity,
			unit: l.unit,
			notes: l.notes,
		})),
	};

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="space-y-1">
				<Link
					href={`/recipes/${recipe.slug}`}
					className="text-xs text-zinc-500 hover:text-zinc-300"
				>
					← {recipe.name}
				</Link>
				<h1 className="text-2xl font-semibold tracking-tight">Edit · {recipe.name}</h1>
			</header>
			<RecipeForm mode="edit" options={opts ?? []} initial={initial} />
		</main>
	);
}
