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
import { Surface } from "@/components/ui/surface";
import { TermHeading } from "@/components/ui/term-heading";
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
		<Surface aria-label={`Suggestions for ${slot}`} className="p-4">
			<header className="mb-2 flex items-baseline justify-between">
				<TermHeading level={3} prompt="?">
					sugg · {slot}
				</TermHeading>
				<p className="font-mono text-[11px] text-fg-mute">
					{currentName ? <>now: {currentName}</> : <>{slot}: empty</>}
				</p>
			</header>
			{cards.length === 0 ? (
				<p className="font-mono text-xs text-fg-dim">no candidates — add some recipes first.</p>
			) : (
				<ul className="space-y-2">
					{cards.map((c) => (
						<li
							key={c.id}
							className={`border border-grid bg-bg-sunk px-3 py-2 ${pending ? "opacity-60" : ""}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm text-fg">{c.name}</p>
									<p className="font-mono text-[10px] text-fg-mute">
										{c.categoryName}
										{c.heroName ? ` · ${c.heroName}` : ""}
									</p>
								</div>
								<button
									type="button"
									disabled={pending}
									onClick={() =>
										start(async () => void (await swapOrAddPlanEntry(slot, c.id)))
									}
									className="shrink-0 rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-accent hover:bg-accent/20 disabled:opacity-50 min-h-[36px]"
								>
									use → {slot}
								</button>
							</div>
							<p className="mt-1 font-mono text-[10px] text-fg-dim">
								{Math.round(c.kcal)} kcal · P {Math.round(c.protein)} ·{" "}
								{c.costPerServing.toFixed(1)} CZK/srv
							</p>
							{c.reasons.length > 0 && (
								<p className="mt-0.5 font-mono text-[10px] text-fg-mute">
									{c.reasons.join(" · ")}
								</p>
							)}
						</li>
					))}
				</ul>
			)}
		</Surface>
	);
}

export interface RecommendationPanelProps {
	lunch: { currentName: string | null; cards: RecommendationCard[] };
	dinner: { currentName: string | null; cards: RecommendationCard[] };
}

export function RecommendationPanel({ lunch, dinner }: RecommendationPanelProps) {
	return (
		<section aria-label="Recommendations" className="space-y-3">
			<header className="flex items-baseline justify-between">
				<TermHeading level={2} prompt="$">
					recommendations
				</TermHeading>
				<p className="font-mono text-[11px] text-fg-mute">click → swap into slot</p>
			</header>
			<div className="grid gap-3 sm:grid-cols-2">
				<SlotPanel slot="lunch" currentName={lunch.currentName} cards={lunch.cards} />
				<SlotPanel slot="dinner" currentName={dinner.currentName} cards={dinner.cards} />
			</div>
		</section>
	);
}
