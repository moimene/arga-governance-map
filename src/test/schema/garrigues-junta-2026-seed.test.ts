// C1 Task 4 — el expediente de la Junta General de Socios de Garrigues (06/05/2026):
// orden del día como módulo puro + la convocatoria en Cloud.
//
// Dos bloques con contratos distintos:
//   1. El módulo. Puro, sin red: la aritmética del expediente no depende de Cloud.
//   2. La convocatoria en Cloud, con login real. **NO hay graceful-skip:** si el
//      login falla, `beforeAll` lanza y los tests revientan. Una sonda que se salta
//      a sí misma es un gate verde que no asierta nada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";
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
  MEETING_SLUG,
  MESA_PRESIDENTA,
  MESA_SECRETARIO,
  REPRESENTANTE_UNICO,
  SOCIOS_PRESENCIALES,
  SUBSUNCION_ART36,
  ordinalEnOrdenDelDia,
  puntosConAcuerdo,
  subsuncionDe,
  textoAcuerdo,
  TEXTOS_ACUERDO,
} from "../../../scripts/garrigues/junta-2026/orden-del-dia";
import {
  baseComputoJunta,
  baseComputoTodasLasClases,
  CENSO_TOTAL,
} from "../../../scripts/garrigues/capital/estructura-art7";
import {
  ADOPCION_LA_CERTIFICA_EL_ACTA,
  buildAgendaRow,
  buildAgreementRow,
  buildAttendeeRows,
  buildQuorumData,
  buildResolutionRow,
  censoPrecondicion,
  concurrenciaCertificada,
  etapaEvaluacion,
  evaluarMayoriaPunto,
  MEETING_VOTES_VACIA,
  SELLO_CLIENTE,
  type PackResuelto,
  type SocioCenso,
} from "../../../scripts/seed-garrigues-junta-2026";
import { esFormulaEvaluable } from "../../../src/lib/rules-engine/majority-evaluator";
import type { RulePack } from "../../../src/lib/rules-engine/types";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
/** Matriz del grupo, J&A Garrigues S.L.P. */
const MATRIZ = "00000000-0000-0000-0002-000000000001";

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
    // Sesión COMPARTIDA y memoizada por cuenta: la suite entera hace 2 logins
    // en vez de ~40. Supabase Auth devolvía HTTP 429 al cruzar el umbral y la
    // suite fallaba de forma no determinista. `sesionDe` LANZA si no puede
    // autenticar, así que el gate se pone rojo en vez de saltarse en silencio,
    // y cada cuenta lleva su propio storageKey para que un login no pise al otro.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);

    // El órgano se resuelve por slug. El UUID no se hardcodea en ninguna parte.
    const { data, error } = await garr.from("governing_bodies")
      .select("id, body_type").eq("slug", ORGANO_SLUG).maybeSingle();
    if (error) throw new Error(`governing_bodies ${ORGANO_SLUG}: ${error.message}`);
    if (!data) throw new Error(`No existe el órgano ${ORGANO_SLUG} para el login Garrigues.`);
    expect(data.body_type).toBe("JUNTA");
    bodyId = data.id;
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA y cerrarla aquí dejaría
  // sin autenticar a todas las sondas que corran después.

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

// ─────────────────────────────────────────────────────────────────── Task 5 ──

/** Titularidad sintética con la estructura del art. 7 (2×A = 50 votos, 1×B = 1). */
const holding = (clase: "A" | "B") =>
  clase === "A"
    ? { numero_titulos: 2, porcentaje_capital: 0.28818423041481955, is_treasury: false, voting_rights: true,
        share_class: { class_code: "A", votes_per_title: 25, voting_rights: true } }
    : { numero_titulos: 1, porcentaje_capital: 0.000009005757200463112, is_treasury: false, voting_rights: true,
        share_class: { class_code: "B", votes_per_title: 1, voting_rights: true } };

const socio = (full_name: string, clase: "A" | "B" = "A"): SocioCenso => ({
  person_id: `id-${full_name}`, full_name, holding: holding(clase),
});

describe("C1 — asistencia, base de cómputo y gate del censo (módulo puro)", () => {
  it("la asistencia del acta: 3 presenciales y el resto representados por UNA sola persona", () => {
    const socios = [...SOCIOS_PRESENCIALES.map((n) => socio(n)), socio("Socia Representada", "A"), socio("Socio Clase B", "B")];
    const filas = buildAttendeeRows("m", socios, `id-${REPRESENTANTE_UNICO}`);

    expect(filas.filter((f) => f.attendance_type === "PRESENCIAL")).toHaveLength(3);
    const repr = filas.filter((f) => f.attendance_type === "REPRESENTADO");
    expect(repr).toHaveLength(2);
    expect(new Set(repr.map((f) => f.represented_by_id)).size).toBe(1);
    expect(repr.every((f) => f.via_representante)).toBe(true);
    // Un presencial con representante lo rechaza el manifiesto autoritativo.
    expect(filas.filter((f) => f.attendance_type === "PRESENCIAL").every((f) => f.represented_by_id === null && !f.via_representante)).toBe(true);
    // Los votos salen de títulos × votos/título, no del porcentaje de capital.
    expect(filas.find((f) => f.person_id === `id-${MESA_PRESIDENTA}`)?.voting_rights).toBe(50);
    expect(filas.find((f) => f.person_id === "id-Socio Clase B")?.voting_rights).toBe(1);
  });

  it("un representante que no está en la sala no puede exhibir cartas de delegación", () => {
    const socios = [...SOCIOS_PRESENCIALES.map((n) => socio(n)), socio("Socia Representada")];
    expect(() => buildAttendeeRows("m", socios, "id-Socia Representada")).toThrow(/representante único no figura/);
    // Y si falta uno de los tres presenciales, tampoco es la asistencia del acta.
    expect(() => buildAttendeeRows("m", socios.slice(1), `id-${REPRESENTANTE_UNICO}`)).toThrow(/presenciales/);
  });

  it("la base declarada reproduce el 0,8875 % del acta y deja escrita la lectura sobre 16.908", () => {
    const q = buildQuorumData(150, baseComputoTodasLasClases());
    expect(q.base_computo).toBe("VOTOS_CLASE_A_NO_AUTOCARTERA");
    expect(q.base_votos).toBe(16_900);
    expect(q.base_votos).toBe(baseComputoJunta());
    // El acta imprime el porcentaje TRUNCADO, y su complemento.
    expect(q.acta_presenciales_pct).toBe(0.8875);
    expect(q.acta_representados_pct).toBe(99.1125);
    // Y la proyección, que normaliza sobre 16.908, da 0,887154 %: los 8 votos de clase B.
    expect(q.base_votos_todas_las_clases).toBe(16_908);
    expect(Number(q.proyeccion_presenciales_pct_sobre_16908.toFixed(6))).toBe(0.887154);
    expect(q.base_votos_todas_las_clases - q.base_votos).toBe(8);
    // Hubo convocatoria formal: esto NO es una junta universal del art. 178 LSC.
    expect(q.junta_universal).toBe(false);
    expect(q.censo_total).toBe(CENSO_TOTAL);
    expect(q.notas.join(" ")).toContain("La hora de la sesión NO consta");
    expect(q.notas.join(" ")).toContain("sin efecto jurídico");
    // El expediente NO afirma envío, entrega, acuse ni actuación de EAD Trust.
    expect(q.notas.join(" ")).toContain("afirma envío, entrega, acuse ni actuación, interposición, mensajería o custodia de EAD Trust");
  });

  it("el gate del censo comprueba el DATO: las clases guardan la proporción del art. 7", () => {
    // El gate nació prediciendo la fórmula de fn_crear_censo_snapshot, para no
    // congelar un peso contrario al art. 7 en un registro inmutable. Corregida la
    // RPC (migración 20260829160000), ya no predice nada: comprueba que las clases
    // del censo guardan entre sí la proporción del art. 7 — que es lo que fallaría
    // si alguien sembrara mal las clases o los títulos.
    const socios = [socio("A", "A"), socio("B", "B")];
    const ok = censoPrecondicion(socios);
    expect(ok.ok).toBe(true);
    expect(ok.ratioVotos).toBe(50);
    expect(ok.ratioRpc).toBe(50);

    // Mutante: un socio de clase B al que se le hubieran sembrado 2 títulos en vez
    // de 1 rompe la proporción y el gate cierra. Es lo que de verdad protege.
    const malSembrado = socios.map((s) =>
      s.holding.share_class?.class_code === "B"
        ? { ...s, holding: { ...s.holding, numero_titulos: 2 } }
        : s,
    );
    expect(censoPrecondicion(malSembrado).ok).toBe(false);
  });
});

describe("C1 — la reunión, la asistencia del acta y el censo WORM en Cloud", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  let bodyId: string;
  let meetingId: string | null = null;

  beforeAll(async () => {
    // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);

    const { data, error } = await garr.from("governing_bodies").select("id").eq("slug", ORGANO_SLUG).maybeSingle();
    if (error) throw new Error(`governing_bodies ${ORGANO_SLUG}: ${error.message}`);
    if (!data) throw new Error(`No existe el órgano ${ORGANO_SLUG} para el login Garrigues.`);
    bodyId = data.id;

    // Se resuelve una vez y se comparte: si no existe, los casos fallan diciéndolo,
    // que es lo contrario de saltárselos.
    const { data: m } = await garr.from("meetings").select("id").eq("slug", MEETING_SLUG).maybeSingle();
    meetingId = m?.id ?? null;
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a todas las sondas que corran después — y el síntoma no es un
  // error de login, son consultas que devuelven vacío y aserciones que fallan
  // en un fichero que no ha hecho nada mal.

  it("la reunión existe con la mesa real del acta y en un estado que no afirma de más", async () => {
    const { data, error } = await garr.from("meetings")
      .select("id, slug, body_id, meeting_type, scheduled_start, scheduled_end, status, president_id, secretary_id, location")
      .eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const m = data[0];
    expect(m.slug).toBe(MEETING_SLUG);
    expect(m.body_id).toBe(bodyId);              // órgano resuelto por slug, nunca por UUID
    expect(m.meeting_type).toBe("JUNTA_GENERAL");
    expect(String(m.scheduled_start).slice(0, 10)).toBe(FECHA_JUNTA);
    expect(new Date(m.scheduled_start).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })).toBe("6/5/2026");
    // DRAFT porque su convocatoria está en BORRADOR: una reunión CONVOCADA
    // afirmaría una convocatoria en forma que la fuente no sostiene. Y porque
    // `trg_00_meeting_open_insert_guard` obliga a nacer en DRAFT salvo una
    // excepción que exige convocatoria EMITIDA e inmutable. El día que la
    // plataforma sepa emitir Juntas esta línea cae y hay que revisar el seed.
    expect(m.status).toBe("DRAFT");
    expect(m.location).toContain("Plaza de Colón");

    const { data: pres } = await garr.from("persons").select("full_name").eq("id", m.president_id).single();
    const { data: sec } = await garr.from("persons").select("full_name").eq("id", m.secretary_id).single();
    expect(pres.full_name).toBe(MESA_PRESIDENTA);
    expect(sec.full_name).toBe(MESA_SECRETARIO);
  });

  it("la asistencia es la del acta: 3 presenciales y 343 representados por una sola persona", async () => {
    expect(meetingId).not.toBeNull();
    const { data, error } = await garr.from("meeting_attendees")
      .select("person_id, attendance_type, represented_by_id, via_representante, voting_rights")
      .eq("meeting_id", meetingId);
    expect(error).toBeNull();
    expect(data).toHaveLength(CENSO_TOTAL);
    const presenciales = data.filter((a) => a.attendance_type === "PRESENCIAL");
    const repr = data.filter((a) => a.attendance_type === "REPRESENTADO");
    expect(presenciales).toHaveLength(SOCIOS_PRESENCIALES.length);
    expect(repr).toHaveLength(CENSO_TOTAL - SOCIOS_PRESENCIALES.length);
    // Roberto Delgado exhibió TODAS las cartas de delegación: un solo representante.
    expect(new Set(repr.map((a) => a.represented_by_id)).size).toBe(1);
    const representante = repr[0].represented_by_id;
    const { data: quien } = await garr.from("persons").select("full_name").eq("id", representante).single();
    expect(quien.full_name).toBe(REPRESENTANTE_UNICO);
    // Y estaba en la sala: si no, nadie pudo exhibirlas ante la Presidenta.
    expect(presenciales.some((a) => a.person_id === representante)).toBe(true);
    expect(presenciales.every((a) => a.represented_by_id === null)).toBe(true);
  });

  it("los votos de la asistencia reproducen el art. 7 y la base declarada del acta", async () => {
    expect(meetingId).not.toBeNull();
    const { data, error } = await garr.from("meeting_attendees")
      .select("attendance_type, voting_rights, shares_represented").eq("meeting_id", meetingId);
    expect(error).toBeNull();
    const suma = (rows: typeof data) => rows.reduce((acc, a) => acc + Number(a.voting_rights), 0);
    // 3 socios de cuota × 2 participaciones A × 25 votos = 150.
    expect(suma(data.filter((a) => a.attendance_type === "PRESENCIAL"))).toBe(150);
    // 338 × 50 + 8 × 1 = 16.908 votos computables de ambas clases.
    expect(suma(data)).toBe(baseComputoTodasLasClases());
    expect(suma(data) - baseComputoJunta()).toBe(8);   // los 8 votos de clase B
    expect(data.reduce((acc, a) => acc + Number(a.shares_represented), 0)).toBe(684); // 338×2 + 8×1
  });

  it("quorum_data declara la base de cómputo y deja escrita la lectura sobre 16.908", async () => {
    const { data, error } = await garr.from("meetings").select("quorum_data").eq("slug", MEETING_SLUG).maybeSingle();
    expect(error).toBeNull();
    const q = data?.quorum_data ?? {};
    expect(q.base_computo).toBe("VOTOS_CLASE_A_NO_AUTOCARTERA");
    expect(q.base_votos).toBe(baseComputoJunta());
    expect(q.acta_presenciales_pct).toBe(0.8875);
    expect(q.base_votos_todas_las_clases).toBe(baseComputoTodasLasClases());
    expect(Number(Number(q.proyeccion_presenciales_pct_sobre_16908).toFixed(6))).toBe(0.887154);
    // Hubo convocatoria formal con 15 días: no es una junta universal.
    expect(q.junta_universal).toBe(false);
    expect(String(q.notas)).toContain("sin efecto jurídico");
  });

  it("el censo WORM existe, lo creó la RPC, es ECONOMICO y cuelga del órgano de la Junta", async () => {
    // Este caso sustituye al gate que decía «el censo NO se ha creado y la razón
    // sigue vigente». La razón dejó de estar vigente con la migración
    // 20260829160000, el gate falló como estaba escrito para fallar, y aquí está
    // lo que exigía a cambio: la aserción del snapshot bien ponderado.
    const { data, error } = await garr.from("censo_snapshot")
      .select("id, session_kind, snapshot_type, body_id, total_partes, capital_total_base, audit_worm_id, payload")
      .eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const censo = data[0];
    expect(censo.session_kind).toBe("MEETING");
    // ECONOMICO, no UNIVERSAL: el art. 178 LSC reserva «universal» a la junta
    // constituida SIN previa convocatoria, y ésta se convocó con 15 días.
    expect(censo.snapshot_type).toBe("ECONOMICO");
    expect(censo.body_id).toBe(bodyId);
    // audit_worm_id lo rellena el trigger: es la prueba de que pasó por la RPC
    // y no por un INSERT directo.
    expect(censo.audit_worm_id).not.toBeNull();
    expect(censo.total_partes).toBe(347);
  });

  it("el payload del censo pondera por votos: A/B = 50, el ratio del art. 7", async () => {
    const { data } = await garr.from("censo_snapshot")
      .select("payload, capital_total_base").eq("tenant_id", GARRIGUES_TENANT).single();
    const pesos = (data.payload as Array<{ voting_weight: number | string }>)
      .map((r) => Number(r.voting_weight)).filter((w) => w > 0);
    // 346 socios con voto; la autocartera pesa 0 y queda fuera.
    expect(pesos).toHaveLength(346);
    // El ratio entre el mayor y el menor peso es el del art. 7: 25 votos por
    // participación de clase A y 2 participaciones por socio de cuota, frente a
    // 1 voto y 1 participación de clase B. Antes de la migración 20260829160000
    // este número era 800.000.
    expect(Math.max(...pesos) / Math.min(...pesos)).toBeCloseTo(50, 6);
    expect(pesos.reduce((a, w) => a + w, 0)).toBeCloseTo(100, 6);
    // capital_total_base sigue siendo CAPITAL, no votos: 100 − el 2,5937 % de
    // autocartera. El nombre del campo dice capital y guarda capital.
    expect(Number(data.capital_total_base)).toBeCloseTo(100 - (18 * 16000 / 11104008) * 100, 6);
  });

  it("ARGA no ve la reunión de Garrigues y conserva las suyas", async () => {
    const { data: cruzado, error: eCruz } = await arga.from("meetings").select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(eCruz).toBeNull();
    expect(cruzado ?? []).toHaveLength(0);
    const { data: propias, error: eArga } = await arga.from("meetings").select("id").limit(200);
    expect(eArga).toBeNull();
    // Sin esto la aserción cruzada sería vacua: ARGA tiene sus 27 reuniones.
    expect((propias ?? []).length).toBeGreaterThan(0);
    const { data: censoArga } = await arga.from("censo_snapshot").select("id").limit(200);
    expect((censoArga ?? []).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────── Task 6 ──

const CON_GATE = new Set([
  "ADMISION_SOCIO_CUOTA",
  "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60",
  "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
]);

/** Las 6 materias que G3 creó para la forma SLP: su pack se llama como la materia. */
const MATERIAS_SLP = [
  "ADMISION_SOCIO_CUOTA", "EXCLUSION_SOCIO_ESTATUTARIA", "CONTINUIDAD_SOCIO_POST_60",
  "RETRIBUCION_PRESTACIONES_ACCESORIAS", "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA",
  "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
];

/** Las 3 que hasta C1 solo existían en ARGA: su pack lleva prefijo GARR_. */
const MATERIAS_NUEVAS = ["APROBACION_CUENTAS", "NOMBRAMIENTO_AUDITOR", "DELEGACION_FACULTADES"];

/**
 * La 4ª que solo existía en ARGA, y va aparte de `MATERIAS_NUEVAS` **porque su
 * mayoría es otra**: las tres de arriba se adoptan por la cláusula general del
 * art. 30.1 y ésta por los 2/3 del art. 30.2.a) — y encima por subsunción
 * etiquetada. Meterla en la misma lista habría convertido las aserciones del
 * art. 30.1 en un filtro que ya no distingue nada.
 */
const MATERIA_ESTATUTOS = "MODIFICACION_ESTATUTOS";

type MayoriaSL = { fuente?: string; formula?: string; referencia?: string; baseComputo?: string };
type PackPayload = { materia?: string; votacion?: { mayoria?: { SL?: MayoriaSL } } };

describe("C1 — los acuerdos de la Junta (módulo puro)", () => {
  it("son 10: el punto 1.1 se desbloqueó y ya no queda ningún punto decisorio sin acuerdo", () => {
    // Task 6 lo dejaba en 9. Este 10 NO es «actualizar un número»: el punto 1.1
    // pasó a tener regla el 2026-08-30, y lo que este caso fija es que ya no
    // existe la categoría «punto que se delibera y no produce acuerdo».
    expect(puntosConAcuerdo()).toHaveLength(10);
    expect(puntosQueMaterializan()).toHaveLength(10);   // el contrato de Task 4 no se toca
    expect(ORDEN_DEL_DIA).toHaveLength(14);             // ni el de las 14 entradas
    expect(puntosConAcuerdo().map((p) => p.numero)).toEqual(puntosQueMaterializan().map((p) => p.numero));
    const uno = ORDEN_DEL_DIA.find((p) => p.numero === "1.1")!;
    expect(uno.materia).toBe(MATERIA_ESTATUTOS);
    expect(uno.materializa).toBe(true);
    expect(puntosConAcuerdo().map((p) => p.materia)).toContain(MATERIA_ESTATUTOS);
  });

  it("la mayoría del 1.1 va etiquetada INFERIDO y arrastra su lectura alternativa", () => {
    // La aserción que impide que la subsunción se presente mañana como cita.
    const sub = subsuncionDe("1.1")!;
    expect(sub).toBe(SUBSUNCION_ART36);
    expect(sub.procedencia).toBe("INFERIDO");
    expect(sub.decididoPor).toContain("2026-08-30");
    // Qué regula el art. 36, y de dónde se sabe: BORME 338618/2026 (I/A 960).
    expect(sub.objeto).toContain("plazo de duración de los administradores");
    expect(sub.objeto).toContain("338618");
    // La lectura aplicada y la ALTERNATIVA, las dos, dentro del registro.
    expect(sub.lecturaAplicada).toContain("30.2.a");
    expect(sub.lecturaAlternativa).toContain("30.2.f");
    expect(sub.lecturaAlternativa).toContain("30.1");
    expect(sub.registroCanonico).toBe("docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md");
    // Y la consecuencia que NO se aplicó queda nombrada: bajo la lectura
    // aplicada, el art. 39.5.b.i arrastraría el informe preceptivo. El gate demo
    // no se amplía sobre algo inferido, y eso se dice en vez de callarse.
    expect(sub.consecuenciaNoAplicada).toContain("39.5.b.i");
    // Los otros nueve resuelven por cita directa: una subsunción vacía en todos
    // haría que esta etiqueta no distinguiera nada.
    for (const p of puntosConAcuerdo().filter((x) => x.numero !== "1.1")) {
      expect(subsuncionDe(p.numero)).toBeNull();
    }
  });

  it("los 10 son las 6 materias SLP, las 3 del art. 30.1 y la modificación de estatutos", () => {
    expect(puntosConAcuerdo().map((p) => p.materia).sort())
      .toEqual([...MATERIAS_SLP, ...MATERIAS_NUEVAS, MATERIA_ESTATUTOS].sort());
  });

  it("el ordinal es la posición en la convocatoria, con huecos donde no hay acuerdo", () => {
    // 6, 9, 10 (sin materia) y 14 (acta) NO aparecen: no se renumera, porque el
    // ordinal apunta al elemento del array de la convocatoria. El 1 ya SÍ está:
    // es el punto 1.1, primer elemento del orden del día.
    expect(puntosConAcuerdo().map((p) => ordinalEnOrdenDelDia(p.numero)))
      .toEqual([1, 2, 3, 4, 5, 7, 8, 11, 12, 13]);
    expect(ordinalEnOrdenDelDia("1.1")).toBe(1);
    expect(ordinalEnOrdenDelDia("acta")).toBe(ORDEN_DEL_DIA.length);
    expect(() => ordinalEnOrdenDelDia("99")).toThrow(/no está en el orden del día/);
  });

  it("el texto del 1.1 dice lo acreditado y NO reconstruye la disposición transitoria", () => {
    const t = textoAcuerdo("1.1");
    // ACREDITADO por dos vías: el BORME y el cotejo del Comité Legal de 2026-08-05.
    expect(t.contenido).toBe("ACREDITADO");
    expect(t.decision).toContain("artículo 36");
    expect(t.decision).toContain("338618/2026");
    expect(t.decision).toContain("seis años");
    // El título del punto enuncia una transitoria de conversión a Consejo que la
    // fuente no acredita: el texto la nombra como no acreditada en vez de
    // inventarle contenido.
    expect(t.decision).toContain("no acredita");
    expect(t.decision).toContain("no la reconstruye");
    // Y la etiqueta de la mayoría viaja también en el texto que lee el abogado.
    expect(t.decision).toContain("INFERIDO");
    expect(t.decision).toContain("30.2.a");
  });

  it("los 10 tienen texto, y el INFERIDO no identifica a ninguna persona del acta", () => {
    const personas = [...SOCIOS_PRESENCIALES, MESA_PRESIDENTA, MESA_SECRETARIO, REPRESENTANTE_UNICO];
    for (const p of puntosConAcuerdo()) {
      const t = textoAcuerdo(p.numero);
      expect(t.propuesta.length).toBeGreaterThan(40);
      expect(t.decision).toContain("Reconstrucción demo sin efecto jurídico");
      if (t.contenido !== "INFERIDO") continue;
      for (const nombre of personas) {
        expect(`${t.propuesta} ${t.decision}`).not.toContain(nombre);
      }
      // Ni tratamientos: un «D.» delante de un cargo ya sugiere una persona.
      expect(t.propuesta).not.toMatch(/\bD\.\s|\bDña\.\s/);
      expect(t.decision).not.toMatch(/\bD\.\s|\bDña\.\s/);
    }
    // Y la mitad acreditada sí puede nombrar: Vives consta en el BORME.
    expect(TEXTOS_ACUERDO["1.2"].contenido).toBe("ACREDITADO");
    expect(TEXTOS_ACUERDO["1.2"].decision).toContain("Fernando Vives Ruiz");
    expect(textoAcuerdo("12").decision).toContain("31.3");   // el acuerdo de cobertura lo dice
  });

  it("el punto celebrado lleva tenant explícito y NO vincula la convocatoria en BORRADOR", () => {
    const punto = puntosConAcuerdo().find((p) => p.numero === "1.2")!;
    const fila = buildAgendaRow("m-1", punto);
    // La columna tiene DEFAULT al tenant de ARGA: omitirla sembraría en ARGA.
    expect(fila.tenant_id).toBe(GARRIGUES_TENANT);
    expect(fila.order_number).toBe(2);
    expect(fila.kind).toBe("DECISORIO");     // `agreement_requires_decisorio` lo exige
    expect(fila.matter_code).toBe(punto.materia);
    expect(fila.title).toBe(punto.titulo);
    expect(fila.description).toContain("Punto 1.2");   // el "1.2" no cabe en un integer
    // Las 3 columnas source_convocatoria_* van juntas o ninguna (CHECK), y el
    // guard exige convocatoria EMITIDA e inmutable: ésta está en BORRADOR.
    expect(Object.keys(fila).some((k) => k.startsWith("source_"))).toBe(false);
  });

  const packDe = (materia: string): PackResuelto => ({
    packId: MATERIAS_SLP.includes(materia) ? materia : `GARR_${materia}`,
    version: "1.0.0",
    materia,
    mayoriaSL: { fuente: "ESTATUTOS", formula: "favor > 1/2_votos_capital", referencia: "art. 30.1 Estatutos: …" },
  });

  it("el acuerdo lee clase del catálogo y cita del pack, y deja la mayoría en NULL", () => {
    const punto = puntosConAcuerdo().find((p) => p.materia === "APROBACION_CUENTAS")!;
    const fila = buildAgreementRow({
      meetingId: "m-1", bodyId: "b-1", agendaItemId: "ai-1", punto,
      clase: { materia: "APROBACION_CUENTAS", matter_class: "ORDINARIA", inscribable: false },
      pack: packDe("APROBACION_CUENTAS"),
    });
    expect(fila.matter_class).toBe("ORDINARIA");
    expect(fila.inscribable).toBe(false);
    expect(fila.adoption_mode).toBe("MEETING");
    expect(fila.status).toBe("ADOPTED");
    expect(fila.decision_date).toBe(FECHA_JUNTA);
    expect(fila.agenda_item_id).toBe("ai-1");        // la arista es un uuid, no el "7"
    expect(fila.rule_pack_id).toBe("GARR_APROBACION_CUENTAS");
    // La cita NO se escribe a mano en el seed: se copia de la rama SL del pack.
    expect(fila.statutory_basis).toBe(packDe("APROBACION_CUENTAS").mayoriaSL.referencia);
    expect("required_majority_code" in fila).toBe(false);
    const ce = fila.compliance_explain.c1_junta_socios_2026 as {
      punto: string;
      orden_del_dia_ordinal: number;
      contenido_acuerdo: string;
      rule_pack: { resolucion: string };
      mayoria: { fuente: string };
      required_majority_code: { valor: null; motivo: string };
    };
    expect(ce.punto).toBe("7");
    expect(ce.orden_del_dia_ordinal).toBe(8);
    expect(ce.rule_pack.resolucion).toBe("POR_MATERIA");
    expect(ce.mayoria.fuente).toBe("ESTATUTOS");
    expect(ce.required_majority_code.valor).toBeNull();
    expect(ce.required_majority_code.motivo).toContain("art. 30.1");
    expect(ce.contenido_acuerdo).toBe("INFERIDO");
  });

  it("el acuerdo del 1.1 lleva la subsunción dentro, y los demás no la llevan", () => {
    const punto = puntosConAcuerdo().find((p) => p.numero === "1.1")!;
    const packEstatutos: PackResuelto = {
      packId: "GARR_MODIFICACION_ESTATUTOS",
      version: "1.0.0",
      materia: MATERIA_ESTATUTOS,
      mayoriaSL: {
        fuente: "ESTATUTOS",
        formula: "favor >= 2/3_votos_totales",
        referencia: "art. 30.2.a) Estatutos",
      },
    };
    const fila = buildAgreementRow({
      meetingId: "m-1", bodyId: "b-1", agendaItemId: "ai-1", punto,
      clase: { materia: MATERIA_ESTATUTOS, matter_class: "ESTATUTARIA", inscribable: true },
      pack: packEstatutos,
    });
    expect(fila.matter_class).toBe("ESTATUTARIA");
    expect(fila.inscribable).toBe(true);
    // La cita de la mayoría se copia del pack: si el pack cambiara a la lectura
    // alternativa (art. 30.1), el acuerdo la seguiría sin tocar el seed.
    expect(fila.statutory_basis).toBe("art. 30.2.a) Estatutos");
    expect(fila.statutory_basis).not.toMatch(/LSC/);
    const ce = fila.compliance_explain.c1_junta_socios_2026 as {
      subsuncion?: { procedencia?: string; lecturaAlternativa?: string };
      mayoria: { fuente: string };
      required_majority_code: { valor: null; motivo: string };
    };
    expect(ce.subsuncion?.procedencia).toBe("INFERIDO");
    expect(ce.subsuncion?.lecturaAlternativa).toContain("30.2.f");
    expect(ce.mayoria.fuente).toBe("ESTATUTOS");
    // NULL también aquí, y por un motivo distinto al de los otros nueve: la
    // escalera sí sabe decir «dos tercios», pero escribirlo presentaría como
    // firme una mayoría que se aplica por subsunción etiquetada.
    expect(ce.required_majority_code.valor).toBeNull();
    expect(ce.required_majority_code.motivo).toContain("REFORZADA_2_3");
    expect(ce.required_majority_code.motivo).toContain("SUBSUNCIÓN");

    // Control: un acuerdo cuya regla sale de una cita directa NO lleva la clave.
    // Sin esto, «la subsunción está» no distinguiría de «se pinta siempre».
    const otro = puntosConAcuerdo().find((p) => p.materia === "APROBACION_CUENTAS")!;
    const filaOtro = buildAgreementRow({
      meetingId: "m-1", bodyId: "b-1", agendaItemId: "ai-2", punto: otro,
      clase: { materia: "APROBACION_CUENTAS", matter_class: "ORDINARIA", inscribable: false },
      pack: packDe("APROBACION_CUENTAS"),
    });
    expect("subsuncion" in (filaOtro.compliance_explain.c1_junta_socios_2026 as object)).toBe(false);
  });

  it("el acuerdo se niega a que le crucen la clase o el pack de otra materia", () => {
    const punto = puntosConAcuerdo().find((p) => p.materia === "APROBACION_CUENTAS")!;
    const base = {
      meetingId: "m-1", bodyId: "b-1", agendaItemId: "ai-1", punto,
      clase: { materia: "APROBACION_CUENTAS", matter_class: "ORDINARIA", inscribable: false },
      pack: packDe("APROBACION_CUENTAS"),
    };
    expect(() => buildAgreementRow({ ...base, pack: packDe("NOMBRAMIENTO_AUDITOR") }))
      .toThrow(/sirve la materia/);
    expect(() => buildAgreementRow({ ...base, clase: { materia: "NOMBRAMIENTO_AUDITOR", matter_class: "ORDINARIA", inscribable: true } }))
      .toThrow(/clase de/);
    expect(() => buildAgreementRow({ ...base, pack: { ...packDe("APROBACION_CUENTAS"), mayoriaSL: {} } }))
      .toThrow(/referencia de mayoría/);
  });
});

describe("C1 — los 10 acuerdos de la Junta en Cloud", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  let meetingId: string | null = null;
  type Acuerdo = {
    id: string;
    entity_id: string;
    agreement_kind: string;
    matter_class: string;
    inscribable: boolean;
    adoption_mode: string;
    status: string;
    decision_date: string;
    parent_meeting_id: string | null;
    agenda_item_id: string | null;
    rule_pack_id: string | null;
    rule_pack_version: string | null;
    required_majority_code: string | null;
    statutory_basis: string | null;
    proposal_text: string | null;
    decision_text: string | null;
    compliance_explain: { c1_junta_socios_2026?: { contenido_acuerdo?: string; alcance?: string } } | null;
  };
  let acuerdos: Acuerdo[] = [];

  beforeAll(async () => {
    // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);

    const { data: m } = await garr.from("meetings").select("id").eq("slug", MEETING_SLUG).maybeSingle();
    meetingId = m?.id ?? null;

    const { data, error } = await garr.from("agreements")
      .select("id, entity_id, body_id, code, agreement_kind, matter_class, inscribable, adoption_mode, status, decision_date, parent_meeting_id, agenda_item_id, rule_pack_id, rule_pack_version, required_majority_code, statutory_basis, proposal_text, decision_text, compliance_explain")
      .eq("tenant_id", GARRIGUES_TENANT);
    if (error) throw new Error(`agreements Garrigues: ${error.message}`);
    acuerdos = data ?? [];
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a todas las sondas que corran después — y el síntoma no es un
  // error de login, son consultas que devuelven vacío y aserciones que fallan
  // en un fichero que no ha hecho nada mal.

  it("hay 10 acuerdos, son los 10 puntos con materia e incluyen la modificación del art. 36", () => {
    expect(acuerdos).toHaveLength(10);
    expect(acuerdos.map((a) => a.agreement_kind).sort())
      .toEqual(puntosConAcuerdo().map((p) => p.materia).sort());
    // El punto 1.1 SÍ produce acuerdo desde Task 6-bis. Lo que sigue sin poder
    // pasar es que aparezca sin regla del tenant: eso lo cierra el caso del pack.
    expect(acuerdos.map((a) => a.agreement_kind)).toContain(MATERIA_ESTATUTOS);
    expect(acuerdos.every((a) => a.adoption_mode === "MEETING")).toBe(true);
    expect(acuerdos.every((a) => a.status === "ADOPTED")).toBe(true);
    expect(acuerdos.every((a) => String(a.decision_date).slice(0, 10) === FECHA_JUNTA)).toBe(true);
    expect(acuerdos.every((a) => a.parent_meeting_id === meetingId)).toBe(true);
    expect(acuerdos.every((a) => a.entity_id === MATRIZ)).toBe(true);
    expect(acuerdos.every((a) => a.rule_pack_id !== null)).toBe(true);
  });

  it("la clase y la inscribibilidad son las de materia_catalog, no las del seed", async () => {
    const { data, error } = await garr.from("materia_catalog")
      .select("materia, matter_class, inscribable")
      .in("materia", acuerdos.map((a) => a.agreement_kind));
    expect(error).toBeNull();
    expect(data).toHaveLength(10);
    for (const c of data!) {
      const a = acuerdos.find((x) => x.agreement_kind === c.materia)!;
      expect([a.agreement_kind, a.matter_class, a.inscribable])
        .toEqual([c.materia, c.matter_class, c.inscribable]);
    }
  });

  it("la arista punto ↔ acuerdo es la FK agenda_item_id, y el ordinal es el de la convocatoria", async () => {
    expect(meetingId).not.toBeNull();
    const { data: items, error } = await garr.from("agenda_items")
      .select("id, order_number, title, kind, matter_code, tenant_id, source_convocatoria_id")
      .eq("meeting_id", meetingId);
    expect(error).toBeNull();
    expect(items).toHaveLength(10);
    expect(items!.every((i) => i.tenant_id === GARRIGUES_TENANT)).toBe(true);
    expect(items!.every((i) => i.kind === "DECISORIO")).toBe(true);
    // El vínculo por FK a la convocatoria no se escribe: está en BORRADOR y el
    // guard exige EMITIDA e inmutable. Si algún día se escribe, esta línea cae.
    expect(items!.every((i) => i.source_convocatoria_id === null)).toBe(true);

    for (const a of acuerdos) {
      expect(a.agenda_item_id).not.toBeNull();
      const item = items!.find((i) => i.id === a.agenda_item_id);
      expect(item, `el acuerdo ${a.agreement_kind} no resuelve su agenda_item`).toBeTruthy();
      // El ordinal se deriva del módulo, no del dato: si el seed lo hubiera
      // desplazado, el acuerdo colgaría de otro punto de la convocatoria.
      const punto = puntosConAcuerdo().find((p) => p.materia === a.agreement_kind)!;
      expect(item!.order_number).toBe(ordinalEnOrdenDelDia(punto.numero));
      expect(item!.title).toBe(punto.titulo);
      expect(item!.matter_code).toBe(a.agreement_kind);
    }
    // Y es 1:1 — dos acuerdos sobre el mismo punto serían el mismo acuerdo.
    expect(new Set(acuerdos.map((a) => a.agenda_item_id)).size).toBe(10);
  });

  it("cada acuerdo resuelve al pack POR MATERIA del tenant Garrigues, no al de órgano", async () => {
    // Sin esto el bucle de abajo no itera y el caso pasa en vacío.
    expect(acuerdos).toHaveLength(10);
    const { data: packs, error } = await garr.from("rule_packs")
      .select("id, materia, organo_tipo, tenant_id, rule_pack_versions!inner(version, is_active)")
      .eq("rule_pack_versions.is_active", true);
    expect(error).toBeNull();
    // RLS: el login de Garrigues solo ve packs de su tenant.
    expect(packs!.every((p) => p.tenant_id === GARRIGUES_TENANT)).toBe(true);

    for (const a of acuerdos) {
      const pack = packs!.find((p) => p.id === a.rule_pack_id);
      expect(pack, `el pack ${a.rule_pack_id} no es visible para Garrigues`).toBeTruthy();
      // La materia del pack es la del acuerdo: eso es «resolver por materia».
      expect(pack!.materia).toBe(a.agreement_kind);
      expect(pack!.organo_tipo).toBe("JUNTA_GENERAL");
      expect(a.rule_pack_id).not.toBe("GARR_JUNTA_SOCIOS");
      expect(a.rule_pack_version).toBe(pack!.rule_pack_versions[0].version);
    }
    // Las 6 de G3 llevan la materia por id; las 3 de C1 llevan prefijo porque el
    // id sin prefijo ya era de ARGA (rule_packs.id es PK global, no por tenant).
    for (const a of acuerdos) {
      const esperado = MATERIAS_SLP.includes(a.agreement_kind) ? a.agreement_kind : `GARR_${a.agreement_kind}`;
      expect(a.rule_pack_id).toBe(esperado);
    }
  });

  it("la mayoría de las 3 materias nuevas es el art. 30.1 estatutario, sin supletoria LSC", async () => {
    const { data, error } = await garr.from("rule_packs")
      .select("id, materia, rule_pack_versions!inner(payload, is_active)")
      .in("materia", MATERIAS_NUEVAS)
      .eq("rule_pack_versions.is_active", true);
    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    for (const p of data!) {
      const sl = (p.rule_pack_versions[0].payload as PackPayload)?.votacion?.mayoria?.SL ?? {};
      expect(sl.fuente).toBe("ESTATUTOS");
      expect(sl.referencia).toContain("30.1");
      // Cero supletoria: citar el 198/201.1 LSC sería atribuir a la ley lo que
      // dicen los Estatutos, y además con otra base de cómputo.
      expect(sl.referencia).not.toMatch(/LSC/);
      expect(sl.baseComputo).toContain("CAPITAL");
      // Y el acuerdo copia esa cita: la arista, no una coincidencia de texto.
      const a = acuerdos.find((x) => x.agreement_kind === p.materia)!;
      expect(a.statutory_basis).toBe(sl.referencia);
    }
  });

  it("el pack homónimo de ARGA existe, dice otra cosa y Garrigues NO lo ve", async () => {
    // Control discriminante. Sin él, «resuelve al pack correcto» solo significa
    // «hay un pack»: los ids sin prefijo existen y sirven la mayoría de la LSC.
    const { data: deArga, error: eArga } = await arga.from("rule_packs")
      .select("id, tenant_id, rule_pack_versions!inner(payload, is_active)")
      .in("id", MATERIAS_NUEVAS)
      .eq("rule_pack_versions.is_active", true);
    expect(eArga).toBeNull();
    expect(deArga).toHaveLength(3);
    expect(deArga!.every((p) => p.tenant_id !== GARRIGUES_TENANT)).toBe(true);
    // La mayoría de ARGA es la supletoria de la LEY: si el acuerdo de Garrigues
    // hubiera resuelto ahí, mostraría el art. 198 LSC en vez del art. 30.1.
    const slArga = deArga!.map((p) => (p.rule_pack_versions[0].payload as PackPayload)?.votacion?.mayoria?.SL ?? {});
    const refsArga = slArga.map((sl) => String(sl.referencia ?? ""));
    expect(slArga.every((sl) => sl.fuente === "LEY")).toBe(true);        // ninguno ESTATUTOS
    expect(refsArga.every((r) => !r.includes("30.1"))).toBe(true);       // ninguno el art. 30.1
    // Al menos uno cita la LSC expresamente. No «todos»: el pack
    // DELEGACION_FACULTADES de ARGA trae la rama SL SIN referencia — hueco
    // pre-existente de ARGA, ajeno a C1, que no se toca desde aquí.
    expect(refsArga.some((r) => /LSC/.test(r))).toBe(true);

    const { data: garrVe, error: eVe } = await garr.from("rule_packs").select("id").in("id", MATERIAS_NUEVAS);
    expect(eVe).toBeNull();
    expect(garrVe ?? []).toHaveLength(0);
  });

  it("la modificación de estatutos va por los 2/3 del art. 30.2.a), no por el 199.a LSC de ARGA", async () => {
    // La arista, no el rótulo: la mayoría que enseña el acuerdo tiene que venir
    // del pack del tenant. Si dejara de leerse y resolviera al homónimo de ARGA,
    // la referencia sería «art. 199.a LSC» (mayoría simple del capital) y este
    // caso caería por los dos lados.
    const { data, error } = await garr.from("rule_packs")
      .select("id, materia, tenant_id, rule_pack_versions!inner(payload, is_active)")
      .eq("materia", MATERIA_ESTATUTOS)
      .eq("rule_pack_versions.is_active", true);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe("GARR_MODIFICACION_ESTATUTOS");
    expect(data![0].tenant_id).toBe(GARRIGUES_TENANT);
    const payload = data![0].rule_pack_versions[0].payload as PackPayload & {
      reglaEspecifica?: { subsuncionArt36?: Record<string, string> };
    };
    const sl = payload?.votacion?.mayoria?.SL ?? {};
    expect(sl.fuente).toBe("ESTATUTOS");
    expect(sl.referencia).toContain("30.2.a");
    expect(sl.referencia).not.toMatch(/LSC/);
    expect(String(sl.formula)).toContain("2/3");

    // La etiqueta INFERIDO y la lectura alternativa viajan DENTRO del pack: es
    // el segundo de los tres sitios (módulo, pack y docs/legal).
    const sub = payload?.reglaEspecifica?.subsuncionArt36 ?? {};
    expect(sub.procedencia).toBe("INFERIDO");
    expect(sub.lecturaAplicada).toBe(SUBSUNCION_ART36.lecturaAplicada);
    expect(sub.lecturaAlternativa).toBe(SUBSUNCION_ART36.lecturaAlternativa);
    expect(sub.objeto).toContain("338618");

    // Y el acuerdo copia esa cita, que es lo que hace de esto una arista.
    const a = acuerdos.find((x) => x.agreement_kind === MATERIA_ESTATUTOS)!;
    expect(a.rule_pack_id).toBe("GARR_MODIFICACION_ESTATUTOS");
    expect(a.statutory_basis).toBe(sl.referencia);
    expect(a.matter_class).toBe("ESTATUTARIA");
    expect(a.inscribable).toBe(true);
    const ce = (a.compliance_explain?.c1_junta_socios_2026 ?? {}) as {
      subsuncion?: Record<string, string>;
    };
    expect(ce.subsuncion?.procedencia).toBe("INFERIDO");
    expect(ce.subsuncion?.lecturaAlternativa).toContain("30.2.f");

    // Control discriminante: el homónimo de ARGA existe, dice otra cosa y
    // Garrigues no lo ve.
    const { data: deArga } = await arga.from("rule_packs")
      .select("id, tenant_id, rule_pack_versions!inner(payload, is_active)")
      .eq("id", MATERIA_ESTATUTOS)
      .eq("rule_pack_versions.is_active", true);
    expect(deArga).toHaveLength(1);
    const slArga = (deArga![0].rule_pack_versions[0].payload as PackPayload)?.votacion?.mayoria?.SL ?? {};
    expect(slArga.referencia).toContain("199");
    expect(String(slArga.referencia)).not.toContain("30.2.a");
    const { data: garrVeArga } = await garr.from("rule_packs").select("id").eq("id", MATERIA_ESTATUTOS);
    expect(garrVeArga ?? []).toHaveLength(0);
  });

  it("el gate del informe preceptivo dispara en 4 acuerdos y solo en esos 4", async () => {
    const { data: reqs, error } = await garr.from("agreement_document_requirements")
      .select("agreement_id, requirement_code, blocking_policy, fase, title, legal_basis")
      .in("agreement_id", acuerdos.map((a) => a.id))
      .eq("requirement_code", "INFORME_PRECEPTIVO_ORGANO");
    expect(error).toBeNull();
    const conGate = new Set(reqs!.map((r) => acuerdos.find((a) => a.id === r.agreement_id)!.agreement_kind));
    expect(conGate).toEqual(CON_GATE);
    // Y NO dispara en los demás: sin esta línea, «el gate funciona» solo
    // significaría «el panel se pinta siempre». El número de acuerdos sin gate
    // se DERIVA (era 5 con 9 acuerdos, es 6 con 10): pinarlo a mano lo habría
    // convertido en inventario, y volvería a romperse al siguiente acuerdo.
    expect(reqs).toHaveLength(CON_GATE.size);
    const sinGate = acuerdos.filter((a) => !CON_GATE.has(a.agreement_kind));
    expect(sinGate).toHaveLength(acuerdos.length - CON_GATE.size);
    expect(sinGate.length).toBeGreaterThan(0);
    // El décimo acuerdo entra por aquí: bajo la lectura aplicada del art. 30.2.a)
    // el art. 39.5.b.i lo llevaría al informe preceptivo, pero el gate demo NO se
    // amplía sobre una subsunción etiquetada INFERIDO. Si alguien lo añade al
    // config del órgano, esta línea cae y hay que ir al Comité Legal, no al test.
    expect(sinGate.map((a) => a.agreement_kind)).toContain(MATERIA_ESTATUTOS);
    // Las columnas reales son `blocking_policy` y `fase`, no `blocking`/`phase`.
    expect(reqs!.every((r) => r.blocking_policy === "BLOCKING" && r.fase === "PRE_CONVOCATORIA")).toBe(true);
    // El copy nombra al órgano informante y su artículo.
    expect(reqs!.every((r) => String(r.title).includes("Consejo de Socios"))).toBe(true);
    expect(reqs!.every((r) => String(r.legal_basis).includes("39.5.b"))).toBe(true);
  });

  it("los acuerdos sin contenido acreditado van marcados y no nombran a ningún socio", async () => {
    const { data: personas, error } = await garr.from("persons").select("full_name").limit(2000);
    expect(error).toBeNull();
    expect((personas ?? []).length).toBeGreaterThan(300);   // si no, la aserción sería vacua
    const inferidos = acuerdos.filter(
      (a) => a.compliance_explain?.c1_junta_socios_2026?.contenido_acuerdo === "INFERIDO",
    );
    expect(inferidos.length).toBeGreaterThan(0);
    for (const a of inferidos) {
      const texto = `${a.proposal_text} ${a.decision_text}`;
      for (const p of personas!) {
        expect(texto, `${a.agreement_kind} nombra a ${p.full_name}`).not.toContain(p.full_name);
      }
    }
    // La mayoría no se falsea con un código de la escalera SIMPLE/2_3/UNANIMIDAD:
    // ninguno expresa la base del art. 30.1 (votos del capital, no emitidos).
    expect(acuerdos.every((a) => a.required_majority_code === null)).toBe(true);
    expect(acuerdos.every((a) => a.compliance_explain?.c1_junta_socios_2026?.alcance?.includes("sin efecto jurídico"))).toBe(true);
  });

  it("ARGA no ve los acuerdos de Garrigues y conserva los suyos", async () => {
    const { data: cruzado, error: eCruz } = await arga.from("agreements").select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(eCruz).toBeNull();
    expect(cruzado ?? []).toHaveLength(0);
    const { data: propias, error: eArga } = await arga.from("agreements").select("id").limit(200);
    expect(eArga).toBeNull();
    // Sin esto la aserción cruzada sería vacua: ARGA tiene sus 46 acuerdos.
    expect((propias ?? []).length).toBeGreaterThan(0);
    // Y al revés: Garrigues tampoco ve los de ARGA.
    const { data: alReves } = await garr.from("agreements").select("id").neq("tenant_id", GARRIGUES_TENANT);
    expect(alReves ?? []).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────── Task 7 ──

/** Las 4 fórmulas reales que los packs del tenant traen para esta Junta. */
const F_80 = "favor >= 4/5_votos_totales";              // art. 30.3.b) Estatutos
const F_2_3 = "favor >= 2/3_votos_totales";             // art. 30.2 Estatutos
const F_30_1 = "favor > 1/2_votos_capital";             // art. 30.1 Estatutos
const F_DOBLE = "favor >= 2/3_votos_totales + mayoria_socios_profesionales"; // art. 30.2.g + art. 15 Ley 2/2007

describe("C1 — el motor evalúa la mayoría de la Junta (módulo puro)", () => {
  /**
   * Pack sintético: lo único que cambia entre casos es la FÓRMULA, que es
   * exactamente la variable cuyo efecto hay que demostrar. Las cadenas son las
   * reales de los packs del tenant, y la sonda de Cloud comprueba después que
   * los packs sembrados siguen trayendo esas mismas cadenas.
   */
  const packDe = (materia: string, formula: string): RulePack =>
    ({
      id: `TEST_${materia}`,
      materia,
      clase: "ESTATUTARIA",
      organoTipo: "JUNTA_GENERAL",
      modosAdopcionPermitidos: ["MEETING"],
      votacion: {
        mayoria: { SL: { formula, fuente: "ESTATUTOS", referencia: "art. 30 de los Estatutos" } },
        abstenciones: "no_cuentan",
      },
    }) as unknown as RulePack;

  const corre = (materia: string, formula: string, concurrenciaVotos: number) =>
    evaluarMayoriaPunto({
      punto: puntosConAcuerdo().find((p) => p.materia === materia)!,
      pack: packDe(materia, formula),
      packId: `TEST_${materia}`,
      version: "1.0.0",
      baseVotos: baseComputoJunta(),
      concurrenciaVotos,
      concurrenciaTodasLasClases: baseComputoTodasLasClases(),
    });

  it("el umbral lo calcula el motor y sale distinto para cada fórmula", () => {
    // 80 % de 16.900 = 13.520. Si esto fuera un rótulo, las tres darían igual.
    expect(corre("ADMISION_SOCIO_CUOTA", F_80, baseComputoJunta()).umbralVotos).toBe(13_520);
    expect(corre("MODIFICACION_ESTATUTOS", F_2_3, baseComputoJunta()).umbralVotos)
      .toBeCloseTo((2 * baseComputoJunta()) / 3, 6);
    expect(corre("APROBACION_CUENTAS", F_30_1, baseComputoJunta()).umbralVotos).toBe(8_450);
  });

  it("MUTACIÓN — bajar la concurrencia por debajo del 80 % vuelca el veredicto de la admisión", () => {
    // Con el censo íntegro concurrido, el 80 % del art. 30.3.b) es alcanzable.
    expect(corre("ADMISION_SOCIO_CUOTA", F_80, baseComputoJunta()).ok).toBe(true);
    // Un solo voto por debajo del umbral y deja de serlo. El motor CORRE: el
    // resultado depende de la entrada, no de la etiqueta del acuerdo.
    expect(corre("ADMISION_SOCIO_CUOTA", F_80, 13_519).ok).toBe(false);
    // Y el umbral es `>=`, no `>`: justo en 13.520 se alcanza.
    expect(corre("ADMISION_SOCIO_CUOTA", F_80, 13_520).ok).toBe(true);
  });

  it("MUTACIÓN — con la MISMA concurrencia, la fórmula decide el veredicto", () => {
    // 12.000 votos: pasan los 2/3 (11.266,67) y no pasan los 4/5 (13.520).
    expect(corre("MODIFICACION_ESTATUTOS", F_2_3, 12_000).ok).toBe(true);
    expect(corre("ADMISION_SOCIO_CUOTA", F_80, 12_000).ok).toBe(false);
    // Y la del art. 30.1 (mayoría de los votos del capital) pasa de sobra.
    expect(corre("APROBACION_CUENTAS", F_30_1, 12_000).ok).toBe(true);
  });

  it("la doble mayoría de la exclusión NO se evalúa, y se dice por qué", () => {
    // El motor no sabe computar «mayoría de socios profesionales» —es una
    // mayoría de SOCIOS, no de votos— y el acta no transcribe el desglose
    // nominal que haría falta. Ante una fórmula desconocida `evaluateFormula`
    // devuelve «no alcanzada» con umbral 0: persistir ese false diría que la
    // mayoría falló cuando lo que pasa es que no se evaluó.
    expect(esFormulaEvaluable(F_DOBLE)).toBe(false);
    const e = corre("EXCLUSION_SOCIO_ESTATUTARIA", F_DOBLE, baseComputoJunta());
    expect(e.evaluable).toBe(false);
    expect(e.umbralVotos).toBeNull();
    expect(e.ok).toBe(false);
    // WARNING, no BLOCKING: el motor no dice que el acuerdo falle, dice que no
    // puede pronunciarse. Pintarlo en rojo afirmaría lo primero.
    expect(e.severity).toBe("WARNING");
    expect(e.warnings.join(" ")).toContain("mayoría de SOCIOS");
    expect(String(e.explain.veredicto)).toContain("NO EVALUADO");
    // Y las tres que sí evalúa siguen evaluándose: si el motor hubiera dejado de
    // reconocer las fórmulas, este caso pasaría solo y sería indistinguible.
    expect(esFormulaEvaluable(F_80)).toBe(true);
    expect(esFormulaEvaluable(F_2_3)).toBe(true);
    expect(esFormulaEvaluable(F_30_1)).toBe(true);
  });

  it("la evaluación declara que NO está sellada en servidor y qué escenario evaluó", () => {
    const e = corre("ADMISION_SOCIO_CUOTA", F_80, baseComputoJunta());
    expect(e.explain.sello).toBe(SELLO_CLIENTE);
    expect(e.explain.sello).toBe("NO_SELLADO_EN_SERVIDOR");
    expect(String(e.explain.sello_motivo)).toContain("fn_secretaria_server_resolution_evaluation");
    expect(String(e.explain.escenario)).toContain("no el escrutinio");
    // La adopción la certifica el acta; esta evaluación no la decide.
    expect(e.explain.adopcion).toBe(ADOPCION_LA_CERTIFICA_EL_ACTA);
    expect(e.explain.desglose_nominal).toBe(MEETING_VOTES_VACIA);
    expect(String(e.explain.desglose_nominal)).toContain("meeting_votes queda VACÍA");
    // `explain` es PLANO: la ficha renderiza cada valor con String(value) y un
    // objeto anidado saldría como "[object Object]".
    expect(Object.values(e.explain).every((v) => typeof v !== "object")).toBe(true);
  });

  it("las dos bases NO se mezclan: el motor recibe 16.900 y 16.908 viaja como conciliación", () => {
    const e = corre("ADMISION_SOCIO_CUOTA", F_80, baseComputoJunta());
    expect(e.explain.base_votos).toBe(16_900);
    expect(e.explain.base_votos).toBe(baseComputoJunta());
    expect(e.explain.concurrencia_todas_las_clases).toBe(16_908);
    expect(e.explain.concurrencia_todas_las_clases).toBe(baseComputoTodasLasClases());
    expect(e.explain.base_computo).toBe("VOTOS_CLASE_A_NO_AUTOCARTERA");
    // El umbral se mide sobre la declarada: 4/5 de 16.908 daría 13.526,4.
    expect(e.umbralVotos).toBe(13_520);
    expect(e.umbralVotos).not.toBe((4 * baseComputoTodasLasClases()) / 5);
  });

  it("la concurrencia se mide sobre la base declarada y sobre la íntegra, por separado", () => {
    const socios = [...SOCIOS_PRESENCIALES.map((n) => socio(n)), socio("Socia Representada", "A"), socio("Socio Clase B", "B")];
    const filas = buildAttendeeRows("m", socios, `id-${REPRESENTANTE_UNICO}`);
    const c = concurrenciaCertificada(socios, filas);
    // 4 socios de cuota × 50 votos = 200 en la base declarada; +1 de clase B.
    expect(c.socios).toBe(4);
    expect(c.votos).toBe(200);
    expect(c.votosTodasLasClases).toBe(201);
    expect(c.votosTodasLasClases - c.votos).toBe(1);   // el voto de clase B, fuera de la base
  });

  it("la resolución enlaza por agreement_id y NO deja que el DEFAULT escriba SIMPLE", () => {
    const punto = puntosConAcuerdo().find((p) => p.materia === "APROBACION_CUENTAS")!;
    const fila = buildResolutionRow("m-1", punto, "ag-1");
    expect(fila.agreement_id).toBe("ag-1");
    expect(fila.agenda_item_index).toBe(ordinalEnOrdenDelDia(punto.numero));
    expect(fila.status).toBe("ADOPTED");
    // DECISION exige agenda_items.kind = DECISORIO, que es lo que Task 6 escribió.
    expect(fila.kind_resolution).toBe("DECISION");
    // La columna tiene DEFAULT 'SIMPLE': omitirla escribiría una mayoría que no
    // es la aplicable. Va a NULL explícito, igual que en `agreements`.
    expect(fila.required_majority_code).toBeNull();
    expect("required_majority_code" in fila).toBe(true);
    expect(fila.resolution_text).toBe(textoAcuerdo(punto.numero).decision);
    expect(fila.tenant_id).toBe(GARRIGUES_TENANT);   // la tabla NO tiene default
  });

  it("la ficha del acuerdo lee ESTA clave: el aviso y el dato no pueden divergir", () => {
    // Verificar un RÓTULO no prueba la ARISTA. El aviso «no sellada en servidor»
    // de `ExpedienteAcuerdo` se dispara leyendo `explain.sello`; si alguien
    // renombrara la clave en el seed o en la página, el aviso dejaría de
    // pintarse EN SILENCIO y todas las demás aserciones seguirían verdes.
    const ficha = readFileSync("src/pages/secretaria/ExpedienteAcuerdo.tsx", "utf8");
    expect(ficha).toContain(`sello === "${SELLO_CLIENTE}"`);
    expect(ficha).toContain("sello_motivo");
    // Y el aviso cuelga de la tarjeta donde se ve el resultado, no de un tooltip.
    expect(ficha).toMatch(/title="Validación normativa">\s*\n\s*<EvaluacionNoSelladaAviso/);
  });

  it("cada punto tiene su propia etapa: dos acuerdos no comparten registro", () => {
    const etapas = puntosConAcuerdo().map((p) => etapaEvaluacion(p.numero));
    expect(new Set(etapas).size).toBe(etapas.length);
    expect(etapas).toContain("MAYORIA_JUNTA_2026_PUNTO_1.1");
  });
});

describe("C1 — resoluciones, votos y evaluación de la Junta en Cloud", () => {
  // ⚠ Este bloque queda ROJO hasta que se ejecute el seed con permiso de
  // escritura: `bun run scripts/seed-garrigues-junta-2026.ts --commit`.
  // La tarea que lo escribió tenía prohibido escribir en Cloud. No se le pone
  // graceful-skip: una sonda que se salta a sí misma es un gate verde que no
  // asierta nada, y este bloque es justo el que prueba que la evaluación llegó.
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  let meetingId: string;
  type Resolucion = {
    id: string;
    agenda_item_index: number;
    agreement_id: string | null;
    status: string;
    required_majority_code: string | null;
    kind_resolution: string;
    resolution_type: string;
  };
  type Evaluacion = {
    id: string;
    agreement_id: string;
    etapa: string;
    ok: boolean;
    severity: string;
    explain: Record<string, unknown> | null;
    warnings: unknown;
    rule_pack_id: string | null;
    rule_pack_version: string | null;
    evaluation_hash: string | null;
  };
  let resoluciones: Resolucion[] = [];
  let evaluaciones: Evaluacion[] = [];
  let acuerdoPorId = new Map<string, string>();

  beforeAll(async () => {
    // Sesión COMPARTIDA y memoizada (patrón de C3): 2 logins en toda la suite.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);

    const { data: m, error: eM } = await garr.from("meetings").select("id").eq("slug", MEETING_SLUG).maybeSingle();
    if (eM) throw new Error(`meetings ${MEETING_SLUG}: ${eM.message}`);
    if (!m) throw new Error(`No existe la reunión ${MEETING_SLUG}: ejecuta antes el seed.`);
    meetingId = m.id;

    const { data: res, error: eRes } = await garr.from("meeting_resolutions")
      .select("id, agenda_item_index, agreement_id, status, required_majority_code, kind_resolution, resolution_type")
      .eq("meeting_id", meetingId);
    if (eRes) throw new Error(`meeting_resolutions: ${eRes.message}`);
    resoluciones = res ?? [];

    const { data: ags, error: eAgs } = await garr.from("agreements")
      .select("id, agreement_kind").eq("tenant_id", GARRIGUES_TENANT).eq("parent_meeting_id", meetingId);
    if (eAgs) throw new Error(`agreements: ${eAgs.message}`);
    acuerdoPorId = new Map((ags ?? []).map((a) => [a.id, a.agreement_kind]));

    const { data: evs, error: eEvs } = await garr.from("rule_evaluation_results")
      .select("id, agreement_id, etapa, ok, severity, explain, warnings, rule_pack_id, rule_pack_version, evaluation_hash")
      .in("agreement_id", [...acuerdoPorId.keys()]);
    if (eEvs) throw new Error(`rule_evaluation_results: ${eEvs.message}`);
    evaluaciones = evs ?? [];
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA.

  it("cada acuerdo tiene su resolución enlazada por agreement_id, no por texto", () => {
    expect(resoluciones).toHaveLength(10);
    expect(resoluciones.every((r) => r.agreement_id !== null)).toBe(true);
    expect(new Set(resoluciones.map((r) => r.agreement_id)).size).toBe(10);
    expect(resoluciones.every((r) => r.status === "ADOPTED")).toBe(true);
    expect(resoluciones.every((r) => r.kind_resolution === "DECISION")).toBe(true);
    // El enlace es real: cada agreement_id es uno de los 10 acuerdos de la Junta.
    expect(resoluciones.every((r) => acuerdoPorId.has(r.agreement_id!))).toBe(true);
    // El ordinal es el del orden del día, con sus huecos y sin renumerar.
    expect(resoluciones.map((r) => r.agenda_item_index).sort((a, b) => a - b))
      .toEqual(puntosConAcuerdo().map((p) => ordinalEnOrdenDelDia(p.numero)).sort((a, b) => a - b));
    // Nadie escribió SIMPLE por el DEFAULT de la columna.
    expect(resoluciones.every((r) => r.required_majority_code === null)).toBe(true);
  });

  it("meeting_votes está VACÍA para esta Junta, y el expediente dice por qué", async () => {
    const { data, error } = await garr.from("meeting_votes").select("id")
      .in("resolution_id", resoluciones.map((r) => r.id));
    expect(error).toBeNull();
    // El acta no transcribe el desglose nominal: escribirlo atribuiría un voto a
    // 346 personas identificadas. La ausencia es la decisión, no un olvido...
    expect(data ?? []).toHaveLength(0);
    // ...y por eso el motivo VIAJA en el expediente. Sin esto, «no hay filas»
    // sería indistinguible de «se olvidaron».
    expect(evaluaciones.length).toBeGreaterThan(0);
    expect(evaluaciones.every((e) => e.explain?.desglose_nominal === MEETING_VOTES_VACIA)).toBe(true);
    // Control discriminante: la aserción de arriba sería vacua si no hubiera
    // resoluciones sobre las que buscar votos.
    expect(resoluciones.length).toBe(10);
  });

  it("los 10 acuerdos llevan la evaluación del motor, con su umbral sobre la base declarada", () => {
    expect(evaluaciones).toHaveLength(10);
    expect(new Set(evaluaciones.map((e) => e.agreement_id)).size).toBe(10);
    expect(new Set(evaluaciones.map((e) => e.etapa)).size).toBe(10);
    expect(evaluaciones.every((e) => e.evaluation_hash !== null)).toBe(true);
    // La base es la declarada (16.900). NUNCA la íntegra de 16.908.
    expect(evaluaciones.every((e) => e.explain?.base_votos === baseComputoJunta())).toBe(true);
    expect(evaluaciones.every((e) => e.explain?.concurrencia_todas_las_clases === baseComputoTodasLasClases())).toBe(true);
    // El umbral del 80 % del art. 30.3.b) son 13.520 votos, calculados por el motor.
    const admision = evaluaciones.find((e) => acuerdoPorId.get(e.agreement_id) === "ADMISION_SOCIO_CUOTA");
    expect(admision).toBeDefined();
    expect(admision!.explain?.umbral_votos).toBe(13_520);
    expect(String(admision!.explain?.formula)).toBe(F_80);
    expect(admision!.ok).toBe(true);
  });

  it("la evaluación declara NO SELLADA EN SERVIDOR — que es lo que la ficha pinta", () => {
    // Sin esto, los tres `every` de abajo pasarían sobre un array VACÍO: verde
    // mudo. La sonda tiene que ponerse roja mientras no haya evaluaciones.
    expect(evaluaciones).toHaveLength(10);
    expect(evaluaciones.every((e) => e.explain?.sello === SELLO_CLIENTE)).toBe(true);
    expect(evaluaciones.every((e) => String(e.explain?.sello_motivo ?? "").includes("fn_secretaria_server_resolution_evaluation"))).toBe(true);
    // El aviso de la ficha se dispara por ESTE dato (`explain.sello`), no por la
    // ruta ni por el tenant: si la clave cambiara de nombre, el aviso caería en
    // silencio y este caso es lo único que lo impide.
    expect(evaluaciones.every((e) => e.explain?.sello === "NO_SELLADO_EN_SERVIDOR")).toBe(true);
  });

  it("la que el motor NO sabe evaluar va marcada, y es exactamente la doble mayoría", () => {
    const noEvaluadas = evaluaciones.filter((e) => String(e.explain?.veredicto ?? "").includes("NO EVALUADO"));
    // Derivado, no pinado: si mañana el motor aprende la doble mayoría, este caso
    // se entera. Un `toBe(1)` a mano no distinguiría eso de una regresión.
    expect(noEvaluadas.map((e) => acuerdoPorId.get(e.agreement_id))).toEqual(["EXCLUSION_SOCIO_ESTATUTARIA"]);
    expect(noEvaluadas.every((e) => e.severity === "WARNING")).toBe(true);
    expect(noEvaluadas.every((e) => e.explain?.umbral_votos === "NO EVALUABLE")).toBe(true);
    // Control discriminante: las otras 9 SÍ se evaluaron y traen umbral numérico.
    const evaluadas = evaluaciones.filter((e) => !String(e.explain?.veredicto ?? "").includes("NO EVALUADO"));
    expect(evaluadas).toHaveLength(9);
    expect(evaluadas.every((e) => typeof e.explain?.umbral_votos === "number")).toBe(true);
  });

  it("ARGA no ve nada de esto y conserva sus propias evaluaciones", async () => {
    // Que ARGA no vea lo de Garrigues solo dice algo si Garrigues tiene algo.
    expect(resoluciones).toHaveLength(10);
    expect(evaluaciones).toHaveLength(10);
    const { data: cruzado, error: eCruz } = await arga.from("meeting_resolutions").select("id").eq("meeting_id", meetingId);
    expect(eCruz).toBeNull();
    expect(cruzado ?? []).toHaveLength(0);
    const { data: cruzadoEval } = await arga.from("rule_evaluation_results").select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(cruzadoEval ?? []).toHaveLength(0);
    // Sin esto las dos aserciones de arriba serían vacuas.
    const { data: propias, error: eProp } = await arga.from("meeting_resolutions").select("id").limit(50);
    expect(eProp).toBeNull();
    expect((propias ?? []).length).toBeGreaterThan(0);
    const { data: propiasEval } = await arga.from("rule_evaluation_results").select("id").limit(50);
    expect((propiasEval ?? []).length).toBeGreaterThan(0);
    // Y al revés: Garrigues tampoco ve las de ARGA.
    const { data: alReves } = await garr.from("rule_evaluation_results").select("id").neq("tenant_id", GARRIGUES_TENANT);
    expect(alReves ?? []).toHaveLength(0);
  });
});
