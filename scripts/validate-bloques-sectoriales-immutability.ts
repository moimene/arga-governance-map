#!/usr/bin/env bun
/**
 * R5 belt-and-suspenders: verifica que bloques_sectoriales ACTIVA tienen
 * texto_aprobado consistente con un snapshot conocido (computed checksum).
 * Si el trigger BD falla y un texto se modifica in-place, este script lo
 * detecta en CI antes de deploy.
 *
 * En v2.0 el snapshot se calcula al ejecutarse (baseline). Tras v2.1+
 * este snapshot se persistirá en el repo (ej. scripts/.bloque-checksums.json)
 * y se comparará en cada CI run.
 *
 * Uso: bun run scripts/validate-bloques-sectoriales-immutability.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing env. Skipping immutability check.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("bloques_sectoriales")
    .select("clave_bloque, version, texto_aprobado, estado")
    .eq("estado", "ACTIVA")
    .order("clave_bloque");
  if (error) {
    console.error("Failed to load bloques:", error.message);
    process.exit(1);
  }

  console.log(`Bloques ACTIVA: ${(data ?? []).length}`);
  for (const b of data ?? []) {
    const hash = createHash("sha256").update(b.texto_aprobado).digest("hex").slice(0, 12);
    console.log(`  ${b.clave_bloque} v${b.version}  sha256:${hash}  len:${b.texto_aprobado.length}`);
  }
  // En v2.1+ comparar contra checksum file persisted; ahora solo log
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
