import { ButtonLink } from "@/components/ui/button";
import { TermHeading } from "@/components/ui/term-heading";
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
		<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<TermHeading level={1} prompt="$" caret>
						ingredients
					</TermHeading>
					<p className="font-mono text-xs text-fg-dim sm:text-sm">
						catalogue backed by supabase · tap a row to edit
					</p>
				</div>
				<ButtonLink href="/ingredients/new" variant="primary" size="sm">
					+ new
				</ButtonLink>
			</header>

			{error ? (
				<div className="rounded-sm border border-rose/40 bg-rose/10 px-4 py-3 font-mono text-sm text-rose">
					! failed to load: {error.message}
				</div>
			) : (
				<div className="overflow-x-auto rounded-sm border border-grid bg-bg-elev">
					<table className="w-full font-mono text-sm">
						<thead className="bg-bg-sunk text-left text-xs uppercase tracking-widest text-fg-dim">
							<tr>
								<th className="px-3 py-2">name</th>
								<th className="px-3 py-2">category</th>
								<th className="px-3 py-2 text-right">package</th>
								<th className="px-3 py-2 text-right">price</th>
								<th className="px-3 py-2 text-right">kcal/100g</th>
								<th className="w-12 px-3 py-2" />
							</tr>
						</thead>
						<tbody className="divide-y divide-grid">
							{ingredients?.map((i) => (
								<tr key={i.id} className="hover:bg-bg-sunk">
									<td className="px-3 py-2 text-fg">{i.name}</td>
									<td className="px-3 py-2 text-fg-mute">{i.category_id ?? "—"}</td>
									<td className="px-3 py-2 text-right text-fg-dim">
										{i.package_size} {i.package_unit}
									</td>
									<td className="px-3 py-2 text-right text-fg-dim">
										{i.package_price != null ? (
											<span className="flex items-center justify-end gap-2">
												<span>
													{i.package_price.toFixed(2)} {i.currency}
												</span>
												{i.price_is_default ? (
													<span
														title="Lidl Prague 2026 estimate — not from a real receipt yet"
														className="rounded-sm border border-amber/40 bg-amber/10 px-1 py-0.5 text-[10px] uppercase tracking-widest text-amber"
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
														className="rounded-sm border border-accent/40 bg-accent/10 px-1 py-0.5 text-[10px] uppercase tracking-widest text-accent"
													>
														real
													</span>
												)}
											</span>
										) : (
											"—"
										)}
									</td>
									<td className="px-3 py-2 text-right text-fg-dim">
										{i.kcal_per_100g != null ? i.kcal_per_100g : "—"}
									</td>
									<td className="px-3 py-2 text-right">
										<Link
											href={`/ingredients/${i.id}/edit`}
											className="text-xs text-fg-dim hover:text-accent"
										>
											edit ↗
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{ingredients?.length === 0 ? (
						<p className="px-3 py-4 text-center font-mono text-sm text-fg-mute">
							no ingredients yet. run{" "}
							<code className="text-fg">pnpm db:seed</code>.
						</p>
					) : null}
				</div>
			)}
		</main>
	);
}
