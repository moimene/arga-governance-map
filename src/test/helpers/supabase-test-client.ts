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
// Real Cloud UUID for ARGA Seguros, S.A. (entity was pre-seeded with a
// random UUID, not the 00000000-0000-0000-0000-000000000010 the plan
// assumed). Verified on project hzqwefkwsxopwrmtksbg at T17 dispatch time:
// SELECT id FROM entities WHERE legal_name = 'ARGA Seguros, S.A.';
// Updating this unblocks the T9 censo_snapshot trigger tests that were
// soft-skipping because the old UUID didn't match any existing entity.
export const DEMO_ENTITY_ARGA = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
// Stable UUIDs used by the T17 canonical seed. Kept as module constants
// so tests can reference the same IDs the seed script inserts/updates.
// Fundación, Cartera SLU and ARGA Seguros PJs already exist (created by
// T14 bootstrap) — their pre-existing ids are not stable, but their
// tax_ids below are canonical. Tests probe by tax_id, not by UUID.
export const DEMO_PJ_FUNDACION_TAX_ID = "G-99999901";
export const DEMO_PJ_CARTERA_TAX_ID = "B-99999902";
export const DEMO_PJ_ARGA_SEGUROS_TAX_ID = "A-99999903";
export const DEMO_PJ_MERCADO_LIBRE_TAX_ID = "X-99999904";
// Cartera ARGA S.L.U. entity UUID — stable on Cloud, so hardcoded.
export const DEMO_ENTITY_CARTERA = "00000000-0000-0000-0000-000000000020";
