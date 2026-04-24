import { phaseStatuses } from "@/lib/phases";
import { describe, expect, it } from "vitest";

describe("phaseStatuses", () => {
	it("contains all six bootstrap phases", () => {
		expect(phaseStatuses).toHaveLength(6);
	});

	it("has Phase 0 marked done", () => {
		const phase0 = phaseStatuses[0];
		expect(phase0).toMatchObject({ id: 0, title: "Bootstrap", status: "done" });
	});

	it("has Phase 1 in progress as Catalogue", () => {
		const phase1 = phaseStatuses[1];
		expect(phase1).toMatchObject({ id: 1, title: "Catalogue", status: "in-progress" });
	});
});
