// src/test/schema/tenant-isolation.test.ts
// G0 gate de salida: aislamiento RLS bidireccional ARGA ⇄ Garrigues.
// Primera vez que governance_OS opera con 2 tenants activos reales.
// GOTCHA documentado (Oleada 3A): un write cross-tenant filtrado por RLS
// devuelve 0 filas SIN error — se asierta "no mutó", no "dio 42501".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
  GARRIGUES_TENANT,
  GARRIGUES_DEMO_EMAIL,
  sesionDe,
} from "../helpers/supabase-test-client";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

// Tablas de dominio representativas de cada superficie (Secretaría, motor,
// plantillas, expedientes, sistema normativo GRC, riesgos penales, hallazgos).
// Todas tienen tenant_id NOT NULL. G5 Task 9: añadidas risks y findings.
const DOMAIN_TABLES = [
  "entities", "document_templates", "rule_packs", "agreements",
  "policies", "obligations", "controls", "risks", "findings",
];

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

describe("G0 — aislamiento RLS bidireccional ARGA ⇄ Garrigues", () => {
  let arga: SupabaseClient | null = null;
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    // Sesión COMPARTIDA y memoizada: la suite entera hace 2 logins en vez de
    // ~40. `sesionDe` LANZA si no puede autenticar, así que el gate se pone
    // rojo en vez de saltarse en silencio.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
    authed = true;
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría
  // sin autenticar a todas las sondas que corran después de esta.

  it("el perfil del usuario Garrigues resuelve a su tenant", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("user_profiles").select("tenant_id, role_code").maybeSingle();
    expect(error).toBeNull();
    expect(data?.tenant_id).toBe(GARRIGUES_TENANT);
    expect(data?.role_code).toBe("SECRETARIO");
  });

  // Las dos direcciones NO tienen la misma fuerza, y el gate no finge que sí:
  //  - "Garrigues no ve filas ARGA": aserción real en las 7 tablas, porque
  //    ARGA tiene filas en todas. Es además la dirección de riesgo real (el
  //    dato histórico y sensible es el de ARGA).
  //  - "ARGA no ve filas Garrigues": vacua en las tablas donde Garrigues aún
  //    no tiene dato propio — al 2026-08-16, `document_templates` (0 filas) y
  //    `agreements` (0 filas). Ahí se comprueba que ARGA no ve algo que no
  //    existe.
  // NO se siembran filas falsas para cerrar ese hueco: un gate honesto y más
  // débil vale más que uno fuerte de mentira. En vez de eso, cada iteración
  // pregunta a Garrigues si tiene dato propio y DECLARA la vacuidad en la
  // salida del runner, de modo que el aviso desaparece solo el día que la
  // tabla se siembre (el comentario no se queda desfasado).
  // El bucle genera 14 tests (7 tablas × 2 direcciones), más los 5 fijos = 19.
  for (const table of DOMAIN_TABLES) {
    it(`Garrigues no ve filas ARGA en ${table}`, async () => {
      if (!authed || !garr) { expect(true).toBe(true); return; }
      const { data, error } = await garr.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id !== GARRIGUES_TENANT);
      expect(foreign).toEqual([]);
    });

    it(`ARGA no ve filas Garrigues en ${table}`, async () => {
      if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
      const { data, error } = await arga.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id === GARRIGUES_TENANT);
      expect(foreign).toEqual([]);

      const own = await garr.from(table).select("tenant_id").limit(1);
      if (!own.error && (own.data ?? []).length === 0) {
        console.warn(
          `[tenant-isolation] dirección VACUA: Garrigues no tiene filas en ${table}, ` +
            "así que esta aserción no prueba aislamiento (la inversa sí).",
        );
      }
    });
  }

  it("ARGA sí ve su propio dato (la sonda no pasa por lista vacía global)", async () => {
    if (!authed || !arga) { expect(true).toBe(true); return; }
    const { data, error } = await arga
      .from("entities").select("id, tenant_id").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it("write cross-tenant: Garrigues no muta una entity ARGA (0 filas, sin error)", async () => {
    if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
    const before = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(before.error).toBeNull();

    const attempt = await garr
      .from("entities")
      .update({ common_name: "PROBE-DENY-G0" })
      .eq("id", DEMO_ENTITY_ARGA)
      .select();
    // GOTCHA: RLS filtra → 0 filas afectadas, SIN 42501.
    expect(attempt.error).toBeNull();
    expect(attempt.data ?? []).toEqual([]);

    const after = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(after.error).toBeNull();
    expect(after.data?.common_name).toBe(before.data?.common_name);
  });

  it("write cross-tenant: Garrigues no muta el tenant ARGA (branding, 0 filas, sin error)", async () => {
    if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
    const before = await arga
      .from("tenants").select("branding").eq("id", DEMO_TENANT).maybeSingle();
    expect(before.error).toBeNull();

    const attempt = await garr
      .from("tenants")
      .update({ branding: { nombre: "PROBE-DENY-TENANTS-G0" } })
      .eq("id", DEMO_TENANT)
      .select();
    // GOTCHA: RLS filtra → 0 filas afectadas, SIN 42501 (misma semántica que entities).
    expect(attempt.error).toBeNull();
    expect(attempt.data ?? []).toEqual([]);

    const after = await arga
      .from("tenants").select("branding").eq("id", DEMO_TENANT).maybeSingle();
    expect(after.error).toBeNull();
    expect(after.data?.branding?.nombre).toBe(before.data?.branding?.nombre);
    expect(after.data?.branding?.nombre).not.toBe("PROBE-DENY-TENANTS-G0");
  });

  it("excepción documentada: tenants es lectura pública (branding no es secreto)", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("tenants").select("id").limit(50);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(DEMO_TENANT);
    expect(ids).toContain(GARRIGUES_TENANT);
  });
});
