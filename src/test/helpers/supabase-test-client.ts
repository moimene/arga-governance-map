// src/test/helpers/supabase-test-client.ts
/**
 * ⚠️ TEST-ONLY helper — NEVER import from production code (hooks, components, pages).
 *
 * Exposes a Supabase client configured with the service role key so schema tests
 * can bypass RLS. Two defenses prevent the key leaking to client bundles:
 *   1. `process.env.SUPABASE_SERVICE_ROLE_KEY` is not prefixed with `VITE_`, so Vite
 *      does NOT inline it into the client build.
 *   2. `import.meta.env.PROD` guard below: in any production build, `supabaseAdmin`
 *      is forced to `null` regardless of env, so even an accidental import cannot
 *      instantiate a service-role client at runtime.
 *
 * If env vars are missing (normal for local dev without `.env.local`), tests that
 * rely on `supabaseAdmin` must use `describe.skipIf(!hasAdminClient())` to skip
 * cleanly instead of failing.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Defense in depth: refuse to construct a service-role client in production builds.
const canCreate =
  !import.meta.env?.PROD && Boolean(url) && Boolean(serviceKey);

export const supabaseAdmin: SupabaseClient | null = canCreate
  ? createClient(url!, serviceKey!, { auth: { persistSession: false } })
  : null;

export function hasAdminClient(): boolean {
  return supabaseAdmin !== null;
}

export const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
export const DEMO_ENTITY_ARGA = "00000000-0000-0000-0000-000000000010";
