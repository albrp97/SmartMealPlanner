import { TermHeading } from "@/components/ui/term-heading";
import Link from "next/link";
import { IngredientForm } from "../ingredient-form";

export const dynamic = "force-dynamic";

export default function NewIngredientPage() {
	return (
		<main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="space-y-1">
				<Link href="/ingredients" className="font-mono text-xs text-fg-mute hover:text-fg">
					← ingredients
				</Link>
				<TermHeading level={1} prompt="+" caret>
					new ingredient
				</TermHeading>
			</header>
			<IngredientForm mode="create" />
		</main>
	);
}
