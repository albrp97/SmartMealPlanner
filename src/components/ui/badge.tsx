/**
 * Badge — small uppercase mono label used for roles, statuses, and
 * "def vs real" markers (DEVELOPER_GUIDE §7.6.1, §7.6.4).
 */
import { cn } from "@/lib/cn";
import type * as React from "react";

type Tone = "hero" | "side" | "fixed" | "info" | "warn" | "danger" | "neutral";

const TONES: Record<Tone, string> = {
	hero: "border-accent/40 bg-accent/10 text-accent",
	side: "border-grid bg-bg-sunk text-fg-dim",
	fixed: "border-amber/40 bg-amber/10 text-amber",
	info: "border-cyan/40 bg-cyan/10 text-cyan",
	warn: "border-magenta/40 bg-magenta/10 text-magenta",
	danger: "border-rose/40 bg-rose/10 text-rose",
	neutral: "border-grid bg-bg-sunk text-fg-dim",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-sm border px-1 py-0.5 font-mono text-[10px] uppercase tracking-wider",
				TONES[tone],
				className,
			)}
			{...props}
		/>
	);
}
