import { createClient } from "@/lib/db/client-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IngredientForm } from "../../ingredient-form";
import type { IngredientRow } from "../../types";

export const dynamic = "force-dynamic";

export default async function EditIngredientPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("ingredients")
		.select(
			"id, slug, name, category_id, sold_as, package_size, package_unit, package_price, currency, is_supplement, brand, notes, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g",
		)
		.eq("id", id)
		.maybeSingle();

	if (error || !data) {
		notFound();
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="space-y-1">
				<Link href="/ingredients" className="text-xs text-zinc-500 hover:text-zinc-300">
					← Ingredients
				</Link>
				<h1 className="text-2xl font-semibold tracking-tight">Edit · {data.name}</h1>
				<p className="font-mono text-xs text-zinc-500">{data.slug}</p>
			</header>
			<IngredientForm mode="edit" initial={data as IngredientRow} />
		</main>
	);
}
