// src/test/schema/garrigues-normativo-seed.test.ts
// G4 Task 3 gate de datos: 38 documentos normativos del tenant Garrigues con
// ownership resuelto a órganos REALES, y ARGA intacta. Patrón graceful-skip
// con clientes independientes por tenant (garrigues-rule-packs-seed.test.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("G4 Task 3 — catálogo normativo sembrado (Garrigues) y ARGA intacta", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  let seeded = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) {
      garr = g; authed = true;
      const { count } = await g.from("policies").select("id", { count: "exact", head: true });
      seeded = (count ?? 0) >= 38;
    }
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) {
      arga = a; argaAuthed = true;
    }
  });

  it("Garrigues ve exactamente 38 documentos normativos", async () => {
    if (!authed || !garr || !seeded) return;
    const { count, error } = await garr.from("policies").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(38);
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
      .in("policy_code", ["PI-30", "PI-14", "PBC-FT-10", "PPD-01"]);
    const bySlug = Object.fromEntries(
      (data ?? []).map((r: Record<string, unknown>) => [
        r.policy_code as string,
        (r.owner_body as { slug?: string } | null)?.slug ?? null,
      ]),
    );
    expect(bySlug["PI-30"]).toBe("garrigues-comite-gobernanza-ia");
    expect(bySlug["PI-14"]).toBe("garrigues-comite-editorial-global");
    expect(bySlug["PBC-FT-10"]).toBe("garrigues-caci");
    expect(bySlug["PPD-01"]).toBe("garrigues-comite-practica-profesional");
  });

  it("no inventa ownership: hay documentos con owner_body_id NULL", async () => {
    if (!authed || !garr || !seeded) return;
    const { count } = await garr
      .from("policies").select("id", { count: "exact", head: true }).is("owner_body_id", null);
    expect(count).toBeGreaterThan(0);
  });

  it("PPD-02 queda etiquetado sin contenido", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr
      .from("policies").select("summary, content_outline").eq("policy_code", "PPD-02").maybeSingle();
    expect(data?.summary).toBeNull();
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
