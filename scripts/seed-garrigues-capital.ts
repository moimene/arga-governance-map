#!/usr/bin/env bun
/**
 * Seed G2 — Capital canónico de la matriz + holdings de filiales.
 * Restricciones REALES respetadas: capital vigente 11.104.008 € (BORME 24/04/2026);
 * autocartera 18 participaciones = 2,59% derechos (is_treasury); los 3 presenciales
 * suman 0,8875% (acta). Pesos individuales SIEMPRE metadata.peso='INFERIDO'.
 * TOTAL_TITULOS (695) derivado, no inventado: 18 en autocartera = 2,59% de los
 * derechos de voto (acta) → 18/0,0259 ≈ 695 títulos totales; ~2 por socio,
 * coincide con el patrón de transmisión por pares del BORME (121A-122A, 3040A-3041A…).
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID, GARRIGUES_ENTITIES } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cat = loadGovernanceCatalog();

// Restricciones agregadas reales
const AUTOCARTERA_PCT = 2.59;          // 18 participaciones (acta 06/05/2026)
const PRESENCIALES_PCT_TOTAL = 0.8875; // Vives+Zarza+Delgado (acta)
const TOTAL_TITULOS = 695; // derivado: 18 en autocartera = 2,59% (acta 06/05/2026) → ≈695; ~2/socio, coincide con el patrón BORME

async function main() {
  const presenciales = cat.censo.presenciales;
  const representados = cat.censo.representados;
  const pctPresencial = PRESENCIALES_PCT_TOTAL / presenciales.length; // 0.29583...
  const restante = 100 - AUTOCARTERA_PCT - PRESENCIALES_PCT_TOTAL;
  const pctRepresentado = restante / representados.length; // ≈ 0.2814

  console.table([
    { dato: "capital vigente (€)", valor: 11104008 },
    { dato: "pct por presencial (INFERIDO)", valor: pctPresencial.toFixed(4) },
    { dato: "pct por representado (INFERIDO)", valor: pctRepresentado.toFixed(4) },
    { dato: "suma control", valor: (AUTOCARTERA_PCT + 3 * pctPresencial + 343 * pctRepresentado).toFixed(4) },
  ]);
  if (!COMMIT) { console.log("Dry-run."); return; }

  // 1) Clase A
  const { data: sc0 } = await admin.from("share_classes").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID).eq("class_code", "A").maybeSingle();
  let claseA = sc0?.id;
  if (!claseA) {
    const { data, error } = await admin.from("share_classes").insert({
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      class_code: "A", name: "Participaciones Clase A", votes_per_title: 1, voting_rights: true,
    }).select("id").single();
    if (error) fail(`share_classes: ${error.message}`);
    claseA = data.id;
  }

  // 2) Perfil de capital VIGENTE (una fila VIGENTE por entidad — regla canónica)
  const { data: prof0 } = await admin.from("entity_capital_profile").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID).eq("estado", "VIGENTE").maybeSingle();
  if (!prof0) {
    const { error } = await admin.from("entity_capital_profile").insert({
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID, currency: "EUR",
      capital_escriturado: 11104008, capital_desembolsado: 11104008,
      estado: "VIGENTE", effective_from: "2026-04-24",
    });
    if (error) fail(`capital_profile: ${error.message}`);
  } else {
    const { error } = await admin.from("entity_capital_profile")
      .update({ capital_escriturado: 11104008, capital_desembolsado: 11104008, effective_from: "2026-04-24" })
      .eq("id", prof0.id);
    if (error) fail(`capital_profile update: ${error.message}`);
  }

  // 3) Holdings del censo (idempotente por holder+entity)
  async function ensureHolding(holderId, pct, extra = {}) {
    const { data } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID)
      .eq("holder_person_id", holderId).maybeSingle();
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      holder_person_id: holderId, share_class_id: claseA,
      porcentaje_capital: pct, voting_rights: true, is_treasury: false,
      numero_titulos: Math.max(1, Math.round((pct / 100) * TOTAL_TITULOS)),
      effective_from: "2026-05-06",
      metadata: { peso: "INFERIDO", nota: "Reparto uniforme bajo restricciones agregadas reales del acta 06/05/2026" },
      ...extra,
    };
    if (data) {
      const { error } = await admin.from("capital_holdings").update(row).eq("id", data.id);
      if (error) fail(`holding update: ${error.message}`);
    } else {
      const { error } = await admin.from("capital_holdings").insert(row);
      if (error) fail(`holding insert: ${error.message}`);
    }
  }

  const pid = async (nombre) => {
    const { data, error } = await admin.from("persons").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("full_name", nombre).maybeSingle();
    if (error || !data) fail(`persona no sembrada: ${nombre}`);
    return data.id;
  };

  for (const n of presenciales) await ensureHolding(await pid(n), pctPresencial);
  for (const n of representados) await ensureHolding(await pid(n), pctRepresentado);

  // Autocartera: titular = la propia matriz (persona PJ de la entidad matriz)
  const { data: matriz } = await admin.from("entities").select("person_id").eq("id", GARRIGUES_MATRIZ_UUID).single();
  await ensureHolding(matriz.person_id, AUTOCARTERA_PCT, {
    is_treasury: true, voting_rights: false, numero_titulos: 18, effective_from: "2026-05-06",
    metadata: { peso: "REAL", nota: "18 participaciones en autocartera (acta 06/05/2026, 2,59% de los derechos de voto)" },
  });
  console.log("✓ 347 holdings de la matriz (346 socios + autocartera)");

  // 4) Holdings de filiales con % CONFIRMADO (titular: matriz u otra del grupo)
  const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));
  for (const e of GARRIGUES_ENTITIES) {
    if (!e.parentSlug || e.ownershipPct == null) continue;
    if (e.provenance.confianza !== "CONFIRMADO" && e.slug !== "ead-trust-sl") continue;
    const parent = bySlug.get(e.parentSlug);
    const { data: pEnt } = await admin.from("entities").select("person_id").eq("id", parent.uuid).single();
    const { data: h0 } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", e.uuid)
      .eq("holder_person_id", pEnt.person_id).maybeSingle();
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: e.uuid, holder_person_id: pEnt.person_id,
      porcentaje_capital: e.ownershipPct, voting_rights: true, is_treasury: false,
      numero_titulos: 1, effective_from: "2026-04-24",
      metadata: { fuente: "IDC 2025", confianza: e.provenance.confianza, titulos_no_aplica: true },
    };
    if (h0) {
      const { error } = await admin.from("capital_holdings").update(row).eq("id", h0.id);
      if (error) fail(`holding filial update ${e.slug}: ${error.message}`);
    } else {
      const { error } = await admin.from("capital_holdings").insert(row);
      if (error) fail(`holding filial insert ${e.slug}: ${error.message}`);
    }
  }
  console.log("✓ Holdings de filiales (CONFIRMADO + EAD 51 A_CONFIRMAR)");

  // 5) Refresh de la proyección (firma sondada en Step 1; ajustar args si difieren)
  const { error: eRpc } = await admin.rpc("fn_refresh_parte_votante_entity", {
    p_entity_id: GARRIGUES_MATRIZ_UUID,
  });
  if (eRpc) console.warn(`⚠ fn_refresh_parte_votante_entity: ${eRpc.message} — revisar firma (Step 1) y re-ejecutar`);
  else console.log("✓ parte_votante_current refrescada para la matriz");
}
main();
