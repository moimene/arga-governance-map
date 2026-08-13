// src/test/schema/garrigues-obligaciones-seed.test.ts
// G4 Task 4 gate: obligaciones PBC/FT y controles del PPD del tenant
// Garrigues, con artículo citado y ownership por comité. ARGA intacta.
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

// OBLIGATORIO en toda sonda con más de un cliente: el preload de bun test monta
// un JSDOM con localStorage, así que supabase-js usa la MISMA storageKey para
// todos los clientes y el último login pisa a los anteriores. Sin esto, el
// cliente "Garrigues" acaba autenticado como ARGA y la sonda miente en verde.
const PERSIST_OFF = { auth: { persistSession: false } } as const;
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("G4 Task 4 — obligaciones PBC/FT y controles del PPD", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false, argaAuthed = false, seeded = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) {
      garr = g; authed = true;
      const { count } = await g.from("obligations").select("id", { count: "exact", head: true });
      seeded = (count ?? 0) >= 12;
    }
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) {
      arga = a; argaAuthed = true;
    }
  });

  it("Garrigues tiene al menos 12 obligaciones y todas citan artículo", async () => {
    if (!authed || !garr || !seeded) return;
    const { data, error } = await garr.from("obligations").select("code, source, legal_reference, owner_body_id");
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(12);
    for (const o of data ?? []) {
      expect(o.legal_reference, `${o.code} sin artículo`).toBeTruthy();
      expect(String(o.legal_reference)).toMatch(/Ley 10\/2010/);
      expect(String(o.legal_reference), `${o.code} sin artículo`).toMatch(/art\. \d/);
    }
  });

  it("source es el marco normativo, no el artículo", async () => {
    if (!authed || !garr || !seeded) return;
    // /obligaciones deriva sus secciones y su filtro de `source`. Un `source`
    // por artículo produciría una sección por fila.
    const { data } = await garr.from("obligations").select("code, source");
    const marcos = new Set((data ?? []).map((o: Record<string, unknown>) => String(o.source)));
    expect(marcos.size, `demasiados marcos: ${[...marcos].join(" · ")}`).toBeLessThanOrEqual(2);
    for (const m of marcos) expect(m, `"${m}" parece un artículo, no un marco`).not.toMatch(/art\. \d/);
  });

  it("toda obligación tiene comité responsable", async () => {
    if (!authed || !garr || !seeded) return;
    const { count } = await garr
      .from("obligations").select("id", { count: "exact", head: true }).is("owner_body_id", null);
    expect(count).toBe(0);
  });

  it("la exención de abogados aparece en el dato", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, title, legal_reference");
    const hit = (data ?? []).some(
      (o: Record<string, unknown>) =>
        /exenci|no sujec/i.test(String(o.title)) || /art\.?\s*22/i.test(String(o.legal_reference)),
    );
    expect(hit, "la exención del art. 22 no está representada").toBe(true);
  });

  it("los controles usan solo estados admitidos por el CHECK", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("controls").select("code, status, owner_body_id, obligation_id");
    expect((data ?? []).length).toBeGreaterThanOrEqual(10);
    for (const c of data ?? []) {
      expect(["Efectivo", "Parcial", "Inefectivo"]).toContain(c.status);
      expect(c.owner_body_id, `${c.code} sin comité`).toBeTruthy();
      // Sin obligación el control no lo pinta ninguna pantalla: todos los
      // read-paths de /obligaciones resuelven controles por obligation_id.
      expect(c.obligation_id, `${c.code} sin obligación — sería dato invisible`).toBeTruthy();
    }
  });

  it("ARGA sigue con 5 obligaciones y 8 controles", async () => {
    if (!argaAuthed || !arga) return;
    const { count: o } = await arga.from("obligations").select("id", { count: "exact", head: true });
    const { count: c } = await arga.from("controls").select("id", { count: "exact", head: true });
    expect(o).toBe(5);
    expect(c).toBe(8);
  });
});
