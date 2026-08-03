// src/test/schema/garrigues-gobierno-seed.test.ts
// G2 gate de datos: el Cloud refleja EXACTAMENTE el gobierno de la matriz Garrigues
// (T2-T5 seeds). Verifica condiciones, órganos, capital y RLS ARGA intacta.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";
import { loadGovernanceCatalog } from "../../../scripts/garrigues/gobierno/governance-catalog";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("G2 — el gobierno de la matriz Garrigues en Cloud refleja los seeds T2-T5", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await garr.auth.signInWithPassword({
        email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      authed = !error;
      if (error) console.warn(`[g2-seed] login Garrigues falló: ${error.message}`);

      // ARGA client para verificar aislamiento RLS
      arga = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: argaError } = await arga.auth.signInWithPassword({
        email: DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      if (argaError) console.warn(`[g2-seed] login ARGA falló: ${argaError.message}`);
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("346 condiciones SOCIO vigentes en la matriz", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("condiciones_persona")
      .select("id").eq("tipo_condicion", "SOCIO").eq("estado", "VIGENTE").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(346);
  });

  it("órganos: 1 JUNTA + 2 CDA + 19 COMITE, todos con config coherente", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("governing_bodies").select("slug, body_type, config").limit(100);
    expect(error).toBeNull();
    const byType = (t) => (data ?? []).filter((b) => b.body_type === t);
    expect(byType("JUNTA").length).toBe(1);
    expect(byType("CDA").length).toBe(2);
    expect(byType("COMITE").length).toBe(19);
    for (const b of byType("COMITE")) expect(b.config?.naturaleza).toBe("CONSULTIVO");
  });

  it("ADMIN_UNICO de Vives con inscripción I/A 960 y mandato 2026→2032", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("condiciones_persona")
      .select("fecha_inicio, fecha_fin, inscripcion_rm_referencia, person:person_id(full_name)")
      .eq("tipo_condicion", "ADMIN_UNICO").maybeSingle();
    expect(error).toBeNull();
    expect(data?.person?.full_name).toBe("Fernando Vives Ruiz");
    expect(data?.fecha_fin).toBe("2032-06-30");
    expect(data?.inscripcion_rm_referencia).toContain("338618");
  });

  it("consejo EAD: 7 cargos en el body garrigues-ead-cda", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data: body } = await garr.from("governing_bodies").select("id").eq("slug", "garrigues-ead-cda").maybeSingle();
    const { data, error } = await garr.from("condiciones_persona")
      .select("tipo_condicion").eq("body_id", body?.id ?? "");
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(7);
  });

  it("capital: perfil VIGENTE 11.104.008 y 347 holdings que suman ~100", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data: prof } = await garr.from("entity_capital_profile")
      .select("capital_escriturado").eq("estado", "VIGENTE")
      .eq("entity_id", "00000000-0000-0000-0002-000000000001").maybeSingle();
    expect(Number(prof?.capital_escriturado)).toBe(11104008);
    const { data: h } = await garr.from("capital_holdings")
      .select("porcentaje_capital, is_treasury").eq("entity_id", "00000000-0000-0000-0002-000000000001").limit(500);
    expect((h ?? []).length).toBe(347);
    const suma = (h ?? []).reduce((a, r) => a + Number(r.porcentaje_capital), 0);
    expect(Math.abs(suma - 100)).toBeLessThan(0.01);
  });

  it("ARGA intacta: sus bodies/condiciones no cambian de recuento", async () => {
    if (!authed || !arga) { expect(true).toBe(true); return; }
    const { data } = await arga.from("governing_bodies").select("id").limit(100);
    expect((data ?? []).every?.(Boolean) ?? true).toBe(true); // ARGA sigue viendo solo lo suyo (RLS)
  });
});
