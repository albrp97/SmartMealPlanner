import Link from "next/link";
import { IngredientForm } from "../ingredient-form";

export const dynamic = "force-dynamic";

export default function NewIngredientPage() {
	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="space-y-1">
				<Link href="/ingredients" className="text-xs text-zinc-500 hover:text-zinc-300">
					← Ingredients
				</Link>
				<h1 className="text-2xl font-semibold tracking-tight">New ingredient</h1>
			</header>
			<IngredientForm mode="create" />
		</main>
	);
}
