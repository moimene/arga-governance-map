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
  // Aliases legacy detectados en plantillas v1 (deuda v2.1: implementar mapping en resolveEntityVars)
  "nif",                          // alias de tax_id
  "tipo_sociedad",                // alias de tipo_social
  "tipo_sociedad_unipersonal",    // computed: tipo_social + ' Unipersonal' si es_unipersonal
  "datos_registrales_resumen",    // computed: tomo+folio+hoja+inscripcion concatenados
]);

// Regex permisivo que extrae claves ENTIDAD.<key> o entities.<key> donde
// quiera que aparezcan en capa1_inmutable. Esto cubre TANTO interpolación
// directa {{ENTIDAD.x}} COMO referencias dentro de subexpressions/helpers
// como {{#if (eq ENTIDAD.x "y")}}, {{#unless ENTIDAD.x}}, {{lookup ENTIDAD.x ...}},
// que son los patrones principales de v2 para activar/desactivar bloques.
//
// Reportado en review Codex pre-merge: el regex original anchored a {{...}}
// dejaba pasar typos en condicionales como {{#if (eq ENTIDAD.es_cotizadaaa "SÍ")}}
// que renderizan silenciosamente como falsy sin que el audit los detectara.
//
// Diseño:
//   \b                              — word boundary previene matches dentro de
//                                     identificadores compuestos como XENTIDAD.foo
//   (?:ENTIDAD|entities)\.          — prefijo canónico (ENTIDAD) o legacy (entities)
//   ([a-zA-Z_][a-zA-Z0-9_]*)        — capture group: identificador válido (no empieza
//                                     con dígito, sigue convención JS/Handlebars)
//
// Sin requerir lookahead final: el carácter no-identificador siguiente queda
// naturalmente fuera del capture group, y `*` (greedy) consume el identificador
// más largo posible. Probado contra interpolación directa, subexpressions
// {{#if (eq ...)}}, block helpers {{#unless}}, y lookup helpers.
const ENTITY_KEY_REGEX = /\b(?:ENTIDAD|entities)\.([a-zA-Z_][a-zA-Z0-9_]*)/g;

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
