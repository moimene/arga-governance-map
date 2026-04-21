// src/test/helpers/supabase-test-client.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Cliente con service role key para bypass de RLS en tests de schema.
 * SOLO usar en tests. Nunca en código de producción.
 *
 * Será `null` si faltan env vars (VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Los tests que lo usan deben chequear con `hasAdminClient()` y usar
 * `describe.skipIf(!hasAdminClient())` para saltar limpiamente en CI sin keys.
 */
export const supabaseAdmin: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

export function hasAdminClient(): boolean {
  return supabaseAdmin !== null;
}

export const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
export const DEMO_ENTITY_ARGA = "00000000-0000-0000-0000-000000000010";
