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
// G0 — tenant Garrigues (segundo tenant real en governance_OS, aislado por RLS).
// Seed de G0 creó el tenant y dos usuarios auth (SECRETARIO/ADMIN_TENANT).
export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";
export const GARRIGUES_DEMO_EMAIL = "demo@garrigues-demo.dev";
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

// ─── Sesión compartida por cuenta ────────────────────────────────────────────
//
// POR QUÉ EXISTE. Cada sonda de esquema abría sus propios clientes y hacía su
// propio login: ~20 ficheros × 2 cuentas ≈ 40 logins por corrida. Supabase Auth
// responde **HTTP 429 "Request rate limit reached"** bastante antes de eso
// —medido: de 8 logins concurrentes, 6 dan 429— y la suite empezó a fallar de
// forma no determinista, con el agravante de que unas sondas se ponían rojas y
// otras se saltaban en silencio, así que el recuento dejó de significar nada.
//
// Con memoización por cuenta, la corrida entera hace **2 logins**.
//
// El helper NO ofrecía esto: exportaba constantes y el cliente service-role,
// pero `signInWithPassword` no aparecía ni una vez. Por eso cada sonda se lo
// fabricó por su cuenta; no duplicaban el helper, construían lo que faltaba.

export type CuentaDemo = "ARGA" | "GARRIGUES";

const SUPABASE_URL_TEST =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";

// GOTCHA: `VITE_SUPABASE_ANON_KEY` NO EXISTE en este repo — el .env nombra la
// clave ANON_PUBLIC/PUBLISHABLE_KEY. Sin la 3ª rama, el bloque Cloud de una
// sonda pasa en verde SIN ASERTAR NADA. No quitar ninguna de las tres.
const ANON_KEY_TEST =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";

const PASSWORD_DEMO = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

const EMAIL_DE: Record<CuentaDemo, string> = {
  ARGA: process.env.DEMO_EMAIL || "demo@arga-seguros.com",
  GARRIGUES: GARRIGUES_DEMO_EMAIL,
};

/**
 * Cache de la PROMESA, no del cliente: si dos ficheros piden la misma cuenta a
 * la vez, comparten el login en vuelo en lugar de lanzar dos.
 */
const sesiones = new Map<CuentaDemo, Promise<SupabaseClient>>();

async function abrirSesion(cuenta: CuentaDemo): Promise<SupabaseClient> {
  // `storageKey` PROPIO por cuenta. El preload monta JSDOM con localStorage y
  // dos clientes de Supabase comparten storageKey por defecto: el último login
  // PISA al anterior, sin error. El cliente "de ARGA" acabaría autenticado como
  // Garrigues y las aserciones de aislamiento pasarían de forma vacua — sería
  // el verificador del aislamiento el que dejaría de verificar.
  const cliente = createClient(SUPABASE_URL_TEST, ANON_KEY_TEST, {
    auth: { persistSession: false, storageKey: `sb-test-${cuenta.toLowerCase()}` },
  });

  // Reintento SOLO ante 429, que es estrangulamiento y no un fallo del gate.
  // Cualquier otro error (clave rotada, credencial mala, Cloud caído) se
  // propaga: convertirlo en "espera un poco más" sería el mismo verde mudo con
  // otra ropa.
  const esperas = [800, 2000, 4500];
  for (let intento = 0; intento <= esperas.length; intento++) {
    const { error } = await cliente.auth.signInWithPassword({
      email: EMAIL_DE[cuenta],
      password: PASSWORD_DEMO,
    });
    if (!error) return cliente;
    if (error.status !== 429) {
      throw new Error(`login ${cuenta} falló (${error.status}): ${error.message}`);
    }
    if (intento === esperas.length) {
      throw new Error(`login ${cuenta}: 429 persistente tras ${esperas.length + 1} intentos`);
    }
    await new Promise((r) => setTimeout(r, esperas[intento]));
  }
  throw new Error(`login ${cuenta}: inalcanzable`);
}

/**
 * Cliente autenticado y memoizado por cuenta. LANZA si no puede autenticar:
 * una sonda que no puede mirar debe ponerse roja, no pasar en verde.
 */
export function sesionDe(cuenta: CuentaDemo): Promise<SupabaseClient> {
  let s = sesiones.get(cuenta);
  if (!s) {
    s = abrirSesion(cuenta);
    sesiones.set(cuenta, s);
  }
  return s;
}
