import { cn } from "@/lib/cn";
import type * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
	primary:
		"border-emerald-700 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30 focus-visible:ring-emerald-500",
	secondary:
		"border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 focus-visible:ring-zinc-500",
	ghost:
		"border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100 focus-visible:ring-zinc-600",
	danger:
		"border-red-900/60 bg-red-950/30 text-red-200 hover:bg-red-900/40 focus-visible:ring-red-500",
};

const SIZES: Record<Size, string> = {
	sm: "h-7 px-2.5 text-xs",
	md: "h-9 px-4 text-sm",
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
				"inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors outline-none",
				"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
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
				"inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors outline-none",
				"focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
				VARIANTS[variant],
				SIZES[size],
				className,
			)}
			{...props}
		/>
	);
}
