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

  // Las dos exclusiones han de estar ETIQUETADAS COMO TALES en el título: es
  // el requisito, no la mera presencia del artículo. Si solo se comprobara
  // `legal_reference`, una fila titulada como obligación exigible pasaría el
  // gate, que es justo el error que se quiere impedir.
  it("la exención de abogados aparece etiquetada como exclusión", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, title, legal_reference");
    const hit = (data ?? []).some(
      (o: Record<string, unknown>) =>
        /art\.?\s*22/i.test(String(o.legal_reference)) &&
        /exenci|excepci|exclusi|no sujec/i.test(String(o.title)),
    );
    expect(hit, "la exención del art. 22 no está etiquetada como exclusión en el título").toBe(true);
  });

  it("la comunicación sistemática está como excepción, no como obligación exigible", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, title, legal_reference");
    const rows = (data ?? []) as Record<string, unknown>[];
    // No puede quedar ninguna fila que afirme la comunicación sistemática como
    // deber del despacho: el RD 304/2014 art. 27.3 exceptúa al art. 2.1.ñ.
    for (const o of rows) {
      if (!/sistem[áa]tica/i.test(String(o.title))) continue;
      expect(String(o.title), `${o.code} afirma la comunicación sistemática como exigible`).toMatch(
        /exenci|excepci|exclusi|no sujec|no es exigible/i,
      );
    }
    const hit = rows.some(
      (o) => /27\.3/.test(String(o.legal_reference)) && /excepci|exclusi|no es exigible/i.test(String(o.title)),
    );
    expect(hit, "la excepción del RD 304/2014 art. 27.3 no está representada").toBe(true);

    // Ningún control puede afirmar que el despacho remite comunicaciones
    // sistemáticas: el seed retira los que lo hacían.
    const { data: ctr } = await garr.from("controls").select("code, name");
    const falso = (ctr ?? []).find((c: Record<string, unknown>) =>
      /comunicaci[óo]n sistem[áa]tica/i.test(String(c.name)) && !/vigencia|excepci/i.test(String(c.name)),
    );
    expect(falso?.code, `${falso?.code} afirma una comunicación sistemática que el despacho no ejecuta`).toBeUndefined();
  });

  // `periodicity` solo se rellena cuando la NORMA la fija (COMMENT de la
  // columna). El art. 7 exige un análisis de riesgo "que en todo caso deberá
  // constar por escrito" y el art. 26.5 un manual "que se mantendrá
  // actualizado": ninguno impone cadencia. Ponerles ANUAL crea un vencimiento
  // que la ley no exige. Los art. 28 ("examen anual") y 29 ("plan anual") sí
  // son literales y deben conservarla.
  it("la periodicidad solo aparece donde el artículo la fija", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, legal_reference, periodicity");
    const byArt = (art: string) =>
      (data ?? []).find((o: Record<string, unknown>) => String(o.legal_reference).endsWith(`art. ${art}`)) as
        | Record<string, unknown>
        | undefined;
    for (const art of ["7", "26"]) {
      const row = byArt(art);
      expect(row, `no encuentro la obligación del art. ${art}`).toBeTruthy();
      expect(row!.periodicity, `art. ${art}: la norma no fija periodicidad`).toBeNull();
    }
    for (const art of ["28", "29"]) {
      const row = byArt(art);
      expect(row, `no encuentro la obligación del art. ${art}`).toBeTruthy();
      expect(row!.periodicity, `art. ${art}: la norma dice "anual" y debe conservarse`).toBe("ANUAL");
    }
  });

  // Cotejado contra el texto consolidado del BOE (RD 304/2014, última
  // actualización publicada el 24/04/2024): el art. 27.3 vigente es idéntico
  // al del expediente y la excepción sigue alcanzando al art. 2.1.ñ. El
  // criterio deja de ser DEMO_PILOTO, y a cambio la cita que llega a pantalla
  // tiene que decir en qué versión se apoya.
  it("la excepción del art. 27.3 ya no es un criterio pendiente y cita la versión cotejada", async () => {
    if (!authed || !garr || !seeded) return;
    const { data } = await garr.from("obligations").select("code, title, legal_reference");
    const row = (data ?? []).find((o: Record<string, unknown>) => /27\.3/.test(String(o.legal_reference))) as
      | Record<string, unknown>
      | undefined;
    expect(row, "no encuentro la excepción del RD 304/2014 art. 27.3").toBeTruthy();
    expect(String(row!.title)).not.toMatch(/DEMO_PILOTO|pendiente de confirmaci/i);
    expect(String(row!.legal_reference), "la cita no dice sobre qué versión consolidada se apoya").toMatch(
      /consolidad\w*\s+del BOE de \d{2}\/\d{2}\/\d{4}/i,
    );
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
