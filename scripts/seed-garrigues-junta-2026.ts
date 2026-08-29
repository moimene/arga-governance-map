#!/usr/bin/env bun
/**
 * Seed C1 — expediente de la Junta General de Socios de Garrigues (06/05/2026).
 *
 * Cubre Task 4 (la convocatoria) y Task 5 (la reunión, la asistencia real del acta
 * y el censo WORM). Task 6+ cuelgan del `meeting_id` que produce este script.
 *
 * Todo el contenido del expediente vive en `./garrigues/junta-2026/orden-del-dia`
 * y este script solo lo escribe: aquí no se redacta ningún título, ninguna nota ni
 * ninguna cita legal.
 *
 * ## Por qué la fila se escribe en BORRADOR y no en EMITIDA
 *
 * Medido contra Cloud antes de escribir una línea:
 *
 * - `secretaria_private.fn_convocatoria_emission_rpc_guard` rechaza con `42501`
 *   (`CONVOCATION_EMISSION_REQUIRES_GOVERNED_RPC`) cualquier INSERT/UPDATE que
 *   deje `estado = 'EMITIDA'` sin el flag de sesión que **solo** pone
 *   `fn_emit_convocatoria`. Además, el constraint trigger
 *   `trg_convocatoria_manifest_required` exige un manifiesto canónico con hashes
 *   coincidentes.
 * - `fn_emit_convocatoria` es la única vía gobernada y **solo admite órganos CDA**
 *   (`CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA`); el órgano de esta
 *   convocatoria es `JUNTA`. También rechaza a `service_role`
 *   (`AUTHENTICATED_USER_REQUIRED_TO_RECORD_DEMO_CONVOCATION_ACT`).
 * - `fn_convocatoria_authority_representation_guard` fuerza
 *   `fecha_emision := NULL` en toda fila que no esté EMITIDA, y en la que lo está
 *   la sobrescribe con la fecha del servidor. **El 21/04/2026 no cabe en esa
 *   columna por ninguna vía**: consta en el texto de la carta, que es donde de
 *   verdad está, y la antelación se deriva de las dos fechas del módulo.
 *
 * Forzar el flag de sesión para colar un EMITIDA sería sortear el gate de
 * gobernanza, no cumplirlo. Queda elevado al orquestador como brecha de producto:
 * hoy la plataforma no sabe emitir la convocatoria de una Junta.
 *
 * ## Por qué la reunión se escribe en DRAFT
 *
 * Dos razones independientes, ambas medidas contra Cloud:
 *
 * 1. **Jurídica.** La convocatoria de esta Junta está en `BORRADOR` (ver arriba:
 *    la vía gobernada de emisión solo admite órganos CDA). Una reunión en
 *    `CONVOCADA` afirmaría que fue convocada en forma, y su propia convocatoria
 *    no lo sostiene. El expediente no puede afirmar más que su fuente.
 * 2. **Técnica.** `trg_00_meeting_open_insert_guard` obliga a que toda reunión
 *    nueva nazca en `DRAFT` salvo una excepción estrecha para `CONVOCADA` que
 *    exige `current_user = 'postgres'` **y** una convocatoria `EMITIDA`,
 *    inmutable y con `fecha_1 > now()`. Esta convocatoria no es ninguna de las
 *    tres cosas. `EN_CURSO` solo lo alcanza `fn_secretaria_open_meeting` y
 *    `CELEBRADA` solo `fn_secretaria_close_meeting_and_generate_minute`.
 *
 * `CLOSED` —el valor que proponía el plan— **no existe**: el CHECK real es
 * `('DRAFT','CONVOCADA','EN_CURSO','CELEBRADA','CANCELADA')`.
 *
 * ## Por qué el censo va por RPC y por qué puede no crearse
 *
 * `censo_snapshot` es **inmutable** (dos triggers bloquean UPDATE y DELETE) y
 * solo admite INSERT desde `fn_crear_censo_snapshot`
 * (`AUTHORITATIVE_WRITE_RPC_REQUIRED`, incluso con service_role). Un snapshot
 * mal creado no se puede corregir: se queda para siempre. Por eso el paso lleva
 * un gate de precondición que se mide **antes** de llamar a la RPC. Ver
 * `censoPrecondicion()`.
 *
 * Ninguna superficie de este seed afirma envío, entrega, acuse ni interacción real
 * con EAD Trust. `publication_channels` describe el canal estatutario del acto
 * real. Todo artefacto es reconstrucción demo sin efecto jurídico.
 *
 * Uso: `bun run scripts/seed-garrigues-junta-2026.ts` (dry-run) / `--commit`.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";
import censoActa from "./garrigues/censo/socios-acta-2026-05-06.json";
import {
  AUTOCARTERA_TITULOS_A,
  CENSO_TOTAL,
  baseComputoJunta,
  baseComputoTodasLasClases,
  pctAutocarteraSobreTotal,
  pctSobreBaseJunta,
  votosAutocartera,
  votosTotales,
} from "./garrigues/capital/estructura-art7";
import {
  ANTELACION_DIAS,
  CANAL_ESTATUTARIO,
  CONVOCATORIA_SLUG,
  FECHA_1_ISO,
  FECHA_CARTA_CONVOCATORIA,
  FECHA_JUNTA,
  LUGAR_JUNTA,
  MEETING_SLUG,
  MESA_PRESIDENTA,
  MESA_SECRETARIO,
  ORDEN_DEL_DIA,
  ORGANO_SLUG,
  REPRESENTANTE_UNICO,
  SOCIOS_PRESENCIALES,
  STATUTORY_BASIS,
  convocatoriaText,
  puntosQueMaterializan,
  puntosSinMateriaAcreditada,
} from "./garrigues/junta-2026/orden-del-dia";
import { votingRightsFromCapitalHolding } from "../src/lib/secretaria/meeting-census";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

/** Estado de la fila. Constante, no parámetro: ver la cabecera del fichero. */
const ESTADO = "BORRADOR";

/** Estado de la reunión. Constante, no parámetro: ver la cabecera del fichero. */
const MEETING_STATUS = "DRAFT";

/**
 * Modalidad del censo. **ECONOMICO, no UNIVERSAL**, y es una desviación
 * deliberada del plan y de la spec §3.3:
 *
 * `UNIVERSAL` es la modalidad de una **junta universal** (art. 178 LSC: sin
 * previa convocatoria). Esta Junta se convocó formalmente con 15 días de
 * antelación y su convocatoria lleva `junta_universal: false`. Tres lecturas
 * independientes del propio código lo confirman: el mensaje de la RPC
 * (`CENSUS_UNIVERSAL_JGA_ONLY: UNIVERSAL solo es modalidad de una JGA`),
 * `fn_secretaria_close_meeting_and_generate_minute`, que solo elige UNIVERSAL
 * cuando `quorum_data` lo declara, y `fn_secretaria_build_minute_legal_manifest`,
 * que trata `snapshot_type = 'UNIVERSAL'` como una afirmación de universalidad y
 * la rechaza por falta de aceptaciones WORM individuales del orden del día.
 *
 * Que asistiera el 100 % del censo no la convierte en universal: hubo
 * convocatoria. Etiquetarla UNIVERSAL sería afirmar en un registro inmutable un
 * hecho que la fuente no sostiene.
 */
const CENSO_SNAPSHOT_TYPE = "ECONOMICO";

/**
 * Serialización canónica para comparar lo que hay con lo que se escribiría.
 * `jsonb` reordena las claves al guardarlas, así que un `JSON.stringify` directo
 * daría siempre distinto y el seed reescribiría en cada ejecución.
 */
function canonical(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]),
      );
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

export type ConvocatoriaRow = {
  tenant_id: string;
  body_id: string;
  estado: string;
  fecha_1: string;
  is_second_call: boolean;
  modalidad: string;
  junta_universal: boolean;
  tipo_convocatoria: string;
  publication_channels: string[];
  agenda_items: Record<string, unknown>[];
  lugar: string;
  statutory_basis: string;
  convocatoria_text: string;
};

/**
 * PASSTHROUGH deliberado del orden del día: `numero`, `titulo`, `materia`, `kind`
 * y `nota` se copian tal cual del módulo. Si esta función volviera a redactar un
 * título o a decidir una materia tendría su propia copia del expediente, que es
 * justo lo que el módulo existe para evitar.
 */
/** Clasificación leída de `materia_catalog`, nunca escrita a mano en este seed. */
export type ClaseMateria = { materia: string; matter_class: string; inscribable: boolean };

export function buildConvocatoria(bodyId: string, clases: ClaseMateria[] = []): ConvocatoriaRow {
  const porMateria = new Map(clases.map((c) => [c.materia, c]));
  return {
    tenant_id: GARRIGUES_TENANT,
    body_id: bodyId,
    estado: ESTADO,
    fecha_1: FECHA_1_ISO,
    is_second_call: false,
    modalidad: "PRESENCIAL",
    junta_universal: false,          // hubo convocatoria formal, no junta universal
    tipo_convocatoria: "ORDINARIA",
    publication_channels: [CANAL_ESTATUTARIO],
    agenda_items: ORDEN_DEL_DIA.map((p) => {
      // `tipo` e `inscribible` son la forma canónica que ya usa ARGA y de la que
      // dependen la ficha y el generador documental. Salen de `materia_catalog`,
      // no de este fichero: duplicar la clasificación sería una segunda copia.
      // En los 3 puntos sin materia acreditada quedan AUSENTES a propósito, para
      // que ninguna rama de la UI les invente una clase.
      const clase = p.materia ? porMateria.get(p.materia) : undefined;
      return {
        numero: p.numero,
        titulo: p.titulo,
        materia: p.materia,
        materializa: p.materializa,
        kind: p.kind,
        ...(clase ? { tipo: clase.matter_class, inscribible: clase.inscribable } : {}),
        ...(p.nota ? { nota: p.nota } : {}),
      };
    }),
    lugar: LUGAR_JUNTA,
    statutory_basis: STATUTORY_BASIS,
    convocatoria_text: convocatoriaText(),
    // fecha_emision NO se envía: el trigger de autoridad la fuerza a NULL en toda
    // fila que no esté EMITIDA. Mandarla sería pedir algo que el servidor descarta.
  };
}


// ───────────────────────────────────────── Task 5: reunión, asistencia y censo ──

/**
 * Fila de `capital_holdings` con su clase ya resuelta. Es la fuente de los
 * títulos, del porcentaje de capital y de los votos de cada socio: el seed **no
 * recalcula** ninguna de las tres magnitudes, las copia del libro de socios.
 */
export type HoldingCenso = {
  numero_titulos: number | string | null;
  porcentaje_capital: number | string | null;
  is_treasury: boolean;
  voting_rights: boolean;
  share_class: {
    class_code: string;
    votes_per_title: number | string | null;
    voting_rights: boolean | null;
  } | null;
};

/** Un socio del censo del acta, ya emparejado con su titularidad en Cloud. */
export type SocioCenso = { person_id: string; full_name: string; holding: HoldingCenso };

export type AttendeeRow = {
  tenant_id: string;
  meeting_id: string;
  person_id: string;
  attendance_type: "PRESENCIAL" | "REPRESENTADO";
  represented_by_id: string | null;
  via_representante: boolean;
  shares_represented: number;
  capital_representado: number;
  voting_rights: number;
};

/**
 * La asistencia que declara el certificado: 3 socios con presencia física y 343
 * representados **por una única persona**, el socio D. Roberto Delgado Gil, que
 * exhibió las cartas de delegación a la Presidenta.
 *
 * `voting_rights` sale de `votingRightsFromCapitalHolding` —títulos × votos por
 * título—, que es el camino que reproduce el art. 7 y el que ya usa
 * `ReunionStepper`. **No sale de `parte_votante_current`**, cuyo `voting_weight`
 * es una magnitud de capital ponderada por clase y no un recuento de votos
 * (`docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md` §7).
 */
export function buildAttendeeRows(
  meetingId: string,
  socios: SocioCenso[],
  representanteId: string,
): AttendeeRow[] {
  const presenciales = socios.filter((s) => SOCIOS_PRESENCIALES.includes(s.full_name));
  if (presenciales.length !== SOCIOS_PRESENCIALES.length) {
    throw new Error(
      `asistencia: ${presenciales.length} presenciales encontrados en el censo, esperados ${SOCIOS_PRESENCIALES.length}`,
    );
  }
  if (!presenciales.some((s) => s.person_id === representanteId)) {
    // El representante tiene que estar físicamente en la sala: si no, nadie
    // exhibió las cartas de delegación y las 343 representaciones no se sostienen.
    throw new Error("asistencia: el representante único no figura entre los presenciales");
  }

  return socios.map((s) => {
    const votos = votingRightsFromCapitalHolding(s.holding);
    if (votos === null) {
      throw new Error(`asistencia: ${s.full_name} no tiene títulos/votos derivables de su titularidad`);
    }
    const esPresencial = SOCIOS_PRESENCIALES.includes(s.full_name);
    return {
      tenant_id: GARRIGUES_TENANT,
      meeting_id: meetingId,
      person_id: s.person_id,
      attendance_type: esPresencial ? "PRESENCIAL" : "REPRESENTADO",
      // Un presencial no puede llevar representante: el manifiesto autoritativo
      // rechaza esa combinación (`attendance/representation binding is invalid`).
      represented_by_id: esPresencial ? null : representanteId,
      via_representante: !esPresencial,
      shares_represented: Number(s.holding.numero_titulos),
      capital_representado: Number(s.holding.porcentaje_capital),
      voting_rights: votos,
    };
  });
}

/**
 * Base de cómputo declarada del expediente y su conciliación.
 *
 * Los porcentajes salen de `estructura-art7.ts`; aquí no se escribe ningún
 * número a mano. Se guardan las DOS lecturas porque la diferencia entre ellas
 * es real y está decidida, no escondida:
 *
 * - **Criterio declarado del acta** (decisión del usuario 2026-08-29): base de
 *   16.900 votos = clase A no autocartera → 150/16.900 = 0,887574 %, que
 *   truncado es el **0,8875 %** literal del certificado.
 * - **Proyección `parte_votante_current`**: normaliza sobre los 16.908 votos
 *   computables de ambas clases → **0,887154 %**. No es un error nuevo: son los
 *   8 votos de clase B, el 0,047 % de la base.
 */
export function buildQuorumData(votosPresenciales: number, votosSumaCenso: number) {
  const pctDeclarado = pctSobreBaseJunta(votosPresenciales);
  const pctProyeccion = (votosPresenciales / baseComputoTodasLasClases()) * 100;
  const trunc4 = (n: number) => Math.trunc(n * 10_000) / 10_000;

  return {
    base_computo: "VOTOS_CLASE_A_NO_AUTOCARTERA",
    base_votos: baseComputoJunta(),
    base_votos_todas_las_clases: baseComputoTodasLasClases(),
    censo_total: CENSO_TOTAL,
    presenciales: SOCIOS_PRESENCIALES.length,
    representados: CENSO_TOTAL - SOCIOS_PRESENCIALES.length,
    presenciales_votos: votosPresenciales,
    presenciales_pct: pctDeclarado,
    representados_pct: 100 - pctDeclarado,
    // Lo que imprime el certificado, que es el truncamiento a 4 decimales.
    acta_presenciales_pct: trunc4(pctDeclarado),
    acta_representados_pct: 100 - trunc4(pctDeclarado),
    proyeccion_presenciales_pct_sobre_16908: pctProyeccion,
    votos_totales_ambas_clases: votosTotales(),
    votos_suma_censo: votosSumaCenso,
    autocartera_titulos: AUTOCARTERA_TITULOS_A,
    autocartera_votos: votosAutocartera(),
    autocartera_pct_sobre_total: pctAutocarteraSobreTotal(),
    // `is_universal` NO se declara: hubo convocatoria formal con 15 días de
    // antelación, así que esto no es una junta universal del art. 178 LSC.
    // Declararlo activaría `v_is_universal` en el manifiesto autoritativo del
    // acta, que exige aceptaciones WORM individuales del orden del día.
    junta_universal: false,
    notas: [
      "Reconstrucción demo sin efecto jurídico. El expediente real de la Junta de 06/05/2026 consta en el Registro Mercantil de Madrid; la plataforma lo reproduce, no lo sustituye.",
      "La hora de la sesión NO consta en la fuente disponible. `scheduled_start` se guarda a las 00:00Z para que la fecha sea correcta en UTC y en hora local de Madrid; la hora que pinte cualquier pantalla es un artefacto de renderizado, no un dato del expediente.",
      "`scheduled_end` es `scheduled_start` + 2 h por convención de la plataforma (la misma que aplica `buildMeetingRowFromConvocatoria`). La duración real de la sesión tampoco consta.",
      `Base de cómputo declarada: ${baseComputoJunta()} votos (clase A no autocartera). Criterio del usuario de 2026-08-29, registrado en docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md §4. No afirma que la clase B carezca de voto: el art. 7 le da 1 voto por participación y votosTotales() los cuenta (${votosTotales()}).`,
      `Conciliación: sobre la base declarada de ${baseComputoJunta()} votos los presenciales son ${trunc4(pctDeclarado)} % (el 0,8875 % del acta); la proyección parte_votante_current normaliza sobre ${baseComputoTodasLasClases()} y da ${pctProyeccion.toFixed(6)} %. La diferencia son los 8 votos de clase B.`,
      "El 99,1125 % de representados que imprime el acta es el complemento del porcentaje YA truncado, no el complemento exacto.",
      "Estado DRAFT: su convocatoria está en BORRADOR porque la vía gobernada de emisión solo admite órganos CDA, y el trigger de apertura obliga además a que toda reunión nueva nazca en DRAFT. La reunión no puede presentarse como convocada en forma.",
      "El emparejamiento socio ↔ participación numerada es INFERIDO y así está etiquetado en capital_holdings.metadata: el Anexo 2 del acta no está transcrito.",
      "Ninguna superficie de este expediente afirma envío, entrega, acuse ni actuación, interposición, mensajería o custodia de EAD Trust.",
    ],
  };
}

/**
 * Gate de precondición del censo WORM. **Se mide antes de llamar a la RPC.**
 *
 * `fn_crear_censo_snapshot` no lee `parte_votante_current`: lleva su propia copia
 * en línea de la fórmula vieja, `voting_weight = porcentaje_capital ×
 * votes_per_title`. La migración `20260829150000` corrigió
 * `fn_refresh_parte_votante_entity` y **no llegó a esta RPC**, así que el payload
 * inmutable del snapshot congelaría un peso en el que un socio de clase A vale
 * 800.000 veces uno de clase B, donde el art. 7 dice 50.
 *
 * Y ese payload no es decorativo: `fn_secretaria_build_minute_legal_manifest`
 * suma `voting_weight` del snapshot para el quórum del acta autoritativa.
 *
 * `censo_snapshot` es inmutable: un snapshot mal creado no se puede borrar. Por
 * eso, si la RPC no reproduce la proporción de votos del art. 7, el seed **no la
 * llama** y lo dice. Corregirla es DDL sobre una función compartida con ARGA:
 * decisión del usuario, no de este seed.
 */
export function censoPrecondicion(socios: SocioCenso[]): {
  ok: boolean;
  ratioRpc: number | null;
  ratioVotos: number | null;
  detalle: string;
} {
  const pesoRpc = (h: HoldingCenso) =>
    Number(h.porcentaje_capital) * Number(h.share_class?.votes_per_title ?? 1);
  const votos = (h: HoldingCenso) => votingRightsFromCapitalHolding(h) ?? 0;

  // Dos titulares de clases distintas: la comparación es de proporciones, así que
  // no depende de qué socio concreto se tome ni de ningún literal.
  const clases = [...new Set(socios.map((s) => s.holding.share_class?.class_code ?? "?"))].sort();
  if (clases.length < 2) {
    return { ok: false, ratioRpc: null, ratioVotos: null, detalle: `censo con una sola clase (${clases.join(", ")}): la proporción no es comprobable` };
  }
  const a = socios.find((s) => s.holding.share_class?.class_code === clases[0])!;
  const b = socios.find((s) => s.holding.share_class?.class_code === clases[1])!;
  if (pesoRpc(b.holding) === 0 || votos(b.holding) === 0) {
    return { ok: false, ratioRpc: null, ratioVotos: null, detalle: `la clase ${clases[1]} pesa cero: no hay proporción que comparar` };
  }

  const ratioRpc = pesoRpc(a.holding) / pesoRpc(b.holding);
  const ratioVotos = votos(a.holding) / votos(b.holding);
  const ok = Math.abs(ratioRpc / ratioVotos - 1) < 1e-9;
  return {
    ok,
    ratioRpc,
    ratioVotos,
    detalle: ok
      ? `la RPC reproduce la proporción de votos del art. 7 (${clases[0]}/${clases[1]} = ${ratioVotos})`
      : `fn_crear_censo_snapshot daría ${clases[0]}/${clases[1]} = ${ratioRpc.toLocaleString("es-ES")} y el art. 7 dice ${ratioVotos}`,
  };
}

async function main() {
  if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);

  // Preflight local: la aritmética del expediente antes de tocar la red.
  const materializan = puntosQueMaterializan();
  const sinMateria = puntosSinMateriaAcreditada();
  if (materializan.length !== 10) fail(`preflight: ${materializan.length} puntos materializan acuerdo, esperados 10.`);
  if (sinMateria.length !== 3) fail(`preflight: ${sinMateria.length} puntos sin materia acreditada, esperados 3.`);
  if (sinMateria.some((p) => !p.nota)) fail("preflight: hay un punto sin materia acreditada y sin nota visible.");
  if (new Set(ORDEN_DEL_DIA.map((p) => p.numero)).size !== ORDEN_DEL_DIA.length) {
    fail("preflight: hay números de punto repetidos; Task 6 no podría enlazar el acuerdo con su punto.");
  }

  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(" | ")}).`);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Preflight Cloud (solo lectura, corre también en dry-run).
  const { data: body, error: eBody } = await admin.from("governing_bodies")
    .select("id, tenant_id, entity_id, body_type, name").eq("slug", ORGANO_SLUG).maybeSingle();
  if (eBody) fail(`governing_bodies ${ORGANO_SLUG}: ${eBody.message}`);
  if (!body) fail(`No existe el órgano ${ORGANO_SLUG}. El UUID no se hardcodea: se resuelve por slug.`);
  if (body.tenant_id !== GARRIGUES_TENANT) fail(`El órgano ${ORGANO_SLUG} no es del tenant Garrigues.`);
  if (body.entity_id !== GARRIGUES_MATRIZ_UUID) fail(`El órgano ${ORGANO_SLUG} no cuelga de la matriz.`);

  const materias = materializan.map((p) => p.materia);
  const { data: cat, error: eCat } = await admin.from("materia_catalog")
    .select("materia, matter_class, inscribable").in("materia", materias);
  if (eCat) fail(`materia_catalog: ${eCat.message}`);
  const faltan = materias.filter((m) => !(cat ?? []).some((c) => c.materia === m));
  if (faltan.length) fail(`materias sin fila en materia_catalog: ${faltan.join(", ")} — Task 6 no podría resolver el pack.`);

  // Cierre del bucle del plazo: la antelación derivada de las dos fechas del acta
  // contra la que exige el pack. Sin literales: si divergen, el seed no corre.
  const { data: versiones, error: ePack } = await admin.from("rule_pack_versions")
    .select("version, is_active, payload").eq("pack_id", "GARR_JUNTA_SOCIOS").eq("is_active", true);
  if (ePack) fail(`rule_pack_versions GARR_JUNTA_SOCIOS: ${ePack.message}`);
  if ((versiones ?? []).length !== 1) {
    fail(`GARR_JUNTA_SOCIOS tiene ${(versiones ?? []).length} versiones activas, esperada 1.`);
  }
  const activa = versiones[0];
  const slp = activa.payload?.convocatoria?.antelacionDias?.SLP;
  if (slp?.valor !== ANTELACION_DIAS) {
    fail(`El pack exige ${slp?.valor} días de antelación para SLP y ${FECHA_CARTA_CONVOCATORIA}→${FECHA_JUNTA} son ${ANTELACION_DIAS}.`);
  }
  const canales = activa.payload?.convocatoria?.canales?.SLP ?? [];
  if (!canales.includes(CANAL_ESTATUTARIO)) {
    fail(`El canal ${CANAL_ESTATUTARIO} no figura en canales.SLP del pack (${canales.join(", ")}).`);
  }

  const row = buildConvocatoria(body.id, cat ?? []);
  const { data: prev, error: ePrev } = await admin.from("convocatorias").select("id, estado")
    .eq("tenant_id", GARRIGUES_TENANT).eq("body_id", body.id).eq("fecha_1", FECHA_1_ISO);
  if (ePrev) fail(`convocatorias lookup: ${ePrev.message}`);
  if ((prev ?? []).length > 1) {
    fail(`Hay ${prev.length} convocatorias con la misma clave (tenant, órgano, fecha_1): el expediente ya está duplicado.`);
  }

  // ─────────────────────────────── Task 5: censo, mesa y reunión (solo lectura) ──

  const { data: personas, error: ePers } = await admin.from("persons")
    .select("id, full_name").eq("tenant_id", GARRIGUES_TENANT).limit(2000);
  if (ePers) fail(`persons: ${ePers.message}`);
  const porNombre = new Map<string, string>();
  for (const persona of personas ?? []) {
    // Un nombre duplicado convertiría «resolver por nombre» en una lotería.
    if (porNombre.has(persona.full_name)) fail(`persons: ${persona.full_name} está duplicado en el tenant.`);
    porNombre.set(persona.full_name, persona.id);
  }

  const { data: clases, error: eClases } = await admin.from("share_classes")
    .select("id, class_code, votes_per_title, voting_rights")
    .eq("entity_id", GARRIGUES_MATRIZ_UUID);
  if (eClases) fail(`share_classes: ${eClases.message}`);
  const porClase = new Map((clases ?? []).map((c) => [c.id, c]));

  const { data: holdings, error: eHold } = await admin.from("capital_holdings")
    .select("holder_person_id, share_class_id, numero_titulos, porcentaje_capital, is_treasury, voting_rights, effective_from, effective_to")
    .eq("entity_id", GARRIGUES_MATRIZ_UUID).limit(2000);
  if (eHold) fail(`capital_holdings: ${eHold.message}`);

  // La RPC del censo recorta el libro por la fecha efectiva de la reunión, así que
  // el seed usa exactamente el mismo corte: si divergieran, el snapshot WORM y la
  // asistencia hablarían de dos censos distintos.
  const vigentes = (holdings ?? []).filter(
    (h) => h.effective_from <= FECHA_JUNTA && (h.effective_to === null || h.effective_to >= FECHA_JUNTA),
  );
  const porPersona = new Map((personas ?? []).map((persona) => [persona.id, persona.full_name]));
  const socios: SocioCenso[] = vigentes
    .filter((h) => !h.is_treasury)
    .map((h) => ({
      person_id: h.holder_person_id,
      full_name: porPersona.get(h.holder_person_id) ?? "",
      holding: {
        numero_titulos: h.numero_titulos,
        porcentaje_capital: h.porcentaje_capital,
        is_treasury: h.is_treasury,
        voting_rights: h.voting_rights,
        share_class: porClase.get(h.share_class_id) ?? null,
      },
    }));

  // Tres fuentes independientes del mismo censo: la transcripción del acta, el
  // módulo del art. 7 y el libro de socios en Cloud. Si no coinciden, el seed no
  // corre: no hay forma honesta de decidir cuál de las tres miente.
  const censoActaNombres = [...(censoActa.presenciales as string[]), ...(censoActa.representados as string[])];
  if (censoActaNombres.length !== CENSO_TOTAL) {
    fail(`preflight: la transcripción del acta trae ${censoActaNombres.length} socios y el art. 7 da ${CENSO_TOTAL}.`);
  }
  if (socios.length !== CENSO_TOTAL) {
    fail(`preflight: ${socios.length} titularidades no-autocartera vigentes al ${FECHA_JUNTA}, esperadas ${CENSO_TOTAL}.`);
  }
  const soloEnCloud = socios.map((x) => x.full_name).filter((n) => !censoActaNombres.includes(n));
  if (soloEnCloud.length) {
    fail(`preflight: ${soloEnCloud.length} socios del libro no están en la transcripción del acta (p. ej. ${soloEnCloud[0]}).`);
  }
  for (const nombre of [...SOCIOS_PRESENCIALES, MESA_PRESIDENTA, MESA_SECRETARIO]) {
    if (!(censoActa.presenciales as string[]).includes(nombre)) {
      fail(`preflight: ${nombre} no figura entre los presenciales de la transcripción del acta.`);
    }
    if (!porNombre.has(nombre)) fail(`preflight: no existe la persona ${nombre} en el tenant Garrigues.`);
  }

  const presidentaId = porNombre.get(MESA_PRESIDENTA)!;
  const secretarioId = porNombre.get(MESA_SECRETARIO)!;
  const representanteId = porNombre.get(REPRESENTANTE_UNICO)!;

  // El `meeting_id` todavía no existe (puede ser un INSERT): se rellena abajo,
  // cuando la fila de `meetings` ya tiene id. Aquí solo se necesitan los votos.
  let attendees: AttendeeRow[];
  try {
    attendees = buildAttendeeRows("<pendiente>", socios, representanteId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const votosPresenciales = attendees
    .filter((a) => a.attendance_type === "PRESENCIAL")
    .reduce((acc, a) => acc + a.voting_rights, 0);
  const votosSumaCenso = attendees.reduce((acc, a) => acc + a.voting_rights, 0);

  // Regresión del acta, cerrada contra el dato vivo y no contra un literal: los 3
  // presenciales tienen que dar el 0,8875 % que imprime el certificado.
  const quorumData = buildQuorumData(votosPresenciales, votosSumaCenso);
  if (quorumData.acta_presenciales_pct !== 0.8875) {
    fail(`preflight: los presenciales dan ${quorumData.acta_presenciales_pct} % y el acta dice 0,8875 %.`);
  }
  if (votosSumaCenso !== baseComputoTodasLasClases()) {
    fail(`preflight: la suma de votos del censo es ${votosSumaCenso} y el art. 7 da ${baseComputoTodasLasClases()}.`);
  }

  const meetingRow = {
    tenant_id: GARRIGUES_TENANT,
    body_id: body.id,
    slug: MEETING_SLUG,
    // JUNTA_GENERAL es el valor que deriva `meetingTypeFromConvocatoria` para un
    // órgano JUNTA y el que ya usan las reuniones de ARGA. `JUNTA` es un
    // body_type, no un meeting_type, y ninguna reunión lo usa.
    meeting_type: "JUNTA_GENERAL",
    scheduled_start: FECHA_1_ISO,
    scheduled_end: new Date(Date.parse(FECHA_1_ISO) + 2 * 3_600_000).toISOString(),
    status: MEETING_STATUS,
    president_id: presidentaId,
    secretary_id: secretarioId,
    location: LUGAR_JUNTA,
    quorum_data: quorumData,
  };

  const { data: prevMeetings, error: ePrevMeeting } = await admin.from("meetings")
    .select("id, tenant_id, status, quorum_data, president_id, secretary_id, scheduled_start, scheduled_end, meeting_type, location, body_id")
    .eq("slug", MEETING_SLUG);
  if (ePrevMeeting) fail(`meetings lookup: ${ePrevMeeting.message}`);
  const prevMeeting = (prevMeetings ?? [])[0] ?? null;
  if (prevMeeting && prevMeeting.tenant_id !== GARRIGUES_TENANT) {
    fail(`El slug ${MEETING_SLUG} ya existe en otro tenant: es UNIQUE global.`);
  }
  const meetingSinCambios = prevMeeting !== null
    && Object.entries(meetingRow).every(([k, v]) => canonical(prevMeeting[k]) === canonical(v));

  const censo = censoPrecondicion(socios);
  let censoPrevio: { id: string; snapshot_type: string } | null = null;
  if (prevMeeting) {
    const { data, error } = await admin.from("censo_snapshot")
      .select("id, snapshot_type").eq("meeting_id", prevMeeting.id);
    if (error) fail(`censo_snapshot lookup: ${error.message}`);
    censoPrevio = (data ?? [])[0] ?? null;
    if ((data ?? []).length > 1) fail(`La reunión ya tiene ${data.length} censos WORM; son inmutables y no se pueden retirar.`);
  }

  console.table([
    { concepto: "expediente", valor: CONVOCATORIA_SLUG },
    { concepto: "órgano (por slug)", valor: `${ORGANO_SLUG} → ${body.id} (${body.body_type})` },
    { concepto: "fecha de la carta (acta)", valor: FECHA_CARTA_CONVOCATORIA },
    { concepto: "fecha de la Junta", valor: `${FECHA_JUNTA} (hora no acreditada → ${FECHA_1_ISO})` },
    { concepto: "antelación derivada", valor: `${ANTELACION_DIAS} días · pack SLP exige ${slp.valor} · ${slp.fuente} · ${slp.referencia}` },
    { concepto: "canal estatutario", valor: CANAL_ESTATUTARIO },
    { concepto: "puntos del orden del día", valor: `${ORDEN_DEL_DIA.length} entradas = ${materializan.length} con acuerdo + ${sinMateria.length} sin materia acreditada + 1 aprobación del acta` },
    { concepto: "materias verificadas en catálogo", valor: `${materias.length}/${materias.length}` },
    { concepto: "estado que se escribirá", valor: `${ESTADO} — la vía gobernada de emisión solo admite órganos CDA (ver cabecera)` },
    { concepto: "fecha_emision", valor: "NULL — la fuerza el servidor; el 21/04/2026 consta en el texto de la carta" },
    { concepto: "operación", valor: (prev ?? []).length ? `UPDATE de ${prev[0].id}` : "INSERT" },
  ]);
  console.log(`\nTexto de la carta: ${row.convocatoria_text.length} caracteres, encabezamiento "${row.convocatoria_text.split("\n").find((l) => l.startsWith("Querido"))}"`);

  console.log("\n── Task 5 · reunión, asistencia y censo ──");
  console.table([
    { concepto: "reunión (slug)", valor: MEETING_SLUG },
    { concepto: "estado", valor: `${MEETING_STATUS} — su convocatoria está en ${ESTADO} y el trigger de apertura obliga a nacer en DRAFT` },
    { concepto: "horario", valor: `${meetingRow.scheduled_start} → ${meetingRow.scheduled_end} (hora y duración NO acreditadas; +2 h por convención)` },
    { concepto: "mesa", valor: `preside ${MESA_PRESIDENTA} (${presidentaId}) · secretario ${MESA_SECRETARIO} (${secretarioId})` },
    { concepto: "autoridad de la mesa", valor: "sin authority_evidence de la Junta: la Presidenta lo es como socia y senior partner y el Secretario fue elegido en la sesión" },
    { concepto: "censo cotejado", valor: `${socios.length} socios = acta ${censoActaNombres.length} = art. 7 ${CENSO_TOTAL}` },
    { concepto: "asistencia", valor: `${attendees.filter((a) => a.attendance_type === "PRESENCIAL").length} PRESENCIAL + ${attendees.filter((a) => a.attendance_type === "REPRESENTADO").length} REPRESENTADO` },
    { concepto: "representante único", valor: `${REPRESENTANTE_UNICO} (${representanteId}) · ${new Set(attendees.filter((a) => a.represented_by_id).map((a) => a.represented_by_id)).size} representante(s) distinto(s)` },
    { concepto: "base de cómputo declarada", valor: `${quorumData.base_computo} = ${quorumData.base_votos} votos` },
    { concepto: "presenciales", valor: `${votosPresenciales} votos = ${quorumData.presenciales_pct.toFixed(6)} % → acta ${quorumData.acta_presenciales_pct} %` },
    { concepto: "conciliación 16.908", valor: `${quorumData.proyeccion_presenciales_pct_sobre_16908.toFixed(6)} % sobre ${quorumData.base_votos_todas_las_clases} (los 8 votos de clase B)` },
    { concepto: "autocartera", valor: `${quorumData.autocartera_titulos} títulos = ${quorumData.autocartera_pct_sobre_total.toFixed(4)} % → acta 2,59 %` },
    { concepto: "operación reunión", valor: prevMeeting ? (meetingSinCambios ? `sin cambios (${prevMeeting.id})` : `UPDATE de ${prevMeeting.id}`) : "INSERT" },
    { concepto: "censo WORM", valor: censoPrevio ? `ya existe (${censoPrevio.id}, ${censoPrevio.snapshot_type}) — inmutable, no se recrea` : (censo.ok ? `fn_crear_censo_snapshot(MEETING, ${CENSO_SNAPSHOT_TYPE})` : "BLOQUEADO") },
    { concepto: "gate del censo", valor: censo.detalle },
  ]);

  if (!censo.ok && !censoPrevio) {
    console.log(
      [
        "",
        "⚠ CENSO WORM NO SE CREARÁ.",
        `  ${censo.detalle}`,
        "  fn_crear_censo_snapshot lleva su propia copia en línea de la fórmula vieja",
        "  (voting_weight = porcentaje_capital × votes_per_title). La migración",
        "  20260829150000 corrigió fn_refresh_parte_votante_entity y NO llegó a esta RPC.",
        "  censo_snapshot es INMUTABLE: crear el snapshot ahora congelaría para siempre",
        "  un peso que contradice el art. 7, y fn_secretaria_build_minute_legal_manifest",
        "  suma ese voting_weight para el quórum del acta autoritativa.",
        "  Corregirlo es DDL sobre una función compartida con ARGA → decisión del usuario.",
        "",
      ].join("\n"),
    );
  }

  if (!COMMIT) { console.log("\nDry-run. Nada escrito. Añade --commit para aplicar."); return; }

  if ((prev ?? []).length === 1) {
    const { error } = await admin.from("convocatorias").update(row).eq("id", prev[0].id);
    if (error) fail(`convocatorias update: ${error.message}`);
    console.log(`✓ convocatoria actualizada (${prev[0].id})`);
  } else {
    const { data, error } = await admin.from("convocatorias").insert(row).select("id").single();
    if (error) fail(`convocatorias insert: ${error.message}`);
    console.log(`✓ convocatoria creada (${data.id})`);
  }

  let meetingId: string;
  if (!prevMeeting) {
    const { data, error } = await admin.from("meetings").insert(meetingRow).select("id").single();
    if (error) fail(`meetings insert: ${error.message}`);
    meetingId = data.id;
    console.log(`✓ reunión creada (${meetingId}) en ${MEETING_STATUS}`);
  } else {
    meetingId = prevMeeting.id;
    if (meetingSinCambios) {
      console.log(`= reunión sin cambios (${meetingId})`);
    } else {
      // Una vez existe el acta autoritativa, `trg_freeze_minute_source_meeting`
      // bloquea este UPDATE. Es correcto: los hechos de la sesión quedan
      // congelados por el manifiesto y este seed no debe poder moverlos.
      const { error } = await admin.from("meetings").update(meetingRow).eq("id", meetingId);
      if (error) fail(`meetings update: ${error.message}`);
      console.log(`✓ reunión actualizada (${meetingId})`);
    }
  }

  const filas = attendees.map((a) => ({ ...a, meeting_id: meetingId }));
  const { data: prevAtt, error: ePrevAtt } = await admin.from("meeting_attendees")
    .select("id, person_id, attendance_type, represented_by_id, via_representante, shares_represented, capital_representado, voting_rights")
    .eq("meeting_id", meetingId).eq("tenant_id", GARRIGUES_TENANT);
  if (ePrevAtt) fail(`meeting_attendees lookup: ${ePrevAtt.message}`);
  const clave = (a: Record<string, unknown>) => canonical([
    a.person_id, a.attendance_type, a.represented_by_id, Boolean(a.via_representante),
    Number(a.shares_represented), Number(a.capital_representado), Number(a.voting_rights),
  ]);
  const asistenciaSinCambios = (prevAtt ?? []).length === filas.length
    && canonical((prevAtt ?? []).map(clave).sort()) === canonical(filas.map(clave).sort());

  if (asistenciaSinCambios) {
    // Reescribir la asistencia idéntica cambiaría los `meeting_attendees.id` y
    // dejaría los `meeting_votes` de Task 7 apuntando a filas que ya no existen.
    console.log(`= asistencia sin cambios (${filas.length} filas)`);
  } else {
    const { data: votos, error: eVotos } = await admin.from("meeting_votes")
      .select("id").in("attendee_id", (prevAtt ?? []).map((a) => a.id)).limit(1);
    if (eVotos) fail(`meeting_votes lookup: ${eVotos.message}`);
    if ((votos ?? []).length) {
      fail("La asistencia ha cambiado y ya hay votos emitidos sobre ella (Task 7). Reescribirla los borraría: parar y decidir.");
    }
    const { error: eDel } = await admin.from("meeting_attendees")
      .delete().eq("meeting_id", meetingId).eq("tenant_id", GARRIGUES_TENANT);
    if (eDel) fail(`meeting_attendees delete: ${eDel.message}`);
    const { error: eIns } = await admin.from("meeting_attendees").insert(filas);
    if (eIns) fail(`meeting_attendees insert: ${eIns.message}`);
    console.log(`✓ asistencia escrita (${filas.length} filas: 3 presenciales + ${filas.length - 3} representados por ${REPRESENTANTE_UNICO})`);
  }

  if (censoPrevio) {
    console.log(`= censo WORM ya existente (${censoPrevio.id}, ${censoPrevio.snapshot_type}) — inmutable, no se recrea`);
  } else if (!censo.ok) {
    console.log("⚠ censo WORM NO creado: ver el aviso de arriba. Task 8 depende de él.");
  } else {
    const { data, error } = await admin.rpc("fn_crear_censo_snapshot", {
      p_meeting_id: meetingId,
      p_session_kind: "MEETING",
      p_entity_id: GARRIGUES_MATRIZ_UUID,
      p_body_id: body.id,
      p_snapshot_type: CENSO_SNAPSHOT_TYPE,
    });
    if (error) fail(`fn_crear_censo_snapshot: ${error.message}`);
    console.log(`✓ censo WORM creado por RPC (${data}, ${CENSO_SNAPSHOT_TYPE})`);
  }
}

if (import.meta.main) main();
