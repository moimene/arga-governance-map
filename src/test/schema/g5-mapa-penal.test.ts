// src/test/schema/g5-mapa-penal.test.ts
// G5 — la extracción del mapa penal es determinista y NO puede degradar en
// silencio. El P0 nº2 de G4 fue justamente eso: un índice topado en 40 que se
// pintaba como completo. Aquí cualquier pérdida de filas rompe el gate.
import { existsSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extraerMapa, AREAS_NEGOCIO, DEPARTAMENTOS_INTERNOS, PDF_AREAS, PDF_DEPTOS } from "../../../scripts/garrigues/penal/extract-mapa";
import { MAPA_PENAL, CELDAS_BANDA_ALTA } from "../../../scripts/garrigues/penal/mapa-penal";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const haySrc = existsSync(PDF_AREAS) && existsSync(PDF_DEPTOS);
const d = haySrc ? describe : describe.skip;

d("G5 — extracción del mapa de riesgos penales", () => {
  const areas = extraerMapa(PDF_AREAS, AREAS_NEGOCIO);
  const deptos = extraerMapa(PDF_DEPTOS, DEPARTAMENTOS_INTERNOS);

  it("los dos mapas dan exactamente 82 filas y 9 columnas", () => {
    expect(areas.filas).toHaveLength(82);
    expect(deptos.filas).toHaveLength(82);
    expect(areas.columnas).toHaveLength(9);
    expect(deptos.columnas).toHaveLength(9);
    for (const f of [...areas.filas, ...deptos.filas]) expect(f.celdas).toHaveLength(9);
  });

  it("ninguna fila se queda sin etiqueta", () => {
    for (const f of areas.filas) expect(`${f.articulo}${f.delito}`.trim()).not.toBe("");
  });

  it("el histograma de color es exactamente el medido", () => {
    const cuenta = (m: typeof areas) => {
      const h: Record<string, number> = {};
      for (const f of m.filas) for (const c of f.celdas) h[c] = (h[c] ?? 0) + 1;
      return h;
    };
    expect(cuenta(areas)).toEqual({
      GRIS: 454, VERDE_CLARO: 223, AMARILLO: 40, VERDE_INTENSO: 13, NARANJA: 7, ROJO: 1,
    });
    expect(cuenta(deptos)).toEqual({
      GRIS: 586, VERDE_CLARO: 105, VERDE_INTENSO: 43, AMARILLO: 4,
    });
  });

  it("la banda alta son 8 celdas y el único rojo es contrabando en Fiscal", () => {
    const altas: string[] = [];
    let rojo: { delito: string; columna: string } | null = null;
    areas.filas.forEach((f) =>
      f.celdas.forEach((c, i) => {
        if (c === "NARANJA" || c === "ROJO") altas.push(`${f.delito}|${areas.columnas[i]}`);
        if (c === "ROJO") rojo = { delito: f.delito, columna: areas.columnas[i] };
      }),
    );
    expect(altas).toHaveLength(8);
    expect(rojo!.columna).toBe("Fiscal");
    expect(rojo!.delito.toLowerCase()).toContain("contrabando");
    for (const f of deptos.filas) {
      expect(f.celdas).not.toContain("NARANJA");
      expect(f.celdas).not.toContain("ROJO");
    }
  });
});

describe("G5 — catálogo penal congelado", () => {
  it("tiene los 82 delitos con código único y correlativo", () => {
    expect(MAPA_PENAL).toHaveLength(82);
    expect(new Set(MAPA_PENAL.map((d) => d.codigo)).size).toBe(82);
    expect(MAPA_PENAL[0].codigo).toBe("RSK-GARR-PEN-001");
    expect(MAPA_PENAL[81].codigo).toBe("RSK-GARR-PEN-082");
  });

  it("cada delito trae las 18 columnas", () => {
    for (const d of MAPA_PENAL) {
      expect(Object.keys(d.areas_negocio)).toHaveLength(9);
      expect(Object.keys(d.departamentos_internos)).toHaveLength(9);
    }
  });

  it("la banda por delito es exactamente la medida", () => {
    const h: Record<string, number> = {};
    for (const d of MAPA_PENAL) h[d.banda] = (h[d.banda] ?? 0) + 1;
    expect(h).toEqual({ ROJO: 1, NARANJA: 7, AMARILLO: 19, VERDE: 44, NO_EVALUADA: 11 });
  });

  it("la banda colapsa los dos verdes: ningún delito se clasifica por el verde que sea", () => {
    expect(MAPA_PENAL.map((d) => d.banda)).not.toContain("VERDE_CLARO");
    expect(MAPA_PENAL.map((d) => d.banda)).not.toContain("VERDE_INTENSO");
  });

  it("las 8 celdas de banda alta están, con el rojo de contrabando en Fiscal", () => {
    expect(CELDAS_BANDA_ALTA).toHaveLength(8);
    const rojos = CELDAS_BANDA_ALTA.filter((c) => c.celda === "ROJO");
    expect(rojos).toHaveLength(1);
    expect(rojos[0].columna).toBe("Fiscal");
    expect(rojos[0].delito.toLowerCase()).toContain("contrabando");
  });
});

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const PERSIST_OFF = { auth: { persistSession: false } } as const;

describe("G5 — datos penales en Cloud (Supabase)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const g = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await g.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD })).error) garr = g;
    const a = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, PERSIST_OFF);
    if (!(await a.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD })).error) arga = a;
  });

  it("las 3 columnas nuevas existen y se pueden seleccionar", async () => {
    if (!garr) return;
    const { error } = await garr.from("risks")
      .select("code, assessed_band, assessment_breakdown, assessment_provenance").limit(1);
    expect(error).toBeNull();
  });

  it("ARGA intacta: sus riesgos tienen las 3 columnas en NULL", async () => {
    if (!arga) return;
    const { data, error } = await arga.from("risks")
      .select("code, assessed_band, assessment_breakdown, assessment_provenance");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) {
      expect(r.assessed_band, `${r.code}`).toBeNull();
      expect(r.assessment_breakdown, `${r.code}`).toBeNull();
      expect(r.assessment_provenance, `${r.code}`).toBeNull();
    }
  });

  it("Garrigues tiene los 82 riesgos penales con banda y desglose", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("risks")
      .select("code, title, assessed_band, assessment_breakdown, assessment_provenance, probability, impact, residual_score, module_id")
      .like("code", "RSK-GARR-PEN-%").order("code");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(82);

    const h: Record<string, number> = {};
    for (const r of rows) h[r.assessed_band as string] = (h[r.assessed_band as string] ?? 0) + 1;
    expect(h).toEqual({ ROJO: 1, NARANJA: 7, AMARILLO: 19, VERDE: 44, NO_EVALUADA: 11 });

    for (const r of rows) {
      expect(r.probability, `${r.code}`).toBeNull();
      expect(r.impact, `${r.code}`).toBeNull();
      expect(r.residual_score, `${r.code}`).toBeNull();
      expect(r.module_id).toBe("risk");
      const b = r.assessment_breakdown as Record<string, Record<string, unknown>>;
      expect(Object.keys(b.areas_negocio)).toHaveLength(9);
      expect(Object.keys(b.departamentos_internos)).toHaveLength(9);
      const p = r.assessment_provenance as Record<string, unknown>;
      expect((p.escala as Record<string, unknown>).leyenda_en_fuente).toBe(false);
      expect((p.escala as Record<string, unknown>).orden_indeterminado).toEqual(["VERDE_INTENSO", "VERDE_CLARO"]);
    }
  });

  it("un riesgo sin score NO se replica al backbone como 'Bajo'", async () => {
    if (!garr) return;
    const { data: r } = await garr.from("risks")
      .select("id, code").eq("assessed_band", "ROJO").maybeSingle();
    if (!r) return;
    const { data: b, error } = await garr.from("grc_risks")
      .select("id, inherent_severity, residual_severity").eq("id", r.id).maybeSingle();
    expect(error).toBeNull();
    expect(b, `el riesgo ${r.code} no llegó al backbone`).not.toBeNull();
    expect(b!.inherent_severity).toBe("No evaluado");
    expect(b!.residual_severity).toBe("No evaluado");
  });

  it("los 8 hallazgos de banda alta están, sin severidad inventada", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("findings")
      .select("code, title, severity, status, origin, due_date, owner_id").like("code", "FND-GARR-PEN-%");
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(8);
    for (const r of rows) {
      expect(r.severity, `${r.code}`).toBeNull();
      expect(r.status).toBe("Abierto");
      expect(r.origin as string).toContain("Mapa de riesgos penales evaluado 2025");
      expect(r.due_date, `${r.code}`).toBeNull();
      expect(r.owner_id, `${r.code}`).toBeNull();
    }
    expect(rows.some((r) => (r.title as string).toLowerCase().includes("contrabando"))).toBe(true);
  });

  it("los 4 controles del Plan de seguimiento del PPD están sembrados", async () => {
    if (!garr) return;
    const { data, error } = await garr.from("controls")
      .select("code, name").in("code", ["CTR-GARR-25", "CTR-GARR-26", "CTR-GARR-27", "CTR-GARR-28"]);
    expect(error).toBeNull();
    expect((data ?? [])).toHaveLength(4);
  });

  it("action_plans sigue vacío para Garrigues: la fuente no publica la lista", async () => {
    if (!garr) return;
    const { data } = await garr.from("findings").select("id").like("code", "FND-GARR-PEN-%");
    const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return;
    const { count } = await garr.from("action_plans")
      .select("id", { count: "exact", head: true }).in("finding_id", ids);
    expect(count ?? 0).toBe(0);
  });
});
