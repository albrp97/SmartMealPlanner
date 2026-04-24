import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/db/client-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Format the % change between a real ticket price and the seeded default. */
function pctDelta(real: number, def: number): string {
	if (def === 0) return "n/a";
	const pct = ((real - def) / def) * 100;
	const sign = pct > 0 ? "+" : "";
	return `${sign}${pct.toFixed(0)}% vs default`;
}

export default async function IngredientsPage() {
	const supabase = await createClient();
	const { data: ingredients, error } = await supabase
		.from("ingredients")
		.select(
			"id, name, category_id, package_size, package_unit, package_price, default_package_price, price_is_default, currency, kcal_per_100g",
		)
		.order("name");

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex items-end justify-between gap-4">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 1</p>
					<h1 className="text-2xl font-semibold tracking-tight">Ingredients</h1>
					<p className="text-sm text-zinc-400">
						Catalogue backed by Supabase. Click a row to edit.
					</p>
				</div>
				<ButtonLink href="/ingredients/new" variant="primary" size="sm">
					+ New
				</ButtonLink>
			</header>

			{error ? (
				<div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
					Failed to load: {error.message}
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-zinc-800">
					<table className="w-full text-sm">
						<thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-400">
							<tr>
								<th className="px-3 py-2">Name</th>
								<th className="px-3 py-2">Category</th>
								<th className="px-3 py-2 text-right">Package</th>
								<th className="px-3 py-2 text-right">Price</th>
								<th className="px-3 py-2 text-right">kcal/100g</th>
								<th className="w-12 px-3 py-2" />
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-800">
							{ingredients?.map((i) => (
								<tr key={i.id} className="hover:bg-zinc-900/30">
									<td className="px-3 py-2 text-zinc-100">{i.name}</td>
									<td className="px-3 py-2 text-zinc-500">{i.category_id ?? "—"}</td>
									<td className="px-3 py-2 text-right font-mono text-zinc-400">
										{i.package_size} {i.package_unit}
									</td>
									<td className="px-3 py-2 text-right font-mono text-zinc-400">
										{i.package_price != null ? (
											<span className="flex items-center justify-end gap-2">
												<span>
													{i.package_price.toFixed(2)} {i.currency}
												</span>
												{i.price_is_default ? (
													<span
														title="Lidl Prague 2026 estimate — not from a real receipt yet"
														className="rounded border border-amber-700 bg-amber-900/30 px-1 py-0.5 text-[10px] uppercase tracking-wider text-amber-300"
													>
														def
													</span>
												) : (
													<span
														title={
															i.default_package_price != null
																? `Real price · default was ${i.default_package_price.toFixed(2)} ${i.currency} (${pctDelta(i.package_price, i.default_package_price)})`
																: "Real price"
														}
														className="rounded border border-emerald-700 bg-emerald-900/30 px-1 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300"
													>
														real
													</span>
												)}
											</span>
										) : (
											"—"
										)}
									</td>
									<td className="px-3 py-2 text-right font-mono text-zinc-400">
										{i.kcal_per_100g != null ? i.kcal_per_100g : "—"}
									</td>
									<td className="px-3 py-2 text-right">
										<Link
											href={`/ingredients/${i.id}/edit`}
											className="text-xs text-zinc-400 hover:text-emerald-300"
										>
											Edit →
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{ingredients?.length === 0 ? (
						<p className="px-3 py-4 text-center text-sm text-zinc-500">
							No ingredients yet. Run <code className="text-zinc-300">pnpm db:seed</code>.
						</p>
					) : null}
				</div>
			)}
		</main>
	);
}
