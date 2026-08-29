#!/usr/bin/env bun
/**
 * Seed C1 — expediente de la Junta General de Socios de Garrigues (06/05/2026).
 *
 * **Task 4: solo la convocatoria.** La reunión, la asistencia y el censo WORM son
 * Task 5, que está BLOQUEADA por una decisión legal pendiente. Este script no crea
 * `meetings` ni `censo_snapshot`.
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
 * Ninguna superficie de este seed afirma envío, entrega, acuse ni interacción real
 * con EAD Trust. `publication_channels` describe el canal estatutario del acto
 * real. Todo artefacto es reconstrucción demo sin efecto jurídico.
 *
 * Uso: `bun run scripts/seed-garrigues-junta-2026.ts` (dry-run) / `--commit`.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";
import {
  ANTELACION_DIAS,
  CANAL_ESTATUTARIO,
  CONVOCATORIA_SLUG,
  FECHA_1_ISO,
  FECHA_CARTA_CONVOCATORIA,
  FECHA_JUNTA,
  LUGAR_JUNTA,
  ORDEN_DEL_DIA,
  ORGANO_SLUG,
  STATUTORY_BASIS,
  convocatoriaText,
  puntosQueMaterializan,
  puntosSinMateriaAcreditada,
} from "./garrigues/junta-2026/orden-del-dia";

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
}

if (import.meta.main) main();
