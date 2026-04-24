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
			className={cn("rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 shadow-sm", className)}
			{...props}
		/>
	);
}

export function CardHeader({ className, ...props }: DivProps) {
	return (
		<div className={cn("mb-3 flex items-center justify-between gap-3", className)} {...props} />
	);
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
	return <h2 className={cn("text-sm font-medium text-zinc-200", className)} {...props} />;
}

export function CardDescription({
	className,
	...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
	return <p className={cn("text-xs text-zinc-500", className)} {...props} />;
}
