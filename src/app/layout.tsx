import { Nav } from "@/components/nav";
import { QueryProvider } from "@/lib/query-provider";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "SmartMealPlanner",
	description: "Personal meal planning, costing, macros & shopping list automation.",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#05070a",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="crt-scanlines min-h-full flex flex-col pb-[calc(env(safe-area-inset-bottom)+56px)] sm:pb-0">
				<QueryProvider>
					<Nav />
					{children}
				</QueryProvider>
			</body>
		</html>
	);
}
