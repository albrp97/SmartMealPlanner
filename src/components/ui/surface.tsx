/**
 * Surface — the three-layer container of the cyberpunk-terminal theme
 * (DEVELOPER_GUIDE §7.6.1).
 *
 *   tone="elev"  → cards / panels  (default)
 *   tone="sunk"  → inputs / code-blocks / shopping-list interior
 *   tagged       → 1px accent top border, "this is the active surface"
 *
 * Square corners by default; pass `rounded="sm"` if you need a softer
 * edge. No padding by default so callers control their own internal
 * rhythm.
 */
import { cn } from "@/lib/cn";
import type * as React from "react";

type Tone = "elev" | "sunk";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export interface SurfaceProps extends DivProps {
	tone?: Tone;
	tagged?: boolean;
	rounded?: "none" | "sm";
	asChild?: false;
}

const TONES: Record<Tone, string> = {
	elev: "bg-bg-elev border border-grid",
	sunk: "bg-bg-sunk border border-grid",
};

export function Surface({
	tone = "elev",
	tagged = false,
	rounded = "none",
	className,
	...props
}: SurfaceProps) {
	return (
		<div
			className={cn(
				TONES[tone],
				rounded === "sm" ? "rounded-sm" : "rounded-none",
				tagged && "border-t-accent/40",
				className,
			)}
			{...props}
		/>
	);
}
