/**
 * Goal pill navigator.
 *
 * Plain `<a>` anchors deliberately — Next 16's RSC router cache has a
 * habit of holding onto the previous payload when only a search-param
 * changes on the same path, which made Cut/Maintain/Bulk feel inert
 * even with `dynamic = "force-dynamic"` and `router.refresh()`. A hard
 * navigation sidesteps the entire cache layer; the page is fast enough
 * that the reload is invisible.
 */
import { GOALS, GOAL_LABEL, type Goal } from "@/lib/goals";

export function GoalPills({ active }: { active: Goal }) {
	return (
		<div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/40 p-1 font-mono text-[11px]">
			{GOALS.map((g) => (
				<a
					key={g}
					href={`/plan?goal=${g}`}
					className={`rounded-full px-2.5 py-1 transition ${
						active === g
							? "bg-emerald-500/15 text-emerald-300"
							: "text-zinc-400 hover:text-zinc-200"
					}`}
				>
					{GOAL_LABEL[g]}
				</a>
			))}
		</div>
	);
}
