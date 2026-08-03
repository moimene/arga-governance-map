#!/usr/bin/env bun
/**
 * Seed G2 — Gobierno de la matriz: personas + condiciones + comités + consejo EAD.
 * Fases (ejecutar en orden, cada una idempotente):
 *   bun run scripts/seed-garrigues-gobierno.ts --personas [--commit]  # censo 346 + no-socios + SOCIO/ADMIN_UNICO
 *   bun run scripts/seed-garrigues-gobierno.ts --comites  [--commit]  # membresías body-scoped + consejo EAD (REQUIERE bodies de seed-garrigues-bodies)
 *
 * MECANISMO AUTORITATIVO (ronda de fix 1, hallazgo del controller verificado en
 * Cloud): `condiciones_persona` lleva un trigger AUTHORITATIVE_WRITE_RPC_REQUIRED
 * — ni service_role puede INSERT/UPDATE la tabla directamente. Toda alta pasa por
 * la RPC `fn_designar_cargo` (SECURITY DEFINER, grant a service_role, idempotente
 * por `p_idempotency_key`: reintentar con la misma key devuelve el mismo uuid sin
 * duplicar). `designarCargo()` es el único punto de escritura de este script
 * sobre esa tabla.
 *
 * PASE COMPLEMENTARIO: `fn_designar_cargo` no acepta `metadata` ni `fecha_fin`
 * (no están en su firma). Lo que depende de esos 2 campos — fecha_fin + nota de
 * reelección de Vives, cargo de senior partner de Zarza, flags
 * consejero_delegado/no_consejero del consejo EAD — NO se escribe desde este
 * script. La fase --personas EMITE (siempre, también en dry-run, porque es una
 * escritura local a disco que no toca Cloud) el fichero
 * `scripts/garrigues/gobierno/g2-metadata-complementaria.sql`, que el controller
 * ejecuta aparte vía MCP execute_sql (requiere el GUC
 * `secretaria.authoritative_writer` para saltarse el mismo trigger desde SQL
 * directo como postgres).
 *
 * - Personas: lookup por (tenant_id, full_name) — sin homónimos (garantizado por
 *   los tests de Task 1 sobre el catálogo).
 * - Condiciones: clave natural (person, entity, body, tipo_condicion); la RPC
 *   decide alta/actualización e idempotencia internamente, este script no hace
 *   SELECT previo.
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

// Pase complementario: contenido EXACTO acordado con el controller (ronda de fix
// 1). Cubre solo lo que fn_designar_cargo no acepta (metadata/fecha_fin) para
// las 4 filas concretas que lo necesitan — no se inventan columnas adicionales
// para otras filas (p. ej. las membresías de comité NO llevan metadata aquí).
const SQL_COMPLEMENTARIA_REL = "garrigues/gobierno/g2-metadata-complementaria.sql";
const SQL_COMPLEMENTARIA_PATH = `${import.meta.dir}/${SQL_COMPLEMENTARIA_REL}`;
const SQL_COMPLEMENTARIA = `-- G2 pase complementario (metadata/fecha_fin que fn_designar_cargo no acepta).
-- Ejecutar vía MCP execute_sql (current_user=postgres). El GUC habilita el
-- guard autoritativo para esta sesión.
SELECT set_config('secretaria.authoritative_writer', 'fn_registrar_inscripcion_rm_cargo', false);

UPDATE condiciones_persona SET
  fecha_fin = '2032-06-30',
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"nota":"Reelección por 6 años (Junta 06/05/2026); mandato anterior vencía 31/01/2028"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'ADMIN_UNICO'
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Fernando Vives Ruiz');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"cargo":"SENIOR_PARTNER","nota":"Preside el Consejo de Socios (art. 29 Estatutos); supervisa PPD y PBC/FT"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'SOCIO' AND body_id IS NULL
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Rosa Zarza Jimeno');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"consejero_delegado":true,"fuente":"BORME (delegación inscrita desde 03/05/2023)"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'CONSEJERO'
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Eduardo Inza Blasco');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"no_consejero":true}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion IN ('SECRETARIO','VICESECRETARIO')
  AND person_id IN (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name IN ('Roberto Delgado Gil','Belén Aguayo'));

SELECT set_config('secretaria.authoritative_writer', '', false);
`;

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

// Único punto de escritura sobre condiciones_persona: el trigger autoritativo
// bloquea INSERT/UPDATE directo, así que no hay branch select-then-upsert aquí
// (a diferencia de ensurePerson) — la RPC decide todo, incluida idempotencia.
async function designarCargo(row) {
  const { data, error } = await admin.rpc("fn_designar_cargo", {
    p_tenant_id: GARRIGUES_TENANT,
    p_person_id: row.person_id,
    p_entity_id: row.entity_id,
    p_body_id: row.body_id ?? null,
    p_tipo_condicion: row.tipo_condicion,
    p_fecha_inicio: row.fecha_inicio ?? null,
    p_fuente_designacion: row.fuente_designacion,
    p_inscripcion_rm_referencia: row.inscripcion_rm_referencia ?? null,
    p_inscripcion_rm_fecha: row.inscripcion_rm_fecha ?? null,
    p_representative_person_id: null,
    p_cesar_singleton_previo: false,
    p_idempotency_key: row.idempotency_key,
  });
  if (error) fail(`fn_designar_cargo (${row.idempotency_key}): ${error.message}`);
  return data;
}

async function fasePersonas() {
  // Se emite SIEMPRE, incluso en dry-run: es una escritura local a disco, no
  // toca Cloud, y el controller necesita el fichero exista para poder correrlo
  // aparte por MCP execute_sql tras el --commit de esta fase.
  try {
    await Bun.write(SQL_COMPLEMENTARIA_PATH, SQL_COMPLEMENTARIA);
  } catch (e) {
    fail(`Escribiendo ${SQL_COMPLEMENTARIA_REL}: ${e instanceof Error ? e.message : String(e)}`);
  }
  console.log(`✓ Emitido ${SQL_COMPLEMENTARIA_REL} (pase complementario metadata/fecha_fin — ejecútalo el controller vía MCP execute_sql)`);

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
    await designarCargo({
      person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
      tipo_condicion: "SOCIO", fecha_inicio: "2026-05-06",
      fuente_designacion: "BOOTSTRAP",
      idempotency_key: `g2:SOCIO:${pid}:${GARRIGUES_MATRIZ_UUID}`,
    });
  }
  console.log(`✓ ${cat.censo.todos.length} socios con condición SOCIO`);

  for (const [nombre, categoria] of noSocios) {
    await ensurePerson(nombre, { denomination: categoria });
  }
  console.log(`✓ ${noSocios.size} personas de comités (no censo)`);

  const vives = await personIdByName(cat.adminUnico.nombreCenso);
  if (!vives) fail("Vives no encontrado tras sembrar el censo");
  await designarCargo({
    person_id: vives, entity_id: GARRIGUES_MATRIZ_UUID, body_id: null,
    tipo_condicion: "ADMIN_UNICO", fecha_inicio: cat.adminUnico.fechaInicio,
    fuente_designacion: "ACTA_NOMBRAMIENTO",
    inscripcion_rm_referencia: cat.adminUnico.inscripcionRef,
    inscripcion_rm_fecha: cat.adminUnico.inscripcionFecha,
    idempotency_key: `g2:ADMIN_UNICO:${vives}:${GARRIGUES_MATRIZ_UUID}`,
  });
  console.log("✓ ADMIN_UNICO Vives (fecha_fin + nota de reelección: pase complementario SQL)");
  console.log("✓ Senior partner (Zarza): ya es SOCIO por el loop de arriba; cargo/nota van en el pase complementario SQL");
}

async function faseComites() {
  // Igual que fasePersonas(): estadísticas locales del catálogo primero (sin
  // Cloud), para que el dry-run sea informativo también en esta fase.
  const totalMiembros = cat.estructuras.reduce((acc, e) => acc + e.miembros.length, 0);
  console.table([
    { dato: "estructuras consultivas", valor: cat.estructuras.length },
    { dato: "membresías previstas", valor: totalMiembros },
    { dato: "cargos consejo EAD", valor: cat.eadBoard.length },
  ]);
  if (!COMMIT) {
    console.log("Dry-run (fase comités). Añade --commit para ejecutar.");
    return;
  }

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
      const tipo = m.rol === "PRESIDE" ? "PRESIDENTE" : "CONSEJERO";
      await designarCargo({
        person_id: pid, entity_id: GARRIGUES_MATRIZ_UUID, body_id: bodyId,
        tipo_condicion: tipo, fecha_inicio: null,
        fuente_designacion: "BOOTSTRAP",
        idempotency_key: `g2:COM:${bodyId}:${pid}:${tipo}`,
      });
      membresias += 1;
    }
  }
  console.log(`✓ ${membresias} membresías de estructuras consultivas`);

  const eadBody = bodyBySlug.get("garrigues-ead-cda");
  if (!eadBody) fail("Body garrigues-ead-cda no encontrado — ejecuta antes seed-garrigues-bodies");
  for (const c of cat.eadBoard) {
    const pid = await ensurePerson(c.nombre);
    await designarCargo({
      person_id: pid, entity_id: EAD_ENTITY, body_id: eadBody,
      tipo_condicion: c.tipoCondicion, fecha_inicio: c.desde ?? null,
      fuente_designacion: "ACTA_NOMBRAMIENTO",
      idempotency_key: `g2:EAD:${pid}:${c.tipoCondicion}`,
    });
  }
  console.log("✓ Consejo de EAD Trust (7 cargos verificados; consejero_delegado/no_consejero van en el pase complementario SQL)");
}

async function main() {
  if (FASE_PERSONAS) await fasePersonas();
  if (FASE_COMITES) await faseComites();
  console.log("✓ Fase completada (idempotente).");
}
main();
