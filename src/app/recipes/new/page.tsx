import { TermHeading } from "@/components/ui/term-heading";
import { createClient } from "@/lib/db/client-server";
import Link from "next/link";
import { RecipeForm } from "../recipe-form";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
	const supabase = await createClient();
	const { data } = await supabase
		.from("ingredients")
		.select("id, name, package_unit")
		.order("name");

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10 sm:gap-6">
			<header className="space-y-1">
				<Link href="/recipes" className="font-mono text-xs text-fg-mute hover:text-fg">
					← recipes
				</Link>
				<TermHeading level={1} prompt="+" caret>
					new recipe
				</TermHeading>
			</header>
			<RecipeForm mode="create" options={data ?? []} />
		</main>
	);
}
