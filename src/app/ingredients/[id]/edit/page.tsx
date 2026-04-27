import { TermHeading } from "@/components/ui/term-heading";
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
			"id, slug, name, category_id, sold_as, package_size, package_unit, package_price, currency, is_supplement, brand, notes, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, g_per_unit, density_g_per_ml, micros_per_100g",
		)
		.eq("id", id)
		.maybeSingle();

	if (error || !data) {
		notFound();
	}

	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="space-y-1">
				<Link href="/ingredients" className="font-mono text-xs text-fg-mute hover:text-fg">
					← ingredients
				</Link>
				<TermHeading level={1} prompt="~" caret>
					edit · {data.name}
				</TermHeading>
				<p className="font-mono text-xs text-fg-mute">{data.slug}</p>
			</header>
			<IngredientForm mode="edit" initial={data as IngredientRow} />
		</main>
	);
}
