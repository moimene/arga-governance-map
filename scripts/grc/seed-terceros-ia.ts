#!/usr/bin/env bun
/**
 * Seed F5.T9 (MOI-175) — terceros de IA en `grc_third_parties`.
 *
 * Fuente de verdad: la especificación
 * docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md §8
 * "Dato demo" fija, literalmente, los terceros de cada tenant:
 *   - Garrigues (…0002): Microsoft; Counsel AI Corporation (Harvey, EE. UU.,
 *     establecimiento en la UE por declarar); OpenAI y Anthropic
 *     (PROVEEDOR_MODELO_GPAI).
 *   - ARGA (…0001): Palantir (FraudGuard), Bloomberg (InvestmentAdvisor) y
 *     Microsoft Azure OpenAI (ARGA Assist).
 * Total: 7 (el "siete terceros" de la aceptación de F5.T9 es la suma de los
 * dos tenants, no una lista aparte). No se inventa ningún dato que la
 * especificación no fije: sin rol de IA declarado → `ai_roles = {}`; sin
 * representante en la UE declarado → `eu_representative = NULL`.
 *
 * Requiere la migración 20260928110000_grc_terceros_ia.sql aplicada (las 5
 * columnas nuevas de `grc_third_parties`).
 *
 * Idempotencia: `grc_third_parties` tiene PK nativa (tenant_id, id) — el
 * upsert va por esa clave con ids deterministas (`TPRM-IA-<TENANT>-NNN`).
 * Reejecutar actualiza, nunca duplica. No borra ni pisa las 5 filas
 * TPRM-ARGA-* preexistentes (DORA, no IA): esos ids no se tocan.
 *
 * Contrato cero-cambio ARGA: sólo añade 3 filas nuevas de ARGA, declaradas
 * arriba y en el ledger; no toca ninguna fila TPRM-ARGA-* existente.
 *
 * Uso: bun run scripts/grc/seed-terceros-ia.ts [--commit]
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "../garrigues/entities-catalog";

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";

function crearAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

const COMMIT = process.argv.includes("--commit");

// Defaults honestos: ninguna diligencia se ha corrido todavía sobre estos
// terceros de IA, así que no se marca "Completada"/"Conforme" (mismo criterio
// que TPRM.tsx ya aplica al alta manual: ver comentario en src/pages/grc/TPRM.tsx).
const SIN_DILIGENCIA = "Pendiente";
const BASE_REGULATORIA_IA = "Reglamento (UE) 2024/1689 (RIA) — proveedor de sistema o modelo de IA";
const SIN_OWNER = "Pendiente de asignación";

type TerceroIa = {
  id: string;
  tenant_id: string;
  provider: string;
  service: string;
  legal_entity_name?: string;
  country: string;
  eu_representative?: string | null;
  is_ai_supplier: true;
  ai_roles: string[];
  payload?: Record<string, unknown>;
};

const TERCEROS_IA: TerceroIa[] = [
  // Garrigues (…0002) — §8 "Dato demo" > Garrigues > 2. Terceros.
  {
    id: "TPRM-IA-GARR-001",
    tenant_id: GARRIGUES_TENANT,
    provider: "Microsoft",
    service: "Infraestructura y modelos de IA (Copilot)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: [],
  },
  {
    id: "TPRM-IA-GARR-002",
    tenant_id: GARRIGUES_TENANT,
    provider: "Harvey",
    service: "Plataforma de IA generativa legal",
    legal_entity_name: "Counsel AI Corporation",
    country: "US",
    eu_representative: null,
    is_ai_supplier: true,
    ai_roles: [],
    payload: { nota: "Establecimiento en la UE del art. 25 RIA por declarar (especificación 2026-09-19 §8)." },
  },
  {
    id: "TPRM-IA-GARR-003",
    tenant_id: GARRIGUES_TENANT,
    provider: "OpenAI",
    service: "Modelo GPAI (GA_IA)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: ["PROVEEDOR_MODELO_GPAI"],
  },
  {
    id: "TPRM-IA-GARR-004",
    tenant_id: GARRIGUES_TENANT,
    provider: "Anthropic",
    service: "Modelo GPAI (GA_IA)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: ["PROVEEDOR_MODELO_GPAI"],
  },
  // ARGA (…0001) — §8 "Dato demo" > ARGA > 2. Terceros.
  {
    id: "TPRM-IA-ARGA-001",
    tenant_id: ARGA_TENANT,
    provider: "Palantir",
    service: "Plataforma de detección de fraude (FraudGuard)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: [],
  },
  {
    id: "TPRM-IA-ARGA-002",
    tenant_id: ARGA_TENANT,
    provider: "Bloomberg",
    service: "Datos y analítica financiera (InvestmentAdvisor)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: [],
  },
  {
    id: "TPRM-IA-ARGA-003",
    tenant_id: ARGA_TENANT,
    provider: "Microsoft Azure OpenAI",
    service: "Modelo de IA generativa (ARGA Assist)",
    country: "US",
    is_ai_supplier: true,
    ai_roles: [],
  },
];

async function main() {
  if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) {
    console.error(`✗ Target inesperado (${SUPABASE_URL}).`);
    process.exit(1);
  }
  if (!SERVICE_KEY) {
    console.error("✗ Falta la service role key (ver SERVICE_KEY_NAMES).");
    process.exit(1);
  }
  const admin = crearAdmin();

  const { data: existentes, error: errLectura } = await admin
    .from("grc_third_parties")
    .select("tenant_id, id, is_ai_supplier")
    .in("tenant_id", [GARRIGUES_TENANT, ARGA_TENANT]);
  if (errLectura) {
    console.error(`✗ lectura previa de grc_third_parties: ${errLectura.message}`);
    process.exit(1);
  }
  const yaEsIa = new Set(
    (existentes ?? []).filter((r) => r.is_ai_supplier).map((r) => `${r.tenant_id}:${r.id}`),
  );

  console.log(`Terceros de IA a sembrar: ${TERCEROS_IA.length} (4 Garrigues + 3 ARGA).`);
  for (const t of TERCEROS_IA) {
    const marcador = yaEsIa.has(`${t.tenant_id}:${t.id}`) ? "actualizar" : "nuevo";
    console.log(`  [${marcador}] ${t.id} — ${t.provider} (${t.country})`);
  }

  if (!COMMIT) {
    console.log("\nDry-run (sin --commit): no se ha escrito nada.");
    return;
  }

  const filas = TERCEROS_IA.map((t) => ({
    tenant_id: t.tenant_id,
    id: t.id,
    provider: t.provider,
    service: t.service,
    criticality: SIN_DILIGENCIA,
    cloud_exposure: "Servicio API en la nube",
    regulatory_basis: BASE_REGULATORIA_IA,
    due_diligence: SIN_DILIGENCIA,
    contract_clauses: SIN_DILIGENCIA,
    exit_plan: SIN_DILIGENCIA,
    owner: SIN_OWNER,
    legal_hold: false,
    legal_entity_name: t.legal_entity_name ?? null,
    country: t.country,
    eu_representative: t.eu_representative ?? null,
    is_ai_supplier: t.is_ai_supplier,
    ai_roles: t.ai_roles,
    payload: t.payload ?? {},
  }));

  const { error: errUpsert } = await admin
    .from("grc_third_parties")
    .upsert(filas, { onConflict: "tenant_id,id" });
  if (errUpsert) {
    console.error(`✗ upsert grc_third_parties: ${errUpsert.message}`);
    process.exit(1);
  }
  console.log(`✓ ${filas.length} terceros de IA sembrados/actualizados.`);
}

main();
