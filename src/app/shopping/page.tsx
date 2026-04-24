/**
 * Phase 3: shopping list aggregator.
 *
 * Reads the meal_plan_entries for the current ISO week (override via
 * `?week=YYYY-MM-DD`), pulls the recipe ingredient lines, scales each by
 * (planned servings / recipe servings), and aggregates into one row per
 * ingredient with rounded-up package counts and total cost.
 *
 * Same default/real price tracking as the rest of the app: each row carries
 * a small badge so we know which lines still ride on the seeded estimates.
 */
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/db/client-server";
import { type PlanLineInput, aggregateShopping, weekDates } from "@/lib/plan";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PlanRow {
	id: string;
	date: string;
	slot: "breakfast" | "lunch" | "dinner";
	servings: number;
	recipe_id: string;
	recipes: {
		id: string;
		name: string;
		servings: number;
		recipe_ingredients: {
			quantity: number;
			unit: "g" | "ml" | "unit";
			ingredients: {
				id: string;
				name: string;
				package_size: number;
				package_unit: "g" | "ml" | "unit";
				package_price: number | null;
				default_package_price: number | null;
				price_is_default: boolean;
				currency: string;
			} | null;
		}[];
	} | null;
}

export default async function ShoppingPage({
	searchParams,
}: {
	searchParams: Promise<{ week?: string }>;
}) {
	const { week } = await searchParams;
	const anchor = week ? new Date(week) : new Date();
	const days = weekDates(Number.isNaN(anchor.getTime()) ? new Date() : anchor);

	const supabase = await createClient();
	const { data: planRaw } = await supabase
		.from("meal_plan_entries")
		.select(
			"id, date, slot, servings, recipe_id, recipes(id, name, servings, recipe_ingredients(quantity, unit, ingredients(id, name, package_size, package_unit, package_price, default_package_price, price_is_default, currency)))",
		)
		.in("date", days);

	const plan = (planRaw ?? []) as unknown as PlanRow[];

	// Flatten plan + recipe lines into PlanLineInput rows for the aggregator.
	const lines: PlanLineInput[] = [];
	const recipeNames: Record<string, string> = {};
	for (const e of plan) {
		const r = e.recipes;
		if (!r) continue;
		recipeNames[r.id] = r.name;
		for (const li of r.recipe_ingredients) {
			if (!li.ingredients) continue;
			lines.push({
				recipeId: r.id,
				recipeServings: r.servings,
				plannedServings: e.servings,
				ingredientId: li.ingredients.id,
				ingredientName: li.ingredients.name,
				quantity: li.quantity,
				unit: li.unit,
				packageSize: li.ingredients.package_size,
				packageUnit: li.ingredients.package_unit,
				packagePrice: li.ingredients.package_price,
				currency: li.ingredients.currency,
				priceIsDefault: li.ingredients.price_is_default ?? true,
			});
		}
	}

	const items = aggregateShopping(lines, recipeNames);
	const currency = items[0]?.currency ?? "CZK";
	const totalConsumed = items.reduce((a, i) => a + (i.consumedCost ?? 0), 0);
	const totalShopping = items.reduce((a, i) => a + (i.shoppingCost ?? 0), 0);
	const defaultShare =
		totalConsumed > 0
			? Math.round(
					(items.reduce((a, i) => a + (i.priceIsDefault ? (i.consumedCost ?? 0) : 0), 0) /
						totalConsumed) *
						100,
				)
			: 0;

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 3</p>
					<h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
					<p className="text-sm text-zinc-400">
						{days[0]} → {days[6]} · {plan.length}{" "}
						{plan.length === 1 ? "planned meal" : "planned meals"} ·{" "}
						{Object.keys(recipeNames).length} unique{" "}
						{Object.keys(recipeNames).length === 1 ? "recipe" : "recipes"}
					</p>
				</div>
				<ButtonLink href={`/plan?week=${days[0]}`} variant="ghost" size="sm">
					← Back to plan
				</ButtonLink>
			</header>

			{items.length === 0 ? (
				<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-6 py-10 text-center text-sm text-zinc-400">
					Nothing planned for this week yet.{" "}
					<Link href={`/plan?week=${days[0]}`} className="text-emerald-300 hover:text-emerald-200">
						Open the planner →
					</Link>
				</div>
			) : (
				<>
					<section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
							<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
								Consumed cost
							</p>
							<p className="mt-1 font-mono text-2xl text-emerald-300">
								{totalConsumed.toFixed(2)} {currency}
							</p>
							<p className="font-mono text-[10px] text-zinc-500">
								proportional cost of what's used
							</p>
						</div>
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
							<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
								Shopping cost
							</p>
							<p className="mt-1 font-mono text-2xl text-sky-300">
								{totalShopping.toFixed(2)} {currency}
							</p>
							<p className="font-mono text-[10px] text-zinc-500">whole packages, rounded up</p>
						</div>
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
							<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
								Default-price share
							</p>
							<p
								className={`mt-1 font-mono text-2xl ${defaultShare > 25 ? "text-amber-300" : "text-emerald-300"}`}
							>
								{defaultShare}%
							</p>
							<p className="font-mono text-[10px] text-zinc-500">
								cost still on Lidl 2026 estimates
							</p>
						</div>
					</section>

					<section className="overflow-x-auto rounded-lg border border-zinc-800">
						<table className="w-full text-sm">
							<thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-400">
								<tr>
									<th className="px-3 py-2">Ingredient</th>
									<th className="px-3 py-2 text-right">Need</th>
									<th className="px-3 py-2 text-right">Pack</th>
									<th className="px-3 py-2 text-right">Buy</th>
									<th className="px-3 py-2 text-right">Cost (shop)</th>
									<th className="px-3 py-2 text-right">Cost (used)</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-800">
								{items.map((it) => (
									<tr key={it.ingredientId} className="hover:bg-zinc-900/30">
										<td className="px-3 py-2">
											<p className="text-zinc-100">{it.ingredientName}</p>
											<p className="font-mono text-[10px] text-zinc-500">
												{it.contributingRecipes.join(", ")}
											</p>
										</td>
										<td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
											{it.totalQuantity.toFixed(it.unit === "unit" ? 1 : 0)} {it.unit}
										</td>
										<td className="px-3 py-2 text-right font-mono text-[10px] text-zinc-500">
											{it.packageSize} {it.packageUnit}
										</td>
										<td className="px-3 py-2 text-right font-mono text-xs text-zinc-300">
											{it.unitMismatch ? (
												<span className="text-amber-400">unit ≠</span>
											) : (
												it.packages
											)}
										</td>
										<td className="px-3 py-2 text-right font-mono text-xs">
											<span className="inline-flex items-center gap-1">
												<span className="text-zinc-100">
													{it.shoppingCost != null
														? `${it.shoppingCost.toFixed(2)} ${it.currency}`
														: "—"}
												</span>
												{it.priceIsDefault ? (
													<span
														title="Lidl Prague 2026 estimate"
														className="rounded border border-amber-700 bg-amber-900/30 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-300"
													>
														def
													</span>
												) : (
													<span
														title="Real ticket price"
														className="rounded border border-emerald-700 bg-emerald-900/30 px-1 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300"
													>
														real
													</span>
												)}
											</span>
										</td>
										<td className="px-3 py-2 text-right font-mono text-[11px] text-zinc-500">
											{it.consumedCost != null
												? `${it.consumedCost.toFixed(2)} ${it.currency}`
												: "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				</>
			)}
		</main>
	);
}
