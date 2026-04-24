import { env } from "@/lib/env";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser/client components.
 * Uses the public anon (publishable) key, which is safe to ship.
 * Row-level security in Postgres is what actually protects your data.
 */
export function createClient() {
	return createBrowserClient(
		env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
	);
}
