/**
 * TermHeading — `> command-style` heading used across pages
 * (DEVELOPER_GUIDE §7.6.1, §7.6.4).
 *
 *   <TermHeading prompt="$" level={1} caret>plan</TermHeading>
 *
 * Renders as: <h1>$&nbsp;plan▌</h1> with the right semantic level and
 * an optional blinking caret on the active screen. Server-component
 * safe (no state, no effects).
 */
import { cn } from "@/lib/cn";
import type * as React from "react";

type Level = 1 | 2 | 3;

interface TermHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
	level?: Level;
	prompt?: string;
	caret?: boolean;
}

const SIZE: Record<Level, string> = {
	1: "text-base sm:text-lg",
	2: "text-sm sm:text-base",
	3: "text-xs sm:text-sm",
};

export function TermHeading({
	level = 2,
	prompt = ">",
	caret = false,
	className,
	children,
	...props
}: TermHeadingProps) {
	const Tag = `h${level}` as const;
	return (
		<Tag
			className={cn(
				"flex items-baseline gap-2 font-mono uppercase tracking-widest text-fg",
				SIZE[level],
				className,
			)}
			{...props}
		>
			<span aria-hidden className="text-accent">
				{prompt}
			</span>
			<span className={caret ? "term-caret" : undefined}>{children}</span>
		</Tag>
	);
}
