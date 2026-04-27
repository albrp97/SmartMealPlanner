import { cn } from "@/lib/cn";
/**
 * Hand-rolled component primitives in the shadcn/ui style.
 *
 * We don't use the shadcn CLI because:
 *  - Tailwind 4 + Next 16 + the CLI's templates don't all line up cleanly yet.
 *  - We want < 10 components, all owned in-repo, with zero runtime deps.
 *
 * Same design language though: small `cva`-free components, dark/zinc palette,
 * focus rings, and a `cn()` helper for class merging.
 */
import type * as React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: DivProps) {
	return (
		<div
			className={cn("rounded-sm border border-grid bg-bg-elev p-4 shadow-sm", className)}
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: DivProps) {
	return (
		<div
			className={cn("mb-3 flex flex-wrap items-center justify-between gap-3", className)}
			{...props}
		/>
	);
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h2 className={cn("font-mono text-sm uppercase tracking-widest text-fg", className)} {...props} />
	);
}

export function CardDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return <p className={cn("font-mono text-xs text-fg-mute", className)} {...props} />;
}
