/**
 * 4-cell macro header strip for /plan: kcal / protein / carbs / fat.
 *
 * Pure presentation. Colour cue (zinc / emerald / amber) is driven by the
 * actual-vs-target ratio so a glance tells you if the day is in band:
 *   - <0.85 of target → zinc-400 (under)
 *   - >1.10 of target → amber-300 (over)
 *   - else            → emerald-300 (in band)
 *
 * Targets are per-goal (see src/lib/goals.ts). The 90–100 % kcal band
 * promised by the macro balancer (Phase 3.10.1) lands inside the
 * emerald range here.
 */

interface DayTotals {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

interface MacroTargets extends DayTotals {}

function pctClass(actual: number, target: number): string {
	if (target <= 0) return "text-zinc-300";
	const p = actual / target;
	if (p > 1.1) return "text-amber-300";
	if (p < 0.85) return "text-zinc-400";
	return "text-emerald-300";
}

function DayStat({
	label,
	value,
	target,
	cls,
}: {
	label: string;
	value: number;
	target: number;
	cls: string;
}) {
	const pct = target > 0 ? Math.round((value / target) * 100) : 0;
	return (
		<div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
			<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
			<p className={`mt-1 font-mono text-2xl ${cls}`}>{value}</p>
			<p className="font-mono text-[10px] text-zinc-500">
				/ {target} ({pct}%)
			</p>
		</div>
	);
}

export function DayMacroCard({ totals, target }: { totals: DayTotals; target: MacroTargets }) {
	return (
		<section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<DayStat
				label="kcal / day"
				value={Math.round(totals.kcal)}
				target={target.kcal}
				cls={pctClass(totals.kcal, target.kcal)}
			/>
			<DayStat
				label="protein g"
				value={Math.round(totals.protein)}
				target={target.protein}
				cls={pctClass(totals.protein, target.protein)}
			/>
			<DayStat
				label="carbs g"
				value={Math.round(totals.carbs)}
				target={target.carbs}
				cls={pctClass(totals.carbs, target.carbs)}
			/>
			<DayStat
				label="fat g"
				value={Math.round(totals.fat)}
				target={target.fat}
				cls={pctClass(totals.fat, target.fat)}
			/>
		</section>
	);
}
