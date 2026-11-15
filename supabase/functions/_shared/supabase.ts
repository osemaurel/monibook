import { createClient, type SupabaseClient } from "./deps.ts";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function createAdminClient(): SupabaseClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Returns the id of the user owning the bearer token, verified by the auth server. */
export async function authenticatedUserId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const { data, error } = await admin.auth.getUser(header.slice("Bearer ".length));
  if (error || !data.user) return null;
  return data.user.id;
}

/** Error message raised by a SQL function (`raise exception 'code'`), if any. */
export function sqlErrorCode(error: { message?: string } | null): string | null {
  const match = error?.message?.match(/^[a-z][a-z0-9_]+$/);
  return match ? match[0] : null;
}
