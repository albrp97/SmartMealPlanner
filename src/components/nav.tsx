/**
 * Top + bottom navigation (Phase 3.15).
 *
 * Cyberpunk-terminal aesthetic: `> SMP` brand prompt, monospace links,
 * a one-shot "boot stripe" under the header that animates left → right
 * the first time the page loads in this tab. On phones (< sm) the
 * primary links collapse to a sticky **bottom dock** so they're within
 * thumb reach; the top bar keeps the brand + scanline toggle.
 *
 * Pure client component. State: scanlines on/off (persisted to
 * localStorage), bootedThisSession flag (sessionStorage) so the boot
 * stripe doesn't replay on every soft nav.
 */
"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
	{ href: "/plan", label: "PLAN", glyph: "◆" },
	{ href: "/recipes", label: "RECIPES", glyph: "◇" },
	{ href: "/ingredients", label: "INGREDIENTS", glyph: "▣" },
] as const;

export function Nav() {
	const pathname = usePathname();
	const [booted, setBooted] = useState(false);
	const [scanlines, setScanlines] = useState(true);

	// Boot stripe: only the first mount per browser tab.
	useEffect(() => {
		const seen = sessionStorage.getItem("smp.booted");
		if (!seen) {
			setBooted(true);
			sessionStorage.setItem("smp.booted", "1");
		}
		const stored = localStorage.getItem("smp.scanlines");
		if (stored === "off") {
			setScanlines(false);
			document.body.dataset.scanlines = "off";
		}
	}, []);

	function toggleScanlines() {
		setScanlines((on) => {
			const next = !on;
			localStorage.setItem("smp.scanlines", next ? "on" : "off");
			document.body.dataset.scanlines = next ? "on" : "off";
			return next;
		});
	}

	function isActive(href: string) {
		if (href === "/") return pathname === "/";
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	return (
		<>
			<header className="sticky top-0 z-40 border-b border-grid bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/65">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
					<Link
						href="/plan"
						className="flex items-baseline gap-2 font-mono text-sm uppercase tracking-widest text-fg"
						aria-label="SmartMealPlanner — go to plan"
					>
						<span aria-hidden className="text-accent">
							&gt;
						</span>
						<span>SMP</span>
						<span aria-hidden className="text-fg-mute">
							::
						</span>
						<span className="text-fg-dim">terminal</span>
					</Link>

					<nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
						{LINKS.map((l) => (
							<TopLink
								key={l.href}
								href={l.href}
								label={l.label}
								active={isActive(l.href)}
							/>
						))}
					</nav>

					<button
						type="button"
						onClick={toggleScanlines}
						aria-pressed={scanlines}
						aria-label={scanlines ? "Disable scanlines" : "Enable scanlines"}
						title={scanlines ? "Scanlines: ON" : "Scanlines: OFF"}
						className="inline-flex h-8 min-w-[40px] items-center justify-center rounded-sm border border-grid px-2 font-mono text-[10px] uppercase tracking-widest text-fg-dim hover:text-fg"
					>
						{scanlines ? "▓" : "░"}
					</button>
				</div>
				{booted ? (
					<div
						aria-hidden
						className="term-boot-stripe h-px w-full bg-gradient-to-r from-accent via-cyan to-transparent"
					/>
				) : (
					<div aria-hidden className="h-px w-full bg-grid" />
				)}
			</header>

			{/* Sticky bottom dock — phones only. */}
			<nav
				aria-label="Primary mobile"
				className={cn(
					"fixed inset-x-0 bottom-0 z-40 border-t border-grid bg-bg/95 backdrop-blur sm:hidden",
					"pb-[env(safe-area-inset-bottom)]",
				)}
			>
				<ul className="mx-auto flex w-full max-w-5xl items-stretch justify-around">
					{LINKS.map((l) => (
						<li key={l.href} className="flex-1">
							<Link
								href={l.href}
								className={cn(
									"flex h-14 flex-col items-center justify-center gap-0.5 font-mono text-[10px] uppercase tracking-widest",
									isActive(l.href) ? "text-accent" : "text-fg-dim hover:text-fg",
								)}
							>
								<span aria-hidden className="text-base leading-none">
									{l.glyph}
								</span>
								<span>{l.label}</span>
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</>
	);
}

function TopLink({
	href,
	label,
	active,
}: {
	href: string;
	label: string;
	active: boolean;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors",
				active
					? "border-accent/60 bg-accent/10 text-accent"
					: "border-transparent text-fg-dim hover:border-grid hover:text-fg",
			)}
		>
			{label}
		</Link>
	);
}
