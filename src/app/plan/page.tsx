/**
 * Phase 3: weekly meal planner.
 *
 * Server component. Renders Mon-Sun for the current ISO week (override via
 * `?week=YYYY-MM-DD`), shows each slot's planned recipe + a daily macro
 * roll-up vs the user's goal target. Empty slots get inline pickers backed
 * by Server Actions.
 *
 * Breakfast is auto-seeded with `breakfast_daily` since the user said it's
 * always the same; the "Seed breakfasts" button explicitly fills the week.
 */
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/db/client-server";
import { GOALS, GOAL_LABEL, type Goal, TARGETS, isGoal, pct } from "@/lib/goals";
import { type NutritionLineInput, computeRecipeNutrition } from "@/lib/nutrition";
import { SLOTS, SLOT_LABEL, type Slot, shortDayLabel, weekDates } from "@/lib/plan";
import Link from "next/link";
import { addPlanEntry, seedBreakfastsForWeek } from "./actions";
import { DeleteEntryButton, SeedBreakfastsButton } from "./controls";

export const dynamic = "force-dynamic";

interface RecipeIng {
	is_supplement: boolean;
	g_per_unit: number | null;
	density_g_per_ml: number | null;
	kcal_per_100g: number | null;
	protein_per_100g: number | null;
	carbs_per_100g: number | null;
	fat_per_100g: number | null;
	fiber_per_100g: number | null;
}

interface RecipeRow {
	id: string;
	slug: string;
	name: string;
	servings: number;
	recipe_ingredients: {
		quantity: number;
		unit: "g" | "ml" | "unit";
		ingredients: RecipeIng | null;
	}[];
}

interface PlanRow {
	id: string;
	date: string;
	slot: Slot;
	servings: number;
	recipe_id: string;
}

export default async function PlanPage({
	searchParams,
}: {
	searchParams: Promise<{ week?: string; goal?: string }>;
}) {
	const { week, goal: goalParam } = await searchParams;
	const goal: Goal = isGoal(goalParam) ? goalParam : "maintain";
	const target = TARGETS[goal];

	const anchor = week ? new Date(week) : new Date();
	const days = weekDates(Number.isNaN(anchor.getTime()) ? new Date() : anchor);

	const supabase = await createClient();

	const [{ data: recipesRaw }, { data: planRaw }] = await Promise.all([
		supabase
			.from("recipes")
			.select(
				"id, slug, name, servings, recipe_ingredients(quantity, unit, ingredients(is_supplement, g_per_unit, density_g_per_ml, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g))",
			)
			.order("name"),
		supabase
			.from("meal_plan_entries")
			.select("id, date, slot, servings, recipe_id")
			.in("date", days),
	]);

	const recipes = (recipesRaw ?? []) as unknown as RecipeRow[];
	const plan = (planRaw ?? []) as PlanRow[];

	// Pre-compute per-serving macros for every recipe.
	const macrosByRecipe = new Map<
		string,
		{ kcal: number; protein: number; carbs: number; fat: number }
	>();
	for (const r of recipes) {
		const inputs: NutritionLineInput[] = r.recipe_ingredients
			.filter(
				(l): l is (typeof r.recipe_ingredients)[number] & { ingredients: RecipeIng } =>
					l.ingredients !== null,
			)
			.map((l) => ({
				ingredient: {
					isSupplement: l.ingredients.is_supplement,
					gPerUnit: l.ingredients.g_per_unit,
					densityGPerMl: l.ingredients.density_g_per_ml,
					kcalPer100g: l.ingredients.kcal_per_100g,
					proteinPer100g: l.ingredients.protein_per_100g,
					carbsPer100g: l.ingredients.carbs_per_100g,
					fatPer100g: l.ingredients.fat_per_100g,
					fiberPer100g: l.ingredients.fiber_per_100g,
				},
				quantity: l.quantity,
				unit: l.unit,
			}));
		const ps = computeRecipeNutrition(inputs, r.servings).perServing;
		macrosByRecipe.set(r.id, { kcal: ps.kcal, protein: ps.protein, carbs: ps.carbs, fat: ps.fat });
	}
	const recipeNameById = new Map(recipes.map((r) => [r.id, r.name]));
	const recipeSlugById = new Map(recipes.map((r) => [r.id, r.slug]));

	// Group entries by date+slot.
	const entriesByDay: Record<string, Record<Slot, PlanRow[]>> = {};
	for (const d of days) {
		entriesByDay[d] = { breakfast: [], lunch: [], dinner: [] };
	}
	for (const e of plan) {
		entriesByDay[e.date]?.[e.slot]?.push(e);
	}

	function dayMacros(date: string) {
		let kcal = 0;
		let protein = 0;
		let carbs = 0;
		let fat = 0;
		for (const slot of SLOTS) {
			for (const e of entriesByDay[date][slot]) {
				const m = macrosByRecipe.get(e.recipe_id);
				if (!m) continue;
				kcal += m.kcal * e.servings;
				protein += m.protein * e.servings;
				carbs += m.carbs * e.servings;
				fat += m.fat * e.servings;
			}
		}
		return { kcal, protein, carbs, fat };
	}

	// Prev / next week URLs.
	const start = new Date(`${days[0]}T00:00:00`);
	const prev = new Date(start);
	prev.setDate(prev.getDate() - 7);
	const next = new Date(start);
	next.setDate(next.getDate() + 7);

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="space-y-1">
					<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Phase 3</p>
					<h1 className="text-2xl font-semibold tracking-tight">Weekly plan</h1>
					<p className="text-sm text-zinc-400">
						{days[0]} → {days[6]} · breakfast pinned to{" "}
						<code className="text-zinc-300">breakfast_daily</code>
					</p>
				</div>
				<div className="flex items-center gap-2 font-mono text-xs">
					<Link
						href={`/plan?week=${days[0].slice(0, 10)}`.replace(days[0], days[0])}
						className="text-zinc-500 hover:text-zinc-200"
					>
						{/* placeholder so the next two stay aligned */}
					</Link>
					<Link
						href={`/plan?week=${prev.toISOString().slice(0, 10)}&goal=${goal}`}
						className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
					>
						← prev
					</Link>
					<Link
						href={`/plan?goal=${goal}`}
						className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
					>
						this week
					</Link>
					<Link
						href={`/plan?week=${next.toISOString().slice(0, 10)}&goal=${goal}`}
						className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
					>
						next →
					</Link>
					<span className="ml-2 text-zinc-600">·</span>
					<div className="flex gap-1">
						{GOALS.map((g) => (
							<Link
								key={g}
								href={`/plan?week=${days[0]}&goal=${g}`}
								className={`rounded-md border px-2 py-0.5 ${
									g === goal
										? "border-sky-600 bg-sky-600/20 text-sky-200"
										: "border-zinc-700 text-zinc-400 hover:border-zinc-500"
								}`}
							>
								{GOAL_LABEL[g]}
							</Link>
						))}
					</div>
					<SeedBreakfastsButton
						action={async () => {
							"use server";
							await seedBreakfastsForWeek(days);
						}}
					/>
					<ButtonLink href="/shopping" variant="primary" size="sm">
						Shopping list →
					</ButtonLink>
				</div>
			</header>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
				{days.map((date) => {
					const dm = dayMacros(date);
					const kcalPct = pct(dm.kcal, target.kcal);
					const proteinPct = pct(dm.protein, target.protein);
					return (
						<section
							key={date}
							className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
						>
							<header className="flex items-baseline justify-between">
								<h2 className="text-sm font-medium text-zinc-200">{shortDayLabel(date)}</h2>
								<span className="font-mono text-[10px] text-zinc-500">{date}</span>
							</header>

							{SLOTS.map((slot) => {
								const entries = entriesByDay[date][slot];
								return (
									<div
										key={slot}
										className="rounded-md border border-zinc-800/60 bg-zinc-950/60 p-2"
									>
										<p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
											{SLOT_LABEL[slot]}
										</p>
										<ul className="mt-1 space-y-1">
											{entries.map((e) => {
												const m = macrosByRecipe.get(e.recipe_id);
												const slug = recipeSlugById.get(e.recipe_id);
												return (
													<li key={e.id} className="flex items-center justify-between gap-2">
														<Link
															href={slug ? `/recipes/${slug}` : "#"}
															className="truncate text-xs text-zinc-200 hover:text-emerald-300"
															title={recipeNameById.get(e.recipe_id) ?? ""}
														>
															{e.servings > 1 ? `${e.servings}× ` : ""}
															{recipeNameById.get(e.recipe_id) ?? "?"}
														</Link>
														<div className="flex items-center gap-1">
															{m ? (
																<span className="font-mono text-[10px] text-zinc-500">
																	{Math.round(m.kcal * e.servings)}k
																</span>
															) : null}
															<DeleteEntryButton id={e.id} />
														</div>
													</li>
												);
											})}
										</ul>
										<form
											action={async (formData: FormData) => {
												"use server";
												await addPlanEntry({ ok: false }, formData);
											}}
											className="mt-1 flex gap-1"
										>
											<input type="hidden" name="date" value={date} />
											<input type="hidden" name="slot" value={slot} />
											<select
												name="recipe_id"
												defaultValue=""
												className="flex-1 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 font-mono text-[10px] text-zinc-300"
												aria-label={`Add ${slot} on ${date}`}
											>
												<option value="" disabled>
													+ recipe
												</option>
												{recipes.map((r) => (
													<option key={r.id} value={r.id}>
														{r.name}
													</option>
												))}
											</select>
											<input
												type="number"
												name="servings"
												defaultValue={1}
												min={1}
												step={1}
												className="w-10 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 font-mono text-[10px] text-zinc-300"
												aria-label="servings"
											/>
											<button
												type="submit"
												className="rounded border border-emerald-700 bg-emerald-900/30 px-1 py-0.5 font-mono text-[10px] text-emerald-300 hover:border-emerald-500"
											>
												add
											</button>
										</form>
									</div>
								);
							})}

							<footer className="mt-1 space-y-1 border-t border-zinc-800/80 pt-2 font-mono text-[10px]">
								<div className="flex justify-between text-zinc-400">
									<span>kcal</span>
									<span
										className={
											kcalPct > 110
												? "text-amber-400"
												: kcalPct < 85
													? "text-zinc-500"
													: "text-emerald-300"
										}
									>
										{Math.round(dm.kcal)} / {target.kcal} ({kcalPct}%)
									</span>
								</div>
								<div className="flex justify-between text-zinc-400">
									<span>protein</span>
									<span
										className={
											proteinPct > 110
												? "text-amber-400"
												: proteinPct < 85
													? "text-zinc-500"
													: "text-emerald-300"
										}
									>
										{Math.round(dm.protein)} / {target.protein} ({proteinPct}%)
									</span>
								</div>
								<div className="flex justify-between text-zinc-500">
									<span>C/F</span>
									<span>
										{Math.round(dm.carbs)} / {Math.round(dm.fat)} g
									</span>
								</div>
							</footer>
						</section>
					);
				})}
			</div>
		</main>
	);
}
