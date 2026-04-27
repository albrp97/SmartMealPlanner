"use client";

/**
 * Auto-saving planner controls (Phase 3.5).
 *
 * Each plan entry stores **hero packs** in `meal_plan_entries.servings`.
 * The page derives servings cooked + macros + the shopping list from that.
 *
 * - `<RecipePicker>`: typing-filter combobox grouped by category.
 * - `<PlanEntryRow>`: shows the recipe + packs input + the resulting
 *   servings/macros for the cook. The label below the input names the
 *   hero ingredient (e.g. "× 1 chicken pack (1000 g)").
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { addPlanEntry, deletePlanEntry, updatePacks, updateRecipe } from "./actions";

/**
 * Render a recipe-line quantity. Whole numbers print without a decimal
 * tail (so non-divisible `unit` lines show "2 unit", not "2.0 unit");
 * fractional quantities round to one decimal. Callers are expected to
 * have already filtered out zero-quantity lines — this never returns "0".
 */
function formatQty(q: number): string {
	if (!Number.isFinite(q)) return "—";
	const rounded = Math.round(q * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export interface PickerRecipe {
	id: string;
	name: string;
	category: string;
	servings: number;
	kcal: number;
	protein: number;
	carbs: number;
	fat: number;
	heroName: string | null;
	heroPackageSize: number | null;
	heroPackageUnit: "g" | "ml" | "unit" | null;
	heroPerServing: number | null;
}

interface PickerProps {
	recipes: PickerRecipe[];
	value: string;
	placeholder: string;
	disabled?: boolean;
	onPick: (recipeId: string) => void;
}

function RecipePicker({ recipes, value, placeholder, disabled, onPick }: PickerProps) {
	const selected = recipes.find((r) => r.id === value);
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onDoc(e: MouseEvent) {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, [open]);

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		const list = needle
			? recipes.filter(
					(r) =>
						r.name.toLowerCase().includes(needle) ||
						r.category.toLowerCase().includes(needle),
				)
			: recipes;
		const groups = new Map<string, PickerRecipe[]>();
		for (const r of list) {
			const arr = groups.get(r.category) ?? [];
			arr.push(r);
			groups.set(r.category, arr);
		}
		return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
	}, [q, recipes]);

	return (
		<div ref={wrapRef} className="relative min-w-[180px] flex-1">
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="listbox"
				aria-expanded={open}
				className="flex min-h-[40px] w-full items-center justify-between rounded-sm border border-grid bg-bg-sunk px-3 py-2 text-left font-mono text-sm text-fg hover:border-fg-mute"
			>
				<span className={selected ? "" : "text-fg-mute"}>
					{selected ? selected.name : placeholder}
				</span>
				<span aria-hidden className="ml-2 text-xs text-fg-mute">
					▾
				</span>
			</button>
			{open && (
				<div
					role="listbox"
					className="absolute left-0 top-full z-30 mt-1 w-[min(20rem,92vw)] max-h-[60vh] overflow-hidden rounded-sm border border-grid bg-bg shadow-2xl"
				>
					<input
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="type to filter…"
						aria-label="filter recipes"
						className="w-full border-b border-grid bg-bg-sunk px-3 py-2 text-base text-fg outline-none placeholder:text-fg-mute"
					/>
					<div className="max-h-[50vh] overflow-y-auto">
						{filtered.length === 0 ? (
							<p className="px-3 py-3 font-mono text-xs text-fg-mute">no recipes match</p>
						) : (
							filtered.map(([cat, items]) => (
								<div key={cat}>
									<p className="sticky top-0 bg-bg/95 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-fg-mute">
										{cat}
									</p>
									{items.map((r) => (
										<button
											type="button"
											key={r.id}
											role="option"
											aria-selected={r.id === value}
											onClick={() => {
												setOpen(false);
												setQ("");
												onPick(r.id);
											}}
											className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-sm hover:bg-bg-sunk ${
												r.id === value ? "bg-accent/10 text-accent" : "text-fg"
											}`}
										>
											<span className="truncate">{r.name}</span>
											<span className="font-mono text-[10px] text-fg-mute">
												{Math.round(r.kcal)} kcal
											</span>
										</button>
									))}
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}

export function AddPlanEntry({
	slot,
	recipes,
}: {
	slot: "lunch" | "dinner";
	recipes: PickerRecipe[];
}) {
	const [pending, start] = useTransition();
	return (
		<RecipePicker
			recipes={recipes}
			value=""
			placeholder={`+ add ${slot}…`}
			disabled={pending}
			onPick={(id) => start(async () => void (await addPlanEntry(slot, id)))}
		/>
	);
}

export function PlanEntryRow({
	id,
	recipeId,
	recipeSlug,
	packs,
	servings,
	totalKcal,
	totalP,
	totalC,
	totalF,
	scaledLines,
	recipes,
}: {
	id: string;
	recipeId: string;
	recipeSlug: string;
	packs: number;
	servings: number;
	totalKcal: number;
	totalP: number;
	totalC: number;
	totalF: number;
	scaledLines: { name: string; quantity: number; unit: "g" | "ml" | "unit"; role: "hero" | "side" | "fixed" }[];
	recipes: PickerRecipe[];
}) {
	const [pending, start] = useTransition();
	const [localPacks, setLocalPacks] = useState(packs);
	const [open, setOpen] = useState(false);
	useEffect(() => setLocalPacks(packs), [packs]);

	const r = recipes.find((x) => x.id === recipeId);
	const heroLabel = r?.heroName
		? `${r.heroName.toLowerCase()} pack${localPacks === 1 ? "" : "s"} · ${r.heroPackageSize}${r.heroPackageUnit}`
		: `× recipe (default ${r?.servings ?? 0} srv)`;

	const servingsLabel = servings % 1 === 0 ? servings.toString() : servings.toFixed(1);
	const kcalPerServing = servings > 0 ? Math.round(totalKcal / servings) : 0;
	const pPS = servings > 0 ? Math.round(totalP / servings) : 0;
	const cPS = servings > 0 ? Math.round(totalC / servings) : 0;
	const fPS = servings > 0 ? Math.round(totalF / servings) : 0;

	return (
		<div
			className={`rounded-sm border border-grid bg-bg-elev ${pending ? "opacity-60" : ""}`}
		>
			<div className="flex flex-wrap items-center gap-2 px-2 py-2">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
					aria-label={open ? "Hide ingredients" : "Show ingredients"}
					className="flex h-9 w-9 items-center justify-center rounded-sm font-mono text-sm text-fg-dim hover:bg-bg-sunk hover:text-fg"
				>
					{open ? "▾" : "▸"}
				</button>
				<RecipePicker
					recipes={recipes}
					value={recipeId}
					placeholder="pick recipe…"
					disabled={pending}
					onPick={(newId) => start(async () => void (await updateRecipe(id, newId)))}
				/>
				<label className="flex items-center gap-1 font-mono text-xs text-fg-dim">
					<span aria-hidden>×</span>
					<span className="sr-only">hero packs</span>
					<input
						type="number"
						inputMode="numeric"
						min={1}
						step={1}
						disabled={pending}
						value={localPacks}
						onChange={(e) => {
							const v = Number(e.target.value);
							if (!Number.isFinite(v) || v < 1) return;
							setLocalPacks(v);
							start(async () => void (await updatePacks(id, v)));
						}}
						className="min-h-[40px] w-16 rounded-sm border border-grid bg-bg-sunk px-2 py-1 text-right font-mono text-base text-fg"
					/>
					<span className="hidden sm:inline">{heroLabel}</span>
				</label>
				<span
					className="font-mono text-[11px] text-fg-dim"
					title="per-serving macros at the current goal"
				>
					→ {servingsLabel} srv · {kcalPerServing} kcal · P{pPS} C{cPS} F{fPS}
				</span>
				<button
					type="button"
					disabled={pending}
					onClick={() => start(async () => void (await deletePlanEntry(id)))}
					aria-label="Remove this entry"
					className="ml-auto inline-flex h-9 min-w-[40px] items-center justify-center rounded-sm border border-grid bg-bg-sunk px-2 font-mono text-sm text-fg-dim hover:border-rose hover:text-rose"
				>
					✕
				</button>
			</div>
			{open && (
				<div className="border-t border-grid bg-bg-sunk px-3 py-3">
					<div className="mb-2 flex items-baseline justify-between">
						<p className="font-mono text-[10px] uppercase tracking-widest text-fg-mute">
							cook · {servingsLabel} srv
						</p>
						<Link
							href={`/recipes/${recipeSlug}`}
							className="font-mono text-[10px] text-fg-dim hover:text-fg"
						>
							recipe ↗
						</Link>
					</div>
					<ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
						{scaledLines
							.filter((sl) => sl.quantity > 0)
							.map((sl) => (
								<li
									key={sl.name}
									className="flex items-baseline justify-between gap-2 font-mono text-[11px]"
								>
									<span
										className={
											sl.role === "hero"
												? "text-accent"
												: sl.role === "fixed"
													? "text-amber"
													: "text-fg"
										}
										title={sl.role}
									>
										<span aria-hidden className="mr-1">
											{sl.role === "hero" ? "◆" : sl.role === "fixed" ? "▣" : "◇"}
										</span>
										{sl.name}
									</span>
									<span className="text-fg-dim">
										{formatQty(sl.quantity)} {sl.unit}
									</span>
								</li>
							))}
					</ul>
					<p className="mt-2 font-mono text-[10px] text-fg-mute">
						<span className="text-accent">◆ hero</span> drives sizing ·{" "}
						<span className="text-fg">◇ side</span> scales with goal ·{" "}
						<span className="text-amber">▣ fixed</span> stays put
					</p>
				</div>
			)}
		</div>
	);
}
