/**
 * Daily micronutrient roll-up for /plan.
 *
 * Reuses the same RDA bar pattern as the per-recipe page
 * ([`src/app/recipes/[slug]/page.tsx`](../recipes/[slug]/page.tsx)) but
 * fed from the daily total: `breakfast.perServingMicros + lunch_ps +
 * dinner_ps`. Sodium overshoot is highlighted in amber (WHO upper limit
 * = 2300 mg/day, see DEVELOPER_GUIDE §4.4 + src/lib/rda.ts).
 *
 * Sparse by design: any micro the OpenFoodFacts seed didn't fill in just
 * doesn't render. If the whole day has no micro data, the section is
 * hidden entirely.
 */
import { RDA, rdaPercent } from "@/lib/rda";

export type Micros = Record<string, number | undefined>;

export function DayMicroRollup({ micros }: { micros: Micros }) {
	const hasAny = Object.keys(RDA).some((key) => {
		const v = micros[key];
		return v != null && v > 0;
	});
	if (!hasAny) return null;

	return (
		<section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
			<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
				Micronutrients · per day
			</h2>
			<p className="mt-0.5 text-[11px] text-zinc-500">
				Breakfast + lunch + dinner · % of EU adult NRV (sodium = WHO upper limit)
			</p>
			<dl className="mt-3 grid gap-2 sm:grid-cols-2">
				{Object.entries(RDA).map(([key, entry]) => {
					const raw = micros[key];
					if (raw == null) return null;
					const value = Math.round(raw);
					const pct = rdaPercent(key, value) ?? 0;
					const clamped = Math.min(100, pct);
					const over = key === "sodium_mg" && pct > 100;
					return (
						<div key={key} className="space-y-1">
							<div className="flex justify-between font-mono text-xs text-zinc-400">
								<span>{entry.label}</span>
								<span>
									{value} {entry.unit} ·{" "}
									<span className={over ? "text-amber-400" : "text-zinc-300"}>{pct}%</span>
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
								<div
									className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-sky-500"}`}
									style={{ width: `${clamped}%` }}
								/>
							</div>
						</div>
					);
				})}
			</dl>
		</section>
	);
}
