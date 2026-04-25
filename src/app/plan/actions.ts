"use server";

/**
 * Meal-planner server actions.
 *
 * The "plan" is a flat list of recipes the user intends to cook. Each entry
 * has a slot (lunch / dinner) and a `batches` count — total servings cooked
 * for that recipe = `recipe.servings * batches`. Breakfast is constant
 * (`breakfast_daily` × 7) and never stored; it's added implicitly in the UI.
 *
 * The `meal_plan_entries.date` column is re-used as a sentinel
 * (`PLAN_DATE`, see ./constants) so every row belongs to "the current plan"
 * — no calendar UI involved.
 */
import { createClient } from "@/lib/db/client-server";
import { revalidatePath } from "next/cache";
import { PLAN_DATE } from "./constants";

export async function addPlanEntry(slot: "lunch" | "dinner", recipeId: string): Promise<void> {
	if (!recipeId) return;
	if (slot !== "lunch" && slot !== "dinner") return;
	const supabase = await createClient();
	await supabase.from("meal_plan_entries").insert({
		date: PLAN_DATE,
		slot,
		recipe_id: recipeId,
		servings: 1,
	});
	revalidatePath("/plan");
}

/**
 * Update the hero-pack count for a plan entry. We re-use the existing
 * `meal_plan_entries.servings` integer column (no migration needed): in
 * Phase 3.5 it now means "number of hero packages committed", and the page
 * derives plate servings from it via `src/lib/portion.ts`.
 */
export async function updatePacks(id: string, packs: number): Promise<void> {
	if (!id) return;
	const n = Math.max(1, Math.floor(Number(packs) || 1));
	const supabase = await createClient();
	await supabase.from("meal_plan_entries").update({ servings: n }).eq("id", id);
	revalidatePath("/plan");
}

export async function updateRecipe(id: string, recipeId: string): Promise<void> {
	if (!id || !recipeId) return;
	const supabase = await createClient();
	await supabase.from("meal_plan_entries").update({ recipe_id: recipeId }).eq("id", id);
	revalidatePath("/plan");
}

export async function deletePlanEntry(id: string): Promise<void> {
	if (!id) return;
	const supabase = await createClient();
	await supabase.from("meal_plan_entries").delete().eq("id", id);
	revalidatePath("/plan");
}
