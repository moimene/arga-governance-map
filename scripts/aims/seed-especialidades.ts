#!/usr/bin/env bun
/**
 * F2.T10 (MOI-170, carril C) — especialidades de AIMS cableadas a órgano.
 * Spec: docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md §7/§8.
 *
 * Solo Garrigues: ARGA queda vacía hasta D-U6 (falla cerrado, sin fila —
 * `aims_specialty_bodies` así lo declara en su comentario de tabla).
 *
 * Escribe por `fn_aims_declarar_especialidad` (exige AIMS_GOBIERNO) con la
 * sesión real de `admin@garrigues-demo.dev` (ADMIN_TENANT). La RPC hace
 * upsert por `(tenant_id, especialidad)`: re-ejecutar no duplica.
 *
 * Uso:
 *   bun run scripts/aims/seed-especialidades.ts            # dry-run
 *   bun run scripts/aims/seed-especialidades.ts --commit   # ejecuta
 */
import { GARRIGUES_ADMIN, GARRIGUES_TENANT, iniciarSesion } from "../_lib/session";

const COMMIT = process.argv.includes("--commit");

export interface EspecialidadSeed {
  especialidad: "JURIDICO" | "TECNICO" | "RIESGOS" | "CIBERSEGURIDAD" | "DATOS";
  governingBodyId: string;
  governingBodySlug: string;
}

// Slugs verificados contra Cloud (governance_OS) el 2026-09-27 — ver spec §7.
export const GARRIGUES_ESPECIALIDADES: EspecialidadSeed[] = [
  { especialidad: "JURIDICO", governingBodyId: "432e420b-4db1-44f1-81da-e3575b1d3dec", governingBodySlug: "garrigues-comite-gobernanza-ia" },
  { especialidad: "TECNICO", governingBodyId: "37a2c5bb-193c-4d89-99fb-c4a516a7e004", governingBodySlug: "garrigues-comite-innovacion-digitalizacion" },
  { especialidad: "RIESGOS", governingBodyId: "941eb90f-a0c6-4576-9353-143a0ebcf73a", governingBodySlug: "garrigues-departamento-compliance" },
  { especialidad: "CIBERSEGURIDAD", governingBodyId: "0d9bec0c-6863-4781-a509-db08bc0a5f45", governingBodySlug: "garrigues-oficina-tecnica-seguridad" },
  { especialidad: "DATOS", governingBodyId: "87e5aa87-b4c5-4734-9414-d97e16674320", governingBodySlug: "garrigues-oficina-dpo" },
];

export interface FilaExistente {
  especialidad: string;
  governing_body_id: string;
}

export interface CambioEspecialidad {
  especialidad: string;
  slug: string;
  antes: string | null;
  despues: string;
}

/** Pura: solo declara lo que cambiaría. Idempotente en cualquier orden de entrada. */
export function construirPlan(actuales: FilaExistente[]): CambioEspecialidad[] {
  return GARRIGUES_ESPECIALIDADES.filter((s) => {
    const actual = actuales.find((a) => a.especialidad === s.especialidad);
    return !actual || actual.governing_body_id !== s.governingBodyId;
  }).map((s) => ({
    especialidad: s.especialidad,
    slug: s.governingBodySlug,
    antes: actuales.find((a) => a.especialidad === s.especialidad)?.governing_body_id ?? null,
    despues: s.governingBodyId,
  }));
}

async function main() {
  console.log("F2.T10 — especialidades AIMS → órgano");
  console.log("ARGA: sin especialidades (D-U6 no decidida) — no se toca, falla cerrado por diseño.\n");

  const sesion = await iniciarSesion(GARRIGUES_ADMIN);
  const { data, error } = await sesion
    .from("aims_specialty_bodies")
    .select("especialidad, governing_body_id")
    .eq("tenant_id", GARRIGUES_TENANT);
  if (error) throw new Error(`lectura aims_specialty_bodies: ${error.message}`);

  const plan = construirPlan((data ?? []) as FilaExistente[]);

  if (plan.length === 0) {
    console.log("Garrigues: las 5 especialidades ya están declaradas como se espera. Nada que hacer.");
    return;
  }

  console.log(`Garrigues — plan (${plan.length} cambio(s)):`);
  for (const c of plan) {
    console.log(`  ${c.especialidad} (${c.slug}): ${c.antes ?? "∅"} → ${c.despues}`);
  }

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
    return;
  }

  for (const c of plan) {
    const { error: rpcError } = await sesion.rpc("fn_aims_declarar_especialidad", {
      p_especialidad: c.especialidad,
      p_governing_body_id: c.despues,
    });
    if (rpcError) throw new Error(`fn_aims_declarar_especialidad(${c.especialidad}): ${rpcError.message}`);
    console.log(`  ✓ ${c.especialidad} → ${c.slug}`);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
