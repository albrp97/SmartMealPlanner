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
}
