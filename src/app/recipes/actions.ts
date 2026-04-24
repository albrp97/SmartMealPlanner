/**
 * Server Actions for recipes.
 *
 * The form serialises its ingredient rows as a JSON string in a hidden field
 * called `ingredients_json` so we can keep using a single Server Action with
 * native FormData and zero client fetch boilerplate.
 *
 * Updates are done as: update the parent row, then replace all child rows.
 * For a personal app this is simpler than computing a diff and is fine
 * performance-wise (recipes have <30 ingredients).
 */
"use server";

import { createClient } from "@/lib/db/client-server";
import { recipeInputSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface RecipeActionResult {
	ok: boolean;
	error?: string;
	fieldErrors?: Record<string, string[]>;
}

function parseForm(formData: FormData) {
	let ingredients: unknown = [];
	try {
		const raw = formData.get("ingredients_json");
		ingredients = typeof raw === "string" && raw.length > 0 ? JSON.parse(raw) : [];
	} catch {
		ingredients = [];
	}
	return recipeInputSchema.safeParse({
		slug: formData.get("slug"),
		name: formData.get("name"),
		category_id: formData.get("category_id"),
		servings: formData.get("servings"),
		meal_type: formData.get("meal_type"),
		prep_minutes: formData.get("prep_minutes"),
		cook_minutes: formData.get("cook_minutes"),
		instructions_md: formData.get("instructions_md"),
		notes: formData.get("notes"),
		ingredients,
	});
}

async function replaceLines(
	supabase: Awaited<ReturnType<typeof createClient>>,
	recipeId: string,
	lines: {
		ingredient_id: string;
		quantity: number;
		unit: "g" | "ml" | "unit";
		notes: string | null;
	}[],
) {
	const { error: delErr } = await supabase
		.from("recipe_ingredients")
		.delete()
		.eq("recipe_id", recipeId);
	if (delErr) return delErr.message;
	if (lines.length === 0) return null;
	const { error: insErr } = await supabase.from("recipe_ingredients").insert(
		lines.map((l, idx) => ({
			recipe_id: recipeId,
			ingredient_id: l.ingredient_id,
			quantity: l.quantity,
			unit: l.unit,
			notes: l.notes,
			position: idx,
		})),
	);
	return insErr ? insErr.message : null;
}

export async function createRecipe(
	_prev: RecipeActionResult,
	formData: FormData,
): Promise<RecipeActionResult> {
	const parsed = parseForm(formData);
	if (!parsed.success) {
		return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
	}
	const { ingredients, ...recipe } = parsed.data;
	const supabase = await createClient();
	const { data, error } = await supabase.from("recipes").insert(recipe).select("id, slug").single();
	if (error || !data) {
		return { ok: false, error: error?.message ?? "insert failed" };
	}
	const lineErr = await replaceLines(supabase, data.id, ingredients);
	if (lineErr) {
		return { ok: false, error: `recipe saved but lines failed: ${lineErr}` };
	}
	revalidatePath("/recipes");
	revalidatePath(`/recipes/${data.slug}`);
	redirect(`/recipes/${data.slug}`);
}

export async function updateRecipe(
	id: string,
	_prev: RecipeActionResult,
	formData: FormData,
): Promise<RecipeActionResult> {
	const parsed = parseForm(formData);
	if (!parsed.success) {
		return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
	}
	const { ingredients, ...recipe } = parsed.data;
	const supabase = await createClient();
	const { error } = await supabase.from("recipes").update(recipe).eq("id", id);
	if (error) {
		return { ok: false, error: error.message };
	}
	const lineErr = await replaceLines(supabase, id, ingredients);
	if (lineErr) {
		return { ok: false, error: lineErr };
	}
	revalidatePath("/recipes");
	revalidatePath(`/recipes/${recipe.slug}`);
	redirect(`/recipes/${recipe.slug}`);
}

export async function deleteRecipe(id: string): Promise<RecipeActionResult> {
	const supabase = await createClient();
	const { error } = await supabase.from("recipes").delete().eq("id", id);
	if (error) {
		return { ok: false, error: error.message };
	}
	revalidatePath("/recipes");
	redirect("/recipes");
}
