// C1 Task 4 — el expediente de la Junta General de Socios de Garrigues (06/05/2026):
// orden del día como módulo puro + la convocatoria en Cloud.
//
// Dos bloques con contratos distintos:
//   1. El módulo. Puro, sin red: la aritmética del expediente no depende de Cloud.
//   2. La convocatoria en Cloud, con login real. **NO hay graceful-skip:** si el
//      login falla, `beforeAll` lanza y los tests revientan. Una sonda que se salta
//      a sí misma es un gate verde que no asierta nada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, GARRIGUES_TENANT } from "../helpers/supabase-test-client";
import {
  ANTELACION_DIAS,
  CANAL_ESTATUTARIO,
  FECHA_CARTA_CONVOCATORIA,
  FECHA_JUNTA,
  ORDEN_DEL_DIA,
  ORGANO_SLUG,
  STATUTORY_BASIS,
  convocatoriaText,
  diasEntre,
  puntosQueMaterializan,
  puntosSinMateriaAcreditada,
} from "../../../scripts/garrigues/junta-2026/orden-del-dia";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

describe("C1 — orden del día de la Junta de Socios 2026 (módulo puro)", () => {
  it("14 entradas: 10 con acuerdo, 3 sin materia acreditada y la aprobación del acta", () => {
    // 12 puntos numerados del certificado, 13 entradas porque el punto 1 tiene
    // dos subpuntos con materias distintas, + el cierre del acta.
    expect(ORDEN_DEL_DIA).toHaveLength(14);
    expect(puntosQueMaterializan()).toHaveLength(10);
    expect(puntosSinMateriaAcreditada()).toHaveLength(3);
    expect(ORDEN_DEL_DIA.filter((p) => p.numero === "acta")).toHaveLength(1);
    // Los subpuntos del punto 1 producen DOS acuerdos, no uno.
    expect(ORDEN_DEL_DIA.filter((p) => p.numero.startsWith("1.")).map((p) => p.materia))
      .toEqual(["MODIFICACION_ESTATUTOS", "NOMBRAMIENTO_ADMINISTRADOR_UNICO"]);
  });

  it("cada punto es estructura, no un string: número único, título, materia y flag", () => {
    // Task 6 enlaza cada acuerdo con su punto por `numero`. Un duplicado
    // convertiría esa arista en una coincidencia de texto.
    const numeros = ORDEN_DEL_DIA.map((p) => p.numero);
    expect(new Set(numeros).size).toBe(numeros.length);
    for (const p of ORDEN_DEL_DIA) {
      expect(p.titulo.trim().length).toBeGreaterThan(10);
      expect(typeof p.materializa).toBe("boolean");
      // `materializa` y `materia` no pueden divergir: un punto que produce
      // acuerdo sin materia dejaría a Task 6 sin pack que resolver.
      expect(p.materializa).toBe(p.materia !== null);
      expect(p.kind).toBe(p.materializa ? "DECISORIO" : null);
    }
  });

  it("los 3 sin materia acreditada llevan su nota y no la lleva ningún punto con acuerdo", () => {
    for (const p of puntosSinMateriaAcreditada()) {
      expect(String(p.nota)).toContain("no está acreditada");
      expect(String(p.nota)).toContain("Comité Legal");
    }
    // Los 3 son exactamente esos: Centro de Estudios, sostenibilidad e informe de gestión.
    expect(puntosSinMateriaAcreditada().map((p) => p.numero)).toEqual(["5", "8", "9"]);
    expect(puntosQueMaterializan().every((p) => p.nota === undefined)).toBe(true);
  });

  it("la antelación se DERIVA de las dos fechas del acta, no es un literal", () => {
    expect(ANTELACION_DIAS).toBe(diasEntre(FECHA_CARTA_CONVOCATORIA, FECHA_JUNTA));
    expect(ANTELACION_DIAS).toBe(15);
    // Mata al mutante «alguien escribe 15 y toca una fecha»: si la carta pasara
    // al 22/04, la derivación daría 14 y esta línea caería.
    expect(diasEntre("2026-04-22", FECHA_JUNTA)).toBe(14);
  });

  it("el plazo NO se apoya en la Ley 2/2007, que no lo regula", () => {
    expect(STATUTORY_BASIS).toContain("27.3");
    expect(STATUTORY_BASIS).toContain("27.4");
    expect(STATUTORY_BASIS).toContain("176 LSC");
    expect(STATUTORY_BASIS).not.toContain("2/2007");
  });

  it("el texto de la carta se etiqueta como reconstrucción y no afirma envío ni EAD Trust", () => {
    const texto = convocatoriaText();
    expect(texto).toContain("RECONSTRUCCIÓN DEMO / SIN EFECTO JURÍDICO");
    expect(texto).toContain("Querido socio:");
    expect(texto).toContain("Madrid, 21 de abril de 2026");   // la fecha real vive aquí
    expect(texto).toContain("no produce remisión, entrega ni acuse");
    expect(texto).toContain("no afirma ninguna actuación, interposición, mensajería ni custodia de EAD Trust");
    expect(texto).toContain("La hora de la sesión no consta en la fuente disponible");
    // Los 13 puntos del orden del día están en el cuerpo; el acta se nombra aparte.
    for (const p of ORDEN_DEL_DIA.filter((x) => x.numero !== "acta")) {
      expect(texto).toContain(p.titulo);
    }
    expect(texto).toContain("artículo 97");
  });
});

describe("C1 — la convocatoria de la Junta de Socios en Cloud", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  let bodyId: string;

  beforeAll(async () => {
    // persistSession:false en cada cliente: el preload de bun test monta JSDOM con
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

    // El órgano se resuelve por slug. El UUID no se hardcodea en ninguna parte.
    const { data, error } = await garr.from("governing_bodies")
      .select("id, body_type").eq("slug", ORGANO_SLUG).maybeSingle();
    if (error) throw new Error(`governing_bodies ${ORGANO_SLUG}: ${error.message}`);
    if (!data) throw new Error(`No existe el órgano ${ORGANO_SLUG} para el login Garrigues.`);
    expect(data.body_type).toBe("JUNTA");
    bodyId = data.id;
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  async function convocatoria() {
    const { data, error } = await garr.from("convocatorias")
      .select("id, body_id, estado, fecha_emision, fecha_1, tipo_convocatoria, modalidad, junta_universal, is_second_call, agenda_items, lugar, statutory_basis, publication_channels, publication_evidence_url, convocatoria_text")
      .eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    // Lista, no maybeSingle: una segunda ejecución del seed que duplicara la fila
    // se vería aquí como 2 en vez de esconderse tras un error de cardinalidad.
    expect(data).toHaveLength(1);
    return data[0];
  }

  it("existe una sola convocatoria del tenant, del órgano resuelto por slug y para el 06/05/2026", async () => {
    const c = await convocatoria();
    expect(c.body_id).toBe(bodyId);
    // La fecha debe leerse correcta TANTO en la cadena UTC como en hora local:
    // un `+02:00` la almacenaría como 2026-05-05T22:00Z y cualquier `slice(0,10)`
    // leería el 5 de mayo. La hora que se ve es artefacto de renderizado.
    expect(String(c.fecha_1).slice(0, 10)).toBe(FECHA_JUNTA);
    expect(new Date(c.fecha_1).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })).toBe("6/5/2026");
    expect(c.tipo_convocatoria).toBe("ORDINARIA");
    expect(c.modalidad).toBe("PRESENCIAL");
    expect(c.junta_universal).toBe(false);   // hubo convocatoria formal
    expect(c.is_second_call).toBe(false);
    expect(c.lugar).toContain("Plaza de Colón");
  });

  it("la antelación real cuadra con la que exige el pack GARR_JUNTA_SOCIOS para SLP", async () => {
    const { data, error } = await garr.from("rule_pack_versions")
      .select("version, payload").eq("pack_id", "GARR_JUNTA_SOCIOS").eq("is_active", true);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const slp = data[0].payload?.convocatoria?.antelacionDias?.SLP;
    // El pack exige 15; 21/04 → 06/05 son 15 días DERIVADOS. Aquí se cierra el bucle.
    expect(slp?.valor).toBe(ANTELACION_DIAS);
    expect(slp?.fuente).toBe("ESTATUTOS");
    expect(slp?.referencia).toContain("27.4");
    expect(slp?.referencia).not.toContain("2/2007");
    expect(data[0].payload?.convocatoria?.canales?.SLP).toContain(CANAL_ESTATUTARIO);
  });

  it("el orden del día en Cloud es exactamente el del módulo, con los 14 puntos", async () => {
    const c = await convocatoria();
    expect(c.agenda_items).toHaveLength(ORDEN_DEL_DIA.length);
    // Igualdad campo a campo: un título parafraseado a «Junta ordinaria genérica
    // de SA» rompe aquí, que es el error que este caso canónico corrige.
    expect(c.agenda_items.map((i) => [i.numero, i.titulo, i.materia, i.materializa, i.kind]))
      .toEqual(ORDEN_DEL_DIA.map((p) => [p.numero, p.titulo, p.materia, p.materializa, p.kind]));
  });

  it("los 3 puntos sin materia acreditada están en el orden del día y NO materializan acuerdo", async () => {
    const c = await convocatoria();
    const sinMateria = c.agenda_items.filter((i) => i.materia === null && i.numero !== "acta");
    expect(sinMateria).toHaveLength(3);
    expect(sinMateria.every((i) => String(i.nota).includes("no está acreditada"))).toBe(true);
    expect(sinMateria.every((i) => i.materializa === false)).toBe(true);
    // `agreementsFromAgenda` filtra por kind === "DECISORIO": sin él, estos 3 no
    // pueden colarse como acuerdo aunque alguien los procese en bloque.
    expect(sinMateria.every((i) => i.kind === null)).toBe(true);
  });

  it("las 10 materias del expediente existen en materia_catalog", async () => {
    // Arista real para Task 6: si una materia no está en el catálogo, el acuerdo
    // no puede resolver pack ni clase, y el fallo se vería tres tareas después.
    const materias = puntosQueMaterializan().map((p) => p.materia);
    const { data, error } = await garr.from("materia_catalog").select("materia").in("materia", materias);
    expect(error).toBeNull();
    expect(new Set((data ?? []).map((m) => m.materia))).toEqual(new Set(materias));
  });

  it("la cita del plazo es estatutaria, con la LSC supletoria y sin Ley 2/2007", async () => {
    const c = await convocatoria();
    expect(c.statutory_basis).toBe(STATUTORY_BASIS);
    expect(c.statutory_basis).toContain("27.3");
    expect(c.statutory_basis).not.toContain("2/2007");
  });

  it("el canal describe el acto real y NO se afirma envío, entrega ni acuse", async () => {
    const c = await convocatoria();
    // El canal del art. 27.3, sin prefijo SANDBOX_ (que es de la vía de emisión
    // de CDA) y sin ningún campo de evidencia de remisión.
    expect(c.publication_channels).toEqual([CANAL_ESTATUTARIO]);
    expect(c.publication_evidence_url).toBeNull();
    expect(c.convocatoria_text).toContain("no produce remisión, entrega ni acuse");
    expect(c.convocatoria_text).toContain("RECONSTRUCCIÓN DEMO");
    expect(c.convocatoria_text).toContain("Madrid, 21 de abril de 2026");
  });

  it("la fila queda en BORRADOR y sin fecha_emision porque la vía gobernada de emisión no admite Juntas", async () => {
    const c = await convocatoria();
    // Medido contra Cloud: `fn_emit_convocatoria` solo acepta órganos CDA y el
    // trigger `fn_convocatoria_emission_rpc_guard` bloquea con 42501 cualquier
    // EMITIDA fuera de esa RPC; el guard de autoridad fuerza fecha_emision a NULL
    // en toda fila no emitida. El 21/04/2026 consta en el texto de la carta.
    // Esta aserción es el recordatorio: el día que la plataforma sepa emitir una
    // Junta, esta línea cae y hay que revisar el seed, no relajar el test.
    expect(c.estado).toBe("BORRADOR");
    expect(c.fecha_emision).toBeNull();
  });

  it("ARGA no ve esta convocatoria y conserva las suyas", async () => {
    const { data: cruzado, error: eCruz } = await arga.from("convocatorias")
      .select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(eCruz).toBeNull();
    expect(cruzado ?? []).toHaveLength(0);
    const { data: propias, error: eArga } = await arga.from("convocatorias").select("id").limit(200);
    expect(eArga).toBeNull();
    // La aserción cruzada de arriba sería vacua si ARGA no tuviera convocatorias.
    expect((propias ?? []).length).toBeGreaterThan(0);
  });
});
