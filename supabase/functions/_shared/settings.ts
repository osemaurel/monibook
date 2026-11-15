import { type SupabaseClient, z } from "./deps.ts";
import { SERVICE_NAMES } from "./services/types.ts";

export const ProviderSettings = z.partialRecord(z.enum(SERVICE_NAMES), z.string().min(1));
export type ProviderSettings = z.infer<typeof ProviderSettings>;

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

export async function readSetting<T>(
  admin: SupabaseClient,
  key: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return schema.parse(cached.value);

  const { data, error } = await admin.from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Cannot read setting ${key}: ${error.message}`);

  const value = schema.parse(data?.value ?? {});
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function readProviderSettings(admin: SupabaseClient): Promise<ProviderSettings> {
  return readSetting(admin, "providers", ProviderSettings);
}
