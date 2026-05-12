#!/usr/bin/env bun
/**
 * Reporta cuántos overrides capa3 están obsoletos por bump de canónica
 * (compatible_with_canonical_version != plantilla.version actual).
 *
 * NO falla el build (warning/info only). Documentado en §6 del spec.
 *
 * Uso: bun run scripts/validate-capa3-overrides-compat.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env. Skipping validation.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Row {
  entity_id: string;
  plantilla_id: string;
  campo: string;
  compatible_with_canonical_version: string;
  plantilla_version: string;
}

async function main() {
  const { data, error } = await supabase
    .from("plantilla_capa3_overrides_por_entidad")
    .select(`
      entity_id, plantilla_id, campo, compatible_with_canonical_version,
      plantillas_protegidas:plantilla_id ( version )
    `);
  if (error) {
    console.error("Failed to load overrides:", error.message);
    process.exit(1);
  }

  type Joined = {
    entity_id: string;
    plantilla_id: string;
    campo: string;
    compatible_with_canonical_version: string;
    plantillas_protegidas: { version: string } | null;
  };

  const obsoletos: Row[] = [];
  for (const r of (data ?? []) as Joined[]) {
    const currentV = r.plantillas_protegidas?.version;
    if (currentV && r.compatible_with_canonical_version !== currentV) {
      obsoletos.push({
        entity_id: r.entity_id,
        plantilla_id: r.plantilla_id,
        campo: r.campo,
        compatible_with_canonical_version: r.compatible_with_canonical_version,
        plantilla_version: currentV,
      });
    }
  }

  console.log(`Total overrides activos: ${(data ?? []).length}`);
  console.log(`Overrides con compat obsoleta: ${obsoletos.length}`);
  if (obsoletos.length > 0) {
    console.log("\nDetalle:");
    for (const o of obsoletos) {
      console.log(`  - entity=${o.entity_id.slice(0, 8)} plantilla=${o.plantilla_id.slice(0, 8)} campo=${o.campo}: compat=${o.compatible_with_canonical_version} vs actual=${o.plantilla_version}`);
    }
    console.log("\nResolución: revalidar overrides via PR (actualizar compatible_with_canonical_version) o archivar.");
  }
  process.exit(0); // Siempre exit 0 — informativo
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
