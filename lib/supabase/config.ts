type PublicSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

export function hasSupabaseConfig(
  env?: PublicSupabaseEnv,
): boolean {
  const values = env ?? {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  };
  const url = values.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || values.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && key) return true;
  if (env) return false;
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true") return false;
  throw new Error(
    "Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to .env.local, or set NEXT_PUBLIC_DEMO_MODE=true for development only.",
  );
}

export function getSupabaseConfig(): {
  publishableKey: string;
  url: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  if (!url || !publishableKey) {
    throw new Error(
      "Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to .env.local.",
    );
  }

  return {
    publishableKey,
    url,
  };
}
