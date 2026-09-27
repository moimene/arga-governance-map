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
 * MECANISMO — LO QUE ESTE SCRIPT HACE Y LO QUE NO PUEDE HACER
 * -------------------------------------------------------------
 * El único parámetro que el issue nombra para "declarar por dato" es la vía
 * de `aims_ria_subjects` (F2.T4: `fn_aims_proponer_sujeto` /
 * `fn_aims_confirmar_sujeto`). Este script SÍ propone un sujeto hipótesis
 * (Corporación Nueva, S.A. como RESPONSABLE_DESPLIEGUE del sistema de MOI-55,
 * SIEMBRA_HIPOTESIS, a validar por el comité de IA real del cliente) por esa
 * vía — es una declaración legítima del RIA y dato útil por derecho propio.
 *
 * PERO verificado contra el SQL real de esa RPC
 * (`supabase/migrations/20260927133000_f2_a3_aims_rpc_sujetos.sql`):
 * `fn_aims_proponer_sujeto` no acepta un parámetro `governing_body_id`, y su
 * INSERT no escribe esa columna. `fn_aims_confirmar_sujeto` tampoco la toca —
 * solo actualiza `status` y `provenance`. Ninguna RPC del carril A escribe
 * `aims_ria_subjects.governing_body_id`; la tabla solo concede SELECT a
 * `authenticated` (no hay UPDATE directo posible). Medido en Cloud
 * (2026-09-27): las 13 filas de ARGA y las 5 de Garrigues en
 * `aims_ria_subjects` tienen `governing_body_id` NULL — el camino nunca se ha
 * usado para esto, ni siquiera donde ya hay sujetos sembrados.
 *
 * CONSECUENCIA: proponer este sujeto NO hace aparecer el panel del Dashboard
 * de AI Governance del Grupo Nuevo. La vía que SÍ resuelve hoy — la que ya
 * hace aparecer el panel en ARGA (CATIT, vía PR-024) y en Garrigues (vía
 * PI-30) — es `policies.owner_body_id` + `ai_systems.ai_policy_id`
 * (`resolveGoverningBodyIdFromPolicies`, `src/lib/aims/governing-body.ts`).
 * El Grupo Nuevo no tiene ninguna política de IA (`policies`) todavía — a
 * diferencia de ARGA/Garrigues, aquí no hay un PR-024/PI-30 al que enlazar. Ni
 * F2.T4 ni este issue autorizan fabricar una política nueva para servir de
 * vehículo, así que este script se detiene en la propuesta del sujeto y
 * deja el hueco declarado — no maquillado — para que Moisés decida entre (a)
 * extender `fn_aims_proponer_sujeto`/`fn_aims_confirmar_sujeto` con un
 * parámetro de órgano (una migración nueva, con su propio ensayo) o (b) crear
 * una política de IA del Grupo Nuevo y repetir el patrón de F2.T15. Ese es el
 * criterio jurídico/técnico reservado que este script NO decide por su cuenta.
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
    .select("system_id, entity_id, role")
    .eq("tenant_id", GRUPO_NUEVO_TENANT);
  if (errSub) throw new Error(`lectura aims_ria_subjects: ${errSub.message}`);

  const propone = !yaDeclarado((existentes ?? []) as SujetoExistente[]);

  console.log(`Sistema declarado: ${SISTEMA_MOI55_REAL_ID} (recorrido MOI-55, real)`);
  console.log(`Entidad sujeto: Corporación Nueva, S.A. (${CORPORACION_NUEVA_ENTITY_ID})`);
  console.log(`Rol propuesto: ${ROL} (SIEMBRA_HIPOTESIS, a validar)`);
  console.log(propone ? "  → se propondría 1 sujeto nuevo por fn_aims_proponer_sujeto" : "  → ya declarado, sin cambio (idempotente)");

  console.log(
    `\nÓrgano D-28: Consejo de Administración de Corporación Nueva, S.A. (${CDA_CORPORACION_NUEVA_ID}).` +
      "\nNOTA IMPORTANTE: ni fn_aims_proponer_sujeto ni fn_aims_confirmar_sujeto aceptan un parámetro de" +
      "\norgano — declarar este sujeto NO hace aparecer el panel del Dashboard (aims_ria_subjects.governing_body_id" +
      "\nno tiene ningún camino de escritura hoy, verificado en el SQL de F2.T4/A3 y en Cloud: 0 de las 18 filas" +
      "\nexistentes en ARGA/Garrigues lo llevan puesto). Hace falta una decisión aparte — ver cabecera del fichero.",
  );

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
  });
  if (rpcError) throw new Error(`fn_aims_proponer_sujeto: ${rpcError.message}`);
  console.log("  ✓ sujeto propuesto (PROPUESTO, sin órgano acreditado — el panel sigue sin aparecer)");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
