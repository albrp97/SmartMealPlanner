/**
 * Top navigation bar.
 *
 * Sticky at the top of every page. On wide viewports the links sit inline;
 * on narrow viewports they collapse behind a hamburger that toggles a
 * dropdown sheet. Pure client component — no router state, no third-party
 * popover, just `useState` + `usePathname` for highlight.
 */
"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/ingredients", label: "Ingredients" },
	{ href: "/recipes", label: "Recipes" },
	{ href: "/plan", label: "Plan" },
] as const;

export function Nav() {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	function isActive(href: string) {
		if (href === "/") return pathname === "/";
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	return (
		<header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
			<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
				<Link
					href="/"
					className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100"
					onClick={() => setOpen(false)}
				>
					<span aria-hidden className="text-emerald-400">
						◆
					</span>
					SmartMealPlanner
				</Link>

				<nav className="hidden gap-1 sm:flex" aria-label="Primary">
					{LINKS.map((l) => (
						<Link
							key={l.href}
							href={l.href}
							className={cn(
								"rounded-md px-3 py-1.5 text-sm transition-colors",
								isActive(l.href)
									? "bg-zinc-900 text-zinc-100"
									: "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
							)}
						>
							{l.label}
						</Link>
					))}
				</nav>

				<button
					type="button"
					aria-label={open ? "Close menu" : "Open menu"}
					aria-expanded={open}
					aria-controls="primary-nav-mobile"
					className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500 sm:hidden"
					onClick={() => setOpen((v) => !v)}
				>
					{open ? <CloseIcon /> : <MenuIcon />}
				</button>
			</div>

			{open ? (
				<nav
					id="primary-nav-mobile"
					className="border-t border-zinc-800 bg-zinc-950 sm:hidden"
					aria-label="Primary mobile"
				>
					<ul className="mx-auto flex w-full max-w-5xl flex-col px-4 py-2">
						{LINKS.map((l) => (
							<li key={l.href}>
								<Link
									href={l.href}
									onClick={() => setOpen(false)}
									className={cn(
										"block rounded-md px-3 py-2 text-sm",
										isActive(l.href)
											? "bg-zinc-900 text-zinc-100"
											: "text-zinc-300 hover:bg-zinc-900/60",
									)}
								>
									{l.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>
			) : null}
		</header>
	);
}

function MenuIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>Open menu</title>
			<line x1="4" y1="6" x2="20" y2="6" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="4" y1="18" x2="20" y2="18" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<title>Close menu</title>
			<line x1="6" y1="6" x2="18" y2="18" />
			<line x1="18" y1="6" x2="6" y2="18" />
		</svg>
	);
}
