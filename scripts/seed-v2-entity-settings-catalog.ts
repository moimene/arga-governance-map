#!/usr/bin/env bun
/**
 * Seed inicial entity_settings_catalog v2.0.
 * Pobla ~40 claves cubriendo Cats. 3 (CONFIG_CONDICIONAL), 4 (CARGO),
 * y selectivos PERFIL_SOCIETARIO + PERFIL_SECTORIAL.
 *
 * Idempotente: usa INSERT ... ON CONFLICT (key) DO UPDATE.
 *
 * Spec: docs/superpowers/specs/2026-05-11-procedimiento-plantillas-v2-design.md §4.3
 *
 * Uso:
 *   bun run scripts/seed-v2-entity-settings-catalog.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface CatalogEntry {
  key: string;
  value_type: "boolean" | "text" | "enum" | "number";
  allowed_values?: unknown[];
  default_value?: unknown;
  descripcion: string;
  categoria: "CARGO" | "CONFIG_CONDICIONAL" | "PERFIL_SOCIETARIO" | "PERFIL_SECTORIAL";
  usado_por_plantillas?: string[];
}

// Cat. 3 — CONFIG_CONDICIONAL (~20 claves para los 10 casos del spec + variantes)
const CONFIG_CONDICIONAL: CatalogEntry[] = [
  { key: "es_cotizada", value_type: "enum", allowed_values: ["SÍ", "NO"], default_value: "NO", descripcion: "¿La sociedad cotiza en mercado regulado? Activa bloques CNMV/MAR.", categoria: "CONFIG_CONDICIONAL" },
  { key: "secretario_es_consejero", value_type: "enum", allowed_values: ["SÍ", "NO"], default_value: "NO", descripcion: "¿El Secretario es también consejero? Afecta cláusulas de ratificación.", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_reglamento_consejo", value_type: "boolean", default_value: false, descripcion: "¿La sociedad tiene Reglamento Interno del Consejo?", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_reglamento_junta", value_type: "boolean", default_value: false, descripcion: "¿La sociedad tiene Reglamento de la Junta?", categoria: "CONFIG_CONDICIONAL" },
  { key: "aseguradora_intragrupo", value_type: "boolean", default_value: false, descripcion: "¿La D&O es contratada con aseguradora del grupo (operación vinculada)?", categoria: "CONFIG_CONDICIONAL" },
  { key: "tipo_social", value_type: "enum", allowed_values: ["SA", "SL", "SLU", "SAU"], default_value: "SA", descripcion: "Tipo social: SA, SL, SLU, SAU", categoria: "CONFIG_CONDICIONAL" },
  { key: "requiere_experto_independiente", value_type: "boolean", default_value: true, descripcion: "¿Fusión/escisión requiere informe de experto independiente? (NO si matriz 100%)", categoria: "CONFIG_CONDICIONAL" },
  { key: "sector_regulado", value_type: "enum", allowed_values: ["BANCA", "SEGUROS", "ENERGIA", "FARMA", "EIP", "INMOBILIARIO", "PUBLICO_PRIVADO", "MERCADO_VALORES", "GENERICO"], default_value: "GENERICO", descripcion: "Sector regulatorio principal de la sociedad. Activa sugerencia de bloques sectoriales.", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_politica_remuneracion_anterior", value_type: "boolean", default_value: false, descripcion: "¿Existe política de remuneración anterior vigente? (sí = cláusula sustitución)", categoria: "CONFIG_CONDICIONAL" },
  { key: "requiere_borme", value_type: "boolean", default_value: true, descripcion: "¿Modificación de estatutos requiere publicación BORME? (SA sí, SL no)", categoria: "CONFIG_CONDICIONAL" },
  { key: "requiere_dictamen_externo", value_type: "boolean", default_value: false, descripcion: "¿La operación requiere dictamen jurídico externo previo?", categoria: "CONFIG_CONDICIONAL" },
  { key: "es_socio_unico", value_type: "boolean", default_value: false, descripcion: "¿Es sociedad unipersonal? Activa flujo decisión socio único.", categoria: "CONFIG_CONDICIONAL" },
  { key: "es_administrador_unico", value_type: "boolean", default_value: false, descripcion: "¿Tiene administrador único? Cambia órgano admin.", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_pacto_parasocial", value_type: "boolean", default_value: false, descripcion: "¿Existe pacto parasocial vigente?", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_voto_calidad_presidente", value_type: "boolean", default_value: true, descripcion: "¿Presidente tiene voto de calidad en empate?", categoria: "CONFIG_CONDICIONAL" },
  { key: "permite_segunda_convocatoria", value_type: "boolean", default_value: true, descripcion: "¿Estatutos prevén segunda convocatoria?", categoria: "CONFIG_CONDICIONAL" },
  { key: "permite_voto_a_distancia", value_type: "boolean", default_value: false, descripcion: "¿Estatutos permiten voto a distancia / electrónico?", categoria: "CONFIG_CONDICIONAL" },
  { key: "permite_representacion", value_type: "boolean", default_value: true, descripcion: "¿Permite representación en Junta?", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_consejero_dominical", value_type: "boolean", default_value: false, descripcion: "¿Hay consejero dominical (representa accionista significativo)?", categoria: "CONFIG_CONDICIONAL" },
  { key: "tiene_consejera_independiente", value_type: "boolean", default_value: false, descripcion: "¿Hay al menos un consejero independiente?", categoria: "CONFIG_CONDICIONAL" },
];

// Cat. 4 — CARGO (~10 claves)
const CARGO: CatalogEntry[] = [
  { key: "cargo_secretario_label", value_type: "text", default_value: "Secretario del Consejo", descripcion: "Denominación del Secretario en encabezamientos y firmas.", categoria: "CARGO" },
  { key: "cargo_presidente_label", value_type: "text", default_value: "Presidente del Consejo", descripcion: "Denominación del Presidente.", categoria: "CARGO" },
  { key: "cargo_ejecutivo_label", value_type: "text", default_value: "Consejero Delegado", descripcion: "Cargo ejecutivo delegado: CEO, Consejero Delegado, Director General.", categoria: "CARGO" },
  { key: "cargo_cfo_label", value_type: "text", default_value: "Dirección Financiera", descripcion: "Denominación del CFO/responsable financiero.", categoria: "CARGO" },
  { key: "cargo_asesor_legal_label", value_type: "text", default_value: "Letrado Asesor", descripcion: "Asesor legal asistente a sesiones.", categoria: "CARGO" },
  { key: "firmante_por_delegacion_label", value_type: "text", descripcion: "Texto literal de firma por delegación si aplica (ej. 'Por delegación, el Vicesecretario').", categoria: "CARGO" },
  { key: "organo_admin_label", value_type: "text", default_value: "El Consejo de Administración", descripcion: "Denominación del órgano de administración firmante.", categoria: "CARGO" },
  { key: "nombre_comite_auditoria", value_type: "text", default_value: "Comisión de Auditoría", descripcion: "Denominación estatutaria del Comité/Comisión de Auditoría.", categoria: "CARGO" },
  { key: "nombre_comite_retribuciones", value_type: "text", default_value: "Comisión de Nombramientos y Retribuciones", descripcion: "Denominación estatutaria del Comité/Comisión de Nombramientos y Retribuciones.", categoria: "CARGO" },
  { key: "rol_certificante", value_type: "enum", allowed_values: ["SECRETARIO", "PRESIDENTE"], default_value: "SECRETARIO", descripcion: "Rol que certifica acuerdos: SECRETARIO con VºBº PRESIDENTE (estándar) o PRESIDENTE.", categoria: "CARGO" },
];

// PERFIL_SOCIETARIO (~10 claves selectivas)
const PERFIL_SOCIETARIO: CatalogEntry[] = [
  { key: "subgrupo_consolidacion", value_type: "text", descripcion: "Nombre del subgrupo de consolidación contable si aplica.", categoria: "PERFIL_SOCIETARIO" },
  { key: "regulador_principal", value_type: "enum", allowed_values: ["CNMV", "BdE", "DGSFP", "CNMC", "AEMPS", "NINGUNO"], default_value: "NINGUNO", descripcion: "Regulador principal de la sociedad.", categoria: "PERFIL_SOCIETARIO" },
  { key: "numero_registro_cnmv", value_type: "text", descripcion: "Número de registro CNMV si aplica.", categoria: "PERFIL_SOCIETARIO" },
  { key: "numero_registro_reglamento_consejo", value_type: "text", descripcion: "Número de inscripción del Reglamento del Consejo en RM.", categoria: "PERFIL_SOCIETARIO" },
  { key: "ejercicio_social_inicio", value_type: "text", default_value: "01-01", descripcion: "Mes-día de inicio del ejercicio social (formato MM-DD).", categoria: "PERFIL_SOCIETARIO" },
  { key: "ejercicio_social_fin", value_type: "text", default_value: "12-31", descripcion: "Mes-día de cierre del ejercicio social.", categoria: "PERFIL_SOCIETARIO" },
];

const ALL_ENTRIES: CatalogEntry[] = [...CONFIG_CONDICIONAL, ...CARGO, ...PERFIL_SOCIETARIO];

async function main() {
  console.log(`Seeding entity_settings_catalog with ${ALL_ENTRIES.length} entries...`);
  let inserted = 0;
  for (const entry of ALL_ENTRIES) {
    const { error } = await supabase
      .from("entity_settings_catalog")
      .upsert(entry, { onConflict: "key" });
    if (error) {
      console.error(`FAIL on key=${entry.key}: ${error.message}`);
      process.exit(1);
    }
    inserted++;
  }
  console.log(`OK: ${inserted} entries upserted (${ALL_ENTRIES.length} total)`);

  // Verification query
  const { count } = await supabase
    .from("entity_settings_catalog")
    .select("*", { count: "exact", head: true })
    .eq("estado_catalog", "ACTIVA");
  console.log(`Total ACTIVA en catalog tras seed: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
