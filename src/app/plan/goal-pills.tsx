/**
 * Goal pill navigator.
 *
 * Plain `<a>` anchors deliberately — Next 16's RSC router cache has a
 * habit of holding onto the previous payload when only a search-param
 * changes on the same path, which made Cut/Maintain/Bulk feel inert
 * even with `dynamic = "force-dynamic"` and `router.refresh()`. A hard
 * navigation sidesteps the entire cache layer; the page is fast enough
 * that the reload is invisible.
 *
 * Visual: terminal-style square pills, accent on active, uppercase
 * mono so cut/maint/bulk read as commands rather than buttons.
 */
import { GOALS, GOAL_LABEL, type Goal } from "@/lib/goals";

const SHORT: Record<Goal, string> = {
	cut: "CUT",
	maintain: "MAINT",
	bulk: "BULK",
};

export function GoalPills({ active }: { active: Goal }) {
	return (
		<div
			role="radiogroup"
			aria-label="Goal"
			className="flex items-center gap-1 rounded-sm border border-grid bg-bg-sunk p-1 font-mono text-[11px]"
		>
			{GOALS.map((g) => (
				<a
					key={g}
					href={`/plan?goal=${g}`}
					role="radio"
					aria-checked={active === g}
					aria-label={GOAL_LABEL[g]}
					className={`min-h-[36px] rounded-sm px-3 py-1.5 uppercase tracking-widest transition-colors ${
						active === g ? "bg-accent/15 text-accent" : "text-fg-dim hover:text-fg"
					}`}
				>
					{SHORT[g]}
				</a>
			))}
		</div>
	);
}
