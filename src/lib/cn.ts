import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes — last wins, with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
