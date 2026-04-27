"use client";

import { slugify } from "@/lib/slugify";
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

	const [name, setName] = useState(initial?.name ?? "");
	const [slug, setSlug] = useState(initial?.slug ?? "");
	const [slugTouched, setSlugTouched] = useState(mode === "edit");

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
				<div className="rounded-sm border border-rose/40 bg-rose/10 px-3 py-2 font-mono text-sm text-rose">
					{state.error}
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<Field
					label="Name"
					name="name"
					value={name}
					onChange={(v) => {
						setName(v);
						if (!slugTouched) setSlug(slugify(v));
					}}
					placeholder="chicken curry"
					hint="Display name. Example: chicken curry"
					error={err("name")}
					required
				/>
				<Field
					label="Slug"
					name="slug"
					value={slug}
					onChange={(v) => {
						setSlugTouched(true);
						setSlug(v);
					}}
					placeholder="chicken_curry"
					hint="URL-safe id (snake_case). Auto-filled from name. Example: chicken_curry"
					error={err("slug")}
					required
				/>
				<Field
					label="Category"
					name="category_id"
					defaultValue={initial?.category_id ?? ""}
					placeholder="main"
					hint="Free-form group. Example: main, side, breakfast"
					error={err("category_id")}
				/>
				<Select
					label="Meal type"
					name="meal_type"
					defaultValue={initial?.meal_type ?? "unknown"}
					options={MEAL_TYPES}
					hint="single_meal = eaten once; batch = leftovers planned"
					error={err("meal_type")}
				/>
				<Field
					label="Servings"
					name="servings"
					type="number"
					min="1"
					defaultValue={String(initial?.servings ?? 1)}
					placeholder="4"
					hint="How many portions the recipe yields. Example: 4"
					error={err("servings")}
					required
				/>
				<Field
					label="Prep (min)"
					name="prep_minutes"
					type="number"
					min="0"
					defaultValue={initial?.prep_minutes?.toString() ?? ""}
					placeholder="15"
					hint="Hands-on time before cooking, in minutes"
					error={err("prep_minutes")}
				/>
				<Field
					label="Cook (min)"
					name="cook_minutes"
					type="number"
					min="0"
					defaultValue={initial?.cook_minutes?.toString() ?? ""}
					placeholder="25"
					hint="Time on the stove / in the oven, in minutes"
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
					<h2 className="font-mono text-sm text-fg">
						<span className="text-accent">▣</span> ingredients{" "}
						<span className="text-xs text-fg-mute">({lines.length})</span>
					</h2>
					<button
						type="button"
						onClick={addLine}
						className="inline-flex min-h-[36px] items-center rounded-sm border border-grid bg-bg-sunk px-3 py-1 font-mono text-xs text-fg-dim hover:border-fg-mute hover:text-fg"
					>
						+ add row
					</button>
				</div>
				{lines.length === 0 ? (
					<p className="rounded-sm border border-dashed border-grid px-3 py-4 text-center font-mono text-xs text-fg-mute">
						no ingredients yet — tap <span className="text-fg">+ add row</span>.
					</p>
				) : (
					<ul className="space-y-2">
						{lines.map((l, idx) => (
							<li
								// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id until persisted
								key={idx}
								className="grid grid-cols-12 items-end gap-2 rounded-sm border border-grid bg-bg-elev px-2 py-2"
							>
								<label className="col-span-12 block sm:col-span-5">
									<span className="block font-mono text-[10px] uppercase tracking-widest text-fg-mute">
										ingredient
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
										className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-2 py-1 font-mono text-base text-fg outline-none focus:border-accent"
									>
										{options.map((o) => (
											<option key={o.id} value={o.id}>
												{o.name}
											</option>
										))}
									</select>
								</label>
								<label className="col-span-4 block sm:col-span-2">
									<span className="block font-mono text-[10px] uppercase tracking-widest text-fg-mute">
										qty
									</span>
									<input
										type="number"
										inputMode="decimal"
										step="0.01"
										min="0"
										value={l.quantity}
										onChange={(e) => updateLine(idx, { quantity: e.target.value })}
										className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-2 py-1 font-mono text-base text-fg outline-none focus:border-accent"
									/>
								</label>
								<label className="col-span-3 block sm:col-span-2">
									<span className="block font-mono text-[10px] uppercase tracking-widest text-fg-mute">
										unit
									</span>
									<select
										value={l.unit}
										onChange={(e) =>
											updateLine(idx, { unit: e.target.value as "g" | "ml" | "unit" })
										}
										className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-2 py-1 font-mono text-base text-fg outline-none focus:border-accent"
									>
										{PACKAGE_UNITS.map((u) => (
											<option key={u} value={u}>
												{u}
											</option>
										))}
									</select>
								</label>
								<label className="col-span-4 block sm:col-span-2">
									<span className="block font-mono text-[10px] uppercase tracking-widest text-fg-mute">
										note
									</span>
									<input
										type="text"
										value={l.notes}
										onChange={(e) => updateLine(idx, { notes: e.target.value })}
										className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-2 py-1 font-mono text-base text-fg outline-none focus:border-accent"
									/>
								</label>
								<button
									type="button"
									onClick={() => removeLine(idx)}
									aria-label="Remove ingredient row"
									className="col-span-1 inline-flex min-h-[40px] items-center justify-center rounded-sm border border-grid bg-bg-sunk px-2 py-1 font-mono text-sm text-fg-dim hover:border-rose hover:text-rose"
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
					className="inline-flex min-h-[40px] items-center rounded-sm border border-accent/60 bg-accent/10 px-4 py-1.5 font-mono text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
				>
					{pending ? "saving…" : mode === "edit" ? "save changes" : "create recipe"}
				</button>
				<a
					href="/recipes"
					className="inline-flex min-h-[40px] items-center rounded-sm border border-grid bg-bg-sunk px-4 py-1.5 font-mono text-sm text-fg-dim hover:border-fg-mute hover:text-fg"
				>
					cancel
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
	value?: string;
	onChange?: (v: string) => void;
	placeholder?: string;
	hint?: string;
	error?: string;
}) {
	const controlled = props.value !== undefined && props.onChange !== undefined;
	const numeric = props.type === "number";
	return (
		<label className="block space-y-1">
			<span className="block font-mono text-xs uppercase tracking-widest text-fg-dim">
				{props.label}
				{props.required ? <span className="text-rose"> *</span> : null}
			</span>
			<input
				name={props.name}
				type={props.type ?? "text"}
				inputMode={numeric ? "decimal" : undefined}
				min={props.min}
				placeholder={props.placeholder}
				{...(controlled
					? { value: props.value, onChange: (e) => props.onChange?.(e.target.value) }
					: { defaultValue: props.defaultValue })}
				required={props.required}
				className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-3 py-1.5 font-mono text-base text-fg outline-none focus:border-accent"
			/>
			{props.hint && !props.error ? (
				<span className="block font-mono text-[11px] text-fg-mute">{props.hint}</span>
			) : null}
			{props.error ? (
				<span className="block font-mono text-xs text-rose">{props.error}</span>
			) : null}
		</label>
	);
}

function Select(props: {
	label: string;
	name: string;
	defaultValue: string;
	options: readonly string[];
	hint?: string;
	error?: string;
}) {
	return (
		<label className="block space-y-1">
			<span className="block font-mono text-xs uppercase tracking-widest text-fg-dim">
				{props.label}
			</span>
			<select
				name={props.name}
				defaultValue={props.defaultValue}
				className="w-full min-h-[40px] rounded-sm border border-grid bg-bg-sunk px-3 py-1.5 font-mono text-base text-fg outline-none focus:border-accent"
			>
				{props.options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
			{props.hint && !props.error ? (
				<span className="block font-mono text-[11px] text-fg-mute">{props.hint}</span>
			) : null}
			{props.error ? (
				<span className="block font-mono text-xs text-rose">{props.error}</span>
			) : null}
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
			<span className="block font-mono text-xs uppercase tracking-widest text-fg-dim">
				{props.label}
			</span>
			<textarea
				name={props.name}
				defaultValue={props.defaultValue}
				rows={props.rows ?? 3}
				className="w-full rounded-sm border border-grid bg-bg-sunk px-3 py-1.5 font-mono text-base text-fg outline-none focus:border-accent"
			/>
			{props.error ? (
				<span className="block font-mono text-xs text-rose">{props.error}</span>
			) : null}
		</label>
	);
}
