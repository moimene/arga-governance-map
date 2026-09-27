#!/usr/bin/env bun
/**
 * F2.T15 (MOI-170, carril C) — país y sector de las candidatas a sujeto RIA
 * de ARGA. Spec §8 ARGA punto 1; plan §2.3.
 *
 * Regla dura: SOLO rellena donde es NULL. `country` sale de `jurisdiction`
 * (ya poblada en las 10 candidatas). `regulated_sector` solo se pone
 * "SEGUROS" donde el plan ya lo fijó como aseguradora (no se infiere de
 * Brasil/México/Portugal: el plan las deja "a decidir", así que aquí NO se
 * tocan). `address`: ninguna de las 10 tiene fuente hoy — se declara "sin
 * dato" y NUNCA se inventa.
 *
 * Escribe con sesión real de `demo@arga-seguros.com` (SECRETARIO): la RLS de
 * `entities` es tenant-scoped sin capacidad adicional (`entities_tenant_isolation`,
 * verificado contra Cloud el 2026-09-27).
 *
 * Uso:
 *   bun run scripts/entidades/seed-ria-direcciones-pais-sector.ts            # dry-run
 *   bun run scripts/entidades/seed-ria-direcciones-pais-sector.ts --commit   # ejecuta
 */
import { ARGA_SECRETARIO, ARGA_TENANT, iniciarSesion } from "../_lib/session";

const COMMIT = process.argv.includes("--commit");

// Las 10 candidatas medidas en Cloud el 2026-09-27 (plan §2.3). Ninguna es
// Garrigues: este script es solo-ARGA, aditivo.
export const ARGA_CANDIDATE_IDS = [
  "6d7ed736-f263-4531-a59d-c6ca0cd41602", // ARGA Seguros, S.A.
  "34676064-b9f3-489e-9fa4-376d6ccea580", // ARGA Vida y Pensiones, S.A.
  "b8ac6ae0-2c42-404f-9db4-d5822321544c", // ARGA Salud, S.A.
  "83059ef7-20ca-4e22-b353-48d14e30bdd9", // ARGA España Seguros y Reaseguros, S.A.
  "ed833c36-9581-4f22-bd8d-cb7f85c09ce0", // ARGA Inversiones, SICAV
  "d0e36d02-032c-5eb4-9436-213cc92554de", // ARGA Servicios Corporativos S.L.
  "f653c44c-15ce-4428-b3d3-f4ed17efe93b", // ARGA Digital Services, S.L.
  "00000000-0000-0000-0000-000000000030", // ARGA Seguros Brasil Ltda.
  "00000000-0000-0000-0000-000000000031", // ARGA Seguros México S.A. de C.V.
  "00000000-0000-0000-0000-000000000032", // ARGA Seguros Portugal, Unipessoal Lda.
];

// Aseguradoras cuyo `regulated_sector` se fija a SEGUROS (plan §2.3: las
// otras tres LATAM/PT "a decidir" — no se tocan aquí; ARGA Seguros SA ya lo
// tiene puesto, por eso no aparece).
export const ARGA_ASEGURADORAS_SIN_SECTOR = [
  "34676064-b9f3-489e-9fa4-376d6ccea580", // ARGA Vida y Pensiones
  "b8ac6ae0-2c42-404f-9db4-d5822321544c", // ARGA Salud
  "83059ef7-20ca-4e22-b353-48d14e30bdd9", // ARGA España Seguros y Reaseguros
];

export interface EntidadRow {
  id: string;
  legal_name: string;
  jurisdiction: string | null;
  country: string | null;
  regulated_sector: string | null;
  address: string | null;
}

export interface CambioEntidad {
  id: string;
  legal_name: string;
  country?: { antes: null; despues: string };
  regulated_sector?: { antes: null; despues: string };
  address_sin_dato: boolean;
}

/** Pura: idempotente en cualquier orden — cada fila se decide solo con su propio estado. */
export function construirPlan(filas: EntidadRow[]): CambioEntidad[] {
  return filas
    .filter((f) => ARGA_CANDIDATE_IDS.includes(f.id))
    .map((f): CambioEntidad => {
      const cambio: CambioEntidad = { id: f.id, legal_name: f.legal_name, address_sin_dato: f.address == null };
      if (f.country == null && f.jurisdiction) {
        cambio.country = { antes: null, despues: f.jurisdiction };
      }
      if (f.regulated_sector == null && ARGA_ASEGURADORAS_SIN_SECTOR.includes(f.id)) {
        cambio.regulated_sector = { antes: null, despues: "SEGUROS" };
      }
      return cambio;
    })
    .filter((c) => c.country || c.regulated_sector);
}

async function main() {
  const sesion = await iniciarSesion(ARGA_SECRETARIO);
  const { data, error } = await sesion
    .from("entities")
    .select("id, legal_name, jurisdiction, country, regulated_sector, address")
    .eq("tenant_id", ARGA_TENANT)
    .in("id", ARGA_CANDIDATE_IDS);
  if (error) throw new Error(`lectura entities: ${error.message}`);

  const filas = (data ?? []) as EntidadRow[];
  const plan = construirPlan(filas);
  const sinAddress = filas.filter((f) => f.address == null).length;

  console.log(`F2.T15 — país/sector de las ${filas.length} candidatas ARGA medidas`);
  console.log(`address: ${sinAddress}/${filas.length} sin dato — no se inventa, queda NULL.\n`);

  if (plan.length === 0) {
    console.log("Nada que rellenar: country y regulated_sector ya están donde el plan los fija.");
    return;
  }

  console.log(`Plan (${plan.length} fila(s) con cambio):`);
  for (const c of plan) {
    const partes: string[] = [];
    if (c.country) partes.push(`country: ∅ → ${c.country.despues}`);
    if (c.regulated_sector) partes.push(`regulated_sector: ∅ → ${c.regulated_sector.despues}`);
    console.log(`  ${c.legal_name} (${c.id}): ${partes.join(", ")}`);
  }

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
    return;
  }

  for (const c of plan) {
    const patch: Record<string, string> = {};
    if (c.country) patch.country = c.country.despues;
    if (c.regulated_sector) patch.regulated_sector = c.regulated_sector.despues;
    const { error: updError } = await sesion.from("entities").update(patch).eq("id", c.id);
    if (updError) throw new Error(`update entities ${c.id}: ${updError.message}`);
    console.log(`  ✓ ${c.legal_name}`);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
