import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
import { type PhaseStatus, phaseStatuses } from "@/lib/phases";
import Link from "next/link";

const statusTone: Record<PhaseStatus, string> = {
	"in-progress": "text-accent border-accent/40 bg-accent/10",
	next: "text-amber border-amber/40 bg-amber/10",
	todo: "text-fg-mute border-grid bg-bg-sunk",
	done: "text-cyan border-cyan/40 bg-cyan/10",
};

export default function Home() {
	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 px-4 py-6 sm:px-6 sm:py-10 sm:gap-8">
			<header className="space-y-2">
				<TermHeading level={1} prompt="$" caret>
					smartmealplanner
				</TermHeading>
				<p className="font-mono text-xs leading-relaxed text-fg-dim sm:text-sm">
					personal meal planning · recipe costing · macro &amp; micronutrient tracking ·
					grocery shopping automation — with receipt-photo price ingestion powered by an LLM.
				</p>
			</header>

			<section className="space-y-3">
				<TermHeading level={2} prompt="◆">
					roadmap
				</TermHeading>
				<ul className="space-y-2">
					{phaseStatuses.map((phase) => (
						<li key={phase.id}>
							<Surface className="flex items-start justify-between gap-3 px-4 py-3">
								<div className="space-y-0.5">
									<p className="font-mono text-sm text-fg">
										<span className="text-fg-mute">phase {phase.id} —</span> {phase.title}
									</p>
									<p className="font-mono text-xs text-fg-mute">{phase.desc}</p>
								</div>
								<span
									className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${statusTone[phase.status]}`}
								>
									{phase.status}
								</span>
							</Surface>
						</li>
					))}
				</ul>
			</section>

			<footer className="mt-auto flex items-center justify-between border-t border-grid pt-4 font-mono text-xs text-fg-mute">
				<span>v0.0.1</span>
				<Link
					href="https://github.com/albrp97/SmartMealPlanner"
					className="hover:text-fg"
					target="_blank"
					rel="noreferrer"
				>
					github.com/albrp97/SmartMealPlanner ↗
				</Link>
			</footer>
		</main>
	);
}
