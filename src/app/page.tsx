import { type PhaseStatus, phaseStatuses } from "@/lib/phases";
import Link from "next/link";

const statusStyles: Record<PhaseStatus, string> = {
	"in-progress": "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
	next: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
	todo: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
	done: "bg-sky-500/10 text-sky-400 ring-sky-500/30",
};

export default function Home() {
	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
			<header className="space-y-2">
				<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
					Phase 1 · Catalogue
				</p>
				<h1 className="text-3xl font-semibold tracking-tight">SmartMealPlanner</h1>
				<p className="text-zinc-400 text-sm leading-relaxed">
					Personal meal planning, recipe costing, macro & micronutrient tracking, and grocery
					shopping automation — with receipt-photo price ingestion powered by an LLM.
				</p>
			</header>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-zinc-300">Roadmap</h2>
				<ul className="space-y-2">
					{phaseStatuses.map((phase) => (
						<li
							key={phase.id}
							className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
						>
							<div className="space-y-0.5">
								<p className="text-sm font-medium text-zinc-100">
									Phase {phase.id} — {phase.title}
								</p>
								<p className="text-xs text-zinc-500">{phase.desc}</p>
							</div>
							<span
								className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1 ring-inset ${statusStyles[phase.status]}`}
							>
								{phase.status}
							</span>
						</li>
					))}
				</ul>
			</section>

			<footer className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-500">
				<span>v0.0.1</span>
				<Link
					href="https://github.com/albrp97/SmartMealPlanner"
					className="hover:text-zinc-300"
					target="_blank"
					rel="noreferrer"
				>
					github.com/albrp97/SmartMealPlanner →
				</Link>
			</footer>
		</main>
	);
}
