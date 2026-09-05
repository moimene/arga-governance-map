// src/test/schema/garrigues-normativo-seed.test.ts
// G4 Task 3 gate de datos: 39 documentos normativos del tenant Garrigues con
// ownership resuelto a órganos REALES, y ARGA intacta. Patrón graceful-skip
// con clientes independientes por tenant (garrigues-rule-packs-seed.test.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

// OBLIGATORIO en toda sonda con más de un cliente: el preload de bun test monta
// un JSDOM con localStorage, así que supabase-js usa la MISMA storageKey para
// todos los clientes y el último login pisa a los anteriores. Sin esto, el
// cliente "Garrigues" acaba autenticado como ARGA y la sonda miente en verde.
const PERSIST_OFF = { auth: { persistSession: false } } as const;

describe("G4 Task 3 — catálogo normativo sembrado (Garrigues) y ARGA intacta", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  let seeded = false;

  beforeAll(async () => {
    // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
    authed = true;
    argaAuthed = true;
    const { count } = await garr.from("policies").select("id", { count: "exact", head: true });
    seeded = (count ?? 0) >= 39;
  });

  it("Garrigues ve exactamente 39 documentos normativos", async () => {
    if (!authed || !garr || !seeded) return;
    const { count, error } = await garr.from("policies").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(39);
  });

  it("las 32 PI están completas", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(data).toHaveLength(32);
  });

  it("el ownership acreditado apunta a órganos reales del tenant", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies")
      .select("policy_code, owner_body:owner_body_id(slug)")
      .in("policy_code", ["PI-30", "PI-14", "PBC-FT-10"]);
    const bySlug = Object.fromEntries(
      (data ?? []).map((r: Record<string, unknown>) => [
        r.policy_code as string,
        (r.owner_body as { slug?: string } | null)?.slug ?? null,
      ]),
    );
    expect(bySlug["PI-30"]).toBe("garrigues-comite-gobernanza-ia");
    expect(bySlug["PI-14"]).toBe("garrigues-comite-editorial-global");
    expect(bySlug["PBC-FT-10"]).toBe("garrigues-caci");
  });

  // El Comité de Práctica Profesional AUXILIA al Senior Partner en el PPD
  // (PPD-01 §8.1) e INFORMA en el Código Ético (art. 43.1); no es el
  // responsable en ninguno de los dos. Y el Catálogo ejemplificativo no
  // menciona comité alguno. Atribuírselos era sustituir al responsable que la
  // fuente nombra por un órgano parecido que sí estaba modelado.
  it("no se atribuye al comité que solo auxilia o informa", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies")
      .select("policy_code, owner_body_id, owner_function")
      .in("policy_code", ["PPD-01", "PPD-02", "PPD-CAT", "CE-2023", "PI-31"]);
    expect((data ?? []).length).toBe(5);
    for (const p of data ?? []) {
      expect(p.owner_body_id, `${p.policy_code} atribuido a un órgano que la fuente no hace responsable`).toBeNull();
      // El responsable que la fuente SÍ nombra es un cargo, y se dice.
      expect(p.owner_function, `${p.policy_code} sin el cargo responsable de la fuente`).toBeTruthy();
    }
  });

  it("solo 4 documentos tienen órgano responsable; el resto queda NULL", async () => {
    if (!authed || !garr || !seeded) return;
    const { count } = await garr
      .from("policies").select("id", { count: "exact", head: true }).not("owner_body_id", "is", null);
    expect(count).toBe(4);
  });

  it("PPD-02 y el Código de Conducta del Socio quedan etiquetados sin contenido", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies").select("policy_code, summary, content_outline").in("policy_code", ["PPD-02", "CCS"]);
    expect((data ?? []).length).toBe(2);
    for (const p of data ?? []) expect(p.summary, `${p.policy_code} no debería traer objeto`).toBeNull();
  });

  // Contracara del anterior: PPD-01 tiene su texto en la carpeta y debe
  // llegar con objeto e índice, no como documento "citado, no incorporado".
  it("PPD-01 llega con su objeto y su índice", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies").select("summary, content_outline, current_version").eq("policy_code", "PPD-01").maybeSingle();
    expect(data?.summary).toBeTruthy();
    expect((data?.content_outline as unknown[] | null)?.length ?? 0).toBeGreaterThan(15);
    expect(data?.current_version).toBe(3);
  });

  it("ARGA sigue con sus 25 políticas y sin ownership por órgano", async () => {
    if (!argaAuthed || !arga) return;
    const { count } = await arga.from("policies").select("id", { count: "exact", head: true });
    expect(count).toBe(25);
    const { count: owned } = await arga
      .from("policies").select("id", { count: "exact", head: true }).not("owner_body_id", "is", null);
    expect(owned).toBe(0);
  });

  it("ARGA no ve ninguna política de Garrigues", async () => {
    if (!argaAuthed || !arga) return;
    const { data } = await arga.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(data ?? []).toHaveLength(0);
  });
});
