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
  MEETING_SLUG,
  MESA_PRESIDENTA,
  MESA_SECRETARIO,
  REPRESENTANTE_UNICO,
  SOCIOS_PRESENCIALES,
} from "../../../scripts/garrigues/junta-2026/orden-del-dia";
import {
  baseComputoJunta,
  baseComputoTodasLasClases,
  CENSO_TOTAL,
} from "../../../scripts/garrigues/capital/estructura-art7";
import {
  buildAttendeeRows,
  buildQuorumData,
  censoPrecondicion,
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

  it("el gate del censo distingue una RPC que pondera por votos de una que pondera por capital", () => {
    const socios = [socio("A", "A"), socio("B", "B")];
    // Tal y como está hoy fn_crear_censo_snapshot: porcentaje_capital × votos/título.
    expect(censoPrecondicion(socios).ok).toBe(false);
    expect(censoPrecondicion(socios).ratioVotos).toBe(50);

    // Mutante: si la RPC ponderase por títulos —que es lo que hace hoy
    // fn_refresh_parte_votante_entity tras la migración 20260829150000— el gate abre.
    const porTitulos = socios.map((s) => ({
      ...s,
      holding: { ...s.holding, porcentaje_capital: Number(s.holding.numero_titulos) },
    }));
    expect(censoPrecondicion(porTitulos).ok).toBe(true);
    expect(censoPrecondicion(porTitulos).ratioRpc).toBe(50);
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

  it("el censo WORM NO se ha creado, y la razón sigue vigente", async () => {
    // GATE DELIBERADO, no una laguna. `fn_crear_censo_snapshot` lleva su propia
    // copia EN LÍNEA de la fórmula vieja (`porcentaje_capital × votes_per_title`):
    // la migración 20260829150000 corrigió `fn_refresh_parte_votante_entity` y no
    // llegó a esta RPC. Con las dos clases del art. 7 eso da un socio de clase A
    // pesando 800.000 veces uno de clase B, cuando el artículo dice 50 — y
    // `censo_snapshot` es INMUTABLE: crearlo hoy congelaría ese peso para siempre,
    // y `fn_secretaria_build_minute_legal_manifest` lo suma para el quórum del acta.
    //
    // ESTE TEST ESTÁ ESCRITO PARA ROMPERSE. El día que la RPC se corrija, el ratio
    // pasará a 50 y este caso fallará: entonces hay que crear el censo y sustituir
    // este test por el que asierta el snapshot bien ponderado. No relajarlo.
    const { data: censo, error } = await garr.from("censo_snapshot")
      .select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    expect(censo).toHaveLength(0);

    // Y se mide que la razón del gate sigue siendo cierta, replicando lo que la
    // RPC calcularía: si esto dejara de ser 800.000, el gate ya no aplica.
    const { data: clases } = await garr.from("share_classes")
      .select("id, class_code, votes_per_title").eq("entity_id", MATRIZ);
    const vpt = new Map(clases.map((c) => [c.id, Number(c.votes_per_title)]));
    const codigo = new Map(clases.map((c) => [c.id, c.class_code]));
    const { data: hs } = await garr.from("capital_holdings")
      .select("porcentaje_capital, share_class_id, is_treasury, voting_rights")
      .eq("entity_id", MATRIZ).limit(500);
    const pesoRpc = (h) => Number(h.porcentaje_capital) * (vpt.get(h.share_class_id) ?? 1);
    const vivos = hs.filter((h) => !h.is_treasury && h.voting_rights);
    const a = pesoRpc(vivos.find((h) => codigo.get(h.share_class_id) === "A"));
    const b = pesoRpc(vivos.find((h) => codigo.get(h.share_class_id) === "B"));
    expect(a / b).toBeGreaterThan(1000);   // hoy 800.000; el art. 7 dice 50
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
