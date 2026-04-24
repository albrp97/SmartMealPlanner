/**
 * Reusable add/edit form for an ingredient.
 *
 * Uses React 19's `useActionState` to wire a Server Action without any client
 * fetch boilerplate. The action returns either `{ok:false, error|fieldErrors}`
 * for inline display, or it `redirect()`s on success (which throws past us).
 *
 * The nutrition section is populated from a "Lookup" button that calls
 * `lookupNutritionAction` (OpenFoodFacts behind the scenes). Those five fields
 * are controlled via `useState` so the lookup can prefill them; everything
 * else stays uncontrolled to keep the diff minimal.
 */
"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { slugify } from "@/lib/slugify";
import { useActionState, useState, useTransition } from "react";
import {
	type ActionResult,
	createIngredient,
	lookupNutritionAction,
	updateIngredient,
} from "./actions";
import type { IngredientRow } from "./types";

interface Props {
	mode: "create" | "edit";
	initial?: IngredientRow;
}

const INITIAL: ActionResult = { ok: true };

interface NutritionState {
	kcal_per_100g: string;
	protein_per_100g: string;
	carbs_per_100g: string;
	fat_per_100g: string;
	fiber_per_100g: string;
}

function nutritionFromInitial(initial?: IngredientRow): NutritionState {
	const v = (n: number | null | undefined) => (n == null ? "" : String(n));
	return {
		kcal_per_100g: v(initial?.kcal_per_100g),
		protein_per_100g: v(initial?.protein_per_100g),
		carbs_per_100g: v(initial?.carbs_per_100g),
		fat_per_100g: v(initial?.fat_per_100g),
		fiber_per_100g: v(initial?.fiber_per_100g),
	};
}

interface LookupHint {
	matched_product_name: string;
	matched_product_brand: string | null;
	off_url: string;
}

export function IngredientForm({ mode, initial }: Props) {
	const action =
		mode === "edit" && initial ? updateIngredient.bind(null, initial.id) : createIngredient;
	const [state, formAction, pending] = useActionState(action, INITIAL);
	const [name, setName] = useState(initial?.name ?? "");
	const [slug, setSlug] = useState(initial?.slug ?? "");
	// Track whether the user has manually touched the slug. Until they do, we
	// keep the slug in sync with `slugify(name)` so creating ingredients is
	// effectively one-field.
	const [slugTouched, setSlugTouched] = useState(mode === "edit");
	const [nutrition, setNutrition] = useState<NutritionState>(() => nutritionFromInitial(initial));
	const [lookupHint, setLookupHint] = useState<LookupHint | null>(null);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const [lookupPending, startLookup] = useTransition();

	const fe = state.fieldErrors ?? {};
	const err = (key: string) => fe[key]?.[0];

	function onLookup() {
		const q = name.trim();
		if (q.length < 2) {
			setLookupError("Enter a name first");
			setLookupHint(null);
			return;
		}
		setLookupError(null);
		startLookup(async () => {
			const result = await lookupNutritionAction(q);
			if (!result.ok) {
				setLookupError(result.error);
				setLookupHint(null);
				return;
			}
			if (!result.hit) {
				setLookupError("No match found on OpenFoodFacts");
				setLookupHint(null);
				return;
			}
			const h = result.hit;
			const fmt = (n: number | null) => (n == null ? "" : String(n));
			setNutrition({
				kcal_per_100g: fmt(h.kcal_per_100g),
				protein_per_100g: fmt(h.protein_per_100g),
				carbs_per_100g: fmt(h.carbs_per_100g),
				fat_per_100g: fmt(h.fat_per_100g),
				fiber_per_100g: fmt(h.fiber_per_100g),
			});
			setLookupHint({
				matched_product_name: h.matched_product_name,
				matched_product_brand: h.matched_product_brand,
				off_url: h.off_url,
			});
		});
	}

	function setNut(k: keyof NutritionState, v: string) {
		setNutrition((s) => ({ ...s, [k]: v }));
	}

	return (
		<form action={formAction} className="space-y-6">
			{state.error ? (
				<div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
					{state.error}
				</div>
			) : null}

			<Card>
				<CardHeader>
					<div>
						<CardTitle>Basics</CardTitle>
						<CardDescription>Identity, packaging, price.</CardDescription>
					</div>
				</CardHeader>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<FormRow
						label="Name"
						required
						hint="Display name. Example: chicken breast"
						error={err("name")}
					>
						<Input
							name="name"
							value={name}
							onChange={(e) => {
								const v = e.target.value;
								setName(v);
								if (!slugTouched) setSlug(slugify(v));
							}}
							placeholder="chicken breast"
							required
						/>
					</FormRow>
					<FormRow
						label="Slug"
						required
						hint="URL-safe id (snake_case). Auto-filled from name. Example: chicken_breast"
						error={err("slug")}
					>
						<Input
							name="slug"
							value={slug}
							onChange={(e) => {
								setSlugTouched(true);
								setSlug(e.target.value);
							}}
							placeholder="chicken_breast"
							pattern="^[a-z0-9_]+$"
							required
						/>
					</FormRow>

					<FormRow
						label="Category"
						hint="Free-form group. Example: meat, vegetable, supplement"
						error={err("category_id")}
					>
						<Input
							name="category_id"
							defaultValue={initial?.category_id ?? ""}
							placeholder="meat"
						/>
					</FormRow>
					<FormRow label="Brand" hint="Optional. Example: Tilda" error={err("brand")}>
						<Input name="brand" defaultValue={initial?.brand ?? ""} placeholder="Tilda" />
					</FormRow>

					<FormRow
						label="Sold as"
						hint="How you buy it: a package (eg 500 g bag) or per unit (eg 1 egg)"
						error={err("sold_as")}
					>
						<Select name="sold_as" defaultValue={initial?.sold_as ?? "package"}>
							<option value="package">package</option>
							<option value="unit">unit</option>
						</Select>
					</FormRow>
					<FormRow
						label="Package unit"
						hint="Measurement unit of the package size below"
						error={err("package_unit")}
					>
						<Select name="package_unit" defaultValue={initial?.package_unit ?? "g"}>
							<option value="g">g</option>
							<option value="ml">ml</option>
							<option value="unit">unit</option>
						</Select>
					</FormRow>

					<FormRow
						label="Package size"
						required
						hint="How much is in one package, in the unit above. Example: 500"
						error={err("package_size")}
					>
						<Input
							name="package_size"
							type="number"
							step="0.01"
							defaultValue={initial?.package_size?.toString() ?? ""}
							placeholder="500"
							required
						/>
					</FormRow>
					<FormRow
						label="Package price"
						hint="What you pay for one package. Example: 89.90"
						error={err("package_price")}
					>
						<Input
							name="package_price"
							type="number"
							step="0.01"
							defaultValue={initial?.package_price?.toString() ?? ""}
							placeholder="89.90"
						/>
					</FormRow>

					<FormRow
						label="Currency"
						hint="3-letter ISO code. Example: CZK, EUR, USD"
						error={err("currency")}
					>
						<Input
							name="currency"
							defaultValue={initial?.currency ?? "CZK"}
							placeholder="CZK"
							maxLength={3}
						/>
					</FormRow>

					<label className="mt-6 flex items-center gap-2 text-sm text-zinc-300">
						<input
							type="checkbox"
							name="is_supplement"
							defaultChecked={initial?.is_supplement ?? false}
							className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
						/>
						Supplement
					</label>
				</div>

				<div className="mt-4">
					<FormRow label="Notes" error={err("notes")}>
						<Textarea name="notes" defaultValue={initial?.notes ?? ""} rows={3} />
					</FormRow>
				</div>
			</Card>

			<Card>
				<CardHeader>
					<div>
						<CardTitle>Nutrition (per 100 g/ml)</CardTitle>
						<CardDescription>
							Use Lookup to autofill from OpenFoodFacts, or type values directly.
						</CardDescription>
					</div>
					<Button
						variant="secondary"
						size="sm"
						onClick={onLookup}
						disabled={lookupPending || pending}
					>
						{lookupPending ? "Looking up…" : "Lookup nutrition"}
					</Button>
				</CardHeader>

				{lookupError ? (
					<p className="mb-3 text-xs text-amber-400">{lookupError}</p>
				) : lookupHint ? (
					<p className="mb-3 text-xs text-zinc-400">
						Matched <span className="text-zinc-200">{lookupHint.matched_product_name}</span>
						{lookupHint.matched_product_brand ? ` · ${lookupHint.matched_product_brand}` : ""} ·{" "}
						<a
							href={lookupHint.off_url}
							target="_blank"
							rel="noreferrer"
							className="text-emerald-400 hover:underline"
						>
							OpenFoodFacts ↗
						</a>
					</p>
				) : null}

				<div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
					<NutritionField
						label="kcal"
						name="kcal_per_100g"
						value={nutrition.kcal_per_100g}
						onChange={(v) => setNut("kcal_per_100g", v)}
						error={err("kcal_per_100g")}
					/>
					<NutritionField
						label="Protein (g)"
						name="protein_per_100g"
						value={nutrition.protein_per_100g}
						onChange={(v) => setNut("protein_per_100g", v)}
						error={err("protein_per_100g")}
					/>
					<NutritionField
						label="Carbs (g)"
						name="carbs_per_100g"
						value={nutrition.carbs_per_100g}
						onChange={(v) => setNut("carbs_per_100g", v)}
						error={err("carbs_per_100g")}
					/>
					<NutritionField
						label="Fat (g)"
						name="fat_per_100g"
						value={nutrition.fat_per_100g}
						onChange={(v) => setNut("fat_per_100g", v)}
						error={err("fat_per_100g")}
					/>
					<NutritionField
						label="Fiber (g)"
						name="fiber_per_100g"
						value={nutrition.fiber_per_100g}
						onChange={(v) => setNut("fiber_per_100g", v)}
						error={err("fiber_per_100g")}
					/>
				</div>
			</Card>

			<Card>
				<CardHeader>
					<div>
						<CardTitle>Unit conversion</CardTitle>
						<CardDescription>
							Used by the nutrition engine to convert recipe quantities to grams. Both fields are
							optional.
						</CardDescription>
					</div>
				</CardHeader>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<FormRow
						label="Grams per unit"
						hint="Average weight of one whole item. Example: egg ≈ 60, onion ≈ 150, tortilla ≈ 50."
						error={err("g_per_unit")}
					>
						<Input
							name="g_per_unit"
							type="number"
							step="0.01"
							min="0"
							defaultValue={initial?.g_per_unit ?? ""}
							placeholder="e.g. 60"
						/>
					</FormRow>
					<FormRow
						label="Density (g/ml)"
						hint="Only needed for liquids that aren't ~water. Example: olive oil 0.92, milk 1.03, honey 1.42."
						error={err("density_g_per_ml")}
					>
						<Input
							name="density_g_per_ml"
							type="number"
							step="0.01"
							min="0"
							defaultValue={initial?.density_g_per_ml ?? ""}
							placeholder="e.g. 1.03"
						/>
					</FormRow>
				</div>
			</Card>

			<div className="flex items-center gap-2 pt-2">
				<Button type="submit" variant="primary" disabled={pending}>
					{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create ingredient"}
				</Button>
				<ButtonLink href="/ingredients" variant="secondary">
					Cancel
				</ButtonLink>
			</div>
		</form>
	);
}

function FormRow({
	label,
	required,
	hint,
	error,
	children,
}: {
	label: string;
	required?: boolean;
	hint?: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<Label>
				{label}
				{required ? <span className="text-red-400"> *</span> : null}
			</Label>
			{children}
			{hint && !error ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
			<FieldError>{error}</FieldError>
		</div>
	);
}

function NutritionField({
	label,
	name,
	value,
	onChange,
	error,
}: {
	label: string;
	name: string;
	value: string;
	onChange: (v: string) => void;
	error?: string;
}) {
	return (
		<div className="space-y-1">
			<Label>{label}</Label>
			<Input
				name={name}
				type="number"
				step="0.01"
				min="0"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<FieldError>{error}</FieldError>
		</div>
	);
}
