import { createClient } from "@/lib/db/client-server";
import Link from "next/link";
import { RecipeForm } from "../recipe-form";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
	const supabase = await createClient();
	const { data } = await supabase
		.from("ingredients")
		.select("id, name, package_unit")
		.order("name");

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="space-y-1">
				<Link href="/recipes" className="text-xs text-zinc-500 hover:text-zinc-300">
					← Recipes
				</Link>
				<h1 className="text-2xl font-semibold tracking-tight">New recipe</h1>
			</header>
			<RecipeForm mode="create" options={data ?? []} />
		</main>
	);
}
