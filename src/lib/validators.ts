/**
 * Single source of truth for input validation.
 *
 * Used by:
 *  - Server Actions (validate FormData server-side before hitting Supabase)
 *  - Client forms (run the same schema in the browser for instant feedback)
 *  - Tests
 *
 * Keep field names in snake_case to match the Supabase REST/Postgres column
 * names — that lets us pass parsed objects straight to `.insert()` / `.update()`.
 */
import { z } from "zod";

export const PACKAGE_UNITS = ["g", "ml", "unit"] as const;
export const SOLD_AS = ["package", "unit"] as const;
export const MEAL_TYPES = ["single_meal", "batch", "unknown"] as const;

const slugSchema = z
	.string()
	.trim()
	.min(1, "slug required")
	.max(80)
	.regex(/^[a-z0-9_]+$/, "slug must be snake_case (a-z, 0-9, _)");

const positiveNumber = z.coerce.number().positive("must be > 0");
const nonNegativeNumber = z.coerce.number().min(0);

export const ingredientInputSchema = z.object({
	slug: slugSchema,
	name: z.string().trim().min(1, "name required").max(120),
	category_id: z
		.string()
		.trim()
		.max(60)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	sold_as: z.enum(SOLD_AS),
	package_size: positiveNumber,
	package_unit: z.enum(PACKAGE_UNITS),
	package_price: z
		.union([z.literal(""), nonNegativeNumber])
		.transform((v) => (v === "" ? null : v)),
	currency: z.string().trim().min(3).max(3).default("CZK"),
	is_supplement: z.coerce.boolean().default(false),
	brand: z
		.string()
		.trim()
		.max(80)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	notes: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
});

export type IngredientInput = z.infer<typeof ingredientInputSchema>;

/**
 * Recipe + nested ingredient lines.
 *
 * Lines come from a JSON-encoded hidden field on the form (the rows are
 * managed client-side, then serialised on submit). Each line references an
 * existing ingredient by id; creating brand new ingredients from inside the
 * recipe form is intentionally out of scope.
 */
export const recipeIngredientLineSchema = z.object({
	ingredient_id: z.string().uuid("pick an ingredient"),
	quantity: positiveNumber,
	unit: z.enum(PACKAGE_UNITS),
	notes: z
		.string()
		.trim()
		.max(200)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
});

export const recipeInputSchema = z.object({
	slug: slugSchema,
	name: z.string().trim().min(1, "name required").max(120),
	category_id: z
		.string()
		.trim()
		.max(60)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	servings: z.coerce.number().int().min(1, "≥ 1").max(50),
	meal_type: z.enum(MEAL_TYPES),
	prep_minutes: z
		.union([z.literal(""), z.coerce.number().int().min(0)])
		.transform((v) => (v === "" ? null : v)),
	cook_minutes: z
		.union([z.literal(""), z.coerce.number().int().min(0)])
		.transform((v) => (v === "" ? null : v)),
	instructions_md: z
		.string()
		.trim()
		.max(5000)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	notes: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v && v.length > 0 ? v : null)),
	ingredients: z.array(recipeIngredientLineSchema),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type RecipeIngredientLine = z.infer<typeof recipeIngredientLineSchema>;
