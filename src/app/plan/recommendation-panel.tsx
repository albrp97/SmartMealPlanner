"use client";

/**
 * Recommendation panel for /plan (Phase 3.9).
 *
 * Two columns, one per slot. Each column shows the top N candidate
 * recipes ranked by `src/lib/recommend.ts`. Click "use as lunch/dinner"
 * to swap the suggestion into the slot via `swapOrAddPlanEntry`.
 *
 * Pure presentation — scoring + filtering happen server-side in
 * page.tsx. This component renders the result and wires the click
 * handlers via `useTransition` so the UI shows pending state.
 */

import { useTransition } from "react";
import { swapOrAddPlanEntry } from "./actions";

export interface RecommendationCard {
	id: string;
	name: string;
	categoryName: string;
	heroName: string | null;
	kcal: number;
	protein: number;
	costPerServing: number;
	reasons: string[];
}

interface SlotPanelProps {
	slot: "lunch" | "dinner";
	currentName: string | null;
	cards: RecommendationCard[];
}

function SlotPanel({ slot, currentName, cards }: SlotPanelProps) {
	const [pending, start] = useTransition();
	return (
		<section className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
			<header className="mb-2 flex items-baseline justify-between">
				<h3 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
					Suggestions · {slot}
				</h3>
				<p className="text-[11px] text-zinc-500">
					{currentName ? <>currently: {currentName}</> : <>no {slot} planned</>}
				</p>
			</header>
			{cards.length === 0 ? (
				<p className="text-xs text-zinc-500">no candidates — add some recipes first.</p>
			) : (
				<ul className="space-y-2">
					{cards.map((c) => (
						<li
							key={c.id}
							className={`rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 ${pending ? "opacity-60" : ""}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-zinc-100">{c.name}</p>
									<p className="font-mono text-[10px] text-zinc-500">
										{c.categoryName}
										{c.heroName ? ` · ${c.heroName}` : ""}
									</p>
								</div>
								<button
									type="button"
									disabled={pending}
									onClick={() => start(async () => void (await swapOrAddPlanEntry(slot, c.id)))}
									className="shrink-0 rounded border border-emerald-700 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
								>
									use as {slot}
								</button>
							</div>
							<p className="mt-1 font-mono text-[10px] text-zinc-500">
								{Math.round(c.kcal)} kcal · P {Math.round(c.protein)} ·{" "}
								{c.costPerServing.toFixed(1)} CZK/srv
							</p>
							{c.reasons.length > 0 && (
								<p className="mt-0.5 text-[10px] text-zinc-600">{c.reasons.join(" · ")}</p>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export interface RecommendationPanelProps {
	lunch: { currentName: string | null; cards: RecommendationCard[] };
	dinner: { currentName: string | null; cards: RecommendationCard[] };
}

export function RecommendationPanel({ lunch, dinner }: RecommendationPanelProps) {
	return (
		<section className="space-y-3">
			<header className="flex items-baseline justify-between">
				<h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
					Recommendations
				</h2>
				<p className="text-[11px] text-zinc-500">click to swap into the slot</p>
			</header>
			<div className="grid gap-3 sm:grid-cols-2">
				<SlotPanel slot="lunch" currentName={lunch.currentName} cards={lunch.cards} />
				<SlotPanel slot="dinner" currentName={dinner.currentName} cards={dinner.cards} />
			</div>
		</section>
	);
}
