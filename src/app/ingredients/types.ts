/** Shape returned by the ingredients table query — kept narrow on purpose. */
export interface IngredientRow {
	id: string;
	slug: string;
	name: string;
	category_id: string | null;
	sold_as: "package" | "unit";
	package_size: number;
	package_unit: "g" | "ml" | "unit";
	package_price: number | null;
	currency: string;
	is_supplement: boolean;
	brand: string | null;
	notes: string | null;
	kcal_per_100g: number | null;
	protein_per_100g: number | null;
	carbs_per_100g: number | null;
	fat_per_100g: number | null;
	fiber_per_100g: number | null;
	g_per_unit: number | null;
	density_g_per_ml: number | null;
	micros_per_100g: Record<string, number> | null;
}
