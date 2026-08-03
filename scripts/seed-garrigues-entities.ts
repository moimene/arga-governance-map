#!/usr/bin/env bun
/**
 * Seed G1 — Perímetro societario Garrigues: persons PJ + entities + parents + provenance.
 * Spec §4 G1. Consume scripts/garrigues/entities-catalog.ts (única fuente de verdad).
 *
 * Uso:
 *   bun run scripts/seed-garrigues-entities.ts            # dry-run
 *   bun run scripts/seed-garrigues-entities.ts --commit   # ejecuta
 *
 * - ADITIVO e IDEMPOTENTE (condición Carril B): upsert por UUID fijo, nunca DELETE.
 * - "El schema manda": entity_status/onboarding_status/materiality/support_docs_metadata
 *   se copian de la matriz ARGA existente, no se inventan.
 * - Dos pasadas: (1) persons+entities sin parent, (2) update de parent_entity_id
 *   (evita violar la FK con ordenación topológica implícita).
 */
import { createClient } from "@supabase/supabase-js";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_TENANT,
} from "./garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const ARGA_MATRIZ = "6d7ed736-f263-4531-a59d-c6ca0cd41602";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
  fail(`Target inesperado (${SUPABASE_URL}) — solo governance_OS.`);
}
if (!SERVICE_KEY) {
  fail(`Falta la service-role key. Nombres buscados:\n${SERVICE_KEY_NAMES.map((n) => `    - ${n}`).join("\n")}`);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));

async function main() {
  // 0) Defaults reales: la matriz ARGA dicta status/onboarding/materiality.
  const { data: arga, error: eArga } = await admin
    .from("entities").select("*").eq("id", ARGA_MATRIZ).maybeSingle();
  if (eArga) fail(`Leyendo entidad ARGA de referencia: ${eArga.message}`);
  if (!arga) fail("No existe la entidad ARGA canónica — target equivocado.");

  const { data: existing, error: eExist } = await admin
    .from("entities").select("id").eq("tenant_id", GARRIGUES_TENANT);
  if (eExist) fail(`Leyendo entities Garrigues: ${eExist.message}`);
  const existingIds = new Set((existing ?? []).map((r) => r.id));

  console.table([
    { dato: "entidades en catálogo", valor: GARRIGUES_ENTITIES.length },
    { dato: "ya sembradas (se re-upsertan)", valor: existingIds.size },
    { dato: "nuevas", valor: GARRIGUES_ENTITIES.filter((e) => !existingIds.has(e.uuid)).length },
  ]);
  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar.");
    return;
  }

  // 1) Primera pasada: persons PJ + entities SIN parent.
  for (const e of GARRIGUES_ENTITIES) {
    // persons: ancladas a la entidad (uuid fijo). tax_id solo si hay NIF real —
    // nada de placeholders: la UI ya tiene fallback honesto para NULL.
    let personId = null;
    const { data: ent } = await admin
      .from("entities").select("person_id").eq("id", e.uuid).maybeSingle();
    if (ent?.person_id) {
      personId = ent.person_id;
      const { error } = await admin.from("persons")
        .update({ full_name: e.legalName, denomination: e.commonName, person_type: "PJ", tax_id: e.nif ?? null })
        .eq("id", personId);
      if (error) fail(`persons update ${e.slug}: ${error.message}`);
    } else {
      const { data, error } = await admin.from("persons")
        .insert({ tenant_id: GARRIGUES_TENANT, full_name: e.legalName, denomination: e.commonName, person_type: "PJ", tax_id: e.nif ?? null })
        .select("id").single();
      if (error) fail(`persons insert ${e.slug}: ${error.message}`);
      personId = data.id;
    }

    const row = {
      id: e.uuid,
      tenant_id: GARRIGUES_TENANT,
      person_id: personId,
      slug: e.slug,
      legal_name: e.legalName,
      common_name: e.commonName,
      legal_form: e.legalForm,
      tipo_social: e.tipoSocial,
      jurisdiction: e.jurisdiction,
      country: e.jurisdiction,
      parent_entity_id: null, // segunda pasada
      ownership_percentage: e.ownershipPct,
      group_role: e.groupRole,
      es_unipersonal: e.esUnipersonal,
      forma_administracion: e.formaAdministracion,
      registration_number: e.nif,
      data_provenance: e.provenance,
      // "El schema manda": copiados de la matriz ARGA, salvo estado registral
      // propio del catálogo (p.ej. Sports & Entertainment = Liquidated).
      entity_status: e.entityStatus ?? arga.entity_status,
      onboarding_status: arga.onboarding_status,
      materiality: arga.materiality,
      support_docs_metadata: arga.support_docs_metadata ?? {},
      ...(e.registral
        ? {
            registry_sheet: e.registral.hoja,
            registry_volume: e.registral.tomo,
            registry_folio: e.registral.folio,
            registry_location: e.registral.registro,
            address: e.registral.domicilio,
            city: e.registral.ciudad,
            postal_code: e.registral.cp,
            province: e.registral.provincia,
            constitution_date: e.registral.constitucion,
            duration: e.registral.duracion,
          }
        : {}),
    };
    const { error: eUp } = await admin.from("entities").upsert(row, { onConflict: "id" });
    if (eUp) fail(`entities upsert ${e.slug}: ${eUp.message}`);
    console.log(`✓ ${e.slug}`);
  }

  // 2) Segunda pasada: parents (UUIDs fijos del catálogo, sin lookups).
  //    Escribe SIEMPRE (incluido null): una corrección de catálogo que retire
  //    un parent no debe dejar el valor viejo en Cloud.
  for (const e of GARRIGUES_ENTITIES) {
    const parent = e.parentSlug ? bySlug.get(e.parentSlug) : null;
    if (e.parentSlug && !parent) fail(`parentSlug inválido en catálogo: ${e.parentSlug}`);
    const { error } = await admin.from("entities")
      .update({ parent_entity_id: parent ? parent.uuid : null }).eq("id", e.uuid);
    if (error) fail(`parent ${e.slug} → ${e.parentSlug ?? "null"}: ${error.message}`);
  }
  console.log("✓ Parents enlazados.");
  console.log("✓ Seed G1 completado (idempotente: re-ejecutar es seguro).");
}

main();
