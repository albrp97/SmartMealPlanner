"use server";

import { createClient } from "@/lib/db/client-server";
import { revalidatePath } from "next/cache";

export interface PlanActionResult {
	ok: boolean;
	error?: string;
}

export async function addPlanEntry(
	_prev: PlanActionResult,
	formData: FormData,
): Promise<PlanActionResult> {
	const date = String(formData.get("date") ?? "");
	const slot = String(formData.get("slot") ?? "");
	const recipeId = String(formData.get("recipe_id") ?? "");
	const servingsRaw = formData.get("servings");
	const servings = servingsRaw ? Number(servingsRaw) : 1;

	if (!date || !slot || !recipeId) {
		return { ok: false, error: "missing fields" };
	}
	if (!["breakfast", "lunch", "dinner"].includes(slot)) {
		return { ok: false, error: "invalid slot" };
	}
	if (!Number.isFinite(servings) || servings <= 0) {
		return { ok: false, error: "servings must be > 0" };
	}

	const supabase = await createClient();
	const { error } = await supabase.from("meal_plan_entries").insert({
		date,
		slot,
		recipe_id: recipeId,
		servings,
	});
	if (error) return { ok: false, error: error.message };
	revalidatePath("/plan");
	revalidatePath("/shopping");
	return { ok: true };
}

export async function deletePlanEntry(id: string): Promise<PlanActionResult> {
	const supabase = await createClient();
	const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	revalidatePath("/plan");
	revalidatePath("/shopping");
	return { ok: true };
}

/**
 * Pre-fill the "breakfast" slot for every day in the given week with the
 * constant breakfast_daily recipe. Idempotent: skips dates that already
 * have a breakfast entry.
 */
export async function seedBreakfastsForWeek(weekDates: string[]): Promise<PlanActionResult> {
	const supabase = await createClient();
	const { data: breakfast } = await supabase
		.from("recipes")
		.select("id")
		.eq("slug", "breakfast_daily")
		.single();
	if (!breakfast) return { ok: false, error: "breakfast_daily recipe not found" };

	const { data: existing } = await supabase
		.from("meal_plan_entries")
		.select("date")
		.in("date", weekDates)
		.eq("slot", "breakfast");
	const have = new Set((existing ?? []).map((e) => e.date));

	const toInsert = weekDates
		.filter((d) => !have.has(d))
		.map((d) => ({
			date: d,
			slot: "breakfast" as const,
			recipe_id: breakfast.id,
			servings: 1,
		}));
	if (toInsert.length === 0) return { ok: true };
	const { error } = await supabase.from("meal_plan_entries").insert(toInsert);
	if (error) return { ok: false, error: error.message };
	revalidatePath("/plan");
	revalidatePath("/shopping");
	return { ok: true };
}
