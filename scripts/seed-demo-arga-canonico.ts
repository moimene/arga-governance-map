// scripts/seed-demo-arga-canonico.ts
/**
 * T17 — Canonical seed for the ARGA demo corporate structure.
 *
 * Target cap table (per CLAUDE.md / §8 of the spec):
 *
 *   Fundación ARGA  ─100%→  Cartera ARGA S.L.U.  ─69.69%→  ARGA Seguros S.A.
 *                                                 ─30.31%→  Free Float (Mercado libre)
 *
 * DEVIATIONS FROM PLAN (pre-approved at dispatch time, all discovered via
 * MCP execute_sql on project hzqwefkwsxopwrmtksbg before writing this file):
 *
 *   1. Plan's ENTITY_ARGA = "00000000-0000-0000-0000-000000000010" DOES NOT
 *      EXIST on Cloud. The real ARGA Seguros entity is
 *      "6d7ed736-f263-4531-a59d-c6ca0cd41602". The helper constant
 *      DEMO_ENTITY_ARGA in src/test/helpers/supabase-test-client.ts has
 *      been updated in lock-step.
 *
 *   2. Plan inserts 4 new PJ rows with stable IDs 10000000-*. T14 bootstrap
 *      ALREADY created PJs for every entity via the synthetic
 *      'PENDIENTE-<entity.id>' tax_id. So we UPDATE the existing PJs for
 *      Fundación/Cartera/ARGA to canonical tax_ids (G-99999901 etc.),
 *      rather than create orphaned duplicates. Only PJ_MERCADO_LIBRE is
 *      net-new (no entity to bootstrap from — it's an aggregate of the
 *      listed-share free float). Its stable UUID is the plan's
 *      10000000-0000-0000-0000-000000000004.
 *
 *   3. Plan uses person_type = 'JURIDICA' but the Cloud CHECK constraint
 *      persons_person_type_check restricts values to 'PF'|'PJ'. Use 'PJ'.
 *
 *   4. T16 bootstrap backfill has inserted 9 holdings on ARGA Seguros
 *      (from mandates.porcentaje_capital, summing to 75%). Those represent
 *      legacy mandate-based ownership data that does NOT match the
 *      canonical IAR 2025 cap table. Close them all (effective_to = today)
 *      before inserting the canonical 69.69/30.31.
 *
 *   5. Plan's condiciones upsert uses onConflict: "person_id,entity_id,tipo_condicion".
 *      The actual unique index ux_condicion_vigente is partial and uses
 *      COALESCE(body_id, zero-uuid) — Supabase PostgREST onConflict can't
 *      reference that index. Use explicit SELECT-then-INSERT-if-missing.
 *
 *   6. Plan's upsertRepresentacion is a bare insert. The
 *      ux_representaciones_vigente unique index uses
 *      (represented_person_id, scope, COALESCE(effective_to, ...)), so we
 *      also use SELECT-then-INSERT-if-missing.
 *
 * Idempotency: every write is tolerant of prior runs. The script can be
 * rerun safely — UPDATEs are deterministic, INSERTs check existence first,
 * and holdings use the close-then-insert pattern.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
      "Source .env.local before running."
  );
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const TENANT = "00000000-0000-0000-0000-000000000001";

// Real Cloud UUIDs for entities (discovered via MCP query at dispatch).
const ENTITY_ARGA_SEGUROS = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
const ENTITY_CARTERA = "00000000-0000-0000-0000-000000000020";
const ENTITY_FUNDACION = "7b9dd701-1ed1-4911-88ba-e186a86083bc";

// Canonical tax_ids (demo values).
const TAX_ID_FUNDACION = "G-99999901";
const TAX_ID_CARTERA = "B-99999902";
const TAX_ID_ARGA_SEGUROS = "A-99999903";
const TAX_ID_MERCADO_LIBRE = "X-99999904";

// Stable UUID for the Mercado Libre aggregate PJ (net-new).
const PJ_MERCADO_LIBRE_ID = "10000000-0000-0000-0000-000000000004";

const TODAY = new Date().toISOString().slice(0, 10);
const EFFECTIVE_FROM = "2025-01-01";

async function main() {
  console.log("Seed demo ARGA canónico — iniciando");
  console.log(`  Cloud: ${url}`);
  console.log(`  Tenant: ${TENANT}`);
  console.log("");

  // --- 1. Update existing PJ tax_ids ----------------------------------
  await updatePjTaxId(ENTITY_FUNDACION, TAX_ID_FUNDACION, "Fundación ARGA");
  await updatePjTaxId(ENTITY_CARTERA, TAX_ID_CARTERA, "Cartera ARGA S.L.U.");
  await updatePjTaxId(ENTITY_ARGA_SEGUROS, TAX_ID_ARGA_SEGUROS, "ARGA Seguros, S.A.");

  // --- 2. Insert Mercado Libre PJ (net-new) ---------------------------
  await upsertMercadoLibre();

  // --- 3. Capital profile for ARGA Seguros (IAR 2025 values) ----------
  await closeVigentesAndInsertProfile({
    entityId: ENTITY_ARGA_SEGUROS,
    capital_escriturado: 307955327.3,
    numero_titulos: 3079553273,
    valor_nominal: 0.1,
  });

  // --- 4. Capital holdings ARGA Seguros: close legacy, insert canonical --
  await closeAllActiveHoldings(ENTITY_ARGA_SEGUROS);
  await insertHolding({
    entity_id: ENTITY_ARGA_SEGUROS,
    holder_person_id: await getPersonIdFromEntity(ENTITY_CARTERA),
    porcentaje_capital: 69.69,
    numero_titulos: 2145754856,
  });
  await insertHolding({
    entity_id: ENTITY_ARGA_SEGUROS,
    holder_person_id: PJ_MERCADO_LIBRE_ID,
    porcentaje_capital: 30.31,
    numero_titulos: 933798417,
  });

  // --- 5. Capital holding Cartera ARGA ← 100% Fundación ---------------
  await closeAllActiveHoldings(ENTITY_CARTERA);
  await insertHolding({
    entity_id: ENTITY_CARTERA,
    holder_person_id: await getPersonIdFromEntity(ENTITY_FUNDACION),
    porcentaje_capital: 100,
    numero_titulos: 1,
  });

  // --- 6. Condiciones SOCIO (body_id = NULL) --------------------------
  await ensureCondicionSocio({
    person_id: await getPersonIdFromEntity(ENTITY_CARTERA),
    entity_id: ENTITY_ARGA_SEGUROS,
  });
  await ensureCondicionSocio({
    person_id: PJ_MERCADO_LIBRE_ID,
    entity_id: ENTITY_ARGA_SEGUROS,
  });
  await ensureCondicionSocio({
    person_id: await getPersonIdFromEntity(ENTITY_FUNDACION),
    entity_id: ENTITY_CARTERA,
  });

  // --- 7. Representación PJ permanente --------------------------------
  await ensureRepresentacionCartera();

  // --- 8. Verificación post-seed F10.1 --------------------------------
  // Comprueba que los rieles del pipeline F8→F9 (certificación) están
  // correctamente poblados. NOTA: el plan usa `role`/`valido_hasta`, pero
  // el schema real es `cargo`/`estado='VIGENTE'` (la migración 000024
  // renombró las columnas). Los contadores se loguean para verificación
  // visual; no interrumpimos el seed si salen bajos — puede ser que el
  // operador quiera correr los seeds de autoridad/capability por
  // separado.
  await verifyAuthorityAndCapability();

  console.log("");
  console.log("Seed demo ARGA canónico — OK");
}

async function verifyAuthorityAndCapability() {
  console.log("");
  console.log("Verificación post-seed:");

  // authority_evidence VIGENTE para ARGA Seguros
  const { data: auth, error: authErr } = await supabase
    .from("authority_evidence")
    .select("id, cargo")
    .eq("entity_id", ENTITY_ARGA_SEGUROS)
    .eq("estado", "VIGENTE");
  if (authErr) {
    console.log(`  [authority_evidence] ERROR: ${authErr.message}`);
  } else {
    const cargos = (auth ?? []).map((a) => a.cargo).sort();
    console.log(
      `  [authority_evidence] VIGENTE en ARGA Seguros: ${auth?.length ?? 0} filas ` +
        `(cargos: ${cargos.length > 0 ? cargos.join(", ") : "∅"})`,
    );
  }

  // capability_matrix total (esperado ≥15: 5 roles × 3 actions)
  const { data: cap, error: capErr } = await supabase
    .from("capability_matrix")
    .select("id", { count: "exact", head: false });
  if (capErr) {
    console.log(`  [capability_matrix] ERROR: ${capErr.message}`);
  } else {
    console.log(
      `  [capability_matrix] ${cap?.length ?? 0} filas ` +
        `(esperado ≥15 — 5 roles × 3 actions SNAPSHOT/VOTE/CERTIFICATION)`,
    );
  }
}

// ----------------------- Helpers --------------------------------------

async function updatePjTaxId(entityId: string, taxId: string, label: string) {
  // Find the PJ currently linked to the entity, then update its tax_id.
  const { data: ent, error: entErr } = await supabase
    .from("entities")
    .select("person_id")
    .eq("id", entityId)
    .single();
  if (entErr || !ent?.person_id) {
    throw new Error(
      `updatePjTaxId(${label}): entity not found or not linked. ` +
        `id=${entityId} err=${entErr?.message}`
    );
  }
  const { error } = await supabase
    .from("persons")
    .update({ tax_id: taxId, full_name: label, denomination: label })
    .eq("id", ent.person_id);
  if (error) throw new Error(`updatePjTaxId(${label}): ${error.message}`);
  console.log(`  [PJ] ${label}  tax_id → ${taxId}`);
}

async function upsertMercadoLibre() {
  const { data: existing } = await supabase
    .from("persons")
    .select("id")
    .eq("id", PJ_MERCADO_LIBRE_ID)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("persons")
      .update({
        tax_id: TAX_ID_MERCADO_LIBRE,
        full_name: "Mercado libre (free float agregado)",
        denomination: "Mercado libre",
      })
      .eq("id", PJ_MERCADO_LIBRE_ID);
    if (error) throw new Error(`upsertMercadoLibre (update): ${error.message}`);
    console.log(`  [PJ] Mercado libre agregado (update)`);
  } else {
    const { error } = await supabase.from("persons").insert({
      id: PJ_MERCADO_LIBRE_ID,
      tenant_id: TENANT,
      person_type: "PJ",
      tax_id: TAX_ID_MERCADO_LIBRE,
      full_name: "Mercado libre (free float agregado)",
      denomination: "Mercado libre",
    });
    if (error) throw new Error(`upsertMercadoLibre (insert): ${error.message}`);
    console.log(`  [PJ] Mercado libre agregado (insert)`);
  }
}

async function getPersonIdFromEntity(entityId: string): Promise<string> {
  const { data, error } = await supabase
    .from("entities")
    .select("person_id")
    .eq("id", entityId)
    .single();
  if (error || !data?.person_id) {
    throw new Error(
      `getPersonIdFromEntity: no person linked to entity ${entityId}. err=${error?.message}`
    );
  }
  return data.person_id as string;
}

async function closeVigentesAndInsertProfile(p: {
  entityId: string;
  capital_escriturado: number;
  numero_titulos: number;
  valor_nominal: number;
}) {
  const { error: upErr } = await supabase
    .from("entity_capital_profile")
    .update({ estado: "HISTORICO", effective_to: TODAY })
    .eq("entity_id", p.entityId)
    .eq("estado", "VIGENTE");
  if (upErr) throw new Error(`closeVigentesAndInsertProfile (close): ${upErr.message}`);
  const { error: insErr } = await supabase.from("entity_capital_profile").insert({
    tenant_id: TENANT,
    entity_id: p.entityId,
    capital_escriturado: p.capital_escriturado,
    numero_titulos: p.numero_titulos,
    valor_nominal: p.valor_nominal,
    estado: "VIGENTE",
    effective_from: EFFECTIVE_FROM,
  });
  if (insErr) throw new Error(`closeVigentesAndInsertProfile (insert): ${insErr.message}`);
  console.log(
    `  [cap profile] entity=${p.entityId.slice(0, 8)} capital=${p.capital_escriturado} titulos=${p.numero_titulos}`
  );
}

async function closeAllActiveHoldings(entityId: string) {
  const { error } = await supabase
    .from("capital_holdings")
    .update({ effective_to: TODAY })
    .eq("entity_id", entityId)
    .is("effective_to", null);
  if (error) throw new Error(`closeAllActiveHoldings: ${error.message}`);
  console.log(`  [holdings] cerradas activas para entity=${entityId.slice(0, 8)}`);
}

async function insertHolding(p: {
  entity_id: string;
  holder_person_id: string;
  porcentaje_capital: number;
  numero_titulos: number;
}) {
  const { error } = await supabase.from("capital_holdings").insert({
    tenant_id: TENANT,
    entity_id: p.entity_id,
    holder_person_id: p.holder_person_id,
    porcentaje_capital: p.porcentaje_capital,
    numero_titulos: p.numero_titulos,
    voting_rights: true,
    effective_from: EFFECTIVE_FROM,
  });
  if (error) throw new Error(`insertHolding: ${error.message}`);
  console.log(
    `  [holding] entity=${p.entity_id.slice(0, 8)}  holder=${p.holder_person_id.slice(0, 8)}  ${p.porcentaje_capital}%`
  );
}

async function ensureCondicionSocio(p: { person_id: string; entity_id: string }) {
  // Look for an existing VIGENTE SOCIO condition (body_id NULL).
  const { data: existing } = await supabase
    .from("condiciones_persona")
    .select("id")
    .eq("person_id", p.person_id)
    .eq("entity_id", p.entity_id)
    .eq("tipo_condicion", "SOCIO")
    .eq("estado", "VIGENTE")
    .is("body_id", null);
  if (existing && existing.length > 0) {
    console.log(`  [condicion SOCIO] ya existe (person=${p.person_id.slice(0, 8)} entity=${p.entity_id.slice(0, 8)})`);
    return;
  }
  const { error } = await supabase.from("condiciones_persona").insert({
    tenant_id: TENANT,
    person_id: p.person_id,
    entity_id: p.entity_id,
    body_id: null,
    tipo_condicion: "SOCIO",
    estado: "VIGENTE",
    fecha_inicio: EFFECTIVE_FROM,
  });
  if (error) throw new Error(`ensureCondicionSocio: ${error.message}`);
  console.log(`  [condicion SOCIO] insertada (person=${p.person_id.slice(0, 8)} entity=${p.entity_id.slice(0, 8)})`);
}

async function ensureRepresentacionCartera() {
  // Find first consejero person on ARGA via condiciones_persona.
  const { data: consejeros, error: cErr } = await supabase
    .from("condiciones_persona")
    .select("person_id")
    .eq("entity_id", ENTITY_ARGA_SEGUROS)
    .eq("tipo_condicion", "CONSEJERO")
    .eq("estado", "VIGENTE")
    .limit(1);
  if (cErr) throw new Error(`ensureRepresentacionCartera (find consejero): ${cErr.message}`);
  if (!consejeros || consejeros.length === 0) {
    console.log(`  [representacion] SKIP — no hay consejeros VIGENTES en ARGA Seguros`);
    return;
  }
  const representativeId = consejeros[0].person_id as string;
  const carteraId = await getPersonIdFromEntity(ENTITY_CARTERA);

  // Check existence.
  const { data: existing } = await supabase
    .from("representaciones")
    .select("id")
    .eq("represented_person_id", carteraId)
    .eq("representative_person_id", representativeId)
    .eq("scope", "ADMIN_PJ_REPRESENTANTE")
    .is("effective_to", null);
  if (existing && existing.length > 0) {
    console.log(`  [representacion] ya existe`);
    return;
  }
  const { error } = await supabase.from("representaciones").insert({
    tenant_id: TENANT,
    entity_id: ENTITY_ARGA_SEGUROS,
    represented_person_id: carteraId,
    representative_person_id: representativeId,
    scope: "ADMIN_PJ_REPRESENTANTE",
    effective_from: EFFECTIVE_FROM,
  });
  if (error) throw new Error(`ensureRepresentacionCartera: ${error.message}`);
  console.log(`  [representacion] Cartera ← ${representativeId.slice(0, 8)} (ADMIN_PJ_REPRESENTANTE)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
