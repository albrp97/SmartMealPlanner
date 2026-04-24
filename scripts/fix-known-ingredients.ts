/**
 * One-shot data correction:
 *  - Whey protein: was null/null. Set per-100g macros so 30g = ~24g protein.
 *  - Capsule/powder supplements (creatine, multivit, omega3, D3+K2, magnesium):
 *    flag is_supplement=true with zero macros so the recipe stops showing them
 *    as "missing nutrition" data.
 *  - Oatmeal, yogurt 3.9% fat, milk 3.5% fat: OFF returned implausible values
 *    for the previous backfill; replace with standard food-table values.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

interface Update {
	slug: string;
	is_supplement?: boolean;
	kcal_per_100g?: number | null;
	protein_per_100g?: number | null;
	carbs_per_100g?: number | null;
	fat_per_100g?: number | null;
	fiber_per_100g?: number | null;
}

const UPDATES: Update[] = [
	// Whey protein (typical 80% protein concentrate). 30 g scoop -> 24 g protein.
	{
		slug: "whey_protein_gymbeam",
		is_supplement: false,
		kcal_per_100g: 400,
		protein_per_100g: 80,
		carbs_per_100g: 6,
		fat_per_100g: 6,
		fiber_per_100g: 0,
	},
	// Pure creatine monohydrate: 0 kcal / 0 macros.
	{
		slug: "creatine_monohydrate_gymbeam",
		is_supplement: true,
		kcal_per_100g: 0,
		protein_per_100g: 0,
		carbs_per_100g: 0,
		fat_per_100g: 0,
		fiber_per_100g: 0,
	},
	// Capsules: negligible macros, flag as supplement so per-serving math kicks in.
	{
		slug: "multivitamin_gymbeam",
		is_supplement: true,
		kcal_per_100g: 0,
		protein_per_100g: 0,
		carbs_per_100g: 0,
		fat_per_100g: 0,
		fiber_per_100g: 0,
	},
	{
		slug: "omega_3_gymbeam",
		is_supplement: true,
		kcal_per_100g: 9,
		protein_per_100g: 0,
		carbs_per_100g: 0,
		fat_per_100g: 1,
		fiber_per_100g: 0,
	},
	{
		slug: "vitamin_d3_k2_gymbeam",
		is_supplement: true,
		kcal_per_100g: 0,
		protein_per_100g: 0,
		carbs_per_100g: 0,
		fat_per_100g: 0,
		fiber_per_100g: 0,
	},
	{
		slug: "magnesium_bisglycinate_gymbeam",
		is_supplement: true,
		kcal_per_100g: 0,
		protein_per_100g: 0,
		carbs_per_100g: 0,
		fat_per_100g: 0,
		fiber_per_100g: 0,
	},
	// Rolled oats (dry): standard food-table values.
	{
		slug: "oatmeal",
		kcal_per_100g: 379,
		protein_per_100g: 13,
		carbs_per_100g: 67,
		fat_per_100g: 7,
		fiber_per_100g: 10,
	},
	// Plain whole-milk yogurt 3.9% fat.
	{
		slug: "yogurt_3_9_fat",
		kcal_per_100g: 65,
		protein_per_100g: 3.5,
		carbs_per_100g: 4.7,
		fat_per_100g: 3.9,
		fiber_per_100g: 0,
	},
	// Whole milk 3.5% fat.
	{
		slug: "milk_3_5_fat",
		kcal_per_100g: 64,
		protein_per_100g: 3.3,
		carbs_per_100g: 4.8,
		fat_per_100g: 3.5,
		fiber_per_100g: 0,
	},
];

async function main() {
	config({ path: ".env.local" });
	const sb = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	for (const u of UPDATES) {
		const { slug, ...patch } = u;
		const { data, error } = await sb
			.from("ingredients")
			.update(patch)
			.eq("slug", slug)
			.select("slug,kcal_per_100g,protein_per_100g,is_supplement");
		if (error) console.error(slug, error.message);
		else console.log(slug, "->", data?.length ?? 0, "row(s)", JSON.stringify(data?.[0]));
	}
}
main();
