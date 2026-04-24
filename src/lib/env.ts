import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Build-time and runtime environment validation.
 *
 * Add new env vars here so they are type-safe everywhere via `import { env } from "@/lib/env"`.
 * Keep public (browser-readable) vars under `client` and prefix them with `NEXT_PUBLIC_`.
 */
export const env = createEnv({
	server: {
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
		// DB & infra (Phase 0: optional; required from Phase 1 onwards)
		DATABASE_URL: z.string().url().optional(),
		SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
		// LLM (Phase 4)
		GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
		OPENAI_API_KEY: z.string().min(1).optional(),
		// Rate limiting (Phase 4)
		UPSTASH_REDIS_REST_URL: z.string().url().optional(),
		UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
		// Observability
		SENTRY_DSN: z.string().url().optional(),
	},
	client: {
		NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
		NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		DATABASE_URL: process.env.DATABASE_URL,
		SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
		GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
		SENTRY_DSN: process.env.SENTRY_DSN,
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
		NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
	},
	// Skip validation in linting / docker builds where vars aren't present.
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
