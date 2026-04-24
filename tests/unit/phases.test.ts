import { phaseStatuses } from "@/lib/phases";
import { describe, expect, it } from "vitest";

describe("phaseStatuses", () => {
	it("contains all six bootstrap phases", () => {
		expect(phaseStatuses).toHaveLength(6);
	});

	it("has Phase 0 in progress as Bootstrap", () => {
		const phase0 = phaseStatuses[0];
		expect(phase0).toMatchObject({ id: 0, title: "Bootstrap", status: "in-progress" });
	});
});
