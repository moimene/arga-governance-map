#!/usr/bin/env bun
/**
 * Seed G4 Task 3 — Sistema normativo interno de Garrigues (38 documentos).
 *
 * Siembra en `policies` (tenant Garrigues, `00000000-…0002`) los 38
 * documentos del catálogo de Task 2 (`scripts/garrigues/normativo/
 * catalogo-normativo.ts`, NORMATIVO_CATALOG — única fuente de verdad, no se
 * reinterpreta aquí). Para cada uno: policy_code, title, normative_tier,
 * effective_date, current_version, summary, content_outline, data_provenance
 * y, SOLO para los 7 acreditados en fuente, owner_body_id + owner_function.
 *
 * Ownership — regla de oro (spec §6): se siembra SOLO lo que la fuente
 * acredita explícitamente. Todo lo demás queda NULL a propósito; sembrar un
 * comité plausible sería inventar. PI-31 (Política del SII) se investigó
 * expresamente: el PDF (§4, p.6) dice "El Responsable de la gestión del SII
 * de Garrigues, designado por el órgano de administración, es el Senior
 * Partner de la Firma, órgano unipersonal...". Sí nombra un responsable, pero
 * "Senior Partner" NO tiene fila propia en `governing_bodies` — está
 * modelado como cargo/persona (Rosa Zarza Jimeno), no como órgano
 * (scripts/garrigues/gobierno/governance-catalog.ts:143-146: "Cargo de
 * supervisión (no órgano): preside el Consejo de Socios..."). Verificado
 * contra Cloud (governing_bodies de Garrigues, 22 filas): no existe
 * "garrigues-senior-partner" ni nada equivalente. Por tanto PI-31 queda
 * NULL — no se sustituye por el Consejo de Socios que preside, eso sería
 * inventar un salto que la fuente no da.
 *
 * owner_function (columna text ya existente, pintada por 3 lecturas vivas:
 * PoliticasList "Propietario", PoliticaDetalle, EntidadDetalle) se rellena
 * en paralelo con el `name` del órgano resuelto, SOLO donde hay
 * owner_body_id — no se inventa para el resto.
 *
 * Contrato cero-cambio ARGA: este script NUNCA toca filas de
 * `00000000-…0001`. Ninguna columna nueva de Task 1 se popula para ARGA.
 *
 * Patrón: scripts/seed-garrigues-rule-packs.ts. Dry-run por defecto,
 * --commit para escribir. Requiere una service-role key en el entorno.
 * El seed ABORTA si algún slug de OWNER_BY_CODE no resuelve a un UUID real
 * en `governing_bodies` — nunca sembrar NULL en silencio por un slug roto.
 *
 * Uso: bun run scripts/seed-garrigues-normativo.ts [--commit]
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";
import { NORMATIVO_CATALOG, type NormativoEntry } from "./garrigues/normativo/catalogo-normativo";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (NORMATIVO_CATALOG.length !== 38) fail(`NORMATIVO_CATALOG tiene ${NORMATIVO_CATALOG.length} entradas, se esperaban 38.`);

// Ownership acreditado en fuente (spec §6, literal). Todo lo demás queda
// NULL a propósito — ver cabecera para el análisis de PI-31.
const OWNER_BY_CODE: Record<string, string> = {
  "PPD-01": "garrigues-comite-practica-profesional",
  "PPD-02": "garrigues-comite-practica-profesional",
  "PPD-CAT": "garrigues-comite-practica-profesional",
  "CE-2023": "garrigues-comite-practica-profesional",
  "PBC-FT-10": "garrigues-caci",
  "PI-14": "garrigues-comite-editorial-global",
  "PI-30": "garrigues-comite-gobernanza-ia",
};

const provenanceFor = (e: NormativoEntry) => ({
  origen: e.provenance, // PDF_EXTRAIDO | CITADO_NO_INCORPORADO
  fuente: e.source_file ?? "citado en el Sistema Normativo Interno",
  ownership_acreditado: Boolean(OWNER_BY_CODE[e.policy_code]),
});

async function resolveOwnerSlugs(admin: ReturnType<typeof createClient>): Promise<Map<string, { id: string; name: string }>> {
  const slugs = Array.from(new Set(Object.values(OWNER_BY_CODE)));
  const { data, error } = await admin
    .from("governing_bodies")
    .select("id, slug, name")
    .eq("tenant_id", GARRIGUES_TENANT)
    .in("slug", slugs);
  if (error) fail(`governing_bodies select: ${error.message}`);

  const bySlug = new Map((data ?? []).map((r: Record<string, unknown>) => [r.slug as string, { id: r.id as string, name: r.name as string }]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) {
    fail(`slug(s) de OWNER_BY_CODE sin fila en governing_bodies (tenant Garrigues): ${missing.join(", ")}`);
  }
  return bySlug;
}

function buildRow(e: NormativoEntry, ownerBySlug: Map<string, { id: string; name: string }>) {
  const ownerSlug = OWNER_BY_CODE[e.policy_code];
  const owner = ownerSlug ? ownerBySlug.get(ownerSlug) : undefined;
  return {
    tenant_id: GARRIGUES_TENANT,
    policy_code: e.policy_code,
    title: e.title,
    normative_tier: e.normative_tier,
    scope_level: "Corporate",
    status: "Published",
    mandatory: true,
    effective_date: e.effective_date,
    current_version: e.current_version,
    summary: e.summary,
    content_outline: e.content_outline,
    owner_body_id: owner?.id ?? null,
    owner_function: owner?.name ?? null,
    data_provenance: provenanceFor(e),
  };
}

async function main() {
  console.log(`G4 Task 3 — sistema normativo Garrigues: ${NORMATIVO_CATALOG.length} documentos, ${Object.keys(OWNER_BY_CODE).length} con ownership acreditado.`);
  console.table(
    NORMATIVO_CATALOG.filter((e) => OWNER_BY_CODE[e.policy_code]).map((e) => ({
      policy_code: e.policy_code,
      title: e.title.slice(0, 50),
      owner_slug: OWNER_BY_CODE[e.policy_code],
    })),
  );
  console.log(`PI-31: SIN ownership — el PDF nombra al "Senior Partner" (órgano unipersonal, §4) pero no tiene fila en governing_bodies (cargo, no órgano). Queda NULL.`);

  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar contra Cloud (requiere service-role key).");
    return;
  }
  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ownerBySlug = await resolveOwnerSlugs(admin);
  const rows = NORMATIVO_CATALOG.map((e) => buildRow(e, ownerBySlug));

  const { error } = await admin.from("policies").upsert(rows, { onConflict: "tenant_id,policy_code" });
  if (error) fail(`policies upsert: ${error.message}`);

  console.log(`✓ Seed completado (idempotente) — ${rows.length} documentos normativos de Garrigues.`);
}

main();
