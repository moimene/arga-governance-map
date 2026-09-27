#!/usr/bin/env bun
/**
 * F2.T16 (MOI-170, carril C) — sujetos hipótesis del RIA (ARGA y Garrigues).
 * Spec §8 (ARGA punto 4, Garrigues punto 5); plan §2.3; criterio C11
 * (validado por Harvey) y D-U1 (ACEPTADA 2026-09-20).
 *
 * Todas las filas: `derivation='SIEMBRA_HIPOTESIS'`, `status` resultante de
 * la RPC (PROPUESTO salvo IMPORTADOR/DISTRIBUIDOR/REPRESENTANTE_AUTORIZADO,
 * que no se usan aquí), y `provenance` con `{firmeza:'DEMO_PILOTO',
 * etiqueta:'Simulado', validar:'Legal'}` — marcadas «a validar por Legal»,
 * NUNCA presentadas como acreditadas (DS-34: se cierran y sustituyen, nunca
 * se reescriben).
 *
 * El responsable interno (`owner_person_id`) NO se fija aquí:
 * `fn_aims_proponer_sujeto` no acepta ese parámetro (solo lo fija
 * `fn_aims_confirmar_sujeto` al pasar a VIGENTE, F2.T4/T18 — fuera de este
 * script). Se declara como pendiente, no se simula un UPDATE directo (la
 * tabla es solo-SELECT para `authenticated`).
 *
 * Idempotencia: `fn_aims_proponer_sujeto` hace INSERT puro (no upsert) y el
 * índice único `ux_aims_ria_subjects_vigente` solo cubre status <> CERRADO,
 * así que este script lee primero `aims_ria_subjects` y omite cualquier
 * (system_id, entity_id, role) ya existente, sea cual sea su estado.
 *
 * Escribe con sesión real de `demo@` (SECRETARIO, tiene AIMS_CLASIFICAR en
 * los dos tenants).
 *
 * Uso:
 *   bun run scripts/aims/seed-sujetos-ria.ts            # dry-run
 *   bun run scripts/aims/seed-sujetos-ria.ts --commit   # ejecuta
 */
import { ARGA_SECRETARIO, ARGA_TENANT, GARRIGUES_SECRETARIO, GARRIGUES_TENANT, iniciarSesion } from "../_lib/session";

const COMMIT = process.argv.includes("--commit");

export type Rol =
  | "PROVEEDOR"
  | "RESPONSABLE_DESPLIEGUE"
  | "IMPORTADOR"
  | "DISTRIBUIDOR"
  | "PROVEEDOR_POSTERIOR"
  | "PROVEEDOR_GPAI"
  | "REPRESENTANTE_AUTORIZADO";

export interface SujetoHipotesis {
  systemId: string;
  systemLabel: string;
  entityId: string;
  entityLabel: string;
  role: Rol;
  roleBasis: string[];
  rationale: string;
}

const RATIONALE_ARGA =
  "Hipótesis C11 (Harvey): la sociedad que pone el sistema en servicio con su nombre para uso propio es proveedora y responsable del despliegue (D-U1, ACEPTADA 2026-09-20). A validar por Legal.";

// ARGA — spec §8 punto 4, plan §2.3 (8 sistemas, 13 filas).
export const ARGA_SUJETOS: SujetoHipotesis[] = [
  { systemId: "90000000-0000-0000-0000-000000000001", systemLabel: "Motor de triaje de siniestros auto", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: RATIONALE_ARGA },
  { systemId: "90000000-0000-0000-0000-000000000001", systemLabel: "Motor de triaje de siniestros auto", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_ARGA },
  { systemId: "90000000-0000-0000-0000-000000000002", systemLabel: "Asistente de suscripción patrimonial", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: RATIONALE_ARGA },
  { systemId: "90000000-0000-0000-0000-000000000002", systemLabel: "Asistente de suscripción patrimonial", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_ARGA },
  { systemId: "90000000-0000-0000-0000-000000000003", systemLabel: "Detector de fraude en reembolsos salud", entityId: "b8ac6ae0-2c42-404f-9db4-d5822321544c", entityLabel: "ARGA Salud", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: RATIONALE_ARGA },
  { systemId: "90000000-0000-0000-0000-000000000003", systemLabel: "Detector de fraude en reembolsos salud", entityId: "b8ac6ae0-2c42-404f-9db4-d5822321544c", entityLabel: "ARGA Salud", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_ARGA },
  { systemId: "1148370a-42bb-4a42-9a97-529ce58e800d", systemLabel: "ARGA Score — Scoring de riesgo asegurador", entityId: "34676064-b9f3-489e-9fa4-376d6ccea580", entityLabel: "ARGA Vida y Pensiones", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: "Uso propio (Interno). " + RATIONALE_ARGA },
  { systemId: "1148370a-42bb-4a42-9a97-529ce58e800d", systemLabel: "ARGA Score — Scoring de riesgo asegurador", entityId: "34676064-b9f3-489e-9fa4-376d6ccea580", entityLabel: "ARGA Vida y Pensiones", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: "Uso propio (Interno). " + RATIONALE_ARGA },
  { systemId: "c572b87e-0bcb-43b7-965e-e1804c232302", systemLabel: "ARGA Assist — Chatbot atención cliente", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: RATIONALE_ARGA },
  { systemId: "c572b87e-0bcb-43b7-965e-e1804c232302", systemLabel: "ARGA Assist — Chatbot atención cliente", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_ARGA },
  { systemId: "900a2ea7-1d31-434b-afd6-4c08b7458ed8", systemLabel: "FraudGuard — Detección de fraude", entityId: "83059ef7-20ca-4e22-b353-48d14e30bdd9", entityLabel: "ARGA España Seguros y Reaseguros", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: "Proveedor externo (Palantir), sin sujeto propio en este carril. " + RATIONALE_ARGA },
  { systemId: "67fdbcb6-fccd-4ab6-ba9c-429e776865e9", systemLabel: "DocAnalyzer — Lectura automática documentos", entityId: "d0e36d02-032c-5eb4-9436-213cc92554de", entityLabel: "ARGA Servicios Corporativos", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_ARGA },
  { systemId: "c73cd129-05f7-48eb-a8a4-7aa4a030bfb5", systemLabel: "InvestmentAdvisor — Recomendaciones cartera", entityId: "ed833c36-9581-4f22-bd8d-cb7f85c09ce0", entityLabel: "ARGA Inversiones, SICAV", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: "Proveedor externo (Bloomberg AI), sin sujeto propio en este carril. " + RATIONALE_ARGA },
];

// Garrigues — spec §8 punto 5 (matriz J&A Garrigues, S.L.P. como sujeto de
// Copilot/Harvey/GA_IA; PROVEEDOR y PROVEEDOR_POSTERIOR de GA_IA según D-U3).
const RATIONALE_GARR = "D-U3: J&A Garrigues, S.L.P. pone en servicio GA_IA con su marca. A validar por Legal.";
export const GARRIGUES_SUJETOS: SujetoHipotesis[] = [
  { systemId: "ad4bd689-a6ca-43b3-a8ae-7b57a705fd36", systemLabel: "Copilot", entityId: "00000000-0000-0000-0002-000000000001", entityLabel: "J&A Garrigues, S.L.P.", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_GARR },
  { systemId: "2f877e8c-875d-4b11-9b39-aed0826cacb5", systemLabel: "Harvey", entityId: "00000000-0000-0000-0002-000000000001", entityLabel: "J&A Garrigues, S.L.P.", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_GARR },
  { systemId: "9de8fb46-6da9-4097-9273-4b307a9744a1", systemLabel: "Garrigues GA_IA", entityId: "00000000-0000-0000-0002-000000000001", entityLabel: "J&A Garrigues, S.L.P.", role: "RESPONSABLE_DESPLIEGUE", roleBasis: ["3.4"], rationale: RATIONALE_GARR },
  { systemId: "9de8fb46-6da9-4097-9273-4b307a9744a1", systemLabel: "Garrigues GA_IA", entityId: "00000000-0000-0000-0002-000000000001", entityLabel: "J&A Garrigues, S.L.P.", role: "PROVEEDOR", roleBasis: ["3.3"], rationale: RATIONALE_GARR },
  { systemId: "9de8fb46-6da9-4097-9273-4b307a9744a1", systemLabel: "Garrigues GA_IA", entityId: "00000000-0000-0000-0002-000000000001", entityLabel: "J&A Garrigues, S.L.P.", role: "PROVEEDOR_POSTERIOR", roleBasis: ["3.68"], rationale: RATIONALE_GARR },
];

export interface FilaExistente {
  system_id: string;
  entity_id: string;
  role: string;
}

/** Pura: idempotente — una tupla (system,entity,role) ya presente se omite, sea cual sea su estado. */
export function construirPlan(hipotesis: SujetoHipotesis[], existentes: FilaExistente[]): SujetoHipotesis[] {
  const clave = (s: { systemId: string; entityId: string; role: string }) => `${s.systemId}::${s.entityId}::${s.role}`;
  const yaExiste = new Set(existentes.map((e) => clave({ systemId: e.system_id, entityId: e.entity_id, role: e.role })));
  return hipotesis.filter((h) => !yaExiste.has(clave(h)));
}

async function planearYAplicar(
  etiqueta: string,
  sesion: Awaited<ReturnType<typeof iniciarSesion>>,
  tenantId: string,
  hipotesis: SujetoHipotesis[],
) {
  const { data, error } = await sesion.from("aims_ria_subjects").select("system_id, entity_id, role").eq("tenant_id", tenantId);
  if (error) throw new Error(`lectura aims_ria_subjects (${etiqueta}): ${error.message}`);

  const plan = construirPlan(hipotesis, (data ?? []) as FilaExistente[]);

  console.log(`\n${etiqueta} — ${plan.length}/${hipotesis.length} fila(s) nueva(s) (todas «a validar por Legal»):`);
  for (const h of plan) {
    console.log(`  ${h.systemLabel} × ${h.entityLabel} — ${h.role}`);
  }
  if (plan.length === 0) {
    console.log("  (ya sembradas; sin cambio)");
    return;
  }
  if (!COMMIT) return;

  for (const h of plan) {
    const { error: rpcError } = await sesion.rpc("fn_aims_proponer_sujeto", {
      p_system_id: h.systemId,
      p_entity_id: h.entityId,
      p_role: h.role,
      p_derivation: "SIEMBRA_HIPOTESIS",
      p_role_basis: h.roleBasis,
      p_rationale: h.rationale,
    });
    if (rpcError) throw new Error(`fn_aims_proponer_sujeto(${h.systemLabel}, ${h.role}): ${rpcError.message}`);
    console.log(`  ✓ ${h.systemLabel} — ${h.role}`);
  }
}

async function main() {
  console.log("F2.T16 — sujetos hipótesis del RIA (SIEMBRA_HIPOTESIS, PROPUESTO, a validar por Legal)");
  console.log("Responsable interno (owner_person_id): NO se fija aquí — lo fija fn_aims_confirmar_sujeto (T4/T18).");

  const argaSesion = await iniciarSesion(ARGA_SECRETARIO);
  await planearYAplicar("ARGA", argaSesion, ARGA_TENANT, ARGA_SUJETOS);

  const garrSesion = await iniciarSesion(GARRIGUES_SECRETARIO);
  await planearYAplicar("Garrigues", garrSesion, GARRIGUES_TENANT, GARRIGUES_SUJETOS);

  if (!COMMIT) {
    console.log("\nDry-run. Ejecuta con --commit para aplicar.");
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
