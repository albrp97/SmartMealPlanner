import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — used by `pnpm db:generate` to produce SQL migration files
 * from `src/lib/db/schema.ts`. We don't run `drizzle-kit push` because direct
 * Postgres access is blocked on corporate networks; SQL is applied via the
 * Supabase SQL Editor instead. (See DEVELOPER_GUIDE §3.)
 */
export default defineConfig({
	schema: "./src/lib/db/schema.ts",
	out: "./migrations",
	dialect: "postgresql",
	// Optional: only used by drizzle-kit's introspection commands (which we don't run).
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgres://placeholder",
	},
	strict: true,
	verbose: true,
});
