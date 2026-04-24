/**
 * Reusable add/edit form for an ingredient.
 *
 * Uses React 19's `useActionState` to wire a Server Action without any client
 * fetch boilerplate. The action returns either `{ok:false, error|fieldErrors}`
 * for inline display, or it `redirect()`s on success (which throws past us).
 */
"use client";

import { useActionState } from "react";
import { type ActionResult, createIngredient, updateIngredient } from "./actions";
import type { IngredientRow } from "./types";

interface Props {
	mode: "create" | "edit";
	initial?: IngredientRow;
}

const INITIAL: ActionResult = { ok: true };

export function IngredientForm({ mode, initial }: Props) {
	const action =
		mode === "edit" && initial ? updateIngredient.bind(null, initial.id) : createIngredient;
	const [state, formAction, pending] = useActionState(action, INITIAL);

	const fe = state.fieldErrors ?? {};
	const err = (key: string) => fe[key]?.[0];

	return (
		<form action={formAction} className="space-y-4">
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
				<Field
					label="Brand"
					name="brand"
					defaultValue={initial?.brand ?? ""}
					error={err("brand")}
				/>

				<Select
					label="Sold as"
					name="sold_as"
					defaultValue={initial?.sold_as ?? "package"}
					options={["package", "unit"]}
					error={err("sold_as")}
				/>
				<Select
					label="Package unit"
					name="package_unit"
					defaultValue={initial?.package_unit ?? "g"}
					options={["g", "ml", "unit"]}
					error={err("package_unit")}
				/>

				<Field
					label="Package size"
					name="package_size"
					type="number"
					step="0.01"
					defaultValue={initial?.package_size?.toString() ?? ""}
					error={err("package_size")}
					required
				/>
				<Field
					label="Package price"
					name="package_price"
					type="number"
					step="0.01"
					defaultValue={initial?.package_price?.toString() ?? ""}
					error={err("package_price")}
				/>

				<Field
					label="Currency"
					name="currency"
					defaultValue={initial?.currency ?? "CZK"}
					error={err("currency")}
				/>

				<label className="flex items-center gap-2 text-sm text-zinc-300">
					<input
						type="checkbox"
						name="is_supplement"
						defaultChecked={initial?.is_supplement ?? false}
						className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
					/>
					Supplement
				</label>
			</div>

			<TextArea
				label="Notes"
				name="notes"
				defaultValue={initial?.notes ?? ""}
				error={err("notes")}
			/>

			<div className="flex items-center gap-2 pt-2">
				<button
					type="submit"
					disabled={pending}
					className="rounded-md border border-emerald-700 bg-emerald-600/20 px-4 py-1.5 text-sm font-medium text-emerald-200 hover:bg-emerald-600/30 disabled:opacity-50"
				>
					{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create ingredient"}
				</button>
				<a
					href="/ingredients"
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
	step?: string;
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
				step={props.step}
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

function TextArea(props: { label: string; name: string; defaultValue?: string; error?: string }) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs uppercase tracking-wider text-zinc-400">{props.label}</span>
			<textarea
				name={props.name}
				defaultValue={props.defaultValue}
				rows={3}
				className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
			/>
			{props.error ? <span className="block text-xs text-red-400">{props.error}</span> : null}
		</label>
	);
}
