#!/usr/bin/env bun
/**
 * MOI-150 — declarar el órgano de gobierno de la IA del Grupo Nuevo (`…0003`)
 * por dato, sin tocar `src/lib/aims/governing-body.ts`.
 *
 * Decisión D-28 (por delegación de Moisés): el órgano es el Consejo de
 * Administración de Corporación Nueva, S.A. (la matriz del grupo), porque el
 * grupo nuevo no tiene comité especializado de IA. Buscado por SELECT en
 * `governing_bodies` (Cloud, 2026-09-27):
 *   Consejo de Administracion — id db8073bb-5089-4bbf-a9a9-456d457f59b7,
 *   slug corporacion-nueva-s-a-1790294732310-admin-onboarding,
 *   entity_id 45c8df67-64c9-42a3-abff-8047dd23748b (Corporación Nueva, S.A.).
 *
 * Sistema de IA: el real del recorrido MOI-55,
 * 75635765-47fd-4020-bdb7-61859be67c31 ("Recorrido MOI-55 — Motor de triaje
 * documental"). El tenant tiene 6 sistemas más: 3 duplicados residuales del
 * mismo recorrido (ejecuciones repetidas del guion manual, mismo nombre con
 * otro sufijo de timestamp, más antiguos que el declarado real) y 3
 * `PROBE-E2E-*` (sondas de aislamiento cross-tenant). Ninguno de los 6 es "un
 * sistema NO residual" distinto del declarado — se listan explícitamente,
 * igual que `ARGA_SYSTEM_IDS`/`GARRIGUES_SYSTEM_IDS` en
 * `scripts/politicas/seed-pr024-owner-body.ts`, para que un alta futura no
 * quede arrastrada por accidente.
 *
 * MECANISMO (D-28 bis, 2026-10-02)
 * ---------------------------------
 * Propone por `fn_aims_proponer_sujeto` un sujeto hipótesis (Corporación
 * Nueva, S.A. como RESPONSABLE_DESPLIEGUE del sistema de MOI-55,
 * SIEMBRA_HIPOTESIS, a validar por el comité de IA real del cliente) con
 * `p_governing_body_id` = Consejo de Administración de la matriz. Ese
 * parámetro lo añade la migración
 * `20261002101000_aims_proponer_sujeto_organo.sql`; antes la RPC no escribía
 * `aims_ria_subjects.governing_body_id` y el panel «Órgano rector» del
 * Dashboard de AIMS no tenía vía por dato en el grupo nuevo (no tiene
 * política de IA). No se fabrica ninguna política.
 *
 * Requiere la migración aplicada: sin ella la llamada con
 * `p_governing_body_id` falla (PostgREST no encuentra la firma) y el script
 * se detiene sin escribir nada.
 *
 * Idempotente: si ya existe el sujeto (sistema, entidad, rol), no propone
 * otro. Si existe SIN órgano, lo dice y no lo toca (no hay RPC para
 * completarlo; se decidiría aparte).
 *
 * Uso:
 *   bun run scripts/aims/seed-organo-ia-grupo-nuevo.ts            # dry-run
 *   bun run scripts/aims/seed-organo-ia-grupo-nuevo.ts --commit   # ejecuta
 */
import { GRUPO_NUEVO_ADMIN, GRUPO_NUEVO_TENANT, iniciarSesion } from "../_lib/session";

const COMMIT = process.argv.includes("--commit");

export const CDA_CORPORACION_NUEVA_ID = "db8073bb-5089-4bbf-a9a9-456d457f59b7";
export const CORPORACION_NUEVA_ENTITY_ID = "45c8df67-64c9-42a3-abff-8047dd23748b";
export const SISTEMA_MOI55_REAL_ID = "75635765-47fd-4020-bdb7-61859be67c31";

// Los 6 sistemas restantes del tenant que NO se declaran (residuales):
// 3 duplicados anteriores del mismo recorrido MOI-55 y 3 sondas E2E. Sirven
// aquí solo para que la lectura del tenant pueda advertir si aparecen y
// hacer explícito por qué se excluyen, no para escribir sobre ellos.
export const SISTEMAS_RESIDUALES_CONOCIDOS = [
  "734fab6e-ea00-4a17-a619-7ca72a843864", // Recorrido MOI-55, ejecución anterior
  "77738905-6a37-4ba7-917c-12839188a9d2", // Recorrido MOI-55, ejecución anterior
  "5e2abfd5-38c3-42ba-9a12-27ec19c6677e", // Recorrido MOI-55, ejecución anterior
  "c2de36c9-d386-481e-935c-850b339dcbcd", // PROBE-E2E-*
  "a5309fae-64ea-4aaf-b037-fc3287da1a4d", // PROBE-E2E-*
  "6d004495-70bb-452b-89ae-994ba8134955", // PROBE-E2E-*
];

const RATIONALE =
  "D-28 (MOI-150, por delegación de Moisés): Corporación Nueva, S.A. pone en servicio el sistema del recorrido MOI-55 para uso propio; hipótesis a validar por el comité de IA real del cliente, como en ARGA (D-U1) y Garrigues (D-U3).";

export interface SujetoExistente {
  system_id: string;
  entity_id: string;
  role: string;
  governing_body_id?: string | null;
}

const ROL = "RESPONSABLE_DESPLIEGUE" as const;

/** Pura: idempotente — si la tupla (sistema, entidad, rol) ya existe, no se propone de nuevo. */
export function yaDeclarado(existentes: SujetoExistente[]): boolean {
  return existentes.some(
    (e) => e.system_id === SISTEMA_MOI55_REAL_ID && e.entity_id === CORPORACION_NUEVA_ENTITY_ID && e.role === ROL,
  );
}

async function main() {
  console.log("MOI-150 — órgano de gobierno de la IA del Grupo Nuevo (D-28: Consejo de Administración de Corporación Nueva, S.A.)\n");

  const sesion = await iniciarSesion(GRUPO_NUEVO_ADMIN);

  const { data: sistemas, error: errSis } = await sesion
    .from("ai_systems")
    .select("id, name, ai_policy_id")
    .eq("tenant_id", GRUPO_NUEVO_TENANT);
  if (errSis) throw new Error(`lectura ai_systems: ${errSis.message}`);

  const desconocido = (sistemas ?? []).filter(
    (s) => s.id !== SISTEMA_MOI55_REAL_ID && !SISTEMAS_RESIDUALES_CONOCIDOS.includes(s.id),
  );
  if (desconocido.length > 0) {
    console.log(
      `AVISO: ${desconocido.length} sistema(s) del Grupo Nuevo no están en la lista conocida (ni el real ni los residuales) — revisar antes de commitear:`,
    );
    for (const s of desconocido) console.log(`  ${s.id} — ${s.name}`);
  }

  const { data: existentes, error: errSub } = await sesion
    .from("aims_ria_subjects")
    .select("system_id, entity_id, role, governing_body_id")
    .eq("tenant_id", GRUPO_NUEVO_TENANT);
  if (errSub) throw new Error(`lectura aims_ria_subjects: ${errSub.message}`);

  const propone = !yaDeclarado((existentes ?? []) as SujetoExistente[]);

  console.log(`Sistema declarado: ${SISTEMA_MOI55_REAL_ID} (recorrido MOI-55, real)`);
  console.log(`Entidad sujeto: Corporación Nueva, S.A. (${CORPORACION_NUEVA_ENTITY_ID})`);
  console.log(`Rol propuesto: ${ROL} (SIEMBRA_HIPOTESIS, a validar)`);
  console.log(propone ? "  → se propondría 1 sujeto nuevo por fn_aims_proponer_sujeto" : "  → ya declarado, sin cambio (idempotente)");

  const previo = ((existentes ?? []) as SujetoExistente[]).find(
    (e) => e.system_id === SISTEMA_MOI55_REAL_ID && e.entity_id === CORPORACION_NUEVA_ENTITY_ID && e.role === ROL,
  );
  console.log(`Órgano declarado (D-28): Consejo de Administración de Corporación Nueva, S.A. (${CDA_CORPORACION_NUEVA_ID})`);
  if (previo && previo.governing_body_id !== CDA_CORPORACION_NUEVA_ID) {
    console.log(
      `AVISO: el sujeto ya existe con órgano ${previo.governing_body_id ?? "NULL"}; no se modifica (no hay RPC para completarlo).`,
    );
  }

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
    return;
  }

  if (!propone) {
    console.log("\nNada que aplicar.");
    return;
  }

  const { error: rpcError } = await sesion.rpc("fn_aims_proponer_sujeto", {
    p_system_id: SISTEMA_MOI55_REAL_ID,
    p_entity_id: CORPORACION_NUEVA_ENTITY_ID,
    p_role: ROL,
    p_derivation: "SIEMBRA_HIPOTESIS",
    p_role_basis: ["3.4"],
    p_rationale: RATIONALE,
    p_governing_body_id: CDA_CORPORACION_NUEVA_ID,
  });
  if (rpcError) throw new Error(`fn_aims_proponer_sujeto: ${rpcError.message}`);
  console.log("  ✓ sujeto propuesto (PROPUESTO) con el órgano declarado — el panel «Órgano rector» de AIMS lo lee por dato");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
