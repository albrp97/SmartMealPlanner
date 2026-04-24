import { cn } from "@/lib/cn";
import type * as React from "react";

const fieldBase = cn(
	"w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100",
	"outline-none transition-colors placeholder:text-zinc-600",
	"focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
	"disabled:opacity-50",
);

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
	<input className={cn(fieldBase, "h-9 py-1.5", className)} {...props} />
);

export const Textarea = ({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
	<textarea className={cn(fieldBase, "py-2 leading-relaxed", className)} {...props} />
);

export const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<select className={cn(fieldBase, "h-9 py-1.5 pr-8", className)} {...props} />
);

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
	// biome-ignore lint/a11y/noLabelWithoutControl: generic primitive; callers wrap or provide htmlFor.
	<label
		className={cn(
			"block text-[11px] font-medium uppercase tracking-wider text-zinc-400",
			className,
		)}
		{...props}
	/>
);

export function FieldError({ children }: { children?: React.ReactNode }) {
	if (!children) return null;
	return <p className="mt-1 text-xs text-red-400">{children}</p>;
}

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	hint?: string;
	error?: string;
	required?: boolean;
}

export function FormField({ label, hint, error, required, className, ...props }: FormFieldProps) {
	return (
		<div className={cn("space-y-1", className)}>
			<Label htmlFor={props.name}>
				{label}
				{required ? <span className="text-red-400"> *</span> : null}
			</Label>
			<Input id={props.name} required={required} {...props} />
			{hint && !error ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
			<FieldError>{error}</FieldError>
		</div>
	);
}
