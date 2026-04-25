"use client";

/**
 * Phase 3.6: per-goal ingredient quantity editor (inline on the recipe
 * detail page). Three columns — Cut · Maintain · Bulk — auto-save on blur.
 *
 * Maintain edits the baseline `recipe_ingredients.quantity`. Cut / Bulk
 * upsert into `recipe_ingredient_overrides`; clearing the field deletes
 * the override (line falls back to maintain). Setting it to 0 keeps the
 * override and means "skip this ingredient on this goal".
 */
import { useState, useTransition } from "react";
import { setIngredientBaselineQuantity, setIngredientOverride } from "../actions";

interface Row {
	id: string; // recipe_ingredient id
	name: string;
	unit: "g" | "ml" | "unit";
	role: "hero" | "side" | "fixed" | null;
	maintain: number;
	cut: number | null; // null = no override (falls back to maintain)
	bulk: number | null;
}

function roleClass(role: Row["role"]) {
	if (role === "hero") return "text-emerald-300";
	if (role === "fixed") return "text-amber-300";
	return "text-zinc-200";
}

function QtyInput({
	value,
	placeholder,
	disabled,
	allowEmpty,
	onCommit,
}: {
	value: number | null;
	placeholder?: string;
	disabled?: boolean;
	allowEmpty: boolean; // cut/bulk allow null (=delete override); maintain doesn't
	onCommit: (q: number | null) => void;
}) {
	const [local, setLocal] = useState<string>(value == null ? "" : String(value));
	return (
		<input
			type="number"
			step="any"
			min={0}
			disabled={disabled}
			value={local}
			placeholder={placeholder}
			onChange={(e) => setLocal(e.target.value)}
			onBlur={() => {
				if (local === "") {
					if (allowEmpty) onCommit(null);
					else setLocal(value == null ? "" : String(value));
					return;
				}
				const n = Number(local);
				if (!Number.isFinite(n) || n < 0) {
					setLocal(value == null ? "" : String(value));
					return;
				}
				if (n === value) return;
				onCommit(n);
			}}
			className="w-16 rounded border border-zinc-800 bg-zinc-950/40 px-1.5 py-0.5 text-right font-mono text-xs text-zinc-100 outline-none focus:border-zinc-600"
		/>
	);
}

export function GoalQuantitiesEditor({
	rows: initialRows,
	recipeSlug,
}: {
	rows: Row[];
	recipeSlug: string;
}) {
	const [rows, setRows] = useState(initialRows);
	const [pending, start] = useTransition();

	function patchRow(id: string, patch: Partial<Row>) {
		setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	}

	return (
		<section>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<h2 className="text-sm font-medium text-zinc-300">Per-goal quantities</h2>
				<p className="font-mono text-[10px] text-zinc-500">
					maintain = baseline · cut/bulk = override (blank = use maintain · 0 = skip)
				</p>
			</div>
			<div className="overflow-hidden rounded-lg border border-zinc-800">
				<div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
					<span>ingredient</span>
					<span className="text-right">cut</span>
					<span className="text-right">maintain</span>
					<span className="text-right">bulk</span>
					<span className="w-6 text-right">unit</span>
				</div>
				<ul className="divide-y divide-zinc-800">
					{rows.map((r) => (
						<li
							key={r.id}
							className={`grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-3 bg-zinc-900/30 px-3 py-1.5 ${
								pending ? "opacity-60" : ""
							}`}
						>
							<span className={`truncate text-sm ${roleClass(r.role)}`} title={r.role ?? "side"}>
								{r.name}
							</span>
							<QtyInput
								value={r.cut}
								placeholder="—"
								allowEmpty
								disabled={pending}
								onCommit={(q) => {
									patchRow(r.id, { cut: q });
									start(async () => {
										await setIngredientOverride(r.id, "cut", q, recipeSlug);
									});
								}}
							/>
							<QtyInput
								value={r.maintain}
								allowEmpty={false}
								disabled={pending}
								onCommit={(q) => {
									if (q == null) return;
									patchRow(r.id, { maintain: q });
									start(async () => {
										await setIngredientBaselineQuantity(r.id, q, recipeSlug);
									});
								}}
							/>
							<QtyInput
								value={r.bulk}
								placeholder="—"
								allowEmpty
								disabled={pending}
								onCommit={(q) => {
									patchRow(r.id, { bulk: q });
									start(async () => {
										await setIngredientOverride(r.id, "bulk", q, recipeSlug);
									});
								}}
							/>
							<span className="w-6 text-right font-mono text-[10px] text-zinc-500">{r.unit}</span>
						</li>
					))}
				</ul>
			</div>
			<p className="mt-2 font-mono text-[10px] text-zinc-500">
				<span className="text-emerald-300">hero</span> drives the planner's portion sizing ·{" "}
				<span className="text-zinc-200">side</span> scales linearly with hero ·{" "}
				<span className="text-amber-300">fixed</span> stays put.
			</p>
		</section>
	);
}
