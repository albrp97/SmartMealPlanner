/**
 * Integration: invoke the real server actions against the live Supabase
 * project (anon key) to prove that setIngredientOverride and
 * setIngredientBaselineQuantity actually write to the DB end-to-end.
 *
 * Skips automatically if env vars are missing.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Mock the Next.js modules that the server action imports.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: () => undefined }));
vi.mock("next/headers", () => ({
	cookies: async () => ({
		getAll: () => [],
		set: () => undefined,
	}),
}));

import { vi } from "vitest";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const haveEnv = !!(URL_ && ANON && SERVICE);

const d = haveEnv ? describe : describe.skip;

d("recipe override server actions (live DB)", () => {
	let recipeIngredientId: string;
	let recipeSlug: string;
	let originalQty: number;
	const service = haveEnv ? createServiceClient(URL_!, SERVICE!) : null;

	beforeAll(async () => {
		const { data: ri, error } = await service!
			.from("recipe_ingredients")
			.select("id, quantity, recipe:recipes(slug)")
			.limit(1)
			.single();
		if (error || !ri) throw new Error(`no recipe_ingredients row: ${error?.message}`);
		recipeIngredientId = ri.id;
		originalQty = ri.quantity;
		// biome-ignore lint/suspicious/noExplicitAny: relation typing
		recipeSlug = (ri as any).recipe?.slug ?? "test";
		// Pre-clean any leftover overrides for this id
		await service!
			.from("recipe_ingredient_overrides")
			.delete()
			.eq("recipe_ingredient_id", recipeIngredientId);
	});

	afterAll(async () => {
		if (!service) return;
		await service
			.from("recipe_ingredient_overrides")
			.delete()
			.eq("recipe_ingredient_id", recipeIngredientId);
		// Restore baseline qty
		await service
			.from("recipe_ingredients")
			.update({ quantity: originalQty })
			.eq("id", recipeIngredientId);
	});

	it("upserts a cut override", async () => {
		const { setIngredientOverride } = await import("@/app/recipes/actions");
		const res = await setIngredientOverride(recipeIngredientId, "cut", 42, recipeSlug);
		expect(res).toEqual({ ok: true });
		const { data } = await service!
			.from("recipe_ingredient_overrides")
			.select("*")
			.eq("recipe_ingredient_id", recipeIngredientId)
			.eq("goal", "cut")
			.single();
		expect(data?.quantity).toBe(42);
	});

	it("updates an existing cut override (re-upsert)", async () => {
		const { setIngredientOverride } = await import("@/app/recipes/actions");
		const res = await setIngredientOverride(recipeIngredientId, "cut", 99, recipeSlug);
		expect(res).toEqual({ ok: true });
		const { data } = await service!
			.from("recipe_ingredient_overrides")
			.select("quantity")
			.eq("recipe_ingredient_id", recipeIngredientId)
			.eq("goal", "cut")
			.single();
		expect(data?.quantity).toBe(99);
	});

	it("deletes an override when quantity is null", async () => {
		const { setIngredientOverride } = await import("@/app/recipes/actions");
		const res = await setIngredientOverride(recipeIngredientId, "cut", null, recipeSlug);
		expect(res).toEqual({ ok: true });
		const { data } = await service!
			.from("recipe_ingredient_overrides")
			.select("*")
			.eq("recipe_ingredient_id", recipeIngredientId)
			.eq("goal", "cut");
		expect(data ?? []).toHaveLength(0);
	});

	it("upserts cut with quantity 0 (drop-on-cut)", async () => {
		const { setIngredientOverride } = await import("@/app/recipes/actions");
		const res = await setIngredientOverride(recipeIngredientId, "cut", 0, recipeSlug);
		expect(res).toEqual({ ok: true });
		const { data } = await service!
			.from("recipe_ingredient_overrides")
			.select("quantity")
			.eq("recipe_ingredient_id", recipeIngredientId)
			.eq("goal", "cut")
			.single();
		expect(data?.quantity).toBe(0);
	});

	it("updates baseline quantity via setIngredientBaselineQuantity", async () => {
		const { setIngredientBaselineQuantity } = await import("@/app/recipes/actions");
		const newQty = originalQty + 7;
		const res = await setIngredientBaselineQuantity(recipeIngredientId, newQty, recipeSlug);
		expect(res).toEqual({ ok: true });
		const { data } = await service!
			.from("recipe_ingredients")
			.select("quantity")
			.eq("id", recipeIngredientId)
			.single();
		expect(data?.quantity).toBe(newQty);
	});
});
