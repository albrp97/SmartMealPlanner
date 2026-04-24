/**
 * Tiny client components used by the plan page so server actions can be
 * triggered from buttons that need a confirm() prompt.
 */
"use client";

import { useTransition } from "react";
import { deletePlanEntry } from "./actions";

export function DeleteEntryButton({ id }: { id: string }) {
	const [pending, start] = useTransition();
	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => start(() => void deletePlanEntry(id))}
			className="rounded border border-zinc-800 px-1 py-0.5 font-mono text-[10px] text-zinc-500 hover:border-red-700 hover:text-red-300 disabled:opacity-50"
			title="Remove entry"
			aria-label="Remove entry"
		>
			✕
		</button>
	);
}

export function SeedBreakfastsButton({ action }: { action: () => Promise<void> }) {
	const [pending, start] = useTransition();
	return (
		<button
			type="button"
			disabled={pending}
			onClick={() => start(() => action())}
			className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
			title="Pin breakfast_daily to every day this week"
		>
			seed breakfasts
		</button>
	);
}
