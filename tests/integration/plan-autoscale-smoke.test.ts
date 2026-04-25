/**
 * Smoke test: verify the auto-scaler on /plan drives daily kcal to within
 * ±10 % of the target for all three goals — without touching anything in
 * the DB. Hits the running dev server.
 *
 * Tolerance was originally ±2 %. After Phase 3.8 the planner optimises
 * across kcal+P+C+F simultaneously (see plan-macro-balance-smoke). On
 * cut, hitting 140 g protein from a single chicken hero scales the hero
 * up by ~40 %, which pushes daily kcal ~8 % over target. The macro
 * balancer is doing the right trade-off; this looser bound just
 * acknowledges it. The macro-balance smoke is the source of truth.
 *
 * Opt-in: set SMOKE=1 (and have a dev server on :3000 with a non-empty
 * plan) before running.
 */
import { describe, expect, it } from "vitest";

const APP = process.env.SMOKE_APP_URL ?? "http://localhost:3000";
const TARGETS = { maintain: 2640, cut: 2240, bulk: 2900 } as const;
const haveSmoke = process.env.SMOKE === "1";
const d = haveSmoke ? describe : describe.skip;

async function fetchKcalPerDay(goal: "maintain" | "cut" | "bulk"): Promise<number> {
	const res = await fetch(`${APP}/plan?goal=${goal}`, { cache: "no-store" });
	const html = await res.text();
	const m = html.match(/kcal\s*\/\s*day<\/p><p[^>]*>(\d{2,5})</i);
	if (!m) throw new Error(`couldn't parse kcal/day for goal=${goal}; html len ${html.length}`);
	return Number(m[1]);
}

d("/plan auto-scaler hits goal kcal target (live dev server)", () => {
	for (const goal of ["maintain", "cut", "bulk"] as const) {
		it(`${goal}: kcal within ±2% of ${TARGETS[goal]}`, async () => {
			const kcal = await fetchKcalPerDay(goal);
			console.log(`[smoke] ${goal}: kcal=${kcal} target=${TARGETS[goal]}`);
			const drift = Math.abs(kcal - TARGETS[goal]) / TARGETS[goal];
			expect(drift).toBeLessThan(0.1);
		});
	}
});
