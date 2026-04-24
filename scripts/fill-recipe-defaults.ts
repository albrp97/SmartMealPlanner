/**
 * Fill in sensible default ingredient lines for recipes that are empty or
 * obviously incomplete (e.g. shish_kebab had no meat).
 *
 *  - Quantities are best-effort estimates for the listed `servings` count.
 *  - Idempotent: existing recipe_ingredients rows are NEVER touched. We only
 *    insert lines for ingredients that don't already exist on the recipe.
 *  - Ingredient slugs must already exist in the catalogue (no auto-create).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

interface Line {
ingredient_slug: string;
quantity: number;
unit: "g" | "ml" | "unit";
notes?: string;
}

interface RecipeFill {
recipe_slug: string;
lines: Line[];
}

const FILLS: RecipeFill[] = [
{
recipe_slug: "burger",
lines: [
{ ingredient_slug: "ground_beef", quantity: 150, unit: "g", notes: "1 patty" },
{ ingredient_slug: "onion", quantity: 0.5, unit: "unit" },
{ ingredient_slug: "tomato", quantity: 0.5, unit: "unit" },
{ ingredient_slug: "grated_cheese", quantity: 30, unit: "g" },
{ ingredient_slug: "egg", quantity: 1, unit: "unit", notes: "binder for the patty" },
{ ingredient_slug: "tortilla_wraps", quantity: 1, unit: "unit", notes: "stand-in for bun" },
],
},
{
recipe_slug: "lentil_stew",
// No lentils in the catalogue yet — proxy with beans + chorizo so the
// recipe is at least computable; rename when lentils are added.
lines: [
{ ingredient_slug: "beans", quantity: 1, unit: "unit", notes: "1 jar (proxy for lentils)" },
{ ingredient_slug: "chorizo", quantity: 100, unit: "g" },
{ ingredient_slug: "onion", quantity: 1, unit: "unit" },
{ ingredient_slug: "carrot", quantity: 100, unit: "g" },
{ ingredient_slug: "potato", quantity: 1, unit: "unit" },
{ ingredient_slug: "tomato_sauce", quantity: 1, unit: "unit" },
{ ingredient_slug: "stock_cube", quantity: 1, unit: "unit" },
],
},
{
recipe_slug: "pasta_with_chicken",
lines: [
{ ingredient_slug: "pasta", quantity: 100, unit: "g" },
{ ingredient_slug: "chicken", quantity: 120, unit: "g" },
{ ingredient_slug: "cream", quantity: 80, unit: "ml" },
{ ingredient_slug: "onion", quantity: 0.5, unit: "unit" },
{ ingredient_slug: "grated_cheese", quantity: 20, unit: "g" },
],
},
{
recipe_slug: "pizza",
// Single-serving pizza using puff pastry as the base (no pizza dough yet).
lines: [
{ ingredient_slug: "puff_pastry", quantity: 1, unit: "unit" },
{ ingredient_slug: "tomato_sauce", quantity: 0.5, unit: "unit" },
{ ingredient_slug: "grated_cheese", quantity: 60, unit: "g" },
{ ingredient_slug: "tomato", quantity: 1, unit: "unit" },
{ ingredient_slug: "chorizo", quantity: 50, unit: "g", notes: "topping" },
],
},
{
recipe_slug: "puchero",
// Spanish chickpea-and-meat stew. No chickpeas in the catalogue → use beans.
lines: [
{ ingredient_slug: "beans", quantity: 1, unit: "unit", notes: "1 jar (proxy for chickpeas)" },
{ ingredient_slug: "chicken", quantity: 200, unit: "g" },
{ ingredient_slug: "pork", quantity: 100, unit: "g" },
{ ingredient_slug: "chorizo", quantity: 80, unit: "g" },
{ ingredient_slug: "potato", quantity: 1, unit: "unit" },
{ ingredient_slug: "carrot", quantity: 100, unit: "g" },
{ ingredient_slug: "cabbage", quantity: 0.25, unit: "unit" },
{ ingredient_slug: "stock_cube", quantity: 1, unit: "unit" },
],
},
{
recipe_slug: "roast_chicken_with_potatoes",
lines: [
{ ingredient_slug: "chicken", quantity: 250, unit: "g" },
{ ingredient_slug: "potato", quantity: 2, unit: "unit" },
{ ingredient_slug: "onion", quantity: 1, unit: "unit" },
{ ingredient_slug: "carrot", quantity: 100, unit: "g" },
{ ingredient_slug: "seasoning", quantity: 1, unit: "unit" },
],
},
{
recipe_slug: "shish_kebab",
lines: [
{ ingredient_slug: "chicken_thigh_fillets", quantity: 200, unit: "g" },
{ ingredient_slug: "bell_pepper", quantity: 1, unit: "unit" },
{ ingredient_slug: "yogurt", quantity: 1, unit: "unit", notes: "marinade" },
{ ingredient_slug: "seasoning", quantity: 1, unit: "unit" },
],
},
];

async function main() {
config({ path: ".env.local" });
const sb = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

let inserted = 0;
let skipped = 0;
for (const fill of FILLS) {
const { data: recipe, error: rerr } = await sb
.from("recipes")
.select("id,slug")
.eq("slug", fill.recipe_slug)
.single();
if (rerr || !recipe) {
console.error(fill.recipe_slug, "recipe not found:", rerr?.message);
continue;
}
const { data: existing } = await sb
.from("recipe_ingredients")
.select("ingredient_id, ingredients(slug)")
.eq("recipe_id", recipe.id);
const haveSlugs = new Set(
(existing ?? [])
.map((e) => (e as { ingredients?: { slug?: string } }).ingredients?.slug)
.filter(Boolean) as string[],
);

for (const line of fill.lines) {
if (haveSlugs.has(line.ingredient_slug)) {
skipped++;
continue;
}
const { data: ing } = await sb
.from("ingredients")
.select("id,slug")
.eq("slug", line.ingredient_slug)
.single();
if (!ing) {
console.warn(fill.recipe_slug, "missing ingredient:", line.ingredient_slug);
continue;
}
const { error: ierr } = await sb.from("recipe_ingredients").insert({
recipe_id: recipe.id,
ingredient_id: ing.id,
quantity: line.quantity,
unit: line.unit,
notes: line.notes ?? null,
});
if (ierr) {
console.error(fill.recipe_slug, line.ingredient_slug, ierr.message);
continue;
}
console.log(`+ ${fill.recipe_slug}: ${line.quantity} ${line.unit} ${line.ingredient_slug}`);
inserted++;
}
}
console.log(`\nDone. Inserted ${inserted} lines, skipped ${skipped} (already present).`);
}
main();
