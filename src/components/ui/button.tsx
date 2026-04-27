import { cn } from "@/lib/cn";
import type * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
	primary:
		"border-accent/60 bg-accent/10 text-accent hover:bg-accent/20 focus-visible:ring-accent",
	secondary:
		"border-grid bg-bg-sunk text-fg-dim hover:border-fg-mute hover:text-fg focus-visible:ring-fg-mute",
	ghost: "border-transparent text-fg-dim hover:bg-bg-sunk hover:text-fg focus-visible:ring-fg-mute",
	danger:
		"border-rose/40 bg-rose/10 text-rose hover:bg-rose/20 focus-visible:ring-rose",
};

const SIZES: Record<Size, string> = {
	sm: "min-h-[36px] px-3 text-xs",
	md: "min-h-[40px] px-4 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
}

export function Button({
	className,
	variant = "secondary",
	size = "md",
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-sm border font-mono transition-colors outline-none",
				"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				"disabled:opacity-50 disabled:pointer-events-none",
				VARIANTS[variant],
				SIZES[size],
				className,
			)}
			{...props}
		/>
	);
}

interface AnchorButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	variant?: Variant;
	size?: Size;
}

export function ButtonLink({
	className,
	variant = "secondary",
	size = "md",
	...props
}: AnchorButtonProps) {
	return (
		<a
			className={cn(
				"inline-flex items-center justify-center gap-1.5 rounded-sm border font-mono transition-colors outline-none",
				"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
				VARIANTS[variant],
				SIZES[size],
				className,
			)}
			{...props}
		/>
	);
}
