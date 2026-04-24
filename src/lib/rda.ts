/**
 * Reference Daily Allowances for the few micros we surface.
 *
 * Sources: EU Nutrient Reference Values (NRVs, Reg. (EU) 1169/2011) for adults.
 * These are deliberately conservative averages — good enough to tell the user
 * "this plate gives you 40 % of your daily iron" without pretending to be
 * personalised dietetics.
 */

export interface RdaEntry {
	/** Display label shown next to the value. */
	label: string;
	/** Amount per day in the same unit as our stored value. */
	amount: number;
	/** Unit string (matches the ingredient micro key suffix, e.g. `mg`). */
	unit: string;
}

export const RDA: Record<string, RdaEntry> = {
	sodium_mg: { label: "Sodium", amount: 2300, unit: "mg" }, // WHO upper limit
	calcium_mg: { label: "Calcium", amount: 800, unit: "mg" },
	iron_mg: { label: "Iron", amount: 14, unit: "mg" },
	vitamin_c_mg: { label: "Vitamin C", amount: 80, unit: "mg" },
};

export function rdaPercent(key: string, value: number): number | null {
	const entry = RDA[key];
	if (!entry || entry.amount <= 0) return null;
	return Math.round((value / entry.amount) * 100);
}
