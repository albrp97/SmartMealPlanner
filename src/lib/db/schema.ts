/**
 * Database schema — single source of truth.
 *
 * - Defines tables in TypeScript (Drizzle ORM).
 * - Generates SQL migrations via `pnpm db:generate`.
 * - SQL files are applied manually in the Supabase SQL Editor (corp network blocks
 *   direct Postgres, so we don't run drizzle-kit push from local machines).
 *
 * Phase 1 covers the catalogue: ingredients, recipes, prices.
 * Phase 3+ adds: meal_plans, shopping_lists, pantry_items.
 * Phase 4 adds: receipts.
 * Phase 5 adds: users (Supabase Auth manages the auth.users table; we add a profile table).
 */
import { sql } from "drizzle-orm";
import {
	boolean,
	doublePrecision,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

/** Top-level grouping for ingredients (e.g. "carnes y proteínas", "lácteos"). */
export const ingredientCategories = pgTable("ingredient_categories", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

/**
 * Ingredient catalogue.
 *
 * `package_size` + `package_unit` capture how the item is sold in store
 * (e.g. arroz: 1000 g; aguacate: 1 unit).
 * `package_price` is the price for one whole package, in `currency`.
 * Per-100g nutrition fields are nullable until we backfill from OpenFoodFacts.
 */
export const ingredients = pgTable(
	"ingredients",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		// Stable slug-style id used by seeds and external references (e.g. "pollo_picado").
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		categoryId: text("category_id").references(() => ingredientCategories.id, {
			onDelete: "set null",
		}),
		// Sold-as: "package" (fixed weight) or "unit" (loose, priced per item). Used by costing.
		soldAs: text("sold_as", { enum: ["package", "unit"] })
			.notNull()
			.default("package"),
		packageSize: doublePrecision("package_size").notNull(),
		packageUnit: text("package_unit", { enum: ["g", "ml", "unit"] }).notNull(),
		packagePrice: doublePrecision("package_price"),
		currency: text("currency").notNull().default("CZK"),
		isSupplement: boolean("is_supplement").notNull().default(false),
		brand: text("brand"),
		// Per-100g nutrition (or per-serving for supplements).
		kcalPer100g: doublePrecision("kcal_per_100g"),
		proteinPer100g: doublePrecision("protein_per_100g"),
		carbsPer100g: doublePrecision("carbs_per_100g"),
		fatPer100g: doublePrecision("fat_per_100g"),
		fiberPer100g: doublePrecision("fiber_per_100g"),
		// Free-form micros bag (vit_a_ug, iron_mg, …) keyed for later analytics.
		microsPer100g: jsonb("micros_per_100g"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
	},
	(t) => ({
		slugUnique: uniqueIndex("ingredients_slug_unique").on(t.slug),
	}),
);

/** Recipe categories — flat for now (e.g. "Curry", "Pasta", "Breakfast"). */
export const recipeCategories = pgTable("recipe_categories", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

export const recipes = pgTable(
	"recipes",
	{
		id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		categoryId: text("category_id").references(() => recipeCategories.id, {
			onDelete: "set null",
		}),
		servings: integer("servings").notNull().default(1),
		mealType: text("meal_type", { enum: ["single_meal", "batch", "unknown"] })
			.notNull()
			.default("unknown"),
		instructionsMd: text("instructions_md"),
		prepMinutes: integer("prep_minutes"),
		cookMinutes: integer("cook_minutes"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`now()`).notNull(),
	},
	(t) => ({
		slugUnique: uniqueIndex("recipes_slug_unique").on(t.slug),
	}),
);

/** Junction table: recipe ↔ ingredient with quantity. */
export const recipeIngredients = pgTable("recipe_ingredients", {
	id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
	recipeId: uuid("recipe_id")
		.notNull()
		.references(() => recipes.id, { onDelete: "cascade" }),
	ingredientId: uuid("ingredient_id")
		.notNull()
		.references(() => ingredients.id, { onDelete: "restrict" }),
	quantity: doublePrecision("quantity").notNull(),
	unit: text("unit", { enum: ["g", "ml", "unit"] }).notNull(),
	notes: text("notes"),
	position: integer("position").notNull().default(0),
});

export const stores = pgTable("stores", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	city: text("city"),
	country: text("country"),
});

/**
 * Append-only price history — one row per observation (ticket scan or manual entry).
 * The `ingredients.package_price` column is the *current* price for fast reads;
 * this table is the audit trail.
 */
export const priceHistory = pgTable("price_history", {
	id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
	ingredientId: uuid("ingredient_id")
		.notNull()
		.references(() => ingredients.id, { onDelete: "cascade" }),
	storeId: text("store_id").references(() => stores.id, { onDelete: "set null" }),
	packagePrice: doublePrecision("package_price").notNull(),
	currency: text("currency").notNull().default("CZK"),
	observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
	source: text("source", { enum: ["receipt", "manual", "seed"] })
		.notNull()
		.default("manual"),
	createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// Useful inferred types for use across the app.
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
