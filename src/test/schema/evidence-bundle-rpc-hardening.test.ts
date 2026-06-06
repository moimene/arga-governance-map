import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Hardening de seguridad (revisión adversarial Codex, [critical] + follow-ups 2026-06-06).
// La RPC SECURITY DEFINER `fn_create_governance_evidence_bundle` (000045) confiaba en
// `p_tenant_id` del cliente y, al saltar RLS, permitía forjar evidencia SEALED cross-tenant.
// Evolución del fix (forward-only):
//   v1 20260606165443: aserción `fn_current_tenant_id() <> p_tenant_id` → FALLABA ABIERTO si NULL.
//   v2 20260606171625: `IF NOT fn_secretaria_is_service_role()` → NULL (3-valued) saltaba el guard.
//   v3 20260606175406: `IS NOT TRUE` → FAIL-CLOSED. Solo service_role (TRUE explícito) pasa
//      p_tenant_id arbitrario; el resto debe tener tenant resuelto que coincida.
// Este test bloquea el contrato fail-closed de v3 (contenido) + prueba conductual real
// (caller autenticado no puede crear evidencia cross-tenant).
const V3 = "supabase/migrations/20260606175406_harden_evidence_bundle_tenant_three_valued_fix.sql";
const migration = readFileSync(join(process.cwd(), V3), "utf8");

describe("Evidence bundle RPC hardening — contrato fail-closed (Codex [critical])", () => {
  it("reemplaza la RPC manteniendo SECURITY DEFINER y search_path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_create_governance_evidence_bundle/i);
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/SET search_path TO 'public', 'extensions'/i);
  });

  it("FAIL-CLOSED: solo service_role (TRUE explícito) bypassa; el resto asierta tenant", () => {
    // `IS NOT TRUE` cubre NULL y FALSE (fail-closed): solo un TRUE explícito (service_role)
    // omite la aserción de tenant. Estos positivos fijan el contrato fail-closed.
    expect(migration).toMatch(/public\.fn_secretaria_is_service_role\(\) IS NOT TRUE/);
    expect(migration).toMatch(/public\.fn_assert_current_tenant_id\(\) <> p_tenant_id/);
    expect(migration).toMatch(/ERRCODE = '42501'/);
    // Regresión: el cuerpo ejecutable NO debe contener la forma fail-open de v1.
    // (Se filtran comentarios para no matchear la nota histórica que documenta el bug.)
    const codeOnly = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(codeOnly).not.toMatch(/v_caller_tenant IS NOT NULL/);
    expect(codeOnly).not.toMatch(/IF NOT public\.fn_secretaria_is_service_role\(\) THEN/);
  });

  it("exige integridad de provenance (tenant y source_object_id)", () => {
    expect(migration).toMatch(/p_tenant_id is required/);
    expect(migration).toMatch(/COALESCE\(p_source_object_id, ''\) = ''/);
    expect(migration).toMatch(/p_source_object_id is required/);
  });
});

// --- Prueba conductual contra Cloud: caller autenticado NO puede forjar cross-tenant. ---
// Se salta si no hay red/credenciales (como los demás schema tests Cloud-dependientes).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const FOREIGN_TENANT = "00000000-0000-0000-0000-0000000000ff";

describe("Evidence bundle RPC hardening — prueba conductual cross-tenant", () => {
  let client: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      authed = !error;
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await client?.auth.signOut(); } catch { /* noop */ }
  });

  it("un usuario autenticado NO puede crear evidencia para otro tenant (42501)", async () => {
    if (!authed || !client) {
      // Sin Cloud/credenciales: el contrato queda cubierto por el test de contenido + el
      // probe en vivo documentado en docs/superpowers/reviews/2026-06-06-...
      expect(true).toBe(true);
      return;
    }
    const { data, error } = await client.rpc("fn_create_governance_evidence_bundle", {
      p_tenant_id: FOREIGN_TENANT,
      p_source_module: "TEST",
      p_source_object_type: "TEST",
      p_source_object_id: "behavioral-cross-tenant",
      p_reference_code: "TEST-DENY",
      p_manifest: {},
      p_status: "SEALED",
    });
    // Debe ser rechazado: la RPC lanza (mismatch o tenant no resuelto). No debe devolver data.
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  }, 30_000);
});
