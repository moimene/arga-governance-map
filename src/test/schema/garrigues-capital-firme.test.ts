// C1 Task 3 — sonda de Cloud: el capital de la matriz Garrigues es el del art. 7
// de los Estatutos y su procedencia es FIRME.
//
// NO hay graceful-skip. Si el login falla, `beforeAll` lanza y los tests revientan:
// una sonda que se salta a sí misma es un gate verde que no asierta nada.
// Registro canónico del criterio: docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

const MATRIZ = "00000000-0000-0000-0002-000000000001";
const ARGA_ENTITY = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
// Los 3 socios con presencia física en la Junta de 06/05/2026 (acta).
const PRESENCIALES = ["Fernando Vives Ruiz", "Rosa Zarza Jimeno", "Roberto Delgado Gil"];

describe("C1 — capital de la matriz Garrigues FIRME por el art. 7", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;

  beforeAll(async () => {
    // Cada cliente con persistSession:false: el preload de bun test monta JSDOM con
    // localStorage y, sin esto, ambos comparten storageKey y el último login pisa al otro.
    garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eGarr } = await garr.auth.signInWithPassword({
      email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD,
    });
    if (eGarr) throw new Error(`login Garrigues falló: ${eGarr.message}`);

    arga = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eArga } = await arga.auth.signInWithPassword({
      email: ARGA_EMAIL, password: DEMO_PASSWORD,
    });
    if (eArga) throw new Error(`login ARGA falló: ${eArga.message}`);
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("la matriz tiene las dos clases del art. 7", async () => {
    const { data, error } = await garr.from("share_classes")
      .select("class_code, votes_per_title, nominal_value, total_titulos")
      .eq("entity_id", MATRIZ).order("class_code");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ class_code: "A", votes_per_title: 25, nominal_value: 16000, total_titulos: 694 });
    expect(data[1]).toMatchObject({ class_code: "B", votes_per_title: 1, nominal_value: 1, total_titulos: 8 });
  });

  it("los holdings reproducen la estructura y la procedencia es FIRME", async () => {
    const { data, error } = await garr.from("capital_holdings")
      .select("numero_titulos, is_treasury, metadata, share_class_id, porcentaje_capital")
      .eq("entity_id", MATRIZ).limit(500);
    expect(error).toBeNull();
    expect(data).toHaveLength(347);                                   // 338 A + 8 B + autocartera
    expect(data.filter((h) => h.is_treasury)).toHaveLength(1);
    expect(data.find((h) => h.is_treasury).numero_titulos).toBe(18);
    expect(data.every((h) => h.metadata?.confianza === "FIRME")).toBe(true);
    expect(data.every((h) => h.metadata?.fuente === "art. 7 de los Estatutos Sociales")).toBe(true);
    // La estructura es FIRME; el emparejamiento socio↔clase sigue etiquetado.
    expect(data.filter((h) => !h.is_treasury).every((h) => h.metadata?.asignacion_clase === "INFERIDO")).toBe(true);
    expect(data.every((h) => h.share_class_id)).toBe(true);
    const suma = data.reduce((s, h) => s + Number(h.porcentaje_capital), 0);
    expect(suma).toBeCloseTo(100, 4);
  });

  it("el reparto por clases es 338 titularidades de A de cuota, 8 de B y 694 títulos A", async () => {
    const { data: clases } = await garr.from("share_classes")
      .select("id, class_code").eq("entity_id", MATRIZ);
    const idA = clases.find((c) => c.class_code === "A").id;
    const idB = clases.find((c) => c.class_code === "B").id;
    const { data, error } = await garr.from("capital_holdings")
      .select("numero_titulos, is_treasury, share_class_id").eq("entity_id", MATRIZ).limit(500);
    expect(error).toBeNull();
    const enA = data.filter((h) => h.share_class_id === idA);
    const enB = data.filter((h) => h.share_class_id === idB);
    expect(enB).toHaveLength(8);
    expect(enB.every((h) => h.numero_titulos === 1)).toBe(true);
    expect(enA.filter((h) => !h.is_treasury)).toHaveLength(338);
    expect(enA.reduce((s, h) => s + h.numero_titulos, 0)).toBe(694);  // 338 × 2 + 18 autocartera
  });

  it("la autocartera queda fuera del cómputo de voto", async () => {
    const { data, error } = await garr.from("capital_holdings")
      .select("id, voting_rights").eq("entity_id", MATRIZ).eq("is_treasury", true).single();
    expect(error).toBeNull();
    expect(data.voting_rights).toBe(false);
    // `parte_votante_current.exclusion_policy` NO admite 'AUTOCARTERA' (CHECK de
    // 20260421114220: NONE|EXCLUIR_QUORUM|EXCLUIR_VOTO|EXCLUIR_AMBOS) y
    // fn_refresh_parte_votante_entity no la escribe. Filtrar por ese valor
    // devolvería 0 filas y el test pasaría en vacío: la proyección de la
    // autocartera se localiza por su source_id, y se exige que EXISTA.
    const { data: pv, error: ePv } = await garr.from("parte_votante_current")
      .select("voting_weight, denominator_weight, voting_rights, source_type")
      .eq("entity_id", MATRIZ).eq("source_id", data.id);
    expect(ePv).toBeNull();
    expect(pv).toHaveLength(1);
    expect(pv[0].source_type).toBe("CAPITAL");
    expect(pv[0].voting_rights).toBe(false);
    expect(Number(pv[0].voting_weight)).toBe(0);
    expect(Number(pv[0].denominator_weight)).toBe(0);
  });

  it("la proyección pondera por VOTOS: la clase B pesa 1/50 de la A, no 1/800.000", async () => {
    // Migración 20260829150000. Antes, `voting_weight = porcentaje_capital x
    // votes_per_title` hacía que un socio de clase B pesara 800.000 veces menos
    // que uno de clase A, cuando el art. 7 dice 50. Ahora es la cuota de VOTOS
    // normalizada a 100. `denominator_weight` sigue siendo capital: no se tocó,
    // porque `fn_crear_censo_snapshot` lo agrega en `capital_total_base` y viaja
    // a registros WORM.
    const { data: clases } = await garr.from("share_classes")
      .select("id, class_code").eq("entity_id", MATRIZ);
    const idA = clases.find((c) => c.class_code === "A").id;
    const idB = clases.find((c) => c.class_code === "B").id;

    const { data, error } = await garr.from("parte_votante_current")
      .select("voting_weight, denominator_weight, source_id").eq("entity_id", MATRIZ)
      .is("body_id", null).limit(500);
    expect(error).toBeNull();
    expect(data).toHaveLength(347);

    const { data: hs } = await garr.from("capital_holdings")
      .select("id, share_class_id, is_treasury").eq("entity_id", MATRIZ).limit(500);
    const claseDe = new Map(hs.map((h) => [h.id, h.share_class_id]));
    const esAutocartera = new Set(hs.filter((h) => h.is_treasury).map((h) => h.id));

    const pesoA = data.find((r) => claseDe.get(r.source_id) === idA && !esAutocartera.has(r.source_id));
    const pesoB = data.find((r) => claseDe.get(r.source_id) === idB);
    expect(Number(pesoA.voting_weight) / Number(pesoB.voting_weight)).toBeCloseTo(50, 6);

    // Σ de cuotas de voto = 100; la autocartera queda fuera y pesa 0.
    expect(data.reduce((s, r) => s + Number(r.voting_weight), 0)).toBeCloseTo(100, 6);
    // El denominador sigue siendo capital: 100 − el 2,5937 % de la autocartera.
    const pctAutocartera = (18 * 16000 / 11104008) * 100;
    expect(data.reduce((s, r) => s + Number(r.denominator_weight), 0))
      .toBeCloseTo(100 - pctAutocartera, 6);
  });

  it("REGRESIÓN DEL ACTA — los 3 presenciales suman 150 votos en Cloud", async () => {
    // Backstop de la fase. El test de arista prueba el fuente y se puede derrotar
    // dejando una llamada de señuelo; esto mide lo que HAY en Cloud. Si un presencial
    // acabara en clase B, aquí saldrían 101 votos y no 150.
    const { data: personas, error: eP } = await garr.from("persons")
      .select("id, full_name").in("full_name", PRESENCIALES);
    expect(eP).toBeNull();
    expect(personas).toHaveLength(3);

    const { data: clases } = await garr.from("share_classes")
      .select("id, votes_per_title").eq("entity_id", MATRIZ);
    const votosPorClase = new Map(clases.map((c) => [c.id, c.votes_per_title]));

    const { data: hs, error: eH } = await garr.from("capital_holdings")
      .select("numero_titulos, share_class_id, effective_from, is_treasury")
      .eq("entity_id", MATRIZ).in("holder_person_id", personas.map((p) => p.id));
    expect(eH).toBeNull();
    expect(hs).toHaveLength(3);
    expect(hs.every((h) => !h.is_treasury && h.numero_titulos === 2)).toBe(true);
    expect(hs.every((h) => h.effective_from === "2026-05-06")).toBe(true);
    const votos = hs.reduce((s, h) => s + h.numero_titulos * votosPorClase.get(h.share_class_id), 0);
    expect(votos).toBe(150);
    // 150 / 16.900 (base declarada: votos de clase A no autocartera) = 0,887574 %,
    // el 0,8875 % del acta por truncamiento.
    expect((votos / 16_900) * 100).toBeCloseTo(0.887574, 6);
  });

  it("ARGA no cambia: sus clases siguen sin nominal ni títulos por clase", async () => {
    const { data, error } = await arga.from("share_classes")
      .select("class_code, nominal_value, total_titulos")
      .eq("entity_id", ARGA_ENTITY);
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((c) => c.nominal_value === null && c.total_titulos === null)).toBe(true);
  });
});
