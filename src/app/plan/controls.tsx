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
				className="flex w-full items-center justify-between rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-left text-sm text-zinc-100 hover:border-zinc-600"
			>
				<span className={selected ? "" : "text-zinc-500"}>
					{selected ? selected.name : placeholder}
				</span>
				<span className="ml-2 text-xs text-zinc-500">▾</span>
			</button>
			{open && (
				<div className="absolute left-0 top-full z-20 mt-1 w-[20rem] max-w-[80vw] rounded-md border border-zinc-700 bg-zinc-950 shadow-xl">
					<input
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="type to filter…"
						className="w-full rounded-t-md border-b border-zinc-800 bg-transparent px-2 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
					/>
					<div className="max-h-72 overflow-y-auto">
						{filtered.length === 0 ? (
							<p className="px-3 py-3 text-xs text-zinc-500">no recipes match</p>
						) : (
							filtered.map(([cat, items]) => (
								<div key={cat}>
									<p className="sticky top-0 bg-zinc-950/95 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
										{cat}
									</p>
									{items.map((r) => (
										<button
											type="button"
											key={r.id}
											onClick={() => {
												setOpen(false);
												setQ("");
												onPick(r.id);
											}}
											className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-zinc-900 ${
												r.id === value
													? "bg-emerald-500/10 text-emerald-200"
													: "text-zinc-100"
											}`}
										>
											<span className="truncate">{r.name}</span>
											<span className="font-mono text-[10px] text-zinc-500">
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
			className={`rounded border border-zinc-800 bg-zinc-900/40 ${pending ? "opacity-60" : ""}`}
		>
			<div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					className="flex h-6 w-6 items-center justify-center rounded text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
					title={open ? "Hide ingredients" : "Show ingredients"}
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
				<label className="flex items-center gap-1 font-mono text-xs text-zinc-400">
					×
					<input
						type="number"
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
						className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right text-sm text-zinc-100"
					/>
					<span className="hidden sm:inline">{heroLabel}</span>
				</label>
				<span
					className="font-mono text-[11px] text-zinc-400"
					title="per-serving macros at the current goal"
				>
					→ {servingsLabel} srv · {kcalPerServing} kcal/srv · P{pPS} C{cPS} F{fPS}
				</span>
				<button
					type="button"
					disabled={pending}
					onClick={() => start(async () => void (await deletePlanEntry(id)))}
					className="ml-auto rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 hover:border-rose-700 hover:text-rose-300"
					title="Remove"
				>
					✕
				</button>
			</div>
			{open && (
				<div className="border-t border-zinc-800 bg-zinc-950/40 px-2 py-2">
					<div className="mb-1 flex items-baseline justify-between">
						<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
							whole cook · {servingsLabel} servings
						</p>
						<Link
							href={`/recipes/${recipeSlug}`}
							className="font-mono text-[10px] text-zinc-400 hover:text-zinc-200"
						>
							recipe →
						</Link>
					</div>
					<ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
						{scaledLines.map((sl) => (
							<li
								key={sl.name}
								className="flex items-baseline justify-between gap-2 font-mono text-[11px]"
							>
								<span
									className={
										sl.role === "hero"
											? "text-emerald-300"
											: sl.role === "fixed"
												? "text-amber-300"
												: "text-zinc-200"
									}
									title={sl.role}
								>
									{sl.name}
								</span>
								<span className="text-zinc-400">
									{sl.quantity.toFixed(sl.unit === "unit" ? 1 : 0)} {sl.unit}
								</span>
							</li>
						))}
					</ul>
					<p className="mt-2 font-mono text-[10px] text-zinc-500">
						<span className="text-emerald-300">hero</span> drives sizing ·{" "}
						<span className="text-zinc-200">side</span> scales with goal ·{" "}
						<span className="text-amber-300">fixed</span> stays put
					</p>
				</div>
			)}
		</div>
	);
}
