import { cn } from "@/lib/cn";
import type * as React from "react";

const fieldBase = cn(
	"w-full rounded-sm border border-grid bg-bg-sunk px-3 font-mono text-base text-fg",
	"outline-none transition-colors placeholder:text-fg-mute",
	"focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
	"disabled:opacity-50",
);

export const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
	<input className={cn(fieldBase, "min-h-[40px] py-1.5", className)} {...props} />
);

export const Textarea = ({
	className,
	...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
	<textarea className={cn(fieldBase, "py-2 leading-relaxed", className)} {...props} />
);

export const Select = ({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
	<select className={cn(fieldBase, "min-h-[40px] py-1.5 pr-8", className)} {...props} />
);

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
	// biome-ignore lint/a11y/noLabelWithoutControl: generic primitive; callers wrap or provide htmlFor.
	<label
		className={cn(
			"block font-mono text-[11px] uppercase tracking-widest text-fg-dim",
			className,
		)}
		{...props}
	/>
);

export function FieldError({ children }: { children?: React.ReactNode }) {
	if (!children) return null;
	return <p className="mt-1 font-mono text-xs text-rose">{children}</p>;
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
				{required ? <span className="text-rose"> *</span> : null}
			</Label>
			<Input id={props.name} required={required} {...props} />
			{hint && !error ? (
				<p className="font-mono text-[11px] text-fg-mute">{hint}</p>
			) : null}
			<FieldError>{error}</FieldError>
		</div>
	);
}
