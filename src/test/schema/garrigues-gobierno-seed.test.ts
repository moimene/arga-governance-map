// src/test/schema/garrigues-gobierno-seed.test.ts
// G2 gate de datos: el Cloud refleja EXACTAMENTE el gobierno de la matriz Garrigues
// (T2-T5 seeds). Verifica condiciones, órganos, capital y RLS ARGA intacta.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";

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
  let argaAuthed = false;

  beforeAll(async () => {
    // Sesión COMPARTIDA y memoizada por cuenta: la suite entera hace 2 logins
    // en vez de ~40. Supabase Auth devolvía HTTP 429 al cruzar el umbral y la
    // suite fallaba de forma no determinista. `sesionDe` LANZA si no puede
    // autenticar, así que el gate se pone rojo en vez de saltarse en silencio,
    // y cada cuenta lleva su propio storageKey para que un login no pise al otro.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
    // `sesionDe` lanza si no autentica, así que llegar aquí ya lo garantiza.
    // Se conservan las banderas porque los `it` las consultan: sin ponerlas a
    // true, TODOS los tests de este fichero se saltarían en silencio — que es
    // justo el defecto que esta tarea vino a cerrar.
    authed = true;
    argaAuthed = true;
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA y cerrarla aquí dejaría
  // sin autenticar a todas las sondas que corran después.

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
      // El embed `person:person_id(...)` es to-ONE por la FK, asi que PostgREST
      // devuelve un OBJETO. Sin tipos de `Database`, TS no puede saber la
      // cardinalidad y asume array: la forma se declara aqui, sin castear.
      .eq("tipo_condicion", "ADMIN_UNICO")
      .maybeSingle<{
        fecha_inicio: string; fecha_fin: string;
        inscripcion_rm_referencia: string; person: { full_name: string } | null;
      }>();
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

  it("ARGA intacta: RLS aísla — su cliente ve sus bodies y ninguno de Garrigues", async () => {
    if (!argaAuthed || !arga) { expect(true).toBe(true); return; }
    const { data, error } = await arga.from("governing_bodies").select("id, tenant_id").limit(200);
    expect(error).toBeNull();
    // ARGA sigue viendo su gobierno (no lo vació el seed Garrigues)...
    expect((data ?? []).length).toBeGreaterThan(0);
    // ...y SOLO el suyo: la RLS nunca deja filtrar filas de otro tenant.
    expect((data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });
});
