#!/usr/bin/env bun
/**
 * Seed G4 Task 4 — obligaciones PBC/FT (Ley 10/2010) y controles del PPD del
 * tenant Garrigues (`00000000-…0002`).
 *
 * Fuente de verdad: `scripts/garrigues/normativo/obligaciones-pbcft.ts`
 * (OBLIGACIONES_PBCFT + CONTROLES_PPD). Este script NO reinterpreta el
 * catálogo: valida, resuelve referencias y escribe.
 *
 * Qué escribe:
 *  - `obligations`: code, title, source, legal_reference, criticality,
 *    periodicity, owner_body_id, policy_id (→ PBC-FT-10, el Manual PBC/FT
 *    sembrado por Task 3) y country_scope ["ES"].
 *  - `controls`: code, name, status, obligation_id, owner_body_id.
 *
 * Idempotencia: ni `obligations` ni `controls` tienen índice único sobre
 * (tenant_id, code) en Cloud — verificado en pg_indexes: solo el pkey sobre
 * `id`. Por eso el upsert va por `id` y el `id` se deriva de forma
 * determinista del code (SHA-256 → UUID). Re-ejecutar actualiza, nunca
 * duplica. No se hace DDL desde aquí.
 *
 * Contrato cero-cambio ARGA: este script solo toca filas de `…0002`. ARGA
 * (`…0001`) mantiene sus 5 obligaciones y 8 controles.
 *
 * ABORTA si: el target no es governance_OS, el catálogo no valida, algún slug
 * de comité no resuelve a un órgano real del tenant, o no existe la política
 * PBC-FT-10. Nunca sembrar NULL en silencio por una referencia rota.
 *
 * Uso: bun run scripts/seed-garrigues-obligaciones.ts [--commit]
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";
import {
  OBLIGACIONES_PBCFT,
  CONTROLES_PPD,
  MARCO_PBCFT,
  type ObligacionPbcFt,
  type ControlPpd,
} from "./garrigues/normativo/obligaciones-pbcft";



const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
// SERVICE_ROLE_SECRET es el nombre que usa el .env real de este repo; los
// seeds anteriores no lo contemplaban y obligaba a exportar la variable a mano.
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";

// El cliente NO esta tipado contra `Database` — ese es un hallazgo abierto del
// arbol, no algo que se arregle aqui. Lo que si se arregla: los helpers
// anotaban `ReturnType<typeof createClient>`, que instancia los genericos con
// sus valores POR DEFECTO (`unknown` / `never`) y no coincide con lo que
// devuelve la llamada real. Se deriva de la fabrica de verdad, asi que el tipo
// sigue al codigo aunque cambie la firma de createClient.
function crearAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
type AdminClient = ReturnType<typeof crearAdmin>;

const COMMIT = process.argv.includes("--commit");

const POLICY_CODE_PBCFT = "PBC-FT-10";

/**
 * Filas sembradas por una versión anterior de este catálogo que hay que
 * RETIRAR de Cloud, no solo dejar de sembrar. El seed es upsert: sin esto, una
 * fila retirada del catálogo sobrevive en el dato y sigue pintándose.
 *
 * `CTR-GARR-22` afirmaba «Remisión de la comunicación sistemática al Servicio
 * Ejecutivo, incluida la comunicación negativa». El despacho está exceptuado
 * de esa obligación (RD 304/2014, art. 27.3) y no la ejecuta: dejar el control
 * vivo sería mantener en pantalla una afirmación falsa sobre el cliente.
 *
 * Solo se borra dentro del tenant Garrigues y solo con los prefijos de esta
 * tarea; nunca puede alcanzar a ARGA ni a filas de otro origen.
 */
const CODIGOS_RETIRADOS = {
  obligations: [] as string[],
  controls: ["CTR-GARR-22"],
};
// CHECK reales en Cloud. Repetidos aquí para que el catálogo reviente en el
// dry-run y no en el INSERT.
const CRITICALITY_OK = new Set(["Crítico", "Alto", "Medio", "Bajo"]);
const STATUS_OK = new Set(["Efectivo", "Parcial", "Inefectivo"]);

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);

/** UUID determinista a partir del code, para que el upsert por pkey sea idempotente. */
async function stableId(kind: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`garrigues:g4:${kind}:${code}`),
  );
  const b = Array.from(new Uint8Array(digest).slice(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // versión 5 (nominal)
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validateCatalog() {
  const oblCodes = new Set<string>();
  for (const o of OBLIGACIONES_PBCFT) {
    if (!o.code.startsWith("OBL-PBC-")) fail(`${o.code}: prefijo no permitido (debe ser OBL-PBC-).`);
    if (oblCodes.has(o.code)) fail(`${o.code}: código duplicado en el catálogo.`);
    oblCodes.add(o.code);
    if (!CRITICALITY_OK.has(o.criticality)) fail(`${o.code}: criticality "${o.criticality}" fuera del CHECK.`);
    if (!o.legal_reference.includes("Ley 10/2010")) fail(`${o.code}: legal_reference sin cita a la Ley 10/2010.`);
    // El artículo va en legal_reference. `source` es el marco y es un único
    // valor para todas: /obligaciones deriva de él sus secciones y su filtro.
    if (!/art\. \d/.test(o.legal_reference)) fail(`${o.code}: legal_reference sin artículo.`);
    if (!o.quote.trim()) fail(`${o.code}: sin literal del BOE que respalde la cita.`);
    // Un criterio no confirmado por el Comité Legal no puede llegar a pantalla
    // sin la cautela: `title` es lo que se pinta.
    if (o.firmeza === "DEMO_PILOTO" && !o.title.includes("DEMO_PILOTO")) {
      fail(`${o.code}: firmeza DEMO_PILOTO sin la cautela en el título.`);
    }
  }
  const ctrCodes = new Set<string>();
  for (const c of CONTROLES_PPD) {
    if (!c.code.startsWith("CTR-GARR-")) fail(`${c.code}: prefijo no permitido (debe ser CTR-GARR-).`);
    if (ctrCodes.has(c.code)) fail(`${c.code}: código duplicado en el catálogo.`);
    ctrCodes.add(c.code);
    if (!STATUS_OK.has(c.status)) fail(`${c.code}: status "${c.status}" fuera del CHECK.`);
    if (!oblCodes.has(c.obligation_code)) fail(`${c.code}: cubre "${c.obligation_code}", que no está en el catálogo.`);
  }
  for (const c of CODIGOS_RETIRADOS.controls) {
    if (ctrCodes.has(c)) fail(`${c}: está a la vez en el catálogo y en CODIGOS_RETIRADOS.`);
    if (!c.startsWith("CTR-GARR-")) fail(`${c}: código retirado fuera del prefijo de esta tarea.`);
  }
  for (const o of CODIGOS_RETIRADOS.obligations) {
    if (oblCodes.has(o)) fail(`${o}: está a la vez en el catálogo y en CODIGOS_RETIRADOS.`);
    if (!o.startsWith("OBL-PBC-")) fail(`${o}: código retirado fuera del prefijo de esta tarea.`);
  }
  const sinControl = OBLIGACIONES_PBCFT.filter((o) => !CONTROLES_PPD.some((c) => c.obligation_code === o.code));
  if (sinControl.length > 0) {
    // No es un fallo: es una advertencia. Una obligación sin control se pinta
    // en /obligaciones como "SIN CONTROL — acción inmediata requerida", que en
    // una demo ante el propio despacho es una afirmación fuerte.
    console.warn(`⚠ Obligaciones sin control (saldrán como "SIN CONTROL"): ${sinControl.map((o) => o.code).join(", ")}`);
  }
}

type Body = { id: string; name: string };

async function resolveOwnerSlugs(admin: AdminClient): Promise<Map<string, Body>> {
  const slugs = Array.from(
    new Set([...OBLIGACIONES_PBCFT.map((o) => o.owner_slug), ...CONTROLES_PPD.map((c) => c.owner_slug)]),
  );
  const { data, error } = await admin
    .from("governing_bodies")
    .select("id, slug, name")
    .eq("tenant_id", GARRIGUES_TENANT)
    .in("slug", slugs);
  if (error) fail(`governing_bodies select: ${error.message}`);

  const bySlug = new Map(
    (data ?? []).map((r: Record<string, unknown>) => [r.slug as string, { id: r.id as string, name: r.name as string }]),
  );
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) fail(`slug(s) sin fila en governing_bodies (tenant Garrigues): ${missing.join(", ")}`);
  return bySlug;
}

async function resolvePolicyId(admin: AdminClient): Promise<string> {
  const { data, error } = await admin
    .from("policies")
    .select("id")
    .eq("tenant_id", GARRIGUES_TENANT)
    .eq("policy_code", POLICY_CODE_PBCFT)
    .maybeSingle();
  if (error) fail(`policies select: ${error.message}`);
  if (!data) fail(`No existe la política ${POLICY_CODE_PBCFT} en el tenant Garrigues. ¿Se ejecutó Task 3?`);
  return (data as { id: string }).id;
}

async function buildObligationRow(o: ObligacionPbcFt, owners: Map<string, Body>, policyId: string) {
  return {
    id: await stableId("obligation", o.code),
    tenant_id: GARRIGUES_TENANT,
    code: o.code,
    title: o.title,
    source: MARCO_PBCFT,
    legal_reference: o.legal_reference,
    criticality: o.criticality,
    periodicity: o.periodicity,
    owner_body_id: owners.get(o.owner_slug)!.id,
    policy_id: policyId,
    country_scope: ["ES"],
  };
}

async function buildControlRow(c: ControlPpd, owners: Map<string, Body>) {
  return {
    id: await stableId("control", c.code),
    tenant_id: GARRIGUES_TENANT,
    code: c.code,
    name: c.name,
    status: c.status,
    obligation_id: await stableId("obligation", c.obligation_code),
    owner_body_id: owners.get(c.owner_slug)!.id,
  };
}

async function main() {
  validateCatalog();
  console.log(
    `G4 Task 4 — PBC/FT Garrigues: ${OBLIGACIONES_PBCFT.length} filas en obligations (2 exclusiones etiquetadas: art. 22 y RD 304/2014 art. 27.3) y ${CONTROLES_PPD.length} controles.`,
  );
  console.log(`Marco único en obligations.source: "${MARCO_PBCFT}" (1 valor distinto para las ${OBLIGACIONES_PBCFT.length} filas).`);
  console.table(
    OBLIGACIONES_PBCFT.map((o) => ({
      code: o.code,
      articulo: o.legal_reference.replace("Ley 10/2010, de 28 de abril, ", ""),
      firmeza: o.firmeza ?? "FIRME",
      criticidad: o.criticality,
      periodicidad: o.periodicity,
      comite: o.owner_slug,
      controles: CONTROLES_PPD.filter((c) => c.obligation_code === o.code).length,
    })),
  );
  console.table(
    CONTROLES_PPD.map((c) => ({ code: c.code, estado: c.status, cubre: c.obligation_code, comite: c.owner_slug })),
  );

  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar contra Cloud (requiere service-role key).");
    return;
  }
  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);

  const admin = crearAdmin();
  const owners = await resolveOwnerSlugs(admin);
  const policyId = await resolvePolicyId(admin);

  const obligationRows = await Promise.all(OBLIGACIONES_PBCFT.map((o) => buildObligationRow(o, owners, policyId)));
  const { error: oblErr } = await admin.from("obligations").upsert(obligationRows, { onConflict: "id" });
  if (oblErr) fail(`obligations upsert: ${oblErr.message}`);

  const controlRows = await Promise.all(CONTROLES_PPD.map((c) => buildControlRow(c, owners)));
  const { error: ctrErr } = await admin.from("controls").upsert(controlRows, { onConflict: "id" });
  if (ctrErr) fail(`controls upsert: ${ctrErr.message}`);

  // Retirada de filas de versiones anteriores del catálogo. Va después del
  // upsert para no dejar una obligación sin control en el intervalo.
  for (const [table, codes] of [
    ["controls", CODIGOS_RETIRADOS.controls],
    ["obligations", CODIGOS_RETIRADOS.obligations],
  ] as const) {
    if (codes.length === 0) continue;
    const { error, count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq("tenant_id", GARRIGUES_TENANT)
      .in("code", codes);
    if (error) fail(`${table} delete de retirados: ${error.message}`);
    console.log(`✓ Retiradas ${count ?? 0} fila(s) de ${table}: ${codes.join(", ")}`);
  }

  console.log(`✓ Seed completado (idempotente) — ${obligationRows.length} obligaciones, ${controlRows.length} controles.`);
}

main();
