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
  ART7_CLASES,
  TITULOS_POR_SOCIO_CUOTA,
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
  SUBSUNCION_ART36,
  ordinalEnOrdenDelDia,
  puntosConAcuerdo,
  subsuncionDe,
  textoAcuerdo,
  ELEVACION_NO_ACREDITADA,
  MOTIVO_SIN_INSCRIPCION,
  candidatoDescartadoDePunto,
  inscripcionDePunto,
  inscripcionesDeLaJunta,
  notaAnuncioCompartido,
  type PuntoOrdenDia,
} from "./garrigues/junta-2026/orden-del-dia";
import { votingRightsFromCapitalHolding } from "../src/lib/secretaria/meeting-census";
import { evaluarVotacion } from "../src/lib/rules-engine/votacion-engine";
import { esFormulaEvaluable } from "../src/lib/rules-engine/majority-evaluator";
import type { EvalSeverity, RulePack, VotosInput } from "../src/lib/rules-engine/types";

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
  // Migración 20260829160000: fn_crear_censo_snapshot ya pondera por
  // `numero_titulos × votes_per_title`. Antes llevaba en línea
  // `porcentaje_capital × votes_per_title` y este gate existía para impedir que
  // se congelara un peso contrario al art. 7 en un registro INMUTABLE.
  // Corregida la RPC, el gate deja de predecir su fórmula y pasa a comprobar el
  // DATO: que las clases del censo guardan entre sí la proporción del art. 7.
  // Fallaría si alguien sembrara mal las clases o los títulos.
  // La comprobación de que la RPC produjo de verdad ese peso se hace DESPUÉS,
  // leyendo el payload del snapshot creado.
  // Referencia INDEPENDIENTE: el ratio que el art. 7 de los Estatutos impone
  // entre un socio de cuota (2 participaciones A) y un socio de clase B (1 de B),
  // tomado del módulo congelado y NO recalculado desde las mismas filas de Cloud.
  // Comparar el dato de Cloud contra otra derivación del propio dato de Cloud
  // sería vacuo: daría siempre verdadero.
  const claseArt7 = (code: string) => ART7_CLASES.find((c) => c.code === code);
  const pesoArt7 = (code: string) =>
    (code === "A" ? TITULOS_POR_SOCIO_CUOTA : 1) * (claseArt7(code)?.votosPorTitulo ?? 0);
  const votos = (h: HoldingCenso) => votingRightsFromCapitalHolding(h) ?? 0;

  const clases = [...new Set(socios.map((s) => s.holding.share_class?.class_code ?? "?"))].sort();
  if (clases.length < 2) {
    return { ok: false, ratioRpc: null, ratioVotos: null, detalle: `censo con una sola clase (${clases.join(", ")}): la proporción no es comprobable` };
  }

  // Se recorren TODOS los socios, no una muestra por clase. La versión anterior
  // tomaba el primero de cada clase con `find`, así que un censo con 344 de 345
  // socios de clase A mal sembrados pasaba el gate diciendo «reproduce la
  // proporción del art. 7». El gate existe para no congelar un peso equivocado
  // en un registro INMUTABLE: muestrear no sirve para eso.
  const desviados: string[] = [];
  for (const s of socios) {
    const code = s.holding.share_class?.class_code ?? "?";
    const esperado = pesoArt7(code);
    if (esperado === 0) {
      return { ok: false, ratioRpc: null, ratioVotos: null, detalle: `clase ${code} sin peso en el art. 7: la proporción no es comprobable` };
    }
    if (votos(s.holding) !== esperado) {
      desviados.push(`${s.full_name} (clase ${code}: ${votos(s.holding)} votos, art. 7 impone ${esperado})`);
    }
  }
  if (desviados.length) {
    return {
      ok: false, ratioRpc: pesoArt7(clases[0]) / pesoArt7(clases[1]), ratioVotos: null,
      detalle: `${desviados.length} de ${socios.length} socios no guardan el peso del art. 7: ${desviados.slice(0, 3).join("; ")}${desviados.length > 3 ? ` …y ${desviados.length - 3} más` : ""}`,
    };
  }

  const a = socios.find((s) => s.holding.share_class?.class_code === clases[0])!;
  const b = socios.find((s) => s.holding.share_class?.class_code === clases[1])!;
  if (pesoArt7(clases[1]) === 0 || votos(b.holding) === 0) {
    return { ok: false, ratioRpc: null, ratioVotos: null, detalle: `la clase ${clases[1]} pesa cero: no hay proporción que comparar` };
  }

  const ratioRpc = pesoArt7(clases[0]) / pesoArt7(clases[1]);   // lo que manda el art. 7
  const ratioVotos = votos(a.holding) / votos(b.holding);        // lo que hay en Cloud
  const ok = Math.abs(ratioVotos / ratioRpc - 1) < 1e-9;
  return {
    ok,
    ratioRpc,
    ratioVotos,
    detalle: ok
      ? `el censo de Cloud reproduce la proporción del art. 7 (${clases[0]}/${clases[1]} = ${ratioVotos})`
      : `el censo de Cloud da ${clases[0]}/${clases[1]} = ${ratioVotos.toLocaleString("es-ES")} y el art. 7 impone ${ratioRpc}: las clases o los títulos están mal sembrados`,
  };
}


// ───────────────────────────── Task 6: los 10 acuerdos, con su regla y su punto ──

/**
 * La regla que sirve un acuerdo: el pack POR MATERIA del tenant Garrigues.
 *
 * `mayoriaSL` es la rama que `effective-rule.ts:89` lee para `tipoSocial='SLP'`.
 * De ella sale también el `statutory_basis` del acuerdo: **este seed no escribe
 * ni una cita legal a mano**, las copia del pack, que es donde el Comité Legal
 * las mantiene.
 */
export type PackResuelto = {
  packId: string;
  version: string;
  materia: string;
  mayoriaSL: Record<string, unknown>;
  /**
   * Payload completo de la versión activa e id de esa fila. Opcionales porque
   * Task 6 no los necesitaba y las fixturas de su sonda no los traen; Task 7 sí
   * los exige —el motor evalúa el pack entero, no solo su rama de mayoría— y
   * `main()` falla cerrado si faltan.
   */
  payload?: RulePack;
  versionId?: string;
};

export type AgendaRow = {
  tenant_id: string;
  meeting_id: string;
  order_number: number;
  title: string;
  description: string;
  kind: "DECISORIO";
  matter_code: string;
  proposal_text: string;
};

export type AgreementRow = {
  tenant_id: string;
  entity_id: string;
  body_id: string;
  code: string;
  agreement_kind: string;
  matter_class: string;
  inscribable: boolean;
  adoption_mode: "MEETING";
  status: "ADOPTED";
  decision_date: string;
  parent_meeting_id: string;
  agenda_item_id: string;
  rule_pack_id: string;
  rule_pack_version: string;
  statutory_basis: string;
  proposal_text: string;
  decision_text: string;
  compliance_explain: Record<string, unknown>;
};

/**
 * El punto celebrado.
 *
 * **`order_number` es el ordinal del punto dentro de la convocatoria**, no un
 * contador propio: es el mismo entero que la plataforma pondría en
 * `agenda_items.source_convocatoria_item_index`. Ese vínculo por FK no se puede
 * escribir aquí —`fn_secretaria_guard_convocation_agenda_binding` exige una
 * convocatoria EMITIDA e inmutable y ésta está en BORRADOR—, así que las tres
 * columnas `source_convocatoria_*` quedan a NULL, que es lo que el CHECK
 * `agenda_items_convocation_source_binding_complete` exige cuando no hay
 * vínculo: las tres o ninguna.
 */
export function buildAgendaRow(meetingId: string, p: PuntoOrdenDia): AgendaRow {
  if (!p.materia) throw new Error(`agenda: el punto ${p.numero} no tiene materia`);
  return {
    tenant_id: GARRIGUES_TENANT,   // la columna tiene DEFAULT al tenant de ARGA: hay que darla
    meeting_id: meetingId,
    order_number: ordinalEnOrdenDelDia(p.numero),
    title: p.titulo,
    // El "1.2" del certificado no cabe en un integer: se conserva aquí, que es
    // donde la ficha del punto lo enseña.
    description: `Punto ${p.numero} del orden del día de la Junta General de Socios de ${FECHA_JUNTA}.`,
    kind: "DECISORIO",             // `agreement_requires_decisorio` lo exige
    matter_code: p.materia,
    proposal_text: textoAcuerdo(p.numero).propuesta,
  };
}

/**
 * El acuerdo.
 *
 * - `matter_class` e `inscribable` salen de `materia_catalog`. Duplicarlos aquí
 *   sería una segunda copia de la clasificación que mentiría el día que el
 *   catálogo cambiara.
 * - `agenda_item_id` es la **arista real** punto ↔ acuerdo: un uuid con FK a
 *   `agenda_items`, no el número del punto ni una coincidencia de título.
 * - `required_majority_code` se deja **NULL a propósito**. El vocabulario de esa
 *   columna es la escalera de `fn_majority_level` (SIMPLE < REFORZADA_2_3 <
 *   UNANIMIDAD) y ninguno de esos tres valores expresa la base de cómputo del
 *   art. 30.1 de los Estatutos —mayoría de los votos DEL CAPITAL, no de los
 *   emitidos ni del capital presente—. Escribir SIMPLE afirmaría otra regla, y
 *   además el trigger `fn_agreements_majority_check` lo rechazaría en las
 *   materias cuyo mínimo de catálogo es REFORZADA_2_3. La mayoría aplicable vive
 *   en el rule pack, que es su sitio, y se copia a `compliance_explain`.
 */
export function buildAgreementRow(args: {
  meetingId: string;
  bodyId: string;
  agendaItemId: string;
  punto: PuntoOrdenDia;
  clase: ClaseMateria;
  pack: PackResuelto;
}): AgreementRow {
  const { meetingId, bodyId, agendaItemId, punto, clase, pack } = args;
  if (!punto.materia) throw new Error(`acuerdo: el punto ${punto.numero} no tiene materia`);
  if (clase.materia !== punto.materia) {
    throw new Error(`acuerdo: clase de ${clase.materia} aplicada al punto ${punto.numero} (${punto.materia})`);
  }
  if (pack.materia !== punto.materia) {
    throw new Error(`acuerdo: el pack ${pack.packId} sirve la materia ${pack.materia} y el punto ${punto.numero} es ${punto.materia}`);
  }
  const texto = textoAcuerdo(punto.numero);
  const referencia = String(pack.mayoriaSL.referencia ?? "");
  if (!referencia) throw new Error(`acuerdo: el pack ${pack.packId} no trae referencia de mayoría`);
  // La subsunción viaja con el acuerdo cuando la hay, y solo cuando la hay: los
  // otros 9 resuelven su mayoría por cita directa y una clave vacía sugeriría lo
  // contrario. Es el mismo objeto que el pack lleva en
  // `reglaEspecifica.subsuncionArt36`, así que la sonda puede contrastarlos.
  const subsuncion = subsuncionDe(punto.numero);

  return {
    tenant_id: GARRIGUES_TENANT,
    entity_id: GARRIGUES_MATRIZ_UUID,
    body_id: bodyId,
    code: `JGS-${FECHA_JUNTA}-${punto.numero}`,
    agreement_kind: punto.materia,
    matter_class: clase.matter_class,
    inscribable: clase.inscribable,
    adoption_mode: "MEETING",
    status: "ADOPTED",
    decision_date: FECHA_JUNTA,
    parent_meeting_id: meetingId,
    agenda_item_id: agendaItemId,
    rule_pack_id: pack.packId,
    rule_pack_version: pack.version,
    // Derivado del pack, no redactado aquí.
    statutory_basis: referencia,
    proposal_text: texto.propuesta,
    decision_text: texto.decision,
    compliance_explain: {
      c1_junta_socios_2026: {
        punto: punto.numero,
        orden_del_dia_ordinal: ordinalEnOrdenDelDia(punto.numero),
        titulo: punto.titulo,
        contenido_acuerdo: texto.contenido,
        rule_pack: {
          pack_id: pack.packId,
          version: pack.version,
          materia: pack.materia,
          resolucion: "POR_MATERIA",
          tenant: "GARRIGUES",
        },
        mayoria: pack.mayoriaSL,
        ...(subsuncion ? { subsuncion } : {}),
        required_majority_code: {
          valor: null,
          motivo: subsuncion
            // Aquí la escalera SÍ tiene una palabra para «dos tercios», así que
            // el motivo del NULL no puede ser el mismo que en los otros nueve.
            ? "REFORZADA_2_3 (fn_majority_level) sí nombra los dos tercios, pero se deja NULL por dos razones: no expresa la base de cómputo —votos de las participaciones en que se divide el capital social, no votos emitidos ni capital presente— y, sobre todo, escribir la mayoría en una columna estructurada la presentaría como FIRME cuando se aplica por SUBSUNCIÓN etiquetada INFERIDO. La mayoría aplicable vive en el rule pack y la subsunción, con su lectura alternativa, está aquí al lado."
            : "El vocabulario de required_majority_code (SIMPLE < REFORZADA_2_3 < UNANIMIDAD, fn_majority_level) no expresa la base de cómputo del art. 30.1 de los Estatutos, que es la mayoría de los votos del capital social y no la de los votos emitidos. Escribir un código de esa escalera afirmaría otra regla; la aplicable es la del rule pack y está copiada aquí al lado.",
        },
        texto_del_acuerdo:
          texto.contenido === "ACREDITADO"
            ? "Contenido acreditado en fuente externa; la redacción es reconstrucción: el certificado del acta no transcribe el literal."
            : "INFERIDO: el certificado recoge el punto pero no lo que se decidió. El texto no identifica a ninguna persona.",
        alcance:
          "Reconstrucción demo sin efecto jurídico. El expediente real consta en el Registro Mercantil de Madrid; la plataforma lo reproduce, no lo sustituye.",
      },
    },
  };
}

// ────────────────── Task 7: resoluciones y evaluación real de la mayoría ──

/**
 * ## Por qué `meeting_votes` queda VACÍA, y por qué eso NO es un hueco
 *
 * El certificado del acta acredita **dos** hechos y ninguno es un escrutinio:
 * que los acuerdos se adoptaron, y que concurrió el censo entero (3 socios
 * presentes y 343 representados por una sola persona). **No transcribe quién
 * votó qué.**
 *
 * `meeting_votes` es, columna por columna (verificado en Cloud), una tabla
 * NOMINAL y SIN PESO: `(resolution_id, attendee_id, vote_value, conflict_flag,
 * reason)`. No tiene ni `votes` ni `direction` ni `meeting_id` —las tres que
 * proponía el plan— así que no sabe expresar un agregado ponderado. De ahí que
 * las tres salidas posibles fueran:
 *
 *  1. **3.460 filas nominales** (346 socios × 10 acuerdos): fabricar la
 *     atribución del sentido del voto a 346 personas identificadas. Descartada.
 *  2. **4 filas** —el representante único y los 3 presenciales—: descartada por
 *     tres razones independientes. (a) El acta dice que Roberto Delgado exhibió
 *     343 cartas de delegación, **no** que votara a favor de los 10 puntos: una
 *     delegación puede llevar instrucción de voto por punto y el certificado no
 *     la transcribe; y a Vives y a Zarza les pondría en la boca un voto que
 *     nadie ha escrito. (b) Sin columna de peso, esas 4 filas cuentan **4
 *     votos**, no 16.900: el agregado saldría además aritméticamente falso.
 *     (c) `meeting_votes` es justo la tabla que la vía sellada del servidor lee
 *     como «el sentido individual del voto»; rellenarla a mano fabrica el
 *     artefacto que esa vía existe para proteger.
 *  3. **Ninguna fila, y el motor evaluando lo que sí está acreditado.** Elegida.
 *
 * Lo que el motor evalúa entonces no es «¿se alcanzó la mayoría?» —eso ya lo
 * certifica el acta— sino **«¿qué mayoría exigía la regla y era alcanzable con
 * la concurrencia certificada?»**. La pregunta tiene respuesta no trivial
 * precisamente porque estas mayorías estatutarias se miden sobre los **votos
 * totales** y no sobre los emitidos: con concurrencia baja, un 80 % del total es
 * inalcanzable y la adopción certificada sería incompatible con la regla. El
 * motor detecta esa incompatibilidad, y por eso su veredicto **cambia** con la
 * entrada en vez de ser un rótulo.
 */
export const MEETING_VOTES_VACIA =
  "El certificado del acta no transcribe el desglose nominal de votos. meeting_votes queda VACÍA a propósito: es una tabla por asistente y sin columna de peso, así que escribirla atribuiría un sentido de voto a personas identificadas que la fuente no nombra votando.";

/** El acta decide la adopción; este motor no. */
export const ADOPCION_LA_CERTIFICA_EL_ACTA =
  "La adopción está certificada por el acta y vive en meeting_resolutions.status = ADOPTED. Esta evaluación NO la decide.";

/** Marca que la ficha lee para avisar de que el resultado no está sellado. */
export const SELLO_CLIENTE = "NO_SELLADO_EN_SERVIDOR";

export const SELLO_MOTIVO =
  "La vía sellada en servidor (fn_secretaria_server_resolution_evaluation) no admite este órgano: evalúa CDA, COMISION y COMITE, exige un censo POLITICO WORM y que cada asiento pese exactamente 1. Esta Junta son 346 socios ponderados por títulos × votos por título sobre un censo ECONOMICO, y no cabe ahí ni añadiendo JUNTA a la lista. La evaluación la ejecutó el motor de reglas TS en el cliente.";

export const ESCENARIO_EVALUADO =
  "MAXIMO_ALCANZABLE — el voto a favor se fija en los votos concurrentes que certifica el acta, que es el TECHO que la concurrencia permite, no el escrutinio. El motor responde si la mayoría exigida era alcanzable con esa concurrencia; no afirma cómo votó nadie.";

/**
 * La clase que compone la base de cómputo declarada del expediente: clase A no
 * autocartera = 16.900 votos (decisión del usuario de 2026-08-29, §4 de
 * `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md`). Los 8 votos
 * de clase B concurrieron y se cuentan aparte: **las dos bases no se mezclan.**
 */
const CLASE_BASE_DECLARADA = "A";

/**
 * Concurrencia certificada, medida sobre la base declarada y sobre la íntegra.
 *
 * Devuelve las dos porque la diferencia (8 votos de clase B) es real y está
 * decidida; devolver una sola invitaría a usarla como si fuera la otra.
 */
export function concurrenciaCertificada(socios: SocioCenso[], attendees: AttendeeRow[]) {
  const claseDe = new Map(socios.map((s) => [s.person_id, s.holding.share_class?.class_code ?? "?"]));
  let enBaseDeclarada = 0;
  let todasLasClases = 0;
  let sociosEnBase = 0;
  for (const a of attendees) {
    // Presencial o representado: ambas formas concurren. Un ausente no sumaría.
    if (a.attendance_type !== "PRESENCIAL" && a.attendance_type !== "REPRESENTADO") continue;
    todasLasClases += a.voting_rights;
    if (claseDe.get(a.person_id) === CLASE_BASE_DECLARADA) {
      enBaseDeclarada += a.voting_rights;
      sociosEnBase += 1;
    }
  }
  return { votos: enBaseDeclarada, socios: sociosEnBase, votosTodasLasClases: todasLasClases };
}

export type EvaluacionMayoria = {
  punto: string;
  materia: string;
  packId: string;
  version: string;
  /** Veredicto del motor sobre la ALCANZABILIDAD, no sobre la adopción. */
  ok: boolean;
  severity: EvalSeverity;
  /** false cuando el motor no sabe evaluar la fórmula del pack. */
  evaluable: boolean;
  formula: string;
  referencia: string;
  /** Votos exigidos por la regla. Sale del motor, no se recalcula aquí. */
  umbralVotos: number | null;
  blockingIssues: string[];
  warnings: string[];
  /** Plano a propósito: la ficha renderiza cada valor con `String(value)`. */
  explain: Record<string, string | number | boolean>;
};

/**
 * Corre el motor de reglas sobre un punto. **Ejecuta `evaluarVotacion` de
 * verdad**: el umbral y el veredicto salen de su salida, no de una constante.
 *
 * Si la fórmula del pack no la sabe evaluar el motor, no se persiste su
 * veredicto: `evaluateFormula` devuelve `false` con umbral 0 ante una fórmula
 * desconocida, y ese `false` es indistinguible de una mayoría realmente no
 * alcanzada. Se declara `evaluable: false` y se dice por qué. Es el caso de la
 * DOBLE MAYORÍA de la exclusión (art. 30.2.g Estatutos + art. 15 Ley 2/2007):
 * su segunda condición es una mayoría de SOCIOS, no de votos, y sin el desglose
 * nominal —que el acta no transcribe— no hay forma de computarla.
 */
export function evaluarMayoriaPunto(args: {
  punto: PuntoOrdenDia;
  pack: RulePack;
  packId: string;
  version: string;
  baseVotos: number;
  concurrenciaVotos: number;
  concurrenciaTodasLasClases: number;
}): EvaluacionMayoria {
  const { punto, pack, packId, version, baseVotos, concurrenciaVotos } = args;
  if (!punto.materia) throw new Error(`evaluación: el punto ${punto.numero} no tiene materia`);
  const mayoria = pack.votacion?.mayoria?.SL;
  if (!mayoria?.formula) {
    throw new Error(`evaluación: el pack ${packId} no trae fórmula en la rama SL de votacion.mayoria`);
  }
  const evaluable = esFormulaEvaluable(mayoria.formula);

  const votos: VotosInput = {
    // TECHO, no escrutinio: ver ESCENARIO_EVALUADO.
    favor: concurrenciaVotos,
    contra: 0,
    abstenciones: 0,
    en_blanco: 0,
    capital_presente: concurrenciaVotos,
    // Base DECLARADA del expediente (16.900). Nunca la íntegra de 16.908.
    capital_total: baseVotos,
  };

  const salida = evaluarVotacion(
    {
      tipoSocial: "SLP",
      organoTipo: "JUNTA_GENERAL",
      adoptionMode: "MEETING",
      materiaClase: pack.clase,
      materias: [punto.materia],
      votos,
    },
    [pack],
  );

  const nodoMayoria = salida.explain.find((n) => String(n.regla).startsWith("Mayoría:"));
  const umbralVotos =
    evaluable && typeof nodoMayoria?.umbral === "number" ? nodoMayoria.umbral : null;
  const pct = (n: number) => Math.round((n / baseVotos) * 1_000_000) / 10_000;

  const motivoNoEvaluable =
    `El motor de reglas no sabe evaluar la fórmula "${mayoria.formula}". No se persiste su veredicto: ante una fórmula desconocida devuelve «no alcanzada» con umbral 0, indistinguible de una mayoría realmente no alcanzada. La segunda condición es una mayoría de SOCIOS, no de votos, y el acta no transcribe el desglose nominal que permitiría computarla.`;

  const explain: Record<string, string | number | boolean> = {
    schema_version: "c1-junta-2026.mayoria.v1",
    sello: SELLO_CLIENTE,
    sello_motivo: SELLO_MOTIVO,
    punto: punto.numero,
    materia: punto.materia,
    rule_pack: `${packId} v${version}`,
    formula: String(mayoria.formula),
    referencia: String(mayoria.referencia ?? ""),
    base_computo: "VOTOS_CLASE_A_NO_AUTOCARTERA",
    base_votos: baseVotos,
    concurrencia_votos: concurrenciaVotos,
    concurrencia_pct: pct(concurrenciaVotos),
    concurrencia_todas_las_clases: args.concurrenciaTodasLasClases,
    escenario: ESCENARIO_EVALUADO,
    umbral_votos: umbralVotos ?? "NO EVALUABLE",
    umbral_pct: umbralVotos === null ? "NO EVALUABLE" : pct(umbralVotos),
    veredicto: !evaluable
      ? "NO EVALUADO por el motor"
      : salida.mayoriaAlcanzada
        ? `La mayoría exigida (${umbralVotos} votos) es alcanzable con la concurrencia certificada (${concurrenciaVotos} votos)`
        : `La mayoría exigida (${umbralVotos} votos) NO es alcanzable con la concurrencia certificada (${concurrenciaVotos} votos)`,
    desglose_nominal: MEETING_VOTES_VACIA,
    adopcion: ADOPCION_LA_CERTIFICA_EL_ACTA,
    alcance:
      "Reconstrucción demo sin efecto jurídico. El expediente real consta en el Registro Mercantil de Madrid; la plataforma lo reproduce, no lo sustituye.",
  };
  if (!evaluable) explain.motivo_no_evaluable = motivoNoEvaluable;

  return {
    punto: punto.numero,
    materia: punto.materia,
    packId,
    version,
    ok: evaluable ? salida.ok : false,
    // No evaluable NO es BLOCKING: el motor no dice que el acuerdo falle, dice
    // que no puede pronunciarse. Pintarlo en rojo afirmaría lo primero.
    severity: evaluable ? salida.severity : "WARNING",
    evaluable,
    formula: String(mayoria.formula),
    referencia: String(mayoria.referencia ?? ""),
    umbralVotos,
    blockingIssues: evaluable ? salida.blocking_issues : [],
    warnings: evaluable ? salida.warnings : [motivoNoEvaluable, ...salida.warnings],
    explain,
  };
}

export type ResolutionRow = {
  tenant_id: string;
  meeting_id: string;
  agenda_item_index: number;
  resolution_text: string;
  resolution_type: string;
  required_majority_code: null;
  status: "ADOPTED";
  agreement_id: string;
  kind_resolution: "DECISION";
};

/**
 * La resolución del punto: el hecho que el acta SÍ certifica.
 *
 * - `agenda_item_index` es el ordinal de la convocatoria, el mismo que
 *   `agenda_items.order_number`. `tr_resolution_kind_matches_agenda` lo exige:
 *   si no encuentra el punto por (meeting_id, order_number), lanza.
 * - `required_majority_code` va a **NULL explícito**. La columna tiene DEFAULT
 *   `'SIMPLE'`, así que omitirla escribiría una mayoría que no es la aplicable:
 *   el mismo motivo que en `agreements` (la escalera SIMPLE/REFORZADA_2_3/
 *   UNANIMIDAD no expresa la base del art. 30.1), agravado porque aquí el
 *   silencio no deja NULL, deja SIMPLE.
 * - `kind_resolution` DECISION exige `agenda_items.kind = 'DECISORIO'`, que es
 *   lo que Task 6 escribió en los 10 puntos.
 */
export function buildResolutionRow(meetingId: string, punto: PuntoOrdenDia, agreementId: string): ResolutionRow {
  if (!punto.materia) throw new Error(`resolución: el punto ${punto.numero} no tiene materia`);
  return {
    tenant_id: GARRIGUES_TENANT,
    meeting_id: meetingId,
    agenda_item_index: ordinalEnOrdenDelDia(punto.numero),
    resolution_text: textoAcuerdo(punto.numero).decision,
    resolution_type: punto.materia,
    required_majority_code: null,
    status: "ADOPTED",
    agreement_id: agreementId,
    kind_resolution: "DECISION",
  };
}

export type RuleEvaluationRow = {
  tenant_id: string;
  agreement_id: string;
  etapa: string;
  ok: boolean;
  explain: Record<string, string | number | boolean>;
  blocking_issues: string[];
  warnings: string[];
  rule_pack_id: string;
  rule_pack_version: string;
  rule_pack_version_id: string | null;
  payload_hash: string;
  severity: EvalSeverity;
  evaluation_hash: string;
};

async function sha256Hex(texto: string) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Etapa del registro. Una por punto: agrupa la fila en la ficha del acuerdo. */
export function etapaEvaluacion(punto: string) {
  return `MAYORIA_JUNTA_2026_PUNTO_${punto}`;
}

/**
 * La fila que se persiste. `rule_evaluation_results` es **WORM**: `worm_guard()`
 * bloquea UPDATE y DELETE para todo el mundo, service_role incluido. Por eso el
 * seed compara `evaluation_hash` antes de insertar y, si difiere del que ya hay,
 * **para y lo dice** en vez de apilar una segunda evaluación del mismo punto.
 */
export async function buildRuleEvaluationRow(args: {
  agreementId: string;
  evaluacion: EvaluacionMayoria;
  packVersionId: string | null;
  packPayload: unknown;
}): Promise<RuleEvaluationRow> {
  const { agreementId, evaluacion } = args;
  const sinHash = {
    tenant_id: GARRIGUES_TENANT,
    agreement_id: agreementId,
    etapa: etapaEvaluacion(evaluacion.punto),
    ok: evaluacion.ok,
    explain: evaluacion.explain,
    blocking_issues: evaluacion.blockingIssues,
    warnings: evaluacion.warnings,
    rule_pack_id: evaluacion.packId,
    rule_pack_version: evaluacion.version,
    rule_pack_version_id: args.packVersionId,
    payload_hash: await sha256Hex(canonical(args.packPayload)),
    severity: evaluacion.severity,
  };
  return { ...sinHash, evaluation_hash: await sha256Hex(canonical(sinHash)) };
}

// ──────────────── Task 9: el ciclo registral, la inscripción del 13/07 y el BORME ──

/**
 * Estado del expediente cuando la fuente acredita la inscripción.
 *
 * Vocabulario medido contra Cloud: el CHECK `registry_filings_v2_status_check`
 * **solo aplica a `workflow_version = 2`** (`PREPARADA · ELEVADA · PRESENTADA ·
 * SUBSANACION · DENEGADA · INSCRITA · PUBLICADA`); en v1 la columna es texto
 * libre con DEFAULT `'PREPARACION'` y no hay ningún trigger sobre la tabla. Se
 * escribe igualmente dentro de ese vocabulario porque es el que `statusLabel()`
 * sabe traducir: `'PREPARACION'` —el default de la tabla— no tiene entrada y la
 * ficha lo pintaría en crudo.
 *
 * `REGISTERED`, que proponía el plan, **no existe en ninguna de las dos escaleras**.
 */
const FILING_ESTADO_INSCRITA = "INSCRITA";

/**
 * Estado del expediente cuando la fuente NO acredita inscripción. Es el peldaño
 * MÁS BAJO del ciclo: no afirma elevación, ni presentación, ni calificación.
 *
 * Y aun así afirma algo, así que la fila lo acota: `PREPARADA` describe el
 * estado de ESTE registro —la plataforma ha reconstruido el expediente del
 * acuerdo— y no un acto del mundo real. Lo que la fuente no dice va escrito en
 * `procedure_snapshot.c1_junta_socios_2026.sin_inscripcion`.
 *
 * La alternativa era no crear la fila. Se descarta: `ExpedienteAcuerdo` solo
 * pinta el bloque registral `{registryFiling ? … : null}`, así que sin fila los
 * cuatro acuerdos sin inscripción quedarían **indistinguibles de un acuerdo no
 * inscribible** — el expediente incompleto se vería completo.
 */
const FILING_ESTADO_SIN_INSCRIPCION = "PREPARADA";

/**
 * La vía. Columna NOT NULL con DEFAULT `'NOTARIAL'`: omitirla **no deja NULL,
 * afirma que se presentó por vía notarial** — la misma mina que
 * `meeting_resolutions.required_majority_code` en Task 7.
 *
 * `REGISTRO_MERCANTIL` (el valor que usan las filas v2 de ARGA) nombra el
 * destino, que sí consta —RM de Madrid, hoja M-190538, en los datos registrales
 * de la propia fuente—, y no dice nada sobre el camino (notarial o telemático),
 * que no consta.
 */
const FILING_VIA = "REGISTRO_MERCANTIL";

export type RegistryFilingRow = {
  tenant_id: string;
  entity_id: string;
  agreement_id: string;
  workflow_version: 1;
  filing_via: string;
  status: string;
  filing_number: null;
  presentation_date: null;
  estimated_resolution: null;
  inscription_number: string | null;
  borme_ref: string | null;
  registered_at: string | null;
  publication_reference: null;
  published_at: null;
  qualification_outcome: null;
  qualified_at: null;
  deed_id: null;
  deed_reference: null;
  deed_date: null;
  notary_id: null;
  notary_name: null;
  protocol_number: null;
  elevated_at: null;
  procedure_snapshot: Record<string, unknown>;
};

/**
 * El expediente registral de un acuerdo inscribible.
 *
 * ## Por qué `workflow_version = 1` y no el ciclo gobernado v2
 *
 * Medido contra Cloud antes de escribir una línea. El ciclo v2
 * (`fn_registry_prepare_filing` → `record_presentation` → `record_qualification`
 * → `record_inscription`) es la vía gobernada, con su `registry_filing_events`
 * append-only, y **aquí no se puede recorrer sin inventar**:
 *
 *  1. `fn_registry_record_inscription` exige `status = 'PRESENTADA'` **y**
 *     `qualification_outcome = 'POSITIVA'` antes de inscribir. Llegar ahí obliga
 *     a dar `p_presentation_date` y `p_filing_number` a `record_presentation` y
 *     una fecha de calificación a `record_qualification`: **tres datos que la
 *     fuente no acredita**. El ciclo gobernado no es opcional en su orden.
 *  2. Las cuatro RPC exigen `p_evidence_artifact_id` NOT NULL y lo verifican
 *     contra `secretaria_document_artifacts` (`fn_registry_assert_artifact` con
 *     `p_require_verified = true`). No hay artefacto de este expediente: la
 *     certificación es Task 8 y el artefacto documental no existe.
 *  3. El CHECK `registry_filings_v2_projection_check` obliga en v2 a
 *     `base_document_artifact_id` NOT NULL, y si el documento base fuera
 *     `'ESCRITURA'`, `registry_filings_escritura_metadata_check` exige
 *     `deed_date`, `notary_name` y `protocol_number` — **exactamente los tres
 *     datos que esta tarea tiene prohibido inventar**.
 *
 * Escribir eventos a mano tampoco vale: `registry_filing_events` es append-only
 * con guard, y fabricar un rastro de auditoría gobernado es peor que no tenerlo.
 * Queda elevado como brecha de producto: **hoy la plataforma no sabe registrar
 * un expediente ya inscrito cuya presentación no consta.**
 *
 * ## Qué se escribe y qué no
 *
 * Todo lo acreditado sale de `inscripcionDePunto()`, que lo DERIVA de la captura
 * BORME. Todo lo demás va a NULL **explícito** —no omitido— para que un `update`
 * de una ejecución posterior limpie cualquier valor que alguien hubiera puesto a
 * mano, y para que la fila enseñe su propio silencio.
 */
export function buildRegistryFilingRow(args: {
  agreementId: string;
  punto: PuntoOrdenDia;
  clase: ClaseMateria;
}): RegistryFilingRow {
  const { agreementId, punto, clase } = args;
  if (!punto.materia) throw new Error(`expediente registral: el punto ${punto.numero} no tiene materia`);
  if (clase.materia !== punto.materia) {
    throw new Error(`expediente registral: clase de ${clase.materia} aplicada al punto ${punto.numero} (${punto.materia})`);
  }
  // Un expediente registral de un acuerdo NO inscribible afirmaría que hay algo
  // que inscribir. La inscribibilidad la dice `materia_catalog`, no este seed.
  if (!clase.inscribable) {
    throw new Error(`expediente registral: el punto ${punto.numero} (${punto.materia}) no es inscribible según materia_catalog`);
  }

  const insc = inscripcionDePunto(punto.numero);
  const descartado = candidatoDescartadoDePunto(punto.numero);

  return {
    tenant_id: GARRIGUES_TENANT,
    entity_id: GARRIGUES_MATRIZ_UUID,
    agreement_id: agreementId,
    workflow_version: 1,
    filing_via: FILING_VIA,
    status: insc ? FILING_ESTADO_INSCRITA : FILING_ESTADO_SIN_INSCRIPCION,
    // Asiento de presentación: no consta ni en los inscritos.
    filing_number: null,
    presentation_date: null,
    estimated_resolution: null,
    inscription_number: insc ? insc.numeroInscripcion : null,
    borme_ref: insc ? insc.anuncio : null,
    // `date` no hay: la columna del asiento es `registered_at` (timestamptz).
    // 00:00Z conserva el DÍA en UTC —`slice(0,10)` da 2026-07-13—, que es el
    // dato que no puede fallar; ver la historia de `FECHA_1_ISO`. Hoy ninguna
    // superficie del Tramitador pinta esta columna: brecha de producto anotada,
    // que NO se compensa metiendo la fecha en una columna que sí se pinte.
    registered_at: insc ? `${insc.fecha}T00:00:00.000Z` : null,
    // La publicación en el boletín es otro acto: la fuente da el número de
    // anuncio pero NO identifica el boletín (no hay CVE de 13/07/2026 en su
    // lista) ni su fecha de publicación.
    publication_reference: null,
    published_at: null,
    // La inscripción implica que hubo calificación positiva, pero la
    // calificación es un acto con fecha y la fuente no la da. Además esas dos
    // columnas pertenecen al ciclo v2 gobernado, que aquí no se recorre.
    qualification_outcome: null,
    qualified_at: null,
    deed_id: null,
    deed_reference: null,
    deed_date: null,
    notary_id: null,
    notary_name: null,
    protocol_number: null,
    elevated_at: null,
    procedure_snapshot: {
      c1_junta_socios_2026: {
        punto: punto.numero,
        materia: punto.materia,
        junta: FECHA_JUNTA,
        inscripcion: insc
          ? {
              anuncio: insc.anuncio,
              fecha: insc.fecha,
              registral: insc.registral,
              numero_inscripcion: insc.numeroInscripcion,
              actos_del_anuncio: insc.actos,
              puntos_del_mismo_anuncio: insc.puntos,
              anuncio_compartido: notaAnuncioCompartido(insc),
              vinculo_con_la_junta: insc.vinculo,
              fuente: "scripts/garrigues/borme/jya-garrigues-slp.json (captura Carril B de la matriz, 2026-08-03)",
            }
          : null,
        ...(insc ? {} : { sin_inscripcion: MOTIVO_SIN_INSCRIPCION }),
        ...(descartado ? { candidato_descartado: descartado } : {}),
        elevacion: ELEVACION_NO_ACREDITADA,
        estado: insc
          ? `${FILING_ESTADO_INSCRITA}: la fuente acredita el asiento (anuncio ${insc.anuncio}, ${insc.registral}, ${insc.fecha}). No acredita ni la presentación ni la calificación como actos con fecha, y esas columnas quedan a NULL.`
          : `${FILING_ESTADO_SIN_INSCRIPCION}: es el peldaño más bajo del ciclo y describe el estado de ESTE registro —la plataforma ha reconstruido el expediente del acuerdo—, no un acto del mundo real. No afirma elevación, ni presentación, ni calificación, ni inscripción.`,
        workflow:
          "workflow_version 1. El ciclo gobernado v2 exige recorrer PRESENTADA + calificación POSITIVA antes de inscribir y un artefacto documental verificado; los tres datos que eso pide (fecha de presentación, asiento y fecha de calificación) no constan, y el artefacto no existe. Ver la cabecera de buildRegistryFilingRow().",
        alcance:
          "Reconstrucción demo sin efecto jurídico. El expediente real consta en el Registro Mercantil de Madrid (hoja M-190538); la plataforma lo reproduce, no lo sustituye. No se afirma presentación, envío, entrega ni interacción real con ningún registro ni con EAD Trust.",
      },
    },
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

  // Task 6-bis: 10 acuerdos. Ya no hay punto bloqueado — el 1.1 se desbloqueó
  // con la decisión del usuario de 2026-08-30 (ver SUBSUNCION_ART36).
  const conAcuerdo = puntosConAcuerdo();
  if (conAcuerdo.length !== 10) fail(`preflight: ${conAcuerdo.length} puntos con acuerdo, esperados 10.`);
  if (conAcuerdo.length !== materializan.length) {
    fail("preflight: hay puntos que materializan sin acuerdo; si vuelve a haber un bloqueo, decláralo aquí.");
  }
  // La etiqueta no es decorativa: si alguien la degrada a FIRME o le quita la
  // lectura alternativa, el seed no escribe. Es el único sitio del pipeline por
  // el que pasan los 10 acuerdos antes de tocar Cloud.
  if (SUBSUNCION_ART36.procedencia !== "INFERIDO") {
    fail("preflight: la subsunción del art. 36 debe seguir etiquetada INFERIDO.");
  }
  if (!SUBSUNCION_ART36.lecturaAlternativa.includes("30.2.f") || !SUBSUNCION_ART36.lecturaAlternativa.includes("30.1")) {
    fail("preflight: la lectura alternativa del art. 36 (30.2.f tasado → 30.1) no puede perderse.");
  }
  for (const p of conAcuerdo) textoAcuerdo(p.numero);   // lanza si falta un texto
  // Los ordinales son los de la convocatoria: si dos coincidieran, dos acuerdos
  // colgarían del mismo punto y el índice único de agenda_items lo rechazaría.
  const ordinales = conAcuerdo.map((p) => ordinalEnOrdenDelDia(p.numero));
  if (new Set(ordinales).size !== ordinales.length) fail("preflight: ordinales de punto repetidos.");

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

  // Task 6 — el pack de cada acuerdo se resuelve POR MATERIA y POR TENANT, que es
  // exactamente lo que hace `useRulePackForMateria` (join !inner contra
  // rule_packs filtrando tenant_id + materia). No se resuelve por `pack_id`:
  // `rule_packs.id` es PK global y los 3 packs nuevos llevan prefijo GARR_
  // porque los ids sin prefijo ya son de ARGA. Y NO se consulta
  // `rule_pack_versions` a secas: esa tabla tiene un SELECT abierto
  // (`rule_pack_versions_read`, qual=true) y devolvería también los de ARGA.
  const materiasAcuerdo = conAcuerdo.map((p) => p.materia!);
  const { data: packsGarr, error: ePacks } = await admin
    .from("rule_packs")
    .select("id, materia, organo_tipo, tenant_id, rule_pack_versions!inner(id, version, is_active, status, payload)")
    .eq("tenant_id", GARRIGUES_TENANT)
    .in("materia", materiasAcuerdo)
    .eq("rule_pack_versions.is_active", true);
  if (ePacks) fail(`rule_packs Garrigues: ${ePacks.message}`);

  type PackPayload = {
    materia?: string;
    votacion?: { mayoria?: { SL?: Record<string, unknown> } };
  };
  const packPorMateria = new Map<string, PackResuelto>();
  for (const rp of packsGarr ?? []) {
    const versiones = (rp.rule_pack_versions ?? []) as Array<{ id: string; version: string; payload: PackPayload }>;
    if (versiones.length !== 1) {
      fail(`rule_packs ${rp.id}: ${versiones.length} versiones activas, esperada 1.`);
    }
    if (packPorMateria.has(rp.materia)) {
      // Dos packs activos de la misma materia dejarían la elección al azar, y de
      // ahí sale la mayoría que se le enseña al abogado.
      fail(`rule_packs: la materia ${rp.materia} tiene más de un pack activo en Garrigues.`);
    }
    const payload: PackPayload = versiones[0].payload ?? {};
    const mayoriaSL = payload?.votacion?.mayoria?.SL;
    if (!mayoriaSL?.referencia) {
      fail(`rule_packs ${rp.id}: la rama SL de votacion.mayoria no trae referencia; es la que lee effective-rule para SLP.`);
    }
    if (payload?.materia && payload.materia !== rp.materia) {
      fail(`rule_packs ${rp.id}: materia del payload (${payload.materia}) ≠ materia de la relación (${rp.materia}).`);
    }
    packPorMateria.set(rp.materia, {
      packId: rp.id,
      version: String(versiones[0].version),
      materia: rp.materia,
      mayoriaSL,
      // Task 7: el motor evalúa el pack ENTERO (materia, clase, órgano, modos y
      // votación), no solo su rama de mayoría.
      payload: payload as unknown as RulePack,
      versionId: versiones[0].id,
    });
  }
  const sinPack = materiasAcuerdo.filter((m) => !packPorMateria.has(m));
  if (sinPack.length) {
    // Fail-closed **al escribir**: un acuerdo sin regla no se siembra. En dry-run
    // no se muere: un ensayo que revienta sin enseñar qué falta no sirve de nada.
    const msg =
      `materias sin rule pack del tenant Garrigues: ${sinPack.join(", ")}. ` +
      `Aplica antes supabase/migrations/20260829170000_c1_packs_materias_junta.sql ` +
      `(APROBACION_CUENTAS, NOMBRAMIENTO_AUDITOR, DELEGACION_FACULTADES) y ` +
      `supabase/migrations/20260830120000_c1_pack_modificacion_estatutos_junta.sql (MODIFICACION_ESTATUTOS).`;
    if (COMMIT) fail(msg);
    console.log(`\n⚠ ${msg}\n  El dry-run continúa para enseñar el resto; con --commit para aquí.`);
  }

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

  // ───────────────────────────────── Task 6: acuerdos, puntos celebrados y gate ──

  // El gate del informe preceptivo NO se decide aquí: lo decide
  // `governing_bodies.config.informe_preceptivo_de` del órgano, que lee
  // `fn_refresh_agreement_document_requirements`. Se lee para poder ANUNCIAR en
  // qué acuerdos va a disparar, y después se contrasta con lo que la RPC escribió.
  const { data: bodyCfg, error: eCfg } = await admin.from("governing_bodies")
    .select("config").eq("id", body.id).single();
  if (eCfg) fail(`governing_bodies config: ${eCfg.message}`);
  const materiasConGate = new Set<string>(
    ((bodyCfg?.config?.informe_preceptivo_de ?? []) as Array<{ materia?: string }>)
      .map((e) => String(e.materia ?? "")).filter(Boolean),
  );

  const claseporMateria = new Map((cat ?? []).map((c) => [c.materia, c as ClaseMateria]));

  console.log(`\n── Task 6 · los ${conAcuerdo.length} acuerdos, su punto y su regla ──`);
  console.table(conAcuerdo.map((p) => {
    const pack = packPorMateria.get(p.materia!);
    const clase = claseporMateria.get(p.materia!)!;
    return {
      punto: p.numero,
      ordinal: ordinalEnOrdenDelDia(p.numero),
      materia: p.materia,
      clase: `${clase.matter_class}${clase.inscribable ? " · inscribible" : ""}`,
      pack: pack ? `${pack.packId} v${pack.version}` : "FALTA — migración sin aplicar",
      mayoria: pack ? `${pack.mayoriaSL.fuente} · ${pack.mayoriaSL.formula}` : "—",
      referencia: pack ? String(pack.mayoriaSL.referencia).slice(0, 52) : "—",
      texto: textoAcuerdo(p.numero).contenido,
      regla: subsuncionDe(p.numero) ? "SUBSUNCIÓN · INFERIDO" : "cita directa",
      gate: materiasConGate.has(p.materia!) ? "INFORME_PRECEPTIVO_ORGANO" : "—",
    };
  }));
  console.log(
    [
      `Punto 1.1 (art. 36) — mayoría de 2/3 por SUBSUNCIÓN en el art. 30.2.a), etiquetada ${SUBSUNCION_ART36.procedencia} y decidida por ${SUBSUNCION_ART36.decididoPor}.`,
      `  Lectura aplicada: ${SUBSUNCION_ART36.lecturaAplicada}`,
      `  Lectura ALTERNATIVA (viaja con el acuerdo): ${SUBSUNCION_ART36.lecturaAlternativa}.`,
      `  Registro canónico: ${SUBSUNCION_ART36.registroCanonico}`,
      `Gate del informe preceptivo previsto en ${conAcuerdo.filter((p) => materiasConGate.has(p.materia!)).length} de ${conAcuerdo.length} acuerdos. MODIFICACION_ESTATUTOS NO entra: ${SUBSUNCION_ART36.consecuenciaNoAplicada}`,
      `Arista punto ↔ acuerdo: agenda_items.order_number (ordinal de la convocatoria) → agreements.agenda_item_id (uuid, FK).`,
      `source_convocatoria_id queda a NULL: el guard exige convocatoria EMITIDA e inmutable y ésta está en ${ESTADO}.`,
      `required_majority_code queda a NULL en los ${conAcuerdo.length}: la escalera SIMPLE/REFORZADA_2_3/UNANIMIDAD no expresa la base del art. 30.1, y en el 1.1 escribir REFORZADA_2_3 presentaría como FIRME una mayoría aplicada por subsunción INFERIDA.`,
    ].join("\n"),
  );

  // ────────────── Task 7 · las resoluciones y la evaluación de la mayoría ──

  // La concurrencia sale de la asistencia ya construida, no de un literal, y se
  // mide sobre las DOS bases: la declarada (16.900, clase A no autocartera) y la
  // íntegra (16.908, ambas clases). El motor recibe SOLO la declarada.
  const concurrencia = concurrenciaCertificada(socios, attendees);
  if (concurrencia.votosTodasLasClases !== votosSumaCenso) {
    fail(`preflight: la concurrencia total (${concurrencia.votosTodasLasClases}) no coincide con la suma del censo (${votosSumaCenso}).`);
  }
  if (concurrencia.votos !== baseComputoJunta()) {
    // El acta certifica que concurrió el censo entero: 346 de 346. Si la base
    // declarada dejara de estar íntegramente concurrida, la evaluación de la
    // mayoría hablaría de otra sesión.
    fail(`preflight: la concurrencia sobre la base declarada es ${concurrencia.votos} y la base es ${baseComputoJunta()}: el acta certifica concurrencia íntegra.`);
  }

  const evaluaciones = conAcuerdo
    .filter((p) => packPorMateria.get(p.materia!)?.payload)
    .map((p) => {
      const pack = packPorMateria.get(p.materia!)!;
      return evaluarMayoriaPunto({
        punto: p,
        pack: pack.payload!,
        packId: pack.packId,
        version: pack.version,
        baseVotos: baseComputoJunta(),
        concurrenciaVotos: concurrencia.votos,
        concurrenciaTodasLasClases: concurrencia.votosTodasLasClases,
      });
    });

  console.log(`\n── Task 7 · resoluciones y evaluación de la mayoría (motor de reglas, en cliente) ──`);
  console.table(evaluaciones.map((e) => ({
    punto: e.punto,
    materia: e.materia,
    formula: e.formula,
    umbral: e.umbralVotos === null ? "NO EVALUABLE" : `${e.umbralVotos} / ${baseComputoJunta()}`,
    concurrencia: `${concurrencia.votos} votos (${concurrencia.socios} socios de clase ${CLASE_BASE_DECLARADA})`,
    veredicto: e.evaluable ? (e.ok ? "ALCANZABLE" : "NO ALCANZABLE") : "NO EVALUADO",
    severity: e.severity,
  })));
  const noEvaluables = evaluaciones.filter((e) => !e.evaluable);
  console.log(
    [
      `Sello: ${SELLO_CLIENTE}. ${SELLO_MOTIVO}`,
      `Escenario: ${ESCENARIO_EVALUADO}`,
      `meeting_votes: 0 filas. ${MEETING_VOTES_VACIA}`,
      `${ADOPCION_LA_CERTIFICA_EL_ACTA}`,
      `Bases NO mezcladas: el motor recibe ${baseComputoJunta()} (declarada); la concurrencia íntegra de ambas clases es ${concurrencia.votosTodasLasClases} y solo se guarda como conciliación.`,
      `Fórmulas que el motor NO sabe evaluar: ${noEvaluables.length} de ${evaluaciones.length}${noEvaluables.length ? ` — ${noEvaluables.map((e) => `${e.materia} ("${e.formula}")`).join(", ")}` : ""}.`,
    ].join("\n"),
  );

  // ────────────── Task 9 · el ciclo registral: elevación, inscripción y BORME ──

  // Quién tiene expediente registral lo dice `materia_catalog.inscribable`, no
  // este seed: el conjunto se DERIVA y no se pina. Si mañana el catálogo cambia
  // la inscribibilidad de una materia, este número cambia con él.
  const inscribibles = conAcuerdo.filter((p) => claseporMateria.get(p.materia!)!.inscribable);
  const noInscribibles = conAcuerdo.filter((p) => !claseporMateria.get(p.materia!)!.inscribable);
  const conInscripcion = inscribibles.filter((p) => inscripcionDePunto(p.numero));
  const sinInscripcion = inscribibles.filter((p) => !inscripcionDePunto(p.numero));

  console.log(`\n── Task 9 · el ciclo registral de los ${inscribibles.length} acuerdos inscribibles ──`);
  console.table(inscribibles.map((p) => {
    const insc = inscripcionDePunto(p.numero);
    return {
      punto: p.numero,
      materia: p.materia,
      estado: insc ? FILING_ESTADO_INSCRITA : FILING_ESTADO_SIN_INSCRIPCION,
      anuncio: insc?.anuncio ?? "—",
      inscripcion: insc ? `I/A ${insc.numeroInscripcion}` : "—",
      fecha: insc?.fecha ?? "—",
      comparte_anuncio: insc && insc.puntos.length > 1
        ? `sí · con el punto ${insc.puntos.filter((x) => x !== p.numero).join(", ")}`
        : "—",
      instrumento: "no acreditado",
      candidato_descartado: candidatoDescartadoDePunto(p.numero)?.anuncio ?? "—",
    };
  }));
  console.log(
    [
      `${conInscripcion.length} de ${inscribibles.length} acuerdos inscribibles con inscripción ACREDITADA; ${sinInscripcion.length} sin anuncio en la fuente: ${sinInscripcion.map((p) => p.materia).join(", ")}.`,
      ...inscripcionesDeLaJunta().map((i) =>
        `Anuncio ${i.anuncio} · ${i.registral} · ${i.fecha} · puntos ${i.puntos.join(", ")} · actos ${i.actos.join(", ")}\n  Vínculo: ${i.vinculo}`,
      ),
      // 2 anuncios y 3 acuerdos inscritos: el aviso viaja también en cada fila.
      ...inscripcionesDeLaJunta().map(notaAnuncioCompartido).filter(Boolean) as string[],
      `Los ${sinInscripcion.length} sin inscripción NO se omiten: se escriben en ${FILING_ESTADO_SIN_INSCRIPCION} con anuncio, fecha, asiento y protocolo a NULL. ${MOTIVO_SIN_INSCRIPCION}`,
      ...inscribibles
        .map((p) => [p, candidatoDescartadoDePunto(p.numero)] as const)
        .filter(([, c]) => c)
        .map(([p, c]) => `Punto ${p.numero}: candidato DESCARTADO ${c!.anuncio} (${c!.fecha}, ${c!.registral}) — ${c!.motivo}`),
      ELEVACION_NO_ACREDITADA,
      `Los ${noInscribibles.length} acuerdos no inscribibles (${noInscribibles.map((p) => p.materia).join(", ")}) no generan expediente registral: lo dice materia_catalog. El depósito de las cuentas de 2025 es otro procedimiento y la fuente no acredita ni su presentación ni su fecha.`,
      `Fuente ÚNICA de todo lo anterior: scripts/garrigues/borme/jya-garrigues-slp.json. Ni una fecha, ni un número de anuncio, ni un protocolo se escriben a mano en este seed.`,
    ].join("\n"),
  );

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

    // Verificación POSTERIOR e imprescindible: el gate previo comprueba el dato,
    // no la fórmula que la RPC aplicó. Aquí se lee el payload realmente escrito.
    // Si el peso no reproduce el art. 7, el snapshot ya es INMUTABLE y no se
    // puede retirar: por eso esto grita en vez de callar.
    const { data: creado, error: eLeer } = await admin
      .from("censo_snapshot").select("payload, total_partes, capital_total_base").eq("id", data).single();
    if (eLeer) fail(`censo_snapshot lectura de vuelta: ${eLeer.message}`);
    const pesos = (creado.payload as Array<{ voting_weight: number | string }>)
      .map((r) => Number(r.voting_weight)).filter((w) => w > 0);
    const ratio = Math.max(...pesos) / Math.min(...pesos);
    const suma = pesos.reduce((a, w) => a + w, 0);
    if (Math.abs(ratio - censo.ratioVotos!) > 1e-6 || Math.abs(suma - 100) > 1e-6) {
      fail(`el censo WORM ${data} quedó mal ponderado: ratio=${ratio} (esperado ${censo.ratioVotos}), Σ=${suma} (esperado 100). Es INMUTABLE: no se puede retirar.`);
    }
    console.log(`✓ payload verificado: ${creado.total_partes} partes · Σ voting_weight=${suma.toFixed(6)} · ratio ${ratio.toFixed(2)} (art. 7)`);
  }

  // ── Task 6 · los 10 acuerdos ─────────────────────────────────────────────

  // 1) El punto celebrado. Índice único (meeting_id, order_number): la clave de
  //    idempotencia es el ordinal, y NO se borra y reinserta — un agenda_item
  //    nuevo cambiaría de id y dejaría huérfano el agreements.agenda_item_id.
  const { data: prevAgenda, error: ePrevAgenda } = await admin.from("agenda_items")
    .select("id, meeting_id, order_number, title, description, kind, matter_code, proposal_text, tenant_id")
    .eq("meeting_id", meetingId);
  if (ePrevAgenda) fail(`agenda_items lookup: ${ePrevAgenda.message}`);
  const agendaPorOrdinal = new Map((prevAgenda ?? []).map((a) => [a.order_number, a]));

  const idPorPunto = new Map<string, string>();
  for (const punto of conAcuerdo) {
    const fila = buildAgendaRow(meetingId, punto);
    const previo = agendaPorOrdinal.get(fila.order_number);
    if (!previo) {
      const { data, error } = await admin.from("agenda_items").insert(fila).select("id").single();
      if (error) fail(`agenda_items insert punto ${punto.numero}: ${error.message}`);
      idPorPunto.set(punto.numero, data.id);
      console.log(`✓ punto ${punto.numero} creado (ordinal ${fila.order_number})`);
      continue;
    }
    if (previo.tenant_id !== GARRIGUES_TENANT) {
      fail(`agenda_items ordinal ${fila.order_number} pertenece a otro tenant.`);
    }
    idPorPunto.set(punto.numero, previo.id);
    const sinCambios = Object.entries(fila).every(([k, v]) => canonical((previo as Record<string, unknown>)[k]) === canonical(v));
    if (sinCambios) { console.log(`= punto ${punto.numero} sin cambios`); continue; }
    const { error } = await admin.from("agenda_items").update(fila).eq("id", previo.id);
    if (error) fail(`agenda_items update punto ${punto.numero}: ${error.message}`);
    console.log(`✓ punto ${punto.numero} actualizado`);
  }

  // 2) El acuerdo. Idempotente por `ux_agreements_agenda_item_id`
  //    (tenant_id, agenda_item_id) WHERE adoption_mode='MEETING': la arista real
  //    es también la clave.
  const { data: prevAgreements, error: ePrevAg } = await admin.from("agreements")
    .select("id, tenant_id, agenda_item_id, agreement_kind, matter_class, inscribable, status, rule_pack_id, rule_pack_version, statutory_basis, proposal_text, decision_text, code, decision_date, adoption_mode, body_id, entity_id, parent_meeting_id, compliance_explain")
    .eq("tenant_id", GARRIGUES_TENANT).eq("parent_meeting_id", meetingId);
  if (ePrevAg) fail(`agreements lookup: ${ePrevAg.message}`);
  const agreementPorAgenda = new Map((prevAgreements ?? []).map((a) => [a.agenda_item_id, a]));

  const idsAcuerdo: Array<{ id: string; punto: string; materia: string }> = [];
  for (const punto of conAcuerdo) {
    const fila = buildAgreementRow({
      meetingId,
      bodyId: body.id,
      agendaItemId: idPorPunto.get(punto.numero)!,
      punto,
      clase: claseporMateria.get(punto.materia!)!,
      pack: packPorMateria.get(punto.materia!)!,
    });
    const previo = agreementPorAgenda.get(fila.agenda_item_id);
    if (!previo) {
      const { data, error } = await admin.from("agreements").insert(fila).select("id").single();
      if (error) fail(`agreements insert punto ${punto.numero}: ${error.message}`);
      idsAcuerdo.push({ id: data.id, punto: punto.numero, materia: fila.agreement_kind });
      console.log(`✓ acuerdo ${punto.numero} (${fila.agreement_kind}) creado`);
      continue;
    }
    idsAcuerdo.push({ id: previo.id, punto: punto.numero, materia: fila.agreement_kind });
    const sinCambios = Object.entries(fila).every(([k, v]) => canonical((previo as Record<string, unknown>)[k]) === canonical(v));
    if (sinCambios) { console.log(`= acuerdo ${punto.numero} sin cambios`); continue; }
    const { error } = await admin.from("agreements").update(fila).eq("id", previo.id);
    if (error) fail(`agreements update punto ${punto.numero}: ${error.message}`);
    console.log(`✓ acuerdo ${punto.numero} actualizado`);
  }

  // Un acuerdo del expediente que ya no esté en el orden del día es un residuo:
  // no se borra en silencio, se dice.
  const huerfanos = (prevAgreements ?? []).filter((a) => !idsAcuerdo.some((x) => x.id === a.id));
  if (huerfanos.length) {
    console.log(`⚠ ${huerfanos.length} acuerdo(s) de esta reunión fuera del orden del día actual: ${huerfanos.map((a) => a.agreement_kind).join(", ")}. No se tocan: decidir a mano.`);
  }

  // 3) Los requisitos documentales. NO se escriben a mano: los genera
  //    `fn_refresh_agreement_document_requirements`, que es quien decide si el
  //    gate INFORME_PRECEPTIVO_ORGANO aplica leyendo el config del órgano.
  //    Escribirlos desde el seed convertiría el gate en decorado.
  for (const a of idsAcuerdo) {
    const { error } = await admin.rpc("fn_refresh_agreement_document_requirements", { p_agreement_id: a.id });
    if (error) fail(`fn_refresh_agreement_document_requirements (${a.punto}): ${error.message}`);
  }

  // Verificación posterior: qué escribió de verdad la RPC, contra lo previsto.
  const { data: reqs, error: eReqs } = await admin.from("agreement_document_requirements")
    .select("agreement_id, requirement_code, blocking_policy, fase")
    .in("agreement_id", idsAcuerdo.map((a) => a.id))
    .eq("requirement_code", "INFORME_PRECEPTIVO_ORGANO");
  if (eReqs) fail(`agreement_document_requirements: ${eReqs.message}`);
  const conGate = new Set((reqs ?? []).map((r) => idsAcuerdo.find((a) => a.id === r.agreement_id)?.materia));
  const previstas = new Set(conAcuerdo.map((p) => p.materia!).filter((m) => materiasConGate.has(m)));
  if (canonical([...conGate].sort()) !== canonical([...previstas].sort())) {
    fail(`el gate del informe preceptivo disparó en {${[...conGate].join(", ")}} y el config del órgano dice {${[...previstas].join(", ")}}.`);
  }
  if ((reqs ?? []).some((r) => r.blocking_policy !== "BLOCKING" || r.fase !== "PRE_CONVOCATORIA")) {
    fail("el gate del informe preceptivo se escribió sin BLOCKING/PRE_CONVOCATORIA.");
  }
  console.log(`✓ ${idsAcuerdo.length} acuerdos con requisitos refrescados · gate INFORME_PRECEPTIVO_ORGANO en ${conGate.size}: ${[...conGate].join(", ")}`);

  // ── Task 7 · resoluciones y evaluación persistida ────────────────────────

  // 4) La resolución del punto. Idempotente por el índice único
  //    (tenant_id, meeting_id, agenda_item_index).
  //
  //    Por qué NO por `fn_save_meeting_resolutions`, que es la vía gobernada que
  //    usa el ReunionStepper (leída en Cloud antes de decidir):
  //      a) Borra TODAS las resoluciones y votos de la reunión y los reinserta.
  //         Los ids cambiarían en cada ejecución del seed, que es justo lo que
  //         este script evita en agenda_items y en la asistencia.
  //      b) Solo persiste la evaluación del motor si el `adoption_snapshot` trae
  //         `rule_trace.source = 'V2_CLOUD'` con `ruleset_snapshot_id`. Aquí no
  //         hay ningún ruleset snapshot y fabricar uno sería un rótulo.
  //      c) Ese `adoption_snapshot` lleva `vote_summary`: el escrutinio que el
  //         acta NO transcribe. Rellenarlo es exactamente lo que esta tarea se
  //         niega a hacer.
  //    El gate de producto que exige la RPC es específico del hook
  //    `useSaveMeetingResolutions` (ver `secretaria-p0-meeting-resolutions-rpc`),
  //    no de los seeds, que ya escriben agenda_items, agreements y asistencia
  //    por PostgREST.
  const { data: prevRes, error: ePrevRes } = await admin.from("meeting_resolutions")
    .select("id, tenant_id, meeting_id, agenda_item_index, resolution_text, resolution_type, required_majority_code, status, agreement_id, kind_resolution")
    .eq("meeting_id", meetingId).eq("tenant_id", GARRIGUES_TENANT);
  if (ePrevRes) fail(`meeting_resolutions lookup: ${ePrevRes.message}`);
  const resPorOrdinal = new Map((prevRes ?? []).map((r) => [r.agenda_item_index, r]));

  for (const punto of conAcuerdo) {
    const acuerdo = idsAcuerdo.find((a) => a.punto === punto.numero);
    if (!acuerdo) fail(`resolución: el punto ${punto.numero} no tiene acuerdo en Cloud.`);
    const fila = buildResolutionRow(meetingId, punto, acuerdo!.id);
    const previo = resPorOrdinal.get(fila.agenda_item_index);
    if (!previo) {
      const { error } = await admin.from("meeting_resolutions").insert(fila);
      if (error) fail(`meeting_resolutions insert punto ${punto.numero}: ${error.message}`);
      console.log(`✓ resolución del punto ${punto.numero} creada (ordinal ${fila.agenda_item_index})`);
      continue;
    }
    const sinCambios = Object.entries(fila).every(([k, v]) => canonical((previo as Record<string, unknown>)[k]) === canonical(v));
    if (sinCambios) { console.log(`= resolución del punto ${punto.numero} sin cambios`); continue; }
    const { error } = await admin.from("meeting_resolutions").update(fila).eq("id", previo.id);
    if (error) fail(`meeting_resolutions update punto ${punto.numero}: ${error.message}`);
    console.log(`✓ resolución del punto ${punto.numero} actualizada`);
  }

  // 5) `meeting_votes` NO se escribe. Se comprueba que sigue vacía: si alguien
  //    la rellenara después, el seed lo dice en vez de convivir con ello.
  const { data: resIds, error: eResIds } = await admin.from("meeting_resolutions")
    .select("id").eq("meeting_id", meetingId).eq("tenant_id", GARRIGUES_TENANT);
  if (eResIds) fail(`meeting_resolutions relectura: ${eResIds.message}`);
  const { data: votosEnCloud, error: eVotosCloud } = await admin.from("meeting_votes")
    .select("id").in("resolution_id", (resIds ?? []).map((r) => r.id));
  if (eVotosCloud) fail(`meeting_votes lookup: ${eVotosCloud.message}`);
  if ((votosEnCloud ?? []).length) {
    fail(`hay ${votosEnCloud.length} fila(s) en meeting_votes para esta Junta y no debería haber ninguna. ${MEETING_VOTES_VACIA}`);
  }
  console.log(`✓ meeting_votes: 0 filas (${(resIds ?? []).length} resoluciones). ${MEETING_VOTES_VACIA}`);

  // 6) La evaluación del motor. `rule_evaluation_results` es WORM: worm_guard()
  //    bloquea UPDATE y DELETE incluso para service_role. Si ya hay una
  //    evaluación del mismo punto con OTRO hash, el seed para: apilar una
  //    segunda dejaría dos veredictos del mismo punto sin poder retirar ninguno.
  const { data: prevEval, error: ePrevEval } = await admin.from("rule_evaluation_results")
    .select("id, agreement_id, etapa, evaluation_hash")
    .in("agreement_id", idsAcuerdo.map((a) => a.id));
  if (ePrevEval) fail(`rule_evaluation_results lookup: ${ePrevEval.message}`);
  const evalPrevia = new Map((prevEval ?? []).map((r) => [`${r.agreement_id}|${r.etapa}`, r]));

  let escritas = 0;
  for (const evaluacion of evaluaciones) {
    const acuerdo = idsAcuerdo.find((a) => a.punto === evaluacion.punto);
    if (!acuerdo) fail(`evaluación: el punto ${evaluacion.punto} no tiene acuerdo en Cloud.`);
    const pack = packPorMateria.get(evaluacion.materia)!;
    const fila = await buildRuleEvaluationRow({
      agreementId: acuerdo!.id,
      evaluacion,
      packVersionId: pack.versionId ?? null,
      packPayload: pack.payload,
    });
    const previa = evalPrevia.get(`${fila.agreement_id}|${fila.etapa}`);
    if (previa) {
      if (previa.evaluation_hash === fila.evaluation_hash) {
        console.log(`= evaluación del punto ${evaluacion.punto} ya persistida e idéntica`);
        continue;
      }
      fail(
        `la evaluación del punto ${evaluacion.punto} ya existe (${previa.id}) con otro hash: la regla, la base o la concurrencia han cambiado. ` +
        `rule_evaluation_results es WORM y la anterior no se puede retirar: decidir a mano.`,
      );
    }
    const { error } = await admin.from("rule_evaluation_results").insert(fila);
    if (error) fail(`rule_evaluation_results insert punto ${evaluacion.punto}: ${error.message}`);
    escritas += 1;
  }
  console.log(
    `✓ ${escritas} evaluación(es) del motor persistidas · ${evaluaciones.filter((e) => e.evaluable).length}/${evaluaciones.length} evaluables · sello ${SELLO_CLIENTE}`,
  );

  // ── Task 9 · el expediente registral de cada acuerdo inscribible ─────────

  // `registry_filings` NO tiene índice único ninguno —solo la PK— ni un solo
  // trigger (medido en Cloud). La clave de idempotencia es (tenant_id,
  // agreement_id), que aquí es 1:1 porque cada acuerdo tiene un expediente. Si
  // apareciera más de uno, el seed PARA: elegir cuál actualizar sería adivinar,
  // y `ExpedienteAcuerdo` pinta el más reciente por `created_at`.
  const { data: prevFilings, error: ePrevFilings } = await admin.from("registry_filings")
    .select("id, tenant_id, entity_id, agreement_id, workflow_version, filing_via, status, filing_number, presentation_date, estimated_resolution, inscription_number, borme_ref, registered_at, publication_reference, published_at, qualification_outcome, qualified_at, deed_id, deed_reference, deed_date, notary_id, notary_name, protocol_number, elevated_at, procedure_snapshot")
    .eq("tenant_id", GARRIGUES_TENANT);
  if (ePrevFilings) fail(`registry_filings lookup: ${ePrevFilings.message}`);
  const filingsPorAcuerdo = new Map<string, Record<string, unknown>>();
  for (const f of prevFilings ?? []) {
    const clave = String(f.agreement_id);
    if (filingsPorAcuerdo.has(clave)) {
      fail(`hay más de un registry_filings para el acuerdo ${clave}: parar y decidir a mano cuál es el del expediente.`);
    }
    filingsPorAcuerdo.set(clave, f as Record<string, unknown>);
  }

  const idsFiling: string[] = [];
  for (const punto of inscribibles) {
    const acuerdo = idsAcuerdo.find((a) => a.punto === punto.numero);
    if (!acuerdo) fail(`expediente registral: el punto ${punto.numero} no tiene acuerdo en Cloud.`);
    const fila = buildRegistryFilingRow({
      agreementId: acuerdo!.id,
      punto,
      clase: claseporMateria.get(punto.materia!)!,
    });
    const previo = filingsPorAcuerdo.get(acuerdo!.id);
    if (!previo) {
      const { data, error } = await admin.from("registry_filings").insert(fila).select("id").single();
      if (error) fail(`registry_filings insert punto ${punto.numero}: ${error.message}`);
      idsFiling.push(data.id);
      console.log(`✓ expediente registral del punto ${punto.numero} creado en ${fila.status}${fila.borme_ref ? ` · anuncio ${fila.borme_ref} · inscripción ${fila.inscription_number}` : " · sin inscripción acreditada"}`);
      continue;
    }
    idsFiling.push(String(previo.id));
    // `registered_at` es timestamptz: se escribe `2026-07-13T00:00:00.000Z` y
    // vuelve `2026-07-13 00:00:00+00`. Comparadas como texto NUNCA son iguales y
    // el seed reescribiría en cada ejecución diciendo «actualizado» sin que nada
    // haya cambiado — una señal falsa. Se comparan como instante.
    const sinCambios = Object.entries(fila).every(([k, v]) =>
      k === "registered_at"
        ? (v === null ? previo[k] === null : previo[k] !== null && Date.parse(String(previo[k])) === Date.parse(String(v)))
        : canonical(previo[k]) === canonical(v));
    if (sinCambios) { console.log(`= expediente registral del punto ${punto.numero} sin cambios`); continue; }
    const { error } = await admin.from("registry_filings").update(fila).eq("id", previo.id);
    if (error) fail(`registry_filings update punto ${punto.numero}: ${error.message}`);
    console.log(`✓ expediente registral del punto ${punto.numero} actualizado`);
  }

  // Un expediente del tenant que no corresponda a un acuerdo inscribible de esta
  // Junta es un residuo: no se borra en silencio, se dice.
  const filingsHuerfanos = (prevFilings ?? []).filter((f) => !idsFiling.includes(String(f.id)));
  if (filingsHuerfanos.length) {
    console.log(`⚠ ${filingsHuerfanos.length} registry_filings del tenant fuera de este expediente (acuerdos ${filingsHuerfanos.map((f) => f.agreement_id).join(", ")}). No se tocan: decidir a mano.`);
  }

  // Verificación posterior: lo que quedó escrito de verdad, contra lo acreditado.
  const { data: escritos, error: eEscritos } = await admin.from("registry_filings")
    .select("agreement_id, status, inscription_number, borme_ref, registered_at, presentation_date, notary_name, protocol_number, deed_date")
    .in("id", idsFiling);
  if (eEscritos) fail(`registry_filings relectura: ${eEscritos.message}`);
  const inscritos = (escritos ?? []).filter((f) => f.status === FILING_ESTADO_INSCRITA);
  if (inscritos.length !== conInscripcion.length) {
    fail(`registry_filings: ${inscritos.length} expediente(s) en ${FILING_ESTADO_INSCRITA} y la fuente acredita ${conInscripcion.length}.`);
  }
  // Ni una fecha, ni un asiento, ni un protocolo fuera de lo acreditado.
  const anuncios = new Set(inscritos.map((f) => `${f.borme_ref}|${f.inscription_number}`));
  if (anuncios.size !== inscripcionesDeLaJunta().length) {
    fail(`registry_filings: ${anuncios.size} anuncio(s) distintos entre los inscritos y la fuente acredita ${inscripcionesDeLaJunta().length}.`);
  }
  const inventado = (escritos ?? []).find((f) =>
    f.presentation_date !== null || f.notary_name !== null || f.protocol_number !== null || f.deed_date !== null
    || (f.status !== FILING_ESTADO_INSCRITA && (f.registered_at !== null || f.inscription_number !== null || f.borme_ref !== null)),
  );
  if (inventado) {
    fail(`registry_filings: el expediente del acuerdo ${inventado.agreement_id} tiene un dato que la fuente no acredita.`);
  }
  console.log(
    `✓ ${idsFiling.length} expediente(s) registral(es) · ${inscritos.length} ${FILING_ESTADO_INSCRITA} en ${anuncios.size} anuncio(s) del BORME · ${idsFiling.length - inscritos.length} en ${FILING_ESTADO_SIN_INSCRIPCION} sin fecha, sin anuncio y sin protocolo`,
  );
}

if (import.meta.main) main();
