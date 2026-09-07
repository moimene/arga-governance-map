// src/test/schema/garrigues-normativo-seed.test.ts
// G4 Task 3 gate de datos: 39 documentos normativos del tenant Garrigues con
// ownership resuelto a órganos REALES, y ARGA intacta. Patrón graceful-skip
// con clientes independientes por tenant (garrigues-rule-packs-seed.test.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";
// El catálogo congelado es la ÚNICA fuente de verdad de lo que tiene que estar
// sembrado. Se contrasta contra él, no contra un número escrito a mano que
// habría que subir cada vez que el tenant crece.
import { NORMATIVO_CATALOG } from "../../../scripts/garrigues/normativo/catalogo-normativo";

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

  let seedError: string | null = null;

  beforeAll(async () => {
    // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
    // SIN try/catch: `sesionDe` LANZA si no autentica —clave rotada, `.env` sin
    // `DEMO_PASSWORD_*`, Cloud caído— y dejarlo lanzar es lo que pone el gate
    // en rojo. Atraparlo devolvía tests EN VERDE sin mirar Cloud.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
    authed = true;
    argaAuthed = true;
    const { count, error } = await garr.from("policies").select("id", { count: "exact", head: true });
    seedError = error ? error.message : count == null ? "el recuento vino a null" : null;
    seeded = (count ?? 0) >= 39;
  });

  // Sin este test, `seeded` era un SKIP MUDO en los 7 de abajo: perder el seed
  // —justo lo que esta sonda vigila— pintaba el gate verde. Ahora falla aquí,
  // una vez y con el motivo, y los demás siguen dando su detalle.
  it("el seed normativo del tenant Garrigues está aplicado", () => {
    expect(seedError, `no se pudo contar políticas: ${seedError}`).toBeNull();
    expect(seeded, "Garrigues tiene menos de 39 políticas: el seed no está aplicado").toBe(true);
  });

  // ABIERTO POR ARRIBA (2026-09-07). `count === 39` era un conteo cerrado: el
  // día que alguien siembre un documento normativo más, el gate se pone rojo
  // por haber avanzado. Lo que importa es que NO SE PIERDA ninguno de los 39
  // del catálogo congelado, y eso se comprueba por código, no por cardinal.
  it("los 39 documentos del catálogo están TODOS en Cloud", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
    const { data, error } = await garr.from("policies").select("policy_code").limit(2000);
    expect(error).toBeNull();
    const enCloud = new Set((data ?? []).map((p) => p.policy_code as string));
    // Encoge mal: el que falte sale nombrado, no escondido tras un número.
    expect(NORMATIVO_CATALOG.filter((e) => !enCloud.has(e.policy_code)).map((e) => e.policy_code))
      .toEqual([]);
    // Anti-vacuidad: si el catálogo se vaciara, lo de arriba no compararía nada.
    expect(NORMATIVO_CATALOG).toHaveLength(39);
  });

  it("las 32 PI del catálogo están completas", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
    const { data, error } = await garr.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(error).toBeNull();
    const enCloud = new Set((data ?? []).map((p) => p.policy_code as string));
    const pi = NORMATIVO_CATALOG.filter((e) => e.policy_code.startsWith("PI-"));
    expect(pi).toHaveLength(32);
    expect(pi.filter((e) => !enCloud.has(e.policy_code)).map((e) => e.policy_code)).toEqual([]);
  });

  it("el ownership acreditado apunta a órganos reales del tenant", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
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
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
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

  // ACOTADO AL CATÁLOGO: son SUS 39 documentos los que tienen 4 ownerships
  // acreditados por la fuente. Un documento normativo futuro traerá el suyo o
  // no lo traerá, y eso no puede poner en rojo el criterio de éste.
  it("de los 39 del catálogo, solo 4 tienen órgano responsable; el resto queda NULL", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
    const { data, error } = await garr
      .from("policies").select("policy_code, owner_body_id").limit(2000);
    expect(error).toBeNull();
    const codigos = new Set(NORMATIVO_CATALOG.map((e) => e.policy_code));
    const delCatalogo = (data ?? []).filter((p) => codigos.has(p.policy_code as string));
    // Anti-vacuidad: sin las 39 filas, «solo 4» se cumpliría con 0.
    expect(delCatalogo).toHaveLength(NORMATIVO_CATALOG.length);
    expect(delCatalogo.filter((p) => p.owner_body_id !== null).map((p) => p.policy_code).sort())
      .toHaveLength(4);
  });

  it("PPD-02 y el Código de Conducta del Socio quedan etiquetados sin contenido", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
    const { data } = await garr
      .from("policies").select("policy_code, summary, content_outline").in("policy_code", ["PPD-02", "CCS"]);
    expect((data ?? []).length).toBe(2);
    for (const p of data ?? []) expect(p.summary, `${p.policy_code} no debería traer objeto`).toBeNull();
  });

  // Contracara del anterior: PPD-01 tiene su texto en la carpeta y debe
  // llegar con objeto e índice, no como documento "citado, no incorporado".
  it("PPD-01 llega con su objeto y su índice", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    if (!seeded) return;
    const { data } = await garr
      .from("policies").select("summary, content_outline, current_version").eq("policy_code", "PPD-01").maybeSingle();
    expect(data?.summary).toBeTruthy();
    expect((data?.content_outline as unknown[] | null)?.length ?? 0).toBeGreaterThan(15);
    expect(data?.current_version).toBe(3);
  });

  // EXACTO A PROPÓSITO: contrato cero-cambio de ARGA, no conteo cerrado de los
  // que estorban a la siembra de Garrigues.
  it("ARGA sigue con sus 25 políticas y sin ownership por órgano", async () => {
    expect(argaAuthed && arga, "sin sesión de ARGA no se puede asertar nada").toBeTruthy();
    const { count } = await arga.from("policies").select("id", { count: "exact", head: true });
    expect(count).toBe(25);
    const { count: owned } = await arga
      .from("policies").select("id", { count: "exact", head: true }).not("owner_body_id", "is", null);
    expect(owned).toBe(0);
  });

  it("ARGA no ve ninguna política de Garrigues", async () => {
    expect(argaAuthed && arga, "sin sesión de ARGA no se puede asertar nada").toBeTruthy();
    const { data } = await arga.from("policies").select("policy_code").like("policy_code", "PI-%");
    expect(data ?? []).toHaveLength(0);
  });
});
