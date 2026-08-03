#!/usr/bin/env bun
/**
 * Seed G2 — Libros societarios de la matriz + delegaciones reales.
 *
 * Libros (mandatory_books, SIN guard autoritativo — a diferencia de
 * condiciones_persona en seed-garrigues-gobierno.ts, aquí no hay trigger que
 * bloquee INSERT/UPDATE directo; se hace upsert directo select-then-write):
 *   - LIBRO_REGISTRO_SOCIOS: el trigger fn_seed_mandatory_books (migración
 *     20260719231000) NO lo crea automáticamente para la matriz porque su
 *     tipo real es SLP y el switch de esa función solo cubre SL/SLU/SA/SAU
 *     — este script es su única vía de alta.
 *   - LIBRO_ACTAS_JUNTA_GENERAL: puede que YA exista, creado automáticamente
 *     por trg_governing_bodies_seed_mandatory_book cuando Task 3 insertó el
 *     body JUNTA (fn_acta_book_kind_for_body mapea body_type='JUNTA' a este
 *     book_kind, con period = año en curso). El upsert por
 *     (tenant_id, entity_id, book_kind, period) converge sin duplicar tanto
 *     si el trigger ya lo creó como si no.
 *   Shape real sondado por el controller (Step 1, information_schema): NOT
 *   NULL sin default = tenant_id, book_kind, period; NO existe `book_type`
 *   (typo del esqueleto original del brief). Ambos libros: period 2026,
 *   status OPEN, book_group LIBRO_MERCANTIL, opened_at 2026-01-02,
 *   requires_legalization true, legalization_requirement OBLIGATORIA,
 *   legalization_status PENDIENTE, volume_number 1.
 *
 * Delegaciones (delegations, tampoco con guard — upsert directo por slug):
 *   status usa vocabulario real con CHECK ('Vigente'|'Caducada'|'Revocada')
 *   — NUNCA "Activa" (placeholder incorrecto del esqueleto original);
 *   delegation_type es texto libre descriptivo, sin CHECK. Las 2 filas:
 *   - GARR-DEL-2026-01: punto 11 de la Junta de Socios de 06/05/2026,
 *     delegada en Fernando Vives Ruiz (elevar a público/subsanar/inscribir;
 *     también a los apoderados de la Sociedad).
 *   - GARR-DEL-EAD-CD: Consejero Delegado de EAD Trust, Eduardo Inza Blasco
 *     (delegación inscrita desde 03/05/2023; fuente BORME/RM).
 *   Ambas personas ya sembradas en Task 2/3 — lookup por (tenant_id,
 *   full_name) con .maybeSingle(), falla claro si no están.
 *
 * Estructura idéntica a los seeds hermanos: guard target/key, dry-run con
 * console.table, --commit, idempotencia por clave natural. Nada de esto
 * toca condiciones_persona ni ninguna tabla con RPC autoritativa.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function personIdByName(nombre) {
  const { data, error } = await admin.from("persons").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
  if (error) fail(`persons select '${nombre}': ${error.message}`);
  if (!data) fail(`persona no sembrada: ${nombre}`);
  return data.id;
}

// Sin RPC autoritativa de por medio (a diferencia de condiciones_persona):
// select-then-write directo, idéntico al patrón de ensureHolding/ensureBody
// de los seeds hermanos.
async function ensureBook(book) {
  const { data, error } = await admin.from("mandatory_books").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", book.entity_id)
    .eq("book_kind", book.book_kind).eq("period", book.period).maybeSingle();
  if (error) fail(`mandatory_books select ${book.book_kind}: ${error.message}`);
  const row = { tenant_id: GARRIGUES_TENANT, ...book };
  if (data) {
    const { error: eU } = await admin.from("mandatory_books").update(row).eq("id", data.id);
    if (eU) fail(`mandatory_books update ${book.book_kind}: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("mandatory_books").insert(row).select("id").single();
  if (eI) fail(`mandatory_books insert ${book.book_kind}: ${eI.message}`);
  return ins.id;
}

async function ensureDelegation(d) {
  const { data, error } = await admin.from("delegations").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("slug", d.slug).maybeSingle();
  if (error) fail(`delegations select ${d.slug}: ${error.message}`);
  const row = { tenant_id: GARRIGUES_TENANT, ...d };
  if (data) {
    const { error: eU } = await admin.from("delegations").update(row).eq("id", data.id);
    if (eU) fail(`delegations update ${d.slug}: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("delegations").insert(row).select("id").single();
  if (eI) fail(`delegations insert ${d.slug}: ${eI.message}`);
  return ins.id;
}

const libros = [
  {
    nombre: "Libro registro de socios",
    book_kind: "LIBRO_REGISTRO_SOCIOS",
    entity_id: GARRIGUES_MATRIZ_UUID,
    period: 2026,
    status: "OPEN",
    book_group: "LIBRO_MERCANTIL",
    opened_at: "2026-01-02",
    requires_legalization: true,
    legalization_requirement: "OBLIGATORIA",
    legalization_status: "PENDIENTE",
    volume_number: 1,
  },
  {
    nombre: "Libro de actas de la Junta General",
    book_kind: "LIBRO_ACTAS_JUNTA_GENERAL",
    entity_id: GARRIGUES_MATRIZ_UUID,
    period: 2026,
    status: "OPEN",
    book_group: "LIBRO_MERCANTIL",
    opened_at: "2026-01-02",
    requires_legalization: true,
    legalization_requirement: "OBLIGATORIA",
    legalization_status: "PENDIENTE",
    volume_number: 1,
  },
];

// delegado_nombre se resuelve a delegate_id solo en COMMIT (requiere Cloud);
// el resto de campos es local y se puede previsualizar siempre.
const delegacionesPlan = [
  {
    code: "GARR-DEL-2026-01",
    slug: "garrigues-delegacion-junta-2026",
    delegation_type: "Delegación de facultades — elevación e inscripción de acuerdos",
    status: "Vigente",
    entity_id: GARRIGUES_MATRIZ_UUID,
    delegado_nombre: "Fernando Vives Ruiz",
    scope: "Elevar a público, subsanar e inscribir los acuerdos de la Junta de Socios de 06/05/2026 (punto 11 del orden del día); facultades también a los apoderados de la Sociedad",
    start_date: "2026-05-06",
  },
  {
    code: "GARR-DEL-EAD-CD",
    slug: "garrigues-delegacion-ead-cd",
    delegation_type: "Delegación de facultades — Consejero Delegado",
    status: "Vigente",
    entity_id: EAD_ENTITY,
    delegado_nombre: "Eduardo Inza Blasco",
    scope: "Delegación de facultades del Consejo en el Consejero Delegado (inscrita; fuente BORME/RM, cosecha 2026-08-03)",
    start_date: "2023-05-03",
  },
];

async function main() {
  console.table(libros.map((l) => ({ libro: l.nombre, book_kind: l.book_kind, period: l.period })));
  console.table(delegacionesPlan.map((d) => ({ code: d.code, delegado: d.delegado_nombre, entity_id: d.entity_id })));
  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar.");
    return;
  }

  for (const l of libros) {
    const { nombre, ...book } = l;
    await ensureBook(book);
  }
  console.log(`✓ ${libros.length} libros societarios (idempotente por tenant_id+entity_id+book_kind+period)`);

  for (const d of delegacionesPlan) {
    const { delegado_nombre, ...rest } = d;
    const delegate_id = await personIdByName(delegado_nombre);
    await ensureDelegation({ ...rest, delegate_id });
  }
  console.log(`✓ ${delegacionesPlan.length} delegaciones reales (idempotente por slug)`);
}
main();
