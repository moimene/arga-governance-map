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
  PUNTO_BLOQUEADO,
  NOTA_PUNTO_BLOQUEADO,
  ordinalEnOrdenDelDia,
  puntosConAcuerdo,
  textoAcuerdo,
  TEXTOS_ACUERDO,
} from "../../../scripts/garrigues/junta-2026/orden-del-dia";
import {
  baseComputoJunta,
  baseComputoTodasLasClases,
  CENSO_TOTAL,
} from "../../../scripts/garrigues/capital/estructura-art7";
import {
  buildAgendaRow,
  buildAgreementRow,
  buildAttendeeRows,
  buildQuorumData,
  censoPrecondicion,
  type PackResuelto,
  type SocioCenso,
} from "../../../scripts/seed-garrigues-junta-2026";

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
    garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eGarr } = await garr.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD });
    if (eGarr) throw new Error(`login Garrigues falló: ${eGarr.message}`);
    arga = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eArga } = await arga.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD });
    if (eArga) throw new Error(`login ARGA falló: ${eArga.message}`);

    const { data, error } = await garr.from("governing_bodies").select("id").eq("slug", ORGANO_SLUG).maybeSingle();
    if (error) throw new Error(`governing_bodies ${ORGANO_SLUG}: ${error.message}`);
    if (!data) throw new Error(`No existe el órgano ${ORGANO_SLUG} para el login Garrigues.`);
    bodyId = data.id;

    // Se resuelve una vez y se comparte: si no existe, los casos fallan diciéndolo,
    // que es lo contrario de saltárselos.
    const { data: m } = await garr.from("meetings").select("id").eq("slug", MEETING_SLUG).maybeSingle();
    meetingId = m?.id ?? null;
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

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

type MayoriaSL = { fuente?: string; formula?: string; referencia?: string; baseComputo?: string };
type PackPayload = { materia?: string; votacion?: { mayoria?: { SL?: MayoriaSL } } };

describe("C1 — los acuerdos de la Junta (módulo puro)", () => {
  it("son 9, no 10: el punto bloqueado sigue en el orden del día pero no produce acuerdo", () => {
    expect(puntosConAcuerdo()).toHaveLength(9);
    expect(puntosQueMaterializan()).toHaveLength(10);   // el contrato de Task 4 no se toca
    const bloqueado = ORDEN_DEL_DIA.find((p) => p.numero === PUNTO_BLOQUEADO)!;
    expect(bloqueado.materia).toBe("MODIFICACION_ESTATUTOS");
    expect(bloqueado.materializa).toBe(true);           // se deliberó
    expect(puntosConAcuerdo().map((p) => p.materia)).not.toContain("MODIFICACION_ESTATUTOS");
    // La razón se escribe: el art. 36 no consta y la mayoría del 30.2.f está tasada.
    expect(NOTA_PUNTO_BLOQUEADO).toContain("art. 36");
    expect(NOTA_PUNTO_BLOQUEADO).toContain("30.2.f");
    expect(NOTA_PUNTO_BLOQUEADO).toContain("Comité Legal");
  });

  it("los 9 son exactamente las 6 materias SLP más las 3 que solo existían en ARGA", () => {
    expect(puntosConAcuerdo().map((p) => p.materia).sort())
      .toEqual([...MATERIAS_SLP, ...MATERIAS_NUEVAS].sort());
  });

  it("el ordinal es la posición en la convocatoria, con huecos donde no hay acuerdo", () => {
    // 1 (bloqueado), 6, 9, 10 (sin materia) y 14 (acta) NO aparecen: no se
    // renumera, porque el ordinal apunta al elemento del array de la convocatoria.
    expect(puntosConAcuerdo().map((p) => ordinalEnOrdenDelDia(p.numero)))
      .toEqual([2, 3, 4, 5, 7, 8, 11, 12, 13]);
    expect(ordinalEnOrdenDelDia("1.1")).toBe(1);
    expect(ordinalEnOrdenDelDia("acta")).toBe(ORDEN_DEL_DIA.length);
    expect(() => ordinalEnOrdenDelDia("99")).toThrow(/no está en el orden del día/);
  });

  it("los 9 tienen texto, y el INFERIDO no identifica a ninguna persona del acta", () => {
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

describe("C1 — los 9 acuerdos de la Junta en Cloud", () => {
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
    garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eGarr } = await garr.auth.signInWithPassword({ email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD });
    if (eGarr) throw new Error(`login Garrigues falló: ${eGarr.message}`);
    arga = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: eArga } = await arga.auth.signInWithPassword({ email: ARGA_EMAIL, password: DEMO_PASSWORD });
    if (eArga) throw new Error(`login ARGA falló: ${eArga.message}`);

    const { data: m } = await garr.from("meetings").select("id").eq("slug", MEETING_SLUG).maybeSingle();
    meetingId = m?.id ?? null;

    const { data, error } = await garr.from("agreements")
      .select("id, entity_id, body_id, code, agreement_kind, matter_class, inscribable, adoption_mode, status, decision_date, parent_meeting_id, agenda_item_id, rule_pack_id, rule_pack_version, required_majority_code, statutory_basis, proposal_text, decision_text, compliance_explain")
      .eq("tenant_id", GARRIGUES_TENANT);
    if (error) throw new Error(`agreements Garrigues: ${error.message}`);
    acuerdos = data ?? [];
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("hay 9 acuerdos, son los 9 puntos con materia y ninguno es la modificación bloqueada", () => {
    expect(acuerdos).toHaveLength(9);
    expect(acuerdos.map((a) => a.agreement_kind).sort())
      .toEqual(puntosConAcuerdo().map((p) => p.materia).sort());
    // El control que importa: el punto 1.1 NO produjo acuerdo.
    expect(acuerdos.map((a) => a.agreement_kind)).not.toContain("MODIFICACION_ESTATUTOS");
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
    expect(data).toHaveLength(9);
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
    expect(items).toHaveLength(9);
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
    expect(new Set(acuerdos.map((a) => a.agenda_item_id)).size).toBe(9);
  });

  it("cada acuerdo resuelve al pack POR MATERIA del tenant Garrigues, no al de órgano", async () => {
    // Sin esto el bucle de abajo no itera y el caso pasa en vacío.
    expect(acuerdos).toHaveLength(9);
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

  it("el gate del informe preceptivo dispara en 4 acuerdos y solo en esos 4", async () => {
    const { data: reqs, error } = await garr.from("agreement_document_requirements")
      .select("agreement_id, requirement_code, blocking_policy, fase, title, legal_basis")
      .in("agreement_id", acuerdos.map((a) => a.id))
      .eq("requirement_code", "INFORME_PRECEPTIVO_ORGANO");
    expect(error).toBeNull();
    const conGate = new Set(reqs!.map((r) => acuerdos.find((a) => a.id === r.agreement_id)!.agreement_kind));
    expect(conGate).toEqual(CON_GATE);
    // Y NO dispara en los otros 5: sin esta línea, «el gate funciona» solo
    // significaría «el panel se pinta siempre».
    expect(reqs).toHaveLength(4);
    expect(acuerdos.filter((a) => !CON_GATE.has(a.agreement_kind))).toHaveLength(5);
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
