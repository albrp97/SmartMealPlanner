/**
 * 4-cell macro header strip for /plan: kcal / protein / carbs / fat.
 *
 * Pure presentation. Colour cue is driven by the actual-vs-target ratio
 * so a glance tells you if the day is in band:
 *   - <0.85 of target → fg-mute (under)
 *   - >1.10 of target → magenta (over)
 *   - else            → accent (in band)
 *
 * Targets are per-goal (see src/lib/goals.ts).
 */
import { Surface } from "@/components/ui/surface";

interface DayTotals {
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
}

interface MacroTargets extends DayTotals {}

function pctClass(actual: number, target: number): string {
	if (target <= 0) return "text-fg-dim";
	const p = actual / target;
	if (p > 1.1) return "text-magenta";
	if (p < 0.85) return "text-fg-mute";
	return "text-accent";
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
		<Surface className="p-3">
			<p className="font-mono text-[10px] uppercase tracking-widest text-fg-mute">{label}</p>
			<p className={`mt-1 font-mono text-2xl ${cls}`}>{value}</p>
			<p className="font-mono text-[10px] text-fg-mute">
				/ {target} ({pct}%)
			</p>
		</Surface>
	);
}

export function DayMacroCard({ totals, target }: { totals: DayTotals; target: MacroTargets }) {
	return (
		<section
			aria-label="Daily macros vs target"
			className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
		>
			<DayStat
				label="kcal"
				value={Math.round(totals.kcal)}
				target={target.kcal}
				cls={pctClass(totals.kcal, target.kcal)}
			/>
			<DayStat
				label="protein"
				value={Math.round(totals.protein)}
				target={target.protein}
				cls={pctClass(totals.protein, target.protein)}
			/>
			<DayStat
				label="carbs"
				value={Math.round(totals.carbs)}
				target={target.carbs}
				cls={pctClass(totals.carbs, target.carbs)}
			/>
			<DayStat
				label="fat"
				value={Math.round(totals.fat)}
				target={target.fat}
				cls={pctClass(totals.fat, target.fat)}
			/>
		</section>
	);
}
