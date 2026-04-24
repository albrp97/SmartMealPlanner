"use client";

import { MEAL_TYPES, PACKAGE_UNITS } from "@/lib/validators";
import { useActionState, useState } from "react";
import { type RecipeActionResult, createRecipe, updateRecipe } from "./actions";

export interface IngredientOption {
	id: string;
	name: string;
	package_unit: "g" | "ml" | "unit";
}

export interface RecipeInitial {
	id: string;
	slug: string;
	name: string;
	category_id: string | null;
	servings: number;
	meal_type: "single_meal" | "batch" | "unknown";
	prep_minutes: number | null;
	cook_minutes: number | null;
	instructions_md: string | null;
	notes: string | null;
	ingredients: {
		ingredient_id: string;
		quantity: number;
		unit: "g" | "ml" | "unit";
		notes: string | null;
	}[];
}

interface Line {
	ingredient_id: string;
	quantity: string;
	unit: "g" | "ml" | "unit";
	notes: string;
}

const INITIAL_RESULT: RecipeActionResult = { ok: true };

export function RecipeForm({
	mode,
	options,
	initial,
}: {
	mode: "create" | "edit";
	options: IngredientOption[];
	initial?: RecipeInitial;
}) {
	const action = mode === "edit" && initial ? updateRecipe.bind(null, initial.id) : createRecipe;
	const [state, formAction, pending] = useActionState(action, INITIAL_RESULT);

	const [lines, setLines] = useState<Line[]>(
		initial?.ingredients.map((l) => ({
			ingredient_id: l.ingredient_id,
			quantity: String(l.quantity),
			unit: l.unit,
			notes: l.notes ?? "",
		})) ?? [],
	);

	function addLine() {
		const first = options[0];
		setLines((prev) => [
			...prev,
			{
				ingredient_id: first?.id ?? "",
				quantity: "1",
				unit: first?.package_unit ?? "g",
				notes: "",
			},
		]);
	}
	function removeLine(idx: number) {
		setLines((prev) => prev.filter((_, i) => i !== idx));
	}
	function updateLine(idx: number, patch: Partial<Line>) {
		setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
	}

	const ingredientsJson = JSON.stringify(
		lines.map((l) => ({
			ingredient_id: l.ingredient_id,
			quantity: Number(l.quantity),
			unit: l.unit,
			notes: l.notes.trim() === "" ? undefined : l.notes,
		})),
	);

	const fe = state.fieldErrors ?? {};
	const err = (key: string) => fe[key]?.[0];

	return (
		<form action={formAction} className="space-y-6">
			<input type="hidden" name="ingredients_json" value={ingredientsJson} />

			{state.error ? (
				<div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
					{state.error}
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field label="Name" name="name" defaultValue={initial?.name} error={err("name")} required />
				<Field label="Slug" name="slug" defaultValue={initial?.slug} error={err("slug")} required />
				<Field
					label="Category"
					name="category_id"
					defaultValue={initial?.category_id ?? ""}
					error={err("category_id")}
				/>
				<Select
					label="Meal type"
					name="meal_type"
					defaultValue={initial?.meal_type ?? "unknown"}
					options={MEAL_TYPES}
					error={err("meal_type")}
				/>
				<Field
					label="Servings"
					name="servings"
					type="number"
					min="1"
					defaultValue={String(initial?.servings ?? 1)}
					error={err("servings")}
					required
				/>
				<Field
					label="Prep (min)"
					name="prep_minutes"
					type="number"
					min="0"
					defaultValue={initial?.prep_minutes?.toString() ?? ""}
					error={err("prep_minutes")}
				/>
				<Field
					label="Cook (min)"
					name="cook_minutes"
					type="number"
					min="0"
					defaultValue={initial?.cook_minutes?.toString() ?? ""}
					error={err("cook_minutes")}
				/>
			</div>

			<TextArea
				label="Instructions (Markdown)"
				name="instructions_md"
				defaultValue={initial?.instructions_md ?? ""}
				error={err("instructions_md")}
				rows={6}
			/>
			<TextArea
				label="Notes"
				name="notes"
				defaultValue={initial?.notes ?? ""}
				error={err("notes")}
			/>

			<section>
				<div className="mb-2 flex items-center justify-between">
					<h2 className="text-sm font-medium text-zinc-300">
						Ingredients <span className="text-xs text-zinc-500">({lines.length})</span>
					</h2>
					<button
						type="button"
						onClick={addLine}
						className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
					>
						+ Add row
					</button>
				</div>
				{lines.length === 0 ? (
					<p className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-center text-xs text-zinc-500">
						No ingredients yet — click <span className="text-zinc-300">+ Add row</span>.
					</p>
				) : (
					<ul className="space-y-2">
						{lines.map((l, idx) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id until persisted
								key={idx}
								className="grid grid-cols-12 items-end gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-2 py-2"
							>
								<label className="col-span-5 block">
									<span className="block text-[10px] uppercase tracking-wider text-zinc-500">
										Ingredient
									</span>
									<select
										value={l.ingredient_id}
										onChange={(e) => {
											const id = e.target.value;
											const opt = options.find((o) => o.id === id);
											updateLine(idx, {
												ingredient_id: id,
												unit: opt?.package_unit ?? l.unit,
											});
										}}
										className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
									>
										{options.map((o) => (
											<option key={o.id} value={o.id}>
												{o.name}
											</option>
										))}
									</select>
								</label>
								<label className="col-span-2 block">
									<span className="block text-[10px] uppercase tracking-wider text-zinc-500">
										Qty
									</span>
									<input
										type="number"
										step="0.01"
										min="0"
										value={l.quantity}
										onChange={(e) => updateLine(idx, { quantity: e.target.value })}
										className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
									/>
								</label>
								<label className="col-span-2 block">
									<span className="block text-[10px] uppercase tracking-wider text-zinc-500">
										Unit
									</span>
									<select
										value={l.unit}
										onChange={(e) =>
											updateLine(idx, { unit: e.target.value as "g" | "ml" | "unit" })
										}
										className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
									>
										{PACKAGE_UNITS.map((u) => (
											<option key={u} value={u}>
												{u}
											</option>
										))}
									</select>
								</label>
								<label className="col-span-2 block">
									<span className="block text-[10px] uppercase tracking-wider text-zinc-500">
										Note
									</span>
									<input
										type="text"
										value={l.notes}
										onChange={(e) => updateLine(idx, { notes: e.target.value })}
										className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-zinc-500"
									/>
								</label>
								<button
									type="button"
									onClick={() => removeLine(idx)}
									className="col-span-1 rounded-md border border-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900/20"
								>
									×
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			<div className="flex items-center gap-2 pt-2">
				<button
					type="submit"
					disabled={pending}
					className="rounded-md border border-emerald-700 bg-emerald-600/20 px-4 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
				>
					{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create recipe"}
				</button>
				<a
					href="/recipes"
					className="rounded-md border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:border-zinc-500"
				>
					Cancel
				</a>
			</div>
		</form>
	);
}

function Field(props: {
	label: string;
	name: string;
	type?: string;
	min?: string;
	required?: boolean;
	defaultValue?: string;
	error?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs uppercase tracking-wider text-zinc-400">
				{props.label}
				{props.required ? <span className="text-red-400"> *</span> : null}
			</span>
			<input
				name={props.name}
				type={props.type ?? "text"}
				min={props.min}
				defaultValue={props.defaultValue}
				required={props.required}
				className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
			/>
			{props.error ? <span className="block text-xs text-red-400">{props.error}</span> : null}
		</label>
	);
}

function Select(props: {
	label: string;
	name: string;
	defaultValue: string;
	options: readonly string[];
	error?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs uppercase tracking-wider text-zinc-400">{props.label}</span>
			<select
				name={props.name}
				defaultValue={props.defaultValue}
				className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
			>
				{props.options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
			{props.error ? <span className="block text-xs text-red-400">{props.error}</span> : null}
		</label>
	);
}

function TextArea(props: {
	label: string;
	name: string;
	defaultValue?: string;
	error?: string;
	rows?: number;
}) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs uppercase tracking-wider text-zinc-400">{props.label}</span>
			<textarea
				name={props.name}
				defaultValue={props.defaultValue}
				rows={props.rows ?? 3}
				className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
			/>
			{props.error ? <span className="block text-xs text-red-400">{props.error}</span> : null}
		</label>
	);
}
