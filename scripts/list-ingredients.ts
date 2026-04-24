import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
async function main() {
	config({ path: ".env.local" });
	const sb = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);
	const { data } = await sb
		.from("ingredients")
		.select(
			"slug,name,sold_as,package_size,package_unit,package_price,currency,is_supplement,brand",
		)
		.order("slug");
	for (const r of data ?? [])
		console.log(
			`${r.slug}\t${r.sold_as}\t${r.package_size}${r.package_unit}\t${r.package_price ?? "-"}${r.currency}\t${r.is_supplement ? "SUPP" : ""}\t${r.brand ?? ""}`,
		);
}
main();
