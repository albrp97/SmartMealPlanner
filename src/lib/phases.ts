/**
 * Roadmap phase metadata.
 *
 * Single source of truth for both the home page and the test suite.
 * Update statuses as phases progress so the landing page stays accurate.
 */
export type PhaseStatus = "in-progress" | "next" | "todo" | "done";

export interface Phase {
	id: number;
	title: string;
	status: PhaseStatus;
	desc: string;
}

export const phaseStatuses: readonly Phase[] = [
	{ id: 0, title: "Bootstrap", status: "in-progress", desc: "Next.js + Tailwind + Biome + CI" },
	{ id: 1, title: "Catalogue", status: "next", desc: "Ingredients & recipes CRUD" },
	{ id: 2, title: "Costing & nutrition", status: "todo", desc: "€/plate, macros, micros" },
	{ id: 3, title: "Planner & shopping list", status: "todo", desc: "Weekly plan → buy list" },
	{ id: 4, title: "Receipt OCR", status: "todo", desc: "Photo → updated prices" },
	{ id: 5, title: "Auth & sync", status: "todo", desc: "Supabase magic-link + RLS" },
] as const;
