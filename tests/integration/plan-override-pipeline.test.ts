/**
 * End-to-end: insert a real cut override, verify the planner pipeline
 * (applyGoalOverrides → toPortionRecipe → scalePortion) produces a
 * different scaled output than maintain. This is what /plan computes
 * each render.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { type PlanRecipeRow, toPortionRecipe } from "@/lib/plan-portion";
import { scalePortion } from "@/lib/portion";
import { applyGoalOverrides, buildOverrideMap } from "@/lib/recipe-overrides";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const haveEnv = !!(URL_ && SERVICE);
const d = haveEnv ? describe : describe.skip;

const SELECT =
	"id, slug, name, servings, recipe_ingredients(id, quantity, unit, role, ingredients(id, slug, name, divisible, package_size, package_unit, g_per_unit))";

d("plan pipeline reacts to a real override (live DB)", () => {
	const service = haveEnv ? createClient(URL_!, SERVICE!) : null;
	let recipe: PlanRecipeRow;
	let sideLineId: string;
	let originalSideQty: number;

	beforeAll(async () => {
		// Find a recipe with a hero + at least one side line.
		const { data, error } = await service!
			.from("recipes")
			.select(SELECT)
			.order("name");
		if (error) throw error;
		// biome-ignore lint/suspicious/noExplicitAny: live row shape
		const rows = (data ?? []) as any[];
		const candidate = rows.find(
			(r) =>
				r.recipe_ingredients?.some((li: any) => li.role === "hero") &&
				r.recipe_ingredients?.some((li: any) => li.role === "side" && li.quantity >= 4),
		);
		if (!candidate) throw new Error("no recipe with hero+side(qty>=4) found");
		recipe = candidate as PlanRecipeRow;
		const side = recipe.recipe_ingredients.find((li) => li.role === "side" && li.quantity >= 4)!;
		sideLineId = side.id;
		originalSideQty = side.quantity;
		// Pre-clean
		await service!
			.from("recipe_ingredient_overrides")
			.delete()
			.eq("recipe_ingredient_id", sideLineId);
	});

	afterAll(async () => {
		if (!service) return;
		await service
			.from("recipe_ingredient_overrides")
			.delete()
			.eq("recipe_ingredient_id", sideLineId);
	});

	it("cut override reduces a side line; bulk override increases it", async () => {
		// Insert real override rows: cut halves, bulk doubles
		const cutQty = Math.max(1, Math.round(originalSideQty / 2));
		const bulkQty = originalSideQty * 2;
		await service!.from("recipe_ingredient_overrides").upsert([
			{ recipe_ingredient_id: sideLineId, goal: "cut", quantity: cutQty },
			{ recipe_ingredient_id: sideLineId, goal: "bulk", quantity: bulkQty },
		]);

		// Re-read overrides like /plan does
		const { data: ovRows } = await service!
			.from("recipe_ingredient_overrides")
			.select("recipe_ingredient_id, goal, quantity");
		const overrides = buildOverrideMap(
			(ovRows ?? []) as {
				recipe_ingredient_id: string;
				goal: "cut" | "bulk";
				quantity: number;
			}[],
		);

		function pipeline(goal: "maintain" | "cut" | "bulk") {
			const lines = applyGoalOverrides(
				recipe.recipe_ingredients.map((li) => ({ ...li })),
				goal,
				overrides,
			);
			const portion = toPortionRecipe({ ...recipe, recipe_ingredients: lines });
			// Use 1 hero pack so scale is deterministic
			const hero = portion.lines.find((l) => l.role === "hero")!;
			return scalePortion(portion, hero.ingredient.packageSize);
		}

		const m = pipeline("maintain");
		const c = pipeline("cut");
		const b = pipeline("bulk");

		const sideName = recipe.recipe_ingredients.find((li) => li.id === sideLineId)!.ingredients!
			.name;
		const sideOf = (s: ReturnType<typeof scalePortion>) =>
			s.scaled.find((l) => l.ingredientName === sideName)?.quantity ?? 0;

		const mSide = sideOf(m);
		const cSide = sideOf(c);
		const bSide = sideOf(b);

		// All three must produce non-zero side amounts and be ordered.
		expect(mSide).toBeGreaterThan(0);
		expect(cSide).toBeGreaterThan(0);
		expect(bSide).toBeGreaterThan(0);
		expect(cSide).toBeLessThan(mSide);
		expect(bSide).toBeGreaterThan(mSide);
	});

	it("quantity = 0 override drops the line entirely (not just shrinks)", async () => {
		await service!
			.from("recipe_ingredient_overrides")
			.upsert(
				{ recipe_ingredient_id: sideLineId, goal: "cut", quantity: 0 },
				{ onConflict: "recipe_ingredient_id,goal" },
			);

		const { data: ovRows } = await service!
			.from("recipe_ingredient_overrides")
			.select("recipe_ingredient_id, goal, quantity");
		const overrides = buildOverrideMap(
			(ovRows ?? []) as {
				recipe_ingredient_id: string;
				goal: "cut" | "bulk";
				quantity: number;
			}[],
		);

		const cutLines = applyGoalOverrides(
			recipe.recipe_ingredients.map((li) => ({ ...li })),
			"cut",
			overrides,
		);
		expect(cutLines.find((l) => l.id === sideLineId)).toBeUndefined();
	});
});
