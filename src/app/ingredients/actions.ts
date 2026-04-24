/**
 * Server Actions for the ingredient catalogue.
 *
 * All mutations go through here so we can:
 *  - validate input with Zod (single source of truth in `lib/validators.ts`)
 *  - run on the server with the user's session cookie (RLS-friendly)
 *  - revalidate the affected paths so the table reflects the new state
 *
 * No `service_role` usage here — that is reserved for the seed script and
 * future admin tasks. Anything called from a browser must be safe under RLS.
 */
"use server";

import { createClient } from "@/lib/db/client-server";
import { ingredientInputSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface ActionResult {
	ok: boolean;
	error?: string;
	fieldErrors?: Record<string, string[]>;
}

function parseForm(formData: FormData) {
	const raw = {
		slug: formData.get("slug"),
		name: formData.get("name"),
		category_id: formData.get("category_id"),
		sold_as: formData.get("sold_as"),
		package_size: formData.get("package_size"),
		package_unit: formData.get("package_unit"),
		package_price: formData.get("package_price"),
		currency: formData.get("currency") ?? "CZK",
		is_supplement: formData.get("is_supplement") === "on",
		brand: formData.get("brand"),
		notes: formData.get("notes"),
	};
	return ingredientInputSchema.safeParse(raw);
}

export async function createIngredient(
	_prev: ActionResult,
	formData: FormData,
): Promise<ActionResult> {
	const parsed = parseForm(formData);
	if (!parsed.success) {
		return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
	}
	const supabase = await createClient();
	const { error } = await supabase.from("ingredients").insert(parsed.data);
	if (error) {
		return { ok: false, error: error.message };
	}
	revalidatePath("/ingredients");
	redirect("/ingredients");
}

export async function updateIngredient(
	id: string,
	_prev: ActionResult,
	formData: FormData,
): Promise<ActionResult> {
	const parsed = parseForm(formData);
	if (!parsed.success) {
		return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
	}
	const supabase = await createClient();
	const { error } = await supabase.from("ingredients").update(parsed.data).eq("id", id);
	if (error) {
		return { ok: false, error: error.message };
	}
	revalidatePath("/ingredients");
	redirect("/ingredients");
}

export async function deleteIngredient(id: string): Promise<ActionResult> {
	const supabase = await createClient();
	const { error } = await supabase.from("ingredients").delete().eq("id", id);
	if (error) {
		return { ok: false, error: error.message };
	}
	revalidatePath("/ingredients");
	return { ok: true };
}
