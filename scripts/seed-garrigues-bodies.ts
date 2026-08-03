#!/usr/bin/env bun
/**
 * Seed G2 — Órganos del tenant Garrigues. Idempotente por slug.
 * Decisorios: Junta de Socios (JUNTA) + body del administrador único (CDA/ADMIN_UNICO)
 * + CdA de EAD Trust (CDA/CONSEJO_ADMIN). Consultivas: 19 COMITE con config.
 * GOTCHA G3: organo-resolver mapea COMITE→COMISION_DELEGADA; la exclusión de
 * consultivos de los selectores de adopción es trabajo de G3 (config.naturaleza).
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
const EAD_ENTITY = "00000000-0000-0000-0002-000000000026";

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

async function ensureBody(row) {
  const { data, error } = await admin.from("governing_bodies")
    .select("id").eq("tenant_id", GARRIGUES_TENANT).eq("slug", row.slug).maybeSingle();
  if (error) fail(`bodies select ${row.slug}: ${error.message}`);
  if (data) {
    const { error: eU } = await admin.from("governing_bodies").update(row).eq("id", data.id);
    if (eU) fail(`bodies update ${row.slug}: ${eU.message}`);
    return data.id;
  }
  const { data: ins, error: eI } = await admin.from("governing_bodies")
    .insert({ tenant_id: GARRIGUES_TENANT, ...row }).select("id").single();
  if (eI) fail(`bodies insert ${row.slug}: ${eI.message}`);
  return ins.id;
}

async function main() {
  const bodies = [
    {
      slug: "garrigues-junta-socios", name: "Junta de Socios", body_type: "JUNTA",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: { naturaleza: "DECISORIO", fuente: "Estatutos J&A Garrigues SLP; acta 06/05/2026", censo_socios: 346 },
    },
    {
      slug: "garrigues-admin-unico", name: "Administrador Único", body_type: "CDA",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: { naturaleza: "DECISORIO", organo_tipo: "ADMIN_UNICO", titular: "Fernando Vives Ruiz", nota: "La condición ADMIN_UNICO (entity-level) es la titularidad; este body habilita los flujos de decisión unipersonal del motor" },
    },
    {
      slug: "garrigues-ead-cda", name: "Consejo de Administración de EAD Trust", body_type: "CDA",
      entity_id: EAD_ENTITY,
      config: { naturaleza: "DECISORIO", organo_tipo: "CONSEJO_ADMIN", fuente: "BORME/RM (cosecha 2026-08-03)" },
    },
    ...cat.estructuras.map((e) => ({
      slug: `garrigues-${e.slug}`, name: e.nombre, body_type: "COMITE",
      entity_id: GARRIGUES_MATRIZ_UUID,
      config: {
        naturaleza: "CONSULTIVO",
        depende_de: e.dependeDe,
        mision: e.mision,
        ...(e.mandatoAnios ? { mandato_anios: e.mandatoAnios } : {}),
        ...(e.informePreceptivo ? { informe_preceptivo: true } : {}),
        ...(e.incidencias?.length ? { incidencias: e.incidencias } : {}),
      },
    })),
  ];
  console.table(bodies.map((b) => ({ slug: b.slug, tipo: b.body_type })));
  if (!COMMIT) { console.log("Dry-run."); return; }
  for (const b of bodies) await ensureBody(b);
  console.log(`✓ ${bodies.length} órganos sembrados (idempotente).`);
}
main();
