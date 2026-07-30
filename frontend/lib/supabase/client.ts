import { createBrowserClient } from "@supabase/ssr";

/** Browser-side client, for use in Client Components. Session is persisted in cookies. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
