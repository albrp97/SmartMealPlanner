import { createClient } from "@/lib/db/client-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface RecipeListRow {
	id: string;
	slug: string;
	name: string;
	servings: number;
	meal_type: "single_meal" | "batch" | "unknown";
	category_id: string | null;
}

export default async function RecipesPage() {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("recipes")
		.select("id, slug, name, servings, meal_type, category_id")
		.order("name");

	const recipes = (data ?? []) as RecipeListRow[];

	const grouped = recipes.reduce<Record<string, RecipeListRow[]>>((acc, r) => {
		const key = r.category_id ?? "uncategorised";
		const bucket = acc[key] ?? [];
		bucket.push(r);
		acc[key] = bucket;
		return acc;
	}, {});

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 1</p>
					<h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
					<p className="text-sm text-zinc-400">{recipes.length} recipes · click for cost preview</p>
				</div>
				<Link
					href="/ingredients"
					className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
				>
					Ingredients →
				</Link>
			</header>

			{error ? (
				<div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
					Failed to load: {error.message}
				</div>
			) : null}

			<div className="space-y-6">
				{Object.entries(grouped).map(([cat, items]) => (
					<section key={cat}>
						<h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">{cat}</h2>
						<ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
							{items.map((r) => (
								<li key={r.id}>
									<Link
										href={`/recipes/${r.slug}`}
										className="flex items-center justify-between px-3 py-2 hover:bg-zinc-900/30"
									>
										<div>
											<p className="text-sm text-zinc-100">{r.name}</p>
											<p className="font-mono text-[10px] text-zinc-500">
												{r.meal_type} · {r.servings} {r.servings === 1 ? "serving" : "servings"}
											</p>
										</div>
										<span className="text-xs text-zinc-500">→</span>
									</Link>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</main>
	);
}
