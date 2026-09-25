#!/usr/bin/env bun
/**
 * Exporta el PACK BASE LSC: snapshot del suelo jurídico común (rule packs,
 * rule sets de jurisdicción ES y plantillas ACTIVA) al repo, para que cualquier
 * tenant nuevo pueda nacer con él sin depender del dato de otro tenant.
 *
 * Spec: docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md §5.
 *
 * SOLO LEE de Cloud (tres SELECT). El origen es el estado VIVO del tenant ARGA
 * y no `scripts/seed-rule-packs.ts`: ese seed quedó atrás respecto a las
 * correcciones del Comité Legal aplicadas por migración. Lo que se congela aquí
 * es lo que hoy está ACTIVE/ACTIVA y revisado.
 *
 * Uso:
 *   bun run scripts/export-pack-base-lsc.ts            # resumen, no escribe
 *   bun run scripts/export-pack-base-lsc.ts --write    # escribe scripts/tenants/pack-base-lsc/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ARGA_TENANT_ID } from "./tenants/tenant-spec";
import {
  PACK_BASE_DIR,
  PROYECTO_GOVERNANCE_OS,
  SERVICE_KEY_NAMES,
  canonicalJson,
  resolverEntorno,
  seleccionarPlantillas,
  seleccionarRulePacks,
  seleccionarRuleSets,
  sha256Hex,
  targetEsGovernanceOs,
  type PackBaseManifest,
  type PlantillaOrigen,
  type RulePackOrigen,
  type RuleSetOrigen,
} from "./tenants/bootstrap-lib";

const WRITE = process.argv.includes("--write");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const { url, serviceKey } = resolverEntorno(process.env);
if (!targetEsGovernanceOs(url)) fail(`Target inesperado (${url}) — solo governance_OS.`);
if (!serviceKey) fail(`Falta la service-role key. Nombres buscados: ${SERVICE_KEY_NAMES.join(", ")}`);

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const packs = await admin
    .from("rule_packs")
    .select("id, materia, organo_tipo, descripcion, rule_pack_versions(version, status, is_active, effective_from, payload_hash, payload)")
    .eq("tenant_id", ARGA_TENANT_ID);
  if (packs.error) fail(`rule_packs: ${packs.error.message}`);

  const sets = await admin.from("jurisdiction_rule_sets").select("*").eq("tenant_id", ARGA_TENANT_ID);
  if (sets.error) fail(`jurisdiction_rule_sets: ${sets.error.message}`);

  const plantillas = await admin.from("plantillas_protegidas").select("*").eq("tenant_id", ARGA_TENANT_ID);
  if (plantillas.error) fail(`plantillas_protegidas: ${plantillas.error.message}`);

  const rp = seleccionarRulePacks((packs.data ?? []) as unknown as RulePackOrigen[]);
  const rs = seleccionarRuleSets((sets.data ?? []) as unknown as RuleSetOrigen[]);
  // Las ARCHIVADA no son "excluidas": nunca fueron candidatas. Se filtran antes
  // para que el manifiesto solo liste exclusiones que alguien deba mirar.
  const activas = ((plantillas.data ?? []) as unknown as PlantillaOrigen[]).filter((p) => p.estado === "ACTIVA");
  const pl = seleccionarPlantillas(activas);

  console.table([
    { tabla: "rule_packs", origen: packs.data?.length ?? 0, incluidas: rp.incluidos.length, excluidas: rp.excluidos.length },
    { tabla: "jurisdiction_rule_sets", origen: sets.data?.length ?? 0, incluidas: rs.incluidos.length, excluidas: rs.excluidos.length },
    { tabla: "plantillas_protegidas (ACTIVA)", origen: activas.length, incluidas: pl.incluidas.length, excluidas: pl.excluidas.length },
  ]);
  const exclusiones = [...rp.excluidos, ...rs.excluidos, ...pl.excluidas];
  // Las de jurisdicción fuera de alcance son esperadas y muchas: se resumen.
  const relevantes = exclusiones.filter((e) => !/fuera del alcance/.test(e.motivo));
  if (relevantes.length) {
    console.log("\nExclusiones que conviene mirar:");
    for (const e of relevantes) console.log(`  · [${e.tabla}] ${e.etiqueta} — ${e.motivo}`);
  }
  if (pl.avisos.length) {
    console.log("\nAvisos de revisión legal:");
    for (const a of pl.avisos) console.log(`  · ${a.etiqueta} — ${a.aviso}`);
  }
  console.log(`\nPlantillas con aviso de prototipo neutralizado: ${pl.incluidas.filter((p) => p.capa1_neutralizada).length}`);

  if (rp.incluidos.length === 0 || pl.incluidas.length === 0 || rs.incluidos.length === 0) {
    fail("Alguna tabla queda vacía: un pack base sin reglas, sin rule sets o sin plantillas no es un suelo jurídico.");
  }

  if (!WRITE) {
    console.log("\nResumen sin escribir. Añade --write para congelar el snapshot en el repo.");
    return;
  }

  mkdirSync(PACK_BASE_DIR, { recursive: true });
  const ficheros = {
    "rule-packs.json": rp.incluidos,
    "jurisdiction-rule-sets.json": rs.incluidos,
    "plantillas.json": pl.incluidas,
  } as const;
  const manifest: PackBaseManifest = {
    pack: "LSC_ES",
    origen: { tenant_id: ARGA_TENANT_ID, proyecto: PROYECTO_GOVERNANCE_OS },
    exportado_en: new Date().toISOString().slice(0, 10),
    ficheros: {} as PackBaseManifest["ficheros"],
    exclusiones,
    avisos_legales: pl.avisos,
  };
  for (const [nombre, filas] of Object.entries(ficheros)) {
    const texto = `${canonicalJson(filas, 1)}\n`;
    writeFileSync(join(PACK_BASE_DIR, nombre), texto, "utf8");
    manifest.ficheros[nombre as keyof PackBaseManifest["ficheros"]] = { filas: filas.length, sha256: sha256Hex(texto) };
    console.log(`✓ ${nombre} (${filas.length} filas)`);
  }
  writeFileSync(join(PACK_BASE_DIR, "MANIFEST.json"), `${canonicalJson(manifest, 1)}\n`, "utf8");
  console.log("✓ MANIFEST.json");
}

main();
