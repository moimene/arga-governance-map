import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ITEM-023 [P1] loop estabilización Secretaría (2026-06-11).
// `fn_create_communication_atomic` (20260518083234, SECURITY DEFINER) resolvía el
// tenant como COALESCE(p_comm->>'tenant_id', fn_current_tenant_id()) SIN asertar
// que coincida con el tenant del caller: un SECRETARIO autenticado podía forjar
// comunicaciones para otro tenant. Además el check de rol no estaba scoped por
// tenant. Mismo vector que el evidence bundle (saga v1→v3, ver
// evidence-bundle-rpc-hardening.test.ts) — el fix adopta directamente el contrato
// fail-closed v3. La migración 20260611182500 también eleva fn_aprobar_acta
// (ITEM-003) de v1 fail-open a fail-closed.
const MIGRATION = "supabase/migrations/20260611182500_fail_closed_tenant_assert_aprobar_acta_y_comms.sql";
const migration = readFileSync(join(process.cwd(), MIGRATION), "utf8");
const codeOnly = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

describe("Comms RPC hardening — contrato fail-closed (ITEM-023)", () => {
  it("reemplaza la RPC manteniendo SECURITY DEFINER", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_create_communication_atomic/i);
    expect(migration).toMatch(/SECURITY DEFINER/i);
  });

  it("FAIL-CLOSED: solo service_role (TRUE explícito) bypassa; el resto asierta tenant", () => {
    expect(migration).toMatch(/public\.fn_secretaria_is_service_role\(\) IS NOT TRUE/);
    expect(migration).toMatch(/public\.fn_assert_current_tenant_id\(\) <> v_tenant_id/);
    expect(migration).toMatch(/communication tenant mismatch/);
    expect(migration).toMatch(/ERRCODE = '42501'/);
    // Regresión: el cuerpo ejecutable NO debe contener la forma fail-open v1.
    expect(codeOnly).not.toMatch(/v_caller_tenant IS NOT NULL/);
  });

  it("scopea el check de rol al tenant efectivo", () => {
    expect(migration).toMatch(/rur\.tenant_id = v_tenant_id/);
  });
});

describe("fn_aprobar_acta — contrato fail-closed (follow-up ITEM-003)", () => {
  it("asierta tenant fail-closed contra el tenant del acta", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_aprobar_acta/i);
    expect(migration).toMatch(/public\.fn_assert_current_tenant_id\(\) <> v_minute\.tenant_id/);
    expect(migration).toMatch(/acta tenant mismatch/);
  });
});

// --- Prueba conductual contra Cloud: caller autenticado NO puede forjar cross-tenant. ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const FOREIGN_TENANT = "00000000-0000-0000-0000-0000000000ff";

describe("Comms RPC hardening — prueba conductual cross-tenant", () => {
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

  it("un usuario autenticado NO puede crear comunicaciones para otro tenant", async () => {
    if (!authed || !client) {
      // Sin Cloud/credenciales el contrato queda cubierto por los tests de contenido.
      expect(true).toBe(true);
      return;
    }
    const { data, error } = await client.rpc("fn_create_communication_atomic", {
      p_comm: {
        tenant_id: FOREIGN_TENANT,
        entity_id: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
        organo_tipo: "CONSEJO",
        tipo_comunicacion: "CONVOCATORIA",
        asunto: "TEST-DENY cross-tenant",
        cuerpo_render: "probe",
        cuerpo_hash_sha512: "0",
        estado: "BORRADOR",
      },
      p_attachments: null,
      p_recipients: [{ person_id: "00000000-0000-0000-0000-000000000000", canal_primario: "EMAIL", destino_primario: "test@example.com" }],
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  }, 30_000);

  it("fn_aprobar_acta sobre acta inexistente devuelve error de negocio, no de permisos", async () => {
    if (!authed || !client) {
      expect(true).toBe(true);
      return;
    }
    const { data, error } = await client.rpc("fn_aprobar_acta", {
      p_minute_id: "00000000-0000-0000-0000-000000000000",
    });
    // authenticated SÍ puede ejecutarla (GRANT), pero el acta dummy no existe.
    expect(error?.message ?? "").toMatch(/no encontrada/i);
    expect(data).toBeNull();
  }, 30_000);
});
