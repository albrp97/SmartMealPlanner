/**
 * Daily micronutrient roll-up for /plan.
 *
 * RDA bar pattern, fed from the daily total
 * (`breakfast.perServingMicros + lunch_ps + dinner_ps`). Sodium overshoot
 * uses magenta (WHO upper limit = 2300 mg/day, see DEVELOPER_GUIDE §4.4
 * + src/lib/rda.ts). Hidden if the day has no micro data.
 */
import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
import { RDA, rdaPercent } from "@/lib/rda";

export type Micros = Record<string, number | undefined>;

export function DayMicroRollup({ micros }: { micros: Micros }) {
	const hasAny = Object.keys(RDA).some((key) => {
		const v = micros[key];
		return v != null && v > 0;
	});
	if (!hasAny) return null;

	return (
		<Surface aria-label="Daily micronutrients" className="p-4">
			<TermHeading level={3} prompt="μ">
				micros · per day
			</TermHeading>
			<p className="mt-1 text-[11px] text-fg-mute">
				breakfast + lunch + dinner · % of EU adult NRV (sodium = WHO upper limit)
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
							<div className="flex justify-between font-mono text-xs text-fg-dim">
								<span>{entry.label}</span>
								<span>
									{value} {entry.unit} ·{" "}
									<span className={over ? "text-magenta" : "text-fg"}>{pct}%</span>
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-sm bg-bg-sunk">
								<div
									className={`h-full rounded-sm ${over ? "bg-magenta" : "bg-cyan"}`}
									style={{ width: `${clamped}%` }}
								/>
							</div>
						</div>
					);
				})}
			</dl>
		</Surface>
	);
}
