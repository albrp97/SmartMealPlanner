/**
 * Shopping-list aside for /plan.
 *
 * Pure presentation: takes the aggregated shopping items + the package
 * meta map (price, currency, divisibility) and renders the list with
 * cost summary at the top. Breakfast is excluded upstream — this only
 * shows lunch + dinner ingredients.
 *
 * For non-divisible packs (a whole onion, a tortilla pack, a beer) we
 * always pay for the rounded-up integer number of packages even if the
 * recipe only consumes part of one — the "·fixed" badge surfaces that.
 * The "def" / "real" badges signal whether the price is the
 * Lidl-Prague-2026 default or a real ticket price (per
 * DEVELOPER_GUIDE §4.4).
 */
import type { ShoppingItem } from "@/lib/plan-portion";

export interface PackageMetaEntry {
	packageSize: number;
	packageUnit: "g" | "ml" | "unit";
	divisible: boolean;
	price: number | null;
	currency: string;
	priceIsDefault: boolean;
}

export function ShoppingList({
	items,
	packageMeta,
	totalConsumed,
	totalShopping,
	currency,
}: {
	items: ShoppingItem[];
	packageMeta: Map<string, PackageMetaEntry>;
	totalConsumed: number;
	totalShopping: number;
	currency: string;
}) {
	return (
		<aside className="space-y-3">
			<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
				<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">Shopping list</h2>
				<p className="mt-0.5 text-[11px] text-zinc-500">
					Lunch + dinner only · breakfast not included
				</p>
				<div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
					<div>
						<p className="text-zinc-500">Used</p>
						<p className="text-emerald-300">
							{totalConsumed.toFixed(2)} {currency}
						</p>
					</div>
					<div>
						<p className="text-zinc-500">To buy</p>
						<p className="text-sky-300">
							{totalShopping.toFixed(2)} {currency}
						</p>
					</div>
				</div>
			</div>

			{items.length === 0 ? (
				<div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-6 text-center text-xs text-zinc-500">
					Add a lunch or dinner to see the shopping list.
				</div>
			) : (
				<ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
					{items.map((it) => {
						const meta = packageMeta.get(it.ingredientId);
						const packsToBuy = Math.ceil(meta?.divisible ? it.consumedRatio : it.packagesPaid);
						const cost = meta?.price != null ? packsToBuy * meta.price : null;
						return (
							<li key={it.ingredientId} className="bg-zinc-900/30 px-3 py-2">
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-sm text-zinc-100">{it.ingredientName}</span>
									<span className="font-mono text-[11px] text-zinc-300">
										{packsToBuy}× {it.packageSize}
										{it.packageUnit}
									</span>
								</div>
								<div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-500">
									<span>
										need {it.quantity.toFixed(it.unit === "unit" ? 1 : 0)} {it.unit}
										{meta && !meta.divisible && (
											<span className="ml-1 text-amber-400" title="non-divisible — pays full pack">
												·fixed
											</span>
										)}
									</span>
									<span className="flex items-center gap-1">
										{cost != null ? `${cost.toFixed(2)} ${meta?.currency ?? ""}` : "—"}
										{meta?.priceIsDefault ? (
											<span
												title="Lidl Prague 2026 estimate"
												className="rounded border border-amber-700/60 bg-amber-900/20 px-1 py-0.5 text-[9px] uppercase tracking-wider text-amber-300"
											>
												def
											</span>
										) : (
											<span
												title="Real ticket price"
												className="rounded border border-emerald-700/60 bg-emerald-900/20 px-1 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300"
											>
												real
											</span>
										)}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</aside>
	);
}
