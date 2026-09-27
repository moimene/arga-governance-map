#!/usr/bin/env bun
/**
 * F2.T15 (MOI-170, carril C) — órgano de PR-024/PI-30 y su asignación a los
 * sistemas de IA. Spec §7 ("Políticas") y §8 punto 5 (ARGA) / punto 7
 * (Garrigues); plan §2.3.
 *
 * PR-024 (ARGA, Draft): `owner_body_id` ← CATIT (D-U2). El `status` NO se
 * toca — sigue Draft, tal como pide el plan.
 * PI-30 (Garrigues, Published): `owner_body_id` ya está puesto al Comité de
 * Gobernanza de la IA (medido en Cloud el 2026-09-27) — se declara sin
 * cambio, no se pisa.
 * `ai_systems.ai_policy_id`: los 8 de ARGA → PR-024, los 6 sistemas de
 * Garrigues → PI-30 (spec §8.7 y criterio de aceptación F2.T16: "ai_policy_id
 * = PI-30 ... en los 6 de Garrigues"), solo donde es NULL.
 *
 * Escribe con sesión real por tenant (SECRETARIO tiene AIMS_INVENTARIO, que
 * es lo que exige la política UPDATE de `ai_systems`; `policies` es
 * tenant-scoped sin capacidad adicional — verificado contra Cloud).
 *
 * Uso:
 *   bun run scripts/politicas/seed-pr024-owner-body.ts            # dry-run
 *   bun run scripts/politicas/seed-pr024-owner-body.ts --commit   # ejecuta
 */
import { ARGA_SECRETARIO, ARGA_TENANT, GARRIGUES_SECRETARIO, GARRIGUES_TENANT, iniciarSesion } from "../_lib/session";

const COMMIT = process.argv.includes("--commit");

export const PR024_ID = "fbf6c726-3656-48d9-ae56-b1a7c0236161";
export const PI30_ID = "d6d2f0db-3e60-49c4-a71f-eb472d899764";
export const CATIT_ID = "08a4156b-a814-4dc6-b953-fafac1b5b840";
export const GARRIGUES_COMITE_IA_ID = "432e420b-4db1-44f1-81da-e3575b1d3dec";

// Los 8 sistemas de ARGA (medidos en Cloud 2026-09-27).
export const ARGA_SYSTEM_IDS = [
  "c572b87e-0bcb-43b7-965e-e1804c232302", // ARGA Assist
  "1148370a-42bb-4a42-9a97-529ce58e800d", // ARGA Score
  "90000000-0000-0000-0000-000000000002", // Asistente de suscripción patrimonial
  "90000000-0000-0000-0000-000000000003", // Detector de fraude en reembolsos salud
  "67fdbcb6-fccd-4ab6-ba9c-429e776865e9", // DocAnalyzer
  "900a2ea7-1d31-434b-afd6-4c08b7458ed8", // FraudGuard
  "c73cd129-05f7-48eb-a8a4-7aa4a030bfb5", // InvestmentAdvisor
  "90000000-0000-0000-0000-000000000001", // Motor de triaje de siniestros auto
];

// Los 6 sistemas de Garrigues (spec §8.7: "ai_policy_id = PI-30 y órgano =
// Comité en los 6"; criterio de aceptación F2.T16 repite "en los 6 de
// Garrigues"). Medidos en Cloud el 2026-09-27, los 6 con ai_policy_id NULL.
export const GARRIGUES_SYSTEM_IDS = [
  "ad4bd689-a6ca-43b3-a8ae-7b57a705fd36", // Copilot
  "9de8fb46-6da9-4097-9273-4b307a9744a1", // Garrigues GA_IA
  "2f877e8c-875d-4b11-9b39-aed0826cacb5", // Harvey
  "bd0ece3d-86fb-4c33-8e3d-df8b25d0394f", // Acuerdo enterprise Anthropic
  "3cb6547f-656f-485f-b9da-04426f55e8bb", // Acuerdo enterprise OpenAI
  "5cdc4893-f57d-4596-a80d-a9079e50fadb", // Soluciones agénticas de proceso
];

export interface PoliticaRow {
  id: string;
  owner_body_id: string | null;
}
export interface SistemaRow {
  id: string;
  ai_policy_id: string | null;
}
export interface CambioId {
  id: string;
  antes: string | null;
  despues: string;
}

const OBJETIVO_POLITICA: Record<string, string> = {
  [PR024_ID]: CATIT_ID,
  [PI30_ID]: GARRIGUES_COMITE_IA_ID,
};

/** Pura: idempotente, orden-independiente. */
export function construirPlanPoliticas(politicas: PoliticaRow[]): CambioId[] {
  return politicas
    .filter((p) => OBJETIVO_POLITICA[p.id] && p.owner_body_id == null)
    .map((p) => ({ id: p.id, antes: null, despues: OBJETIVO_POLITICA[p.id] }));
}

/** Pura: idempotente, orden-independiente. */
export function construirPlanSistemas(sistemas: SistemaRow[]): CambioId[] {
  const objetivo: Record<string, string> = {};
  for (const id of ARGA_SYSTEM_IDS) objetivo[id] = PR024_ID;
  for (const id of GARRIGUES_SYSTEM_IDS) objetivo[id] = PI30_ID;
  return sistemas
    .filter((s) => objetivo[s.id] && s.ai_policy_id == null)
    .map((s) => ({ id: s.id, antes: null, despues: objetivo[s.id] }));
}

async function main() {
  const argaSesion = await iniciarSesion(ARGA_SECRETARIO);
  const garrSesion = await iniciarSesion(GARRIGUES_SECRETARIO);

  const [{ data: politicas, error: errPol }, { data: sistemasArga, error: errSisArga }, { data: sistemasGarr, error: errSisGarr }] =
    await Promise.all([
      argaSesion.from("policies").select("id, owner_body_id").in("id", [PR024_ID]),
      argaSesion.from("ai_systems").select("id, ai_policy_id").eq("tenant_id", ARGA_TENANT).in("id", ARGA_SYSTEM_IDS),
      garrSesion.from("ai_systems").select("id, ai_policy_id").eq("tenant_id", GARRIGUES_TENANT).in("id", GARRIGUES_SYSTEM_IDS),
    ]);
  if (errPol) throw new Error(`lectura policies (PR-024): ${errPol.message}`);
  if (errSisArga) throw new Error(`lectura ai_systems ARGA: ${errSisArga.message}`);
  if (errSisGarr) throw new Error(`lectura ai_systems Garrigues: ${errSisGarr.message}`);

  // PI-30 vive en el tenant de Garrigues: leerla con la sesión de Garrigues.
  const { data: pi30, error: errPi30 } = await garrSesion.from("policies").select("id, owner_body_id").eq("id", PI30_ID);
  if (errPi30) throw new Error(`lectura policies (PI-30): ${errPi30.message}`);

  const planPoliticas = construirPlanPoliticas([...(politicas ?? []), ...(pi30 ?? [])] as PoliticaRow[]);
  const planSistemas = construirPlanSistemas([...(sistemasArga ?? []), ...(sistemasGarr ?? [])] as SistemaRow[]);

  console.log("F2.T15 — órgano de PR-024/PI-30 y ai_policy_id de sus sistemas\n");
  console.log(`PR-024: status Draft, sin tocar. owner_body_id: ${planPoliticas.find((c) => c.id === PR024_ID) ? "∅ → CATIT" : "sin cambio (ya puesto o inexistente)"}`);
  console.log(`PI-30: owner_body_id: ${planPoliticas.find((c) => c.id === PI30_ID) ? "∅ → Comité de Gobernanza de la IA" : "sin cambio (ya puesto)"}`);
  console.log(`\nai_policy_id — ${planSistemas.length} sistema(s) con cambio de ${ARGA_SYSTEM_IDS.length + GARRIGUES_SYSTEM_IDS.length} candidatos:`);
  for (const c of planSistemas) {
    console.log(`  ${c.id}: ∅ → ${c.despues === PR024_ID ? "PR-024" : "PI-30"}`);
  }

  if (planPoliticas.length === 0 && planSistemas.length === 0) {
    console.log("\nNada que aplicar.");
    return;
  }

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
    return;
  }

  for (const c of planPoliticas) {
    const sesion = c.id === PR024_ID ? argaSesion : garrSesion;
    const { error } = await sesion.from("policies").update({ owner_body_id: c.despues }).eq("id", c.id);
    if (error) throw new Error(`update policies ${c.id}: ${error.message}`);
    console.log(`  ✓ policies ${c.id} → owner_body_id ${c.despues}`);
  }
  for (const c of planSistemas) {
    const sesion = ARGA_SYSTEM_IDS.includes(c.id) ? argaSesion : garrSesion;
    const { error } = await sesion.from("ai_systems").update({ ai_policy_id: c.despues }).eq("id", c.id);
    if (error) throw new Error(`update ai_systems ${c.id}: ${error.message}`);
    console.log(`  ✓ ai_systems ${c.id} → ai_policy_id ${c.despues}`);
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
