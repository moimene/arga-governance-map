#!/usr/bin/env bun
/**
 * R2 — FAIL build si una plantilla ACTIVA referencia una clave {{ENTIDAD.<key>}}
 * que no existe en entity_settings_catalog.
 *
 * Excepción: claves legacy (entities.* o cualquier campo directo de entities)
 * son válidas porque el resolver las maneja por la vía existente.
 *
 * Adicionalmente reconstruye usado_por_plantillas como side-effect informativo.
 *
 * Uso: bun run scripts/audit-entity-settings-keys.ts
 * Exit code: 0 = OK, 1 = FAIL build (claves no catalogadas usadas en capa1).
 *
 * Spec §11.6 + R2.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env. Skipping audit (no fail).");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Claves legacy del resolver (resolveEntityVars) — válidas sin estar en catalog
const LEGACY_ENTITIES_KEYS = new Set([
  "name", "tax_id", "registration_number", "legal_name", "common_name",
  "jurisdiction", "legal_form", "entity_type_detail", "denominacion_social",
  "cif", "domicilio_social", "registro_mercantil", "tomo", "folio", "hoja",
  "inscripcion", "lugar", "tipo_social", "articulo_estatutos_comision",
]);

// Regex que extrae claves usadas en {{ENTIDAD.<key>}} o {{entities.<key>}}
const ENTITY_KEY_REGEX = /\{\{\s*(?:ENTIDAD|entities)\.([a-zA-Z0-9_]+)\s*[}|]/g;

async function main() {
  // 1. Cargar plantillas ACTIVA y catalog
  const [{ data: plantillas, error: e1 }, { data: catalog, error: e2 }] = await Promise.all([
    supabase
      .from("plantillas_protegidas")
      .select("id, materia, capa1_inmutable")
      .eq("estado", "ACTIVA"),
    supabase
      .from("entity_settings_catalog")
      .select("key")
      .eq("estado_catalog", "ACTIVA"),
  ]);
  if (e1 || e2) {
    console.error("Failed to load plantillas or catalog:", e1?.message, e2?.message);
    process.exit(1);
  }

  const catalogKeys = new Set((catalog ?? []).map((r) => r.key));
  const usedKeys = new Map<string, Set<string>>(); // key → Set of materias

  // 2. Extraer claves usadas en cada plantilla
  for (const pl of plantillas ?? []) {
    if (!pl.capa1_inmutable) continue;
    const matches = pl.capa1_inmutable.matchAll(ENTITY_KEY_REGEX);
    for (const m of matches) {
      const key = m[1];
      if (!usedKeys.has(key)) usedKeys.set(key, new Set());
      usedKeys.get(key)!.add(pl.materia ?? "(sin materia)");
    }
  }

  // 3. Detectar claves usadas que NO están en catalog ni son legacy
  const orphanedKeys: string[] = [];
  for (const key of usedKeys.keys()) {
    if (LEGACY_ENTITIES_KEYS.has(key)) continue;
    if (catalogKeys.has(key)) continue;
    orphanedKeys.push(key);
  }

  if (orphanedKeys.length > 0) {
    console.error(`\n❌ FAIL: ${orphanedKeys.length} claves {{ENTIDAD.<key>}} usadas en capa1 NO existen en entity_settings_catalog ni son legacy:`);
    for (const k of orphanedKeys) {
      console.error(`  - ${k}  (usada por materias: ${Array.from(usedKeys.get(k) ?? []).join(", ")})`);
    }
    console.error("\nResolución: añadir claves al catálogo via scripts/seed-v2-entity-settings-catalog.ts o via migración.");
    process.exit(1);
  }

  // 4. Side effect: reconstruir entity_settings_catalog.usado_por_plantillas
  console.log(`✅ Audit OK: ${usedKeys.size} claves usadas, todas catalogadas o legacy.`);
  console.log("Reconstruyendo usado_por_plantillas en catalog...");
  for (const [key, materias] of usedKeys.entries()) {
    if (catalogKeys.has(key)) {
      const { error } = await supabase
        .from("entity_settings_catalog")
        .update({ usado_por_plantillas: Array.from(materias) })
        .eq("key", key);
      if (error) console.warn(`  warn: failed to update usado_por_plantillas for ${key}: ${error.message}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
