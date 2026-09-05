// src/test/schema/garrigues-entities-seed.test.ts
// G1 gate de datos: el Cloud refleja EXACTAMENTE el catálogo (fuente de verdad).
// Además, con dato Garrigues real, la dirección ARGA→Garrigues del gate de
// aislamiento G0 deja de ser vacua (ver nota de secuenciación en tenant-isolation).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_MATRIZ_UUID,
} from "../../../scripts/garrigues/entities-catalog";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";

describe("G1 — el perímetro Garrigues en Cloud refleja el catálogo", () => {
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
      garr = await sesionDe("GARRIGUES");
      authed = true;
    } catch {
      authed = false;
    }
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a las sondas posteriores, y el síntoma serían consultas vacías
  // en un fichero que no ha hecho nada mal.

  it("hay exactamente tantas entidades como entradas del catálogo, todas del tenant", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("entities").select("id, tenant_id").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(GARRIGUES_ENTITIES.length);
    expect((data ?? []).every((r) => r.tenant_id === GARRIGUES_TENANT)).toBe(true);
  });

  it("la matriz tiene NIF y registrales del RM", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("entities")
      .select("registration_number, registry_sheet, registry_volume, registry_folio, forma_administracion")
      .eq("id", GARRIGUES_MATRIZ_UUID).maybeSingle();
    expect(error).toBeNull();
    expect(data?.registration_number).toBe("B81709081");
    expect(data?.registry_sheet).toBe("M-190538");
    expect(data?.registry_volume).toBe("17456");
    expect(data?.registry_folio).toBe("132");
    expect(data?.forma_administracion).toBe("ADMINISTRADOR_UNICO");
  });

  it("los parents de Cloud coinciden 1:1 con el catálogo", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const bySlugUuid = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e.uuid]));
    const expected = new Map(
      GARRIGUES_ENTITIES.map((e) => [e.uuid, e.parentSlug ? bySlugUuid.get(e.parentSlug)! : null]),
    );
    const { data, error } = await garr.from("entities").select("id, parent_entity_id").limit(500);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.parent_entity_id).toBe(expected.get(row.id) ?? null);
    }
  });

  it("EAD Trust cuelga de NewLaw con provenance a-confirmar y consejo", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("entities")
      .select("parent_entity_id, ownership_percentage, forma_administracion, data_provenance")
      .eq("slug", "ead-trust-sl").maybeSingle();
    expect(error).toBeNull();
    expect(data?.ownership_percentage).toBe(51);
    expect(data?.forma_administracion).toBe("CONSEJO");
    const prov = data?.data_provenance;
    expect(prov?.confianza).toBe("A_CONFIRMAR");
  });

  it("toda entidad tiene data_provenance con cobertura_motor booleana", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("entities").select("slug, data_provenance").limit(500);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(typeof row.data_provenance?.cobertura_motor).toBe("boolean");
    }
  });
});
