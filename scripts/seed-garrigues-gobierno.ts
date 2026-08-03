#!/usr/bin/env bun
/**
 * Seed G2 — Gobierno de la matriz: personas + condiciones + comités + consejo EAD.
 * Fases (ejecutar en orden, cada una idempotente):
 *   bun run scripts/seed-garrigues-gobierno.ts --personas [--commit]  # censo 346 + no-socios + SOCIO/ADMIN_UNICO/metadata SP
 *   bun run scripts/seed-garrigues-gobierno.ts --comites  [--commit]  # membresías body-scoped + consejo EAD (REQUIERE bodies de seed-garrigues-bodies)
 *
 * - Personas: lookup por (tenant_id, full_name) — sin homónimos (garantizado por
 *   los tests de Task 1 sobre el catálogo).
 * - Condiciones: clave natural (person, entity, body, tipo_condicion) con
 *   estado VIGENTE; body_id NULL para condiciones a nivel de matriz (SOCIO,
 *   ADMIN_UNICO) y con valor para membresías de comités/consejo EAD.
 * - Consume scripts/garrigues/gobierno/governance-catalog.ts (Task 1) y las
 *   constantes GARRIGUES_TENANT/GARRIGUES_MATRIZ_UUID de ./garrigues/entities-catalog.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const FASE_PERSONAS = process.argv.includes("--personas");
const FASE_COMITES = process.argv.includes("--comites");
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);
if (!FASE_PERSONAS && !FASE_COMITES) fail("Indica la fase: --personas o --comites");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

async function personIdByName(nombre) {
  const { data, error } = await admin.from("persons")
    .select("id").eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
  if (error) fail(`persons select '${nombre}': ${error.message}`);
  return data?.id ?? null;
}

async function ensurePerson(nombre, extra = {}) {
  const existing = await personIdByName(nombre);
  if (existing) return existing;
  const { data, error } = await admin.from("persons")
    .insert({ tenant_id: GARRIGUES_TENANT, full_name: nombre, person_type: "PF", ...extra })
    .select("id").single();
  if (error) fail(`persons insert '${nombre}': ${error.message}`);
  return data.id;
}

async function ensureCondicion(row) {
  let q = admin.from("condiciones_persona").select("id, metadata")
    .eq("tenant_id", GARRIGUES_TENANT)
    .eq("person_id", row.person_id).eq("entity_id", row.entity_id)
    .eq("tipo_condicion", row.tipo_condicion);
  q = row.body_id ? q.eq("body_id", row.body_id) : q.is("body_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) fail(`condiciones select: ${error.message}`);
  if (data) {
    // Merge superficial: una condición ya sembrada puede llevar metadata añadida
    // fuera de este helper (p. ej. el cargo de senior partner sobre la SOCIO de
    // Zarza, escrito directamente por fasePersonas()). Re-ejecutar --personas o
    // --comites NO debe machacar esa metadata previa con la de esta llamada.
    const metadata = { ...(data.metadata ?? {}), ...(row.metadata ?? {}) };
    const { error: eU } = await admin.from("condiciones_persona")
      .update({ estado: "VIGENTE", ...row, metadata }).eq("id", data.id);
    if (eU) fail(`condiciones update: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("condiciones_persona")
    .insert({ tenant_id: GARRIGUES_TENANT, estado: "VIGENTE", ...row }).select("id").single();
  if (eI) fail(`condiciones insert: ${eI.message}`);
  return ins.id;
}

async function fasePersonas() {
  const noSocios = new Map();
  for (const e of cat.estructuras) {
    for (const m of e.miembros) {
      if (!m.esSocioCenso) noSocios.set(m.nombreCanonico, m.categoria);
    }
  }
  console.table([
    { dato: "socios del censo", valor: cat.censo.todos.length },
    { dato: "personas de comités no-censo", valor: noSocios.size },
  ]);
  if (!COMMIT) {
    console.log("Dry-run (fase personas). Añade --commit para ejecutar.");
    return;
  }

  for (const nombre of cat.censo.todos) {
    const pid = await ensurePerson(nombre);
    await ensureCondicion({
      person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
      tipo_condicion: "SOCIO", fecha_inicio: "2026-05-06",
      metadata: { fuente: "Censo acta Junta 06/05/2026 (depósito RM)", categoria: "SOCIO" },
    });
  }
  console.log(`✓ ${cat.censo.todos.length} socios con condición SOCIO`);

  for (const [nombre, categoria] of noSocios) {
    await ensurePerson(nombre, { denomination: categoria });
  }
  console.log(`✓ ${noSocios.size} personas de comités (no censo)`);

  const vives = await personIdByName(cat.adminUnico.nombreCenso);
  if (!vives) fail("Vives no encontrado tras sembrar el censo");
  await ensureCondicion({
    person_id: vives, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
    tipo_condicion: "ADMIN_UNICO",
    fecha_inicio: cat.adminUnico.fechaInicio, fecha_fin: cat.adminUnico.fechaFin,
    inscripcion_rm_referencia: cat.adminUnico.inscripcionRef,
    inscripcion_rm_fecha: cat.adminUnico.inscripcionFecha,
    metadata: { nota: cat.adminUnico.nota },
  });
  console.log("✓ ADMIN_UNICO Vives con inscripción registral");

  const zarza = await personIdByName(cat.seniorPartner.nombreCenso);
  if (!zarza) fail("Zarza no encontrada tras sembrar el censo");
  const { data: condZ, error: eZ } = await admin.from("condiciones_persona")
    .select("id, metadata").eq("tenant_id", GARRIGUES_TENANT)
    .eq("person_id", zarza).eq("entity_id", GARRIGUES_MATRIZ_UUID)
    .eq("tipo_condicion", "SOCIO").is("body_id", null).maybeSingle();
  if (eZ || !condZ) fail(`Condición SOCIO de Zarza no localizada: ${eZ?.message ?? "sin fila"}`);
  const { error: eZu } = await admin.from("condiciones_persona")
    .update({ metadata: { ...(condZ.metadata ?? {}), cargo: cat.seniorPartner.cargoMetadata, nota: cat.seniorPartner.nota } })
    .eq("id", condZ.id);
  if (eZu) fail(`metadata senior partner: ${eZu.message}`);
  console.log("✓ Senior partner (metadata sobre la condición SOCIO de Zarza)");
}

async function faseComites() {
  const { data: bodies, error: eB } = await admin.from("governing_bodies")
    .select("id, slug").eq("tenant_id", GARRIGUES_TENANT);
  if (eB) fail(`governing_bodies: ${eB.message}`);
  const bodyBySlug = new Map((bodies ?? []).map((b) => [b.slug, b.id]));

  let membresias = 0;
  for (const e of cat.estructuras) {
    const bodyId = bodyBySlug.get(`garrigues-${e.slug}`);
    if (!bodyId) fail(`Body no encontrado para ${e.slug} — ejecuta antes seed-garrigues-bodies`);
    for (const m of e.miembros) {
      const pid = await personIdByName(m.nombreCanonico);
      if (!pid) fail(`Persona no sembrada: ${m.nombreCanonico} (fase --personas primero)`);
      await ensureCondicion({
        person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: bodyId,
        tipo_condicion: m.rol === "PRESIDE" ? "PRESIDENTE" : "CONSEJERO",
        metadata: { categoria: m.categoria, rol_comite: m.rol ?? "VOCAL", naturaleza: "CONSULTIVO" },
      });
      membresias += 1;
    }
  }
  console.log(`✓ ${membresias} membresías de estructuras consultivas`);

  const eadBody = bodyBySlug.get("garrigues-ead-cda");
  if (!eadBody) fail("Body garrigues-ead-cda no encontrado — ejecuta antes seed-garrigues-bodies");
  for (const c of cat.eadBoard) {
    const pid = await ensurePerson(c.nombre);
    await ensureCondicion({
      person_id: pid, entity_id: EAD_ENTITY, body_id: eadBody,
      tipo_condicion: c.tipoCondicion, fecha_inicio: c.desde,
      metadata: { ...(c.metadata ?? {}), fuente: cat.fuenteEad },
    });
  }
  console.log("✓ Consejo de EAD Trust (7 cargos verificados)");
}

async function main() {
  if (FASE_PERSONAS) await fasePersonas();
  if (FASE_COMITES) {
    if (!COMMIT) {
      console.log("Dry-run (fase comités; se listaría el plan). Añade --commit para ejecutar.");
      return;
    }
    await faseComites();
  }
  console.log("✓ Fase completada (idempotente).");
}
main();
