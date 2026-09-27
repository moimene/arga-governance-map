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
 * MECANISMO
 * ---------
 * D-28 bis (por delegación de Moisés, migración `20260928172000`): en vez de
 * fabricar una política de IA del Grupo Nuevo (opción (b) del hueco que este
 * script declaraba), se completó F2.T4 con el modelo de F2.T9 —
 * `fn_aims_proponer_sujeto` acepta ahora `p_governing_body_id`, exige
 * `AIMS_GOBIERNO` para usarlo y valida que el órgano sea del mismo tenant.
 * Este script propone el sujeto hipótesis (Corporación Nueva, S.A. como
 * RESPONSABLE_DESPLIEGUE del sistema de MOI-55, SIEMBRA_HIPOTESIS, a validar
 * por el comité de IA real del cliente) declarando DE UNA VEZ el órgano
 * (D-28: el Consejo de Administración de Corporación Nueva, S.A. — el grupo
 * nuevo no tiene comité especializado de IA). Con esto, `governing_body_id`
 * queda puesto y `resolveGoverningBodyIdFromSubjects`
 * (`src/lib/aims/governing-body.ts`, F2.T9, vía `useAiGovernanceBody`) lo
 * resuelve: el panel del Dashboard de AI Governance del Grupo Nuevo aparece.
 *
 * Requiere una sesión con `AIMS_GOBIERNO` (`admin@grupo-nuevo-demo.dev`,
 * ADMIN_TENANT — `demo@` es SECRETARIO y no la tiene, se rechazaría).
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
  governing_body_id: string | null;
}

const ROL = "RESPONSABLE_DESPLIEGUE" as const;

/** Pura: idempotente — si la tupla (sistema, entidad, rol) ya existe, no se propone de nuevo. */
export function yaDeclarado(existentes: SujetoExistente[]): boolean {
  return existentes.some(
    (e) => e.system_id === SISTEMA_MOI55_REAL_ID && e.entity_id === CORPORACION_NUEVA_ENTITY_ID && e.role === ROL,
  );
}

/** Pura: el sujeto ya existe pero sin el órgano D-28 puesto (p.ej. una corrida previa a esta migración). */
export function faltaOrgano(existentes: SujetoExistente[]): boolean {
  const fila = existentes.find(
    (e) => e.system_id === SISTEMA_MOI55_REAL_ID && e.entity_id === CORPORACION_NUEVA_ENTITY_ID && e.role === ROL,
  );
  return fila !== undefined && fila.governing_body_id !== CDA_CORPORACION_NUEVA_ID;
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

  const filas = (existentes ?? []) as SujetoExistente[];
  const propone = !yaDeclarado(filas);
  const confirma = !propone && faltaOrgano(filas);

  console.log(`Sistema declarado: ${SISTEMA_MOI55_REAL_ID} (recorrido MOI-55, real)`);
  console.log(`Entidad sujeto: Corporación Nueva, S.A. (${CORPORACION_NUEVA_ENTITY_ID})`);
  console.log(`Rol propuesto: ${ROL} (SIEMBRA_HIPOTESIS, a validar)`);
  console.log(`Órgano D-28: Consejo de Administración de Corporación Nueva, S.A. (${CDA_CORPORACION_NUEVA_ID})`);
  if (propone) {
    console.log("  → se propondría 1 sujeto nuevo por fn_aims_proponer_sujeto, CON el órgano D-28 puesto de una vez");
  } else if (confirma) {
    console.log("  → el sujeto ya existe SIN el órgano D-28 — se completaría por fn_aims_confirmar_sujeto");
  } else {
    console.log("  → ya declarado con el órgano D-28, sin cambio (idempotente)");
  }

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
    return;
  }

  if (!propone && !confirma) {
    console.log("\nNada que aplicar.");
    return;
  }

  if (propone) {
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
    console.log("  ✓ sujeto propuesto (PROPUESTO, órgano D-28 acreditado — el panel del Dashboard debería aparecer)");
    return;
  }

  // confirma: el sujeto ya existía (p.ej. de una corrida anterior a esta
  // migración) sin el órgano. Se completa con el motivo D-28, sin tocar
  // status (se pasa el mismo que ya tiene la fila).
  const filaExistente = filas.find(
    (e) => e.system_id === SISTEMA_MOI55_REAL_ID && e.entity_id === CORPORACION_NUEVA_ENTITY_ID && e.role === ROL,
  )!;
  const { data: sujetoActual, error: errActual } = await sesion
    .from("aims_ria_subjects")
    .select("id, status")
    .eq("tenant_id", GRUPO_NUEVO_TENANT)
    .eq("system_id", filaExistente.system_id)
    .eq("entity_id", filaExistente.entity_id)
    .eq("role", filaExistente.role)
    .single();
  if (errActual || !sujetoActual) throw new Error(`lectura del sujeto existente: ${errActual?.message ?? "no encontrado"}`);

  const { error: rpcError } = await sesion.rpc("fn_aims_confirmar_sujeto", {
    p_subject_id: sujetoActual.id,
    p_nuevo_status: sujetoActual.status,
    p_motivo: RATIONALE,
    p_governing_body_id: CDA_CORPORACION_NUEVA_ID,
  });
  if (rpcError) throw new Error(`fn_aims_confirmar_sujeto: ${rpcError.message}`);
  console.log("  ✓ órgano D-28 completado sobre el sujeto existente — el panel del Dashboard debería aparecer");
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
