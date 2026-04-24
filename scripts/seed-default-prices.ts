/**
 * Seed default Lidl Prague 2026 prices for every ingredient.
 *
 * Each row has:
 *  - package_size  : how the item is sold (e.g. milk: 1000 ml; eggs: 10 unit).
 *  - package_unit  : g | ml | unit.
 *  - package_price : current price in CZK (defaults are best-effort estimates
 *                    based on Lidl CZ shelves around early 2026).
 *
 * The "default vs real" flag lives in the `price_is_default` column added by
 * migration 0003_default_prices.sql. Once that migration is applied, the
 * server-side `updateIngredient` action flips the flag to false on any manual
 * edit, and the UI shows a small badge so we know which rows are still
 * estimates and which came from a real ticket.
 *
 * Re-runnable: this script is idempotent — it always overwrites with the
 * default values, so call it whenever the catalogue changes.
 *
 * Supplements (GymBeam) are NOT sold at Lidl. They keep their own brand-store
 * estimate and stay marked as default until a real receipt is logged.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

interface PriceSeed {
	slug: string;
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	sold_as: "package" | "unit";
	package_price: number;
	currency?: string;
}

// All prices in CZK unless noted. Sources: typical Lidl CZ shelf prices
// observed in Prague stores during Q1 2026. Round numbers are deliberate —
// these are estimates, real values come from receipts.
const PRICES: PriceSeed[] = [
	// Produce — sold as loose units, priced per item or per kg.
	{ slug: "avocado", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 25 },
	{
		slug: "bell_pepper",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 15,
	},
	{
		slug: "red_bell_pepper",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 18,
	},
	{ slug: "cabbage", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 35 },
	{ slug: "carrot", sold_as: "package", package_size: 1000, package_unit: "g", package_price: 25 },
	{ slug: "onion", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 6 },
	{ slug: "potato", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 4 },
	{ slug: "tomato", sold_as: "unit", package_size: 1, package_unit: "unit", package_price: 10 },
	{
		slug: "vine_tomato",
		sold_as: "unit",
		package_size: 1,
		package_unit: "unit",
		package_price: 13,
	},
	{
		slug: "mushrooms",
		sold_as: "package",
		package_size: 250,
		package_unit: "g",
		package_price: 35,
	},

	// Grains, pasta, dry staples.
	{
		slug: "basmati_rice",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 60,
	},
	{ slug: "rice", sold_as: "package", package_size: 1000, package_unit: "g", package_price: 30 },
	{ slug: "pasta", sold_as: "package", package_size: 500, package_unit: "g", package_price: 25 },
	{ slug: "noodles", sold_as: "package", package_size: 250, package_unit: "g", package_price: 40 },
	{ slug: "oatmeal", sold_as: "package", package_size: 500, package_unit: "g", package_price: 30 },
	{
		slug: "puff_pastry",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 50,
	},
	{
		slug: "tortilla_wraps",
		sold_as: "package",
		package_size: 6,
		package_unit: "unit",
		package_price: 28,
	},

	// Canned / jarred.
	{ slug: "beans", sold_as: "package", package_size: 400, package_unit: "g", package_price: 25 },
	{ slug: "tuna", sold_as: "package", package_size: 1, package_unit: "unit", package_price: 30 },
	{
		slug: "crushed_tomato",
		sold_as: "package",
		package_size: 700,
		package_unit: "g",
		package_price: 37,
	},
	{
		slug: "tomato_sauce",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 40,
	},
	{ slug: "honey", sold_as: "package", package_size: 500, package_unit: "g", package_price: 80 },

	// Dairy & eggs.
	{ slug: "egg", sold_as: "package", package_size: 10, package_unit: "unit", package_price: 50 },
	{
		slug: "milk_3_5_fat",
		sold_as: "package",
		package_size: 1000,
		package_unit: "ml",
		package_price: 25,
	},
	{ slug: "cream", sold_as: "package", package_size: 200, package_unit: "ml", package_price: 25 },
	{ slug: "yogurt", sold_as: "package", package_size: 1, package_unit: "unit", package_price: 10 },
	{
		slug: "yogurt_3_9_fat",
		sold_as: "package",
		package_size: 150,
		package_unit: "g",
		package_price: 10,
	},
	{
		slug: "plain_yogurt",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 45,
	},
	{
		slug: "grated_cheese",
		sold_as: "package",
		package_size: 200,
		package_unit: "g",
		package_price: 40,
	},

	// Meat & poultry.
	{
		slug: "chicken",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 180,
	},
	{
		slug: "chicken_thigh_fillets",
		sold_as: "package",
		package_size: 800,
		package_unit: "g",
		package_price: 160,
	},
	{
		slug: "chicken_livers",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 50,
	},
	{
		slug: "minced_chicken",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 80,
	},
	{
		slug: "ground_beef",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 120,
	},
	{ slug: "pork", sold_as: "package", package_size: 1000, package_unit: "g", package_price: 150 },
	{ slug: "chorizo", sold_as: "package", package_size: 200, package_unit: "g", package_price: 70 },

	// Nuts & dried fruit.
	{ slug: "cashews", sold_as: "package", package_size: 200, package_unit: "g", package_price: 85 },
	{
		slug: "dried_sweetened_cranberries",
		sold_as: "package",
		package_size: 200,
		package_unit: "g",
		package_price: 70,
	},
	{
		slug: "jumbo_raisins",
		sold_as: "package",
		package_size: 250,
		package_unit: "g",
		package_price: 60,
	},

	// Pantry odds and ends.
	{ slug: "beer", sold_as: "package", package_size: 500, package_unit: "ml", package_price: 20 },
	{
		slug: "golden_curry_paste",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 80,
	},
	{
		slug: "seasoning",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 25,
	},
	{
		slug: "stock_cube",
		sold_as: "package",
		package_size: 1,
		package_unit: "unit",
		package_price: 5,
	},

	// Supplements (GymBeam, not Lidl) — kept here so the catalogue is 100% covered.
	{
		slug: "whey_protein_gymbeam",
		sold_as: "package",
		package_size: 1000,
		package_unit: "g",
		package_price: 750,
	},
	{
		slug: "creatine_monohydrate_gymbeam",
		sold_as: "package",
		package_size: 500,
		package_unit: "g",
		package_price: 400,
	},
	{
		slug: "multivitamin_gymbeam",
		sold_as: "package",
		package_size: 60,
		package_unit: "unit",
		package_price: 250,
	},
	{
		slug: "omega_3_gymbeam",
		sold_as: "package",
		package_size: 240,
		package_unit: "unit",
		package_price: 400,
	},
	{
		slug: "vitamin_d3_k2_gymbeam",
		sold_as: "package",
		package_size: 60,
		package_unit: "unit",
		package_price: 250,
	},
	{
		slug: "magnesium_bisglycinate_gymbeam",
		sold_as: "package",
		package_size: 100,
		package_unit: "unit",
		package_price: 250,
	},
];

async function main() {
	config({ path: ".env.local" });
	const sb = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);

	// Detect whether migration 0003 has been applied. If yes, also write
	// `default_package_price` and reset `price_is_default` to true.
	const { data: probe } = await sb.from("ingredients").select("default_package_price").limit(1);
	const hasDefaultColumn = probe !== null;

	let updated = 0;
	let missing = 0;
	for (const p of PRICES) {
		const patch: Record<string, unknown> = {
			package_size: p.package_size,
			package_unit: p.package_unit,
			sold_as: p.sold_as,
			package_price: p.package_price,
			currency: p.currency ?? "CZK",
		};
		if (hasDefaultColumn) {
			patch.default_package_price = p.package_price;
			patch.price_is_default = true;
		}
		const { data, error } = await sb
			.from("ingredients")
			.update(patch)
			.eq("slug", p.slug)
			.select("slug");
		if (error) {
			console.error(p.slug, error.message);
			continue;
		}
		if (!data || data.length === 0) {
			console.warn(p.slug, "NOT FOUND in ingredients table");
			missing++;
			continue;
		}
		updated++;
	}

	console.log(
		`\nDone. Updated ${updated}/${PRICES.length} ingredients (default_package_price column present: ${hasDefaultColumn}, missing slugs: ${missing}).`,
	);
}
main();
