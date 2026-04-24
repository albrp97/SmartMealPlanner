import { env } from "@/lib/env";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for server components, server actions, and route handlers.
 *
 * Reads the user's auth session from the `next/headers` cookie store and refreshes
 * it transparently. Use this for any server-side data access.
 *
 * For admin / cross-user operations (seeding, migrations, scheduled jobs) use
 * `createServiceClient` instead — it bypasses Row Level Security.
 */
export async function createClient() {
	const cookieStore = await cookies();

	return createServerClient(
		env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						for (const { name, value, options } of cookiesToSet) {
							cookieStore.set(name, value, options);
						}
					} catch {
						// Called from a Server Component (read-only). Safe to ignore;
						// middleware will refresh tokens on the next request.
					}
				},
			},
		},
	);
}
