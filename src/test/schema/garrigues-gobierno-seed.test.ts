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
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

// La MATRIZ. Todo lo que este fichero cuenta es gobierno DE LA MATRIZ, así que
// se acota por entidad: el día que se siembre una filial con su propia Junta o
// sus propios socios, los cardinales de aquí no pueden moverse por eso.
const MATRIZ = "00000000-0000-0000-0002-000000000001";

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

  // CARDINAL EXACTO CONSERVADO. Los 346 socios no son un conteo cómodo: son el
  // censo que CUADRA con el capital (347 holdings = 346 socios + autocartera,
  // suma 100 %) y con la asistencia del acta. Aflojarlo a «al menos 346»
  // permitiría que el censo y el capital se separasen sin que nada cayera.
  //
  // Lo que sí se corrige es la MEDICIÓN: con `.limit(500)` y un recuento por
  // longitud, pasar del tope truncaba y el test mentía —decía «hay 500, no
  // 346»— en vez de fallar por lo que es. Ahora cuenta el servidor.
  it("346 condiciones SOCIO vigentes en la matriz", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    const { count, error } = await garr.from("condiciones_persona")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", MATRIZ).eq("tipo_condicion", "SOCIO").eq("estado", "VIGENTE");
    expect(error).toBeNull();
    expect(count, "el recuento vino a null: la consulta no midió nada").not.toBeNull();
    expect(count).toBe(346);
  });

  it("gobierno de la matriz: 1 JUNTA, 1 CDA y al menos los 19 comités consultivos", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    // `.limit(100)` truncaba en silencio: al pasar del tope el recuento se
    // quedaba corto y el gate fallaba por «faltan órganos» cuando lo que
    // pasaba es que sobraban. Se cuenta en el servidor y se comprueba que la
    // página traída es COMPLETA antes de contar sobre ella.
    const { data, error, count } = await garr.from("governing_bodies")
      .select("slug, body_type, config, entity_id", { count: "exact" }).limit(2000);
    expect(error).toBeNull();
    const bodies = data ?? [];
    expect(bodies.length, "la consulta de órganos se truncó: el recuento de abajo no valdría").toBe(count);

    const matriz = bodies.filter((b) => b.entity_id === MATRIZ);
    const byType = (t) => matriz.filter((b) => b.body_type === t);
    // Una sola Junta de Socios y un solo Consejo en la matriz: eso es
    // topología, no cardinal de siembra.
    expect(byType("JUNTA").length).toBe(1);
    expect(byType("CDA").length).toBe(1);
    // Los 19 consultivos son suelo, no techo: encoge mal, crece bien.
    const comites = byType("COMITE");
    expect(comites.filter((b) => b.config?.naturaleza === "CONSULTIVO").length)
      .toBeGreaterThanOrEqual(19);
    // Y el CdA de EAD sigue colgando de su propia entidad, no de la matriz.
    expect(bodies.filter((b) => b.body_type === "CDA").length).toBeGreaterThanOrEqual(2);
    // TODO órgano declara su naturaleza: el badge de la ficha se gatea por este
    // campo, así que uno sin declararla se pinta mudo. Vale también para los
    // que se siembren mañana.
    expect(bodies.filter((b) => !b.config?.naturaleza).map((b) => b.slug)).toEqual([]);
  });

  it("ADMIN_UNICO de Vives con inscripción I/A 960 y mandato 2026→2032", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    const { data, error } = await garr.from("condiciones_persona")
      .select("fecha_inicio, fecha_fin, inscripcion_rm_referencia, person:person_id(full_name)")
      // Acotado a la MATRIZ: un administrador único de una filial sembrada
      // después tumbaría el `maybeSingle` con un PGRST116 cuya causa no
      // aparece por ningún sitio. Es el modo de fallo más caro de diagnosticar.
      .eq("entity_id", MATRIZ)
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
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    const { data: body } = await garr.from("governing_bodies").select("id").eq("slug", "garrigues-ead-cda").maybeSingle();
    const { data, error } = await garr.from("condiciones_persona")
      .select("tipo_condicion").eq("body_id", body?.id ?? "");
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(7);
  });

  it("capital: perfil VIGENTE 11.104.008 y 347 holdings que suman ~100", async () => {
    expect(authed && garr, "sin sesión de Garrigues no se puede asertar nada").toBeTruthy();
    const { data: prof } = await garr.from("entity_capital_profile")
      .select("capital_escriturado").eq("estado", "VIGENTE")
      .eq("entity_id", MATRIZ).maybeSingle();
    expect(Number(prof?.capital_escriturado)).toBe(11104008);
    const { data: h, count: nH } = await garr.from("capital_holdings")
      .select("porcentaje_capital, is_treasury", { count: "exact" })
      .eq("entity_id", MATRIZ).limit(2000);
    // Con `.limit(500)` una tabla de más de 500 títulos se truncaba y la SUMA
    // salía por debajo de 100 sin que nadie supiera por qué. La página tiene
    // que ser completa antes de sumar sobre ella.
    expect((h ?? []).length, "la consulta de holdings se truncó").toBe(nH);
    // Cardinal exacto CONSERVADO: 347 = 346 socios + autocartera, y es lo que
    // hace que la suma dé 100. Aflojarlo desacopla capital y censo.
    expect((h ?? []).length).toBe(347);
    const suma = (h ?? []).reduce((a, r) => a + Number(r.porcentaje_capital), 0);
    expect(Math.abs(suma - 100)).toBeLessThan(0.01);
  });

  it("ARGA intacta: RLS aísla — su cliente ve sus bodies y ninguno de Garrigues", async () => {
    expect(argaAuthed && arga, "sin sesión de ARGA no se puede asertar nada").toBeTruthy();
    const { data, error } = await arga.from("governing_bodies").select("id, tenant_id").limit(200);
    expect(error).toBeNull();
    // ARGA sigue viendo su gobierno (no lo vació el seed Garrigues)...
    expect((data ?? []).length).toBeGreaterThan(0);
    // ...y SOLO el suyo: la RLS nunca deja filtrar filas de otro tenant.
    expect((data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });
});
