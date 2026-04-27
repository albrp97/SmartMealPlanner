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
 *
 * Mobile collapse: on `< sm` the list lives inside a `<details>` so it
 * doesn't dominate the planner; on `lg:` it's the right column and
 * always open. Uses `<details>` (no JS) for the disclosure.
 */
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
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
		<aside aria-label="Shopping list" className="space-y-3">
			<details
				className="group block lg:open:block"
				/* details element is open by default on lg+; on mobile the user
				   can collapse it. We honour any explicit toggle either way. */
				open
			>
				<summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-sm border border-grid bg-bg-elev px-3 py-3 lg:hidden">
					<TermHeading level={3} prompt="$">
						shopping
					</TermHeading>
					<span aria-hidden className="font-mono text-xs text-fg-dim group-open:hidden">
						▸
					</span>
					<span aria-hidden className="hidden font-mono text-xs text-fg-dim group-open:inline">
						▾
					</span>
				</summary>

				<Summary
					totalConsumed={totalConsumed}
					totalShopping={totalShopping}
					currency={currency}
				/>

				{items.length === 0 ? (
					<Surface className="px-4 py-6 text-center font-mono text-xs text-fg-dim">
						add a lunch or dinner to see the shopping list.
					</Surface>
				) : (
					<ul className="divide-y divide-grid overflow-hidden border border-grid bg-bg-elev">
						{items.map((it) => {
							const meta = packageMeta.get(it.ingredientId);
							const packsToBuy = Math.ceil(meta?.divisible ? it.consumedRatio : it.packagesPaid);
							const cost = meta?.price != null ? packsToBuy * meta.price : null;
							return (
								<li key={it.ingredientId} className="px-3 py-2">
									<div className="flex items-baseline justify-between gap-2">
										<span className="text-sm text-fg">{it.ingredientName}</span>
										<span className="font-mono text-[11px] text-fg-dim">
											{packsToBuy}× {it.packageSize}
											{it.packageUnit}
										</span>
									</div>
									<div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-fg-mute">
										<span className="flex items-center gap-1">
											need {it.quantity.toFixed(it.unit === "unit" ? 1 : 0)} {it.unit}
											{meta && !meta.divisible && (
												<Badge tone="fixed" title="non-divisible — pays full pack">
													fixed
												</Badge>
											)}
										</span>
										<span className="flex items-center gap-1">
											{cost != null
												? `${cost.toFixed(2)} ${meta?.currency ?? ""}`
												: "—"}
											{meta?.priceIsDefault ? (
												<Badge tone="fixed" title="Lidl Prague 2026 estimate">
													def
												</Badge>
											) : (
												<Badge tone="hero" title="Real ticket price">
													real
												</Badge>
											)}
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</details>
		</aside>
	);
}

function Summary({
	totalConsumed,
	totalShopping,
	currency,
}: {
	totalConsumed: number;
	totalShopping: number;
	currency: string;
}) {
	return (
		<Surface className="mt-2 p-4 lg:mt-0">
			<div className="hidden items-baseline justify-between lg:flex">
				<TermHeading level={3} prompt="$">
					shopping
				</TermHeading>
				<span className="text-[10px] text-fg-mute">lunch + dinner only</span>
			</div>
			<div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
				<div>
					<p className="text-fg-mute">used</p>
					<p className="text-accent">
						{totalConsumed.toFixed(2)} {currency}
					</p>
				</div>
				<div>
					<p className="text-fg-mute">to buy</p>
					<p className="text-cyan">
						{totalShopping.toFixed(2)} {currency}
					</p>
				</div>
			</div>
		</Surface>
	);
}
