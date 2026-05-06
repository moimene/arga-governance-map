#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ENV_FILE = "docs/superpowers/plans/.env";

const ARGA_SEG = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
const ARGA_CDA = "fe05ddd9-ce3e-47b0-8948-5b975c79ab59";
const ARGA_JGA = "4d7996ad-d4ca-5a4f-a182-6044dcf04d4c";
const LEGACY_JGA = "e288fe36-3846-49ba-91d8-89fe35405b50";

const CARTERA_SLU = "00000000-0000-0000-0000-000000000020";
const CARTERA_SOCIO_UNICO = "aabb5405-db37-5265-b478-06b88ab1d822";
const REASEGUROS = "04d0a477-3b0d-41af-b5e4-9a46195da272";
const REASEGUROS_CDA = "b900f016-b5f1-5e9b-85d8-79c86051c781";

const PRESIDENTE_ARGA = "12ab13c3-0a0e-4ab6-a17a-902a3eaeddf8";
const SECRETARIA_ARGA = "f8b64324-a19d-4050-98c2-8e34cff52087";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

type Json = Record<string, unknown>;
type Row = Record<string, unknown> & { id: string };

function cleanEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalEnv() {
  try {
    const text = readFileSync(ENV_FILE, "utf8");
    const parsed: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      parsed[match[1]] = cleanEnvValue(match[2]) ?? "";
    }
    return parsed;
  } catch {
    return {};
  }
}

const localEnv = readLocalEnv();

function secretEnv(name: string) {
  return cleanEnvValue(process.env[name]) ?? cleanEnvValue(localEnv[name]);
}

function projectRefFromUrl(rawUrl: string) {
  try {
    const [ref] = new URL(rawUrl).host.split(".");
    return ref;
  } catch {
    return null;
  }
}

function client() {
  const url =
    secretEnv("VITE_SUPABASE_URL") ??
    secretEnv("SUPABASE_URL") ??
    secretEnv("URL") ??
    `https://${EXPECTED_PROJECT_REF}.supabase.co`;
  const key =
    secretEnv("SUPABASE_SERVICE_ROLE_KEY") ??
    secretEnv("SERVICE_ROLE_SECRET") ??
    secretEnv("SECRET_DEFFAULT_KEY") ??
    secretEnv("ANON_PUBLIC");

  if (!key) throw new Error("Missing Supabase service key or anon key in environment.");
  const ref = projectRefFromUrl(url);
  if (ref !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_SEED_ALLOW_NON_CANONICAL_PROJECT !== "1") {
    throw new Error(`Refusing to run against ${ref ?? "unknown"}; expected ${EXPECTED_PROJECT_REF}.`);
  }

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function stableUuid(label: string) {
  const hash = createHash("sha1").update(`arga-secretaria-golden-path:${label}`).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const value = hash.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function today() {
  return "2026-05-06";
}

function nowIso() {
  return "2026-05-06T12:00:00.000Z";
}

function profile(entityId: string, overrides: Json = {}) {
  return {
    schema_version: "entity-normative-profile.golden-path.v1",
    tenant_id: DEMO_TENANT,
    entity_id: entityId,
    jurisdiction: "ES",
    sources: ["LEY", "REGISTRO", "ESTATUTOS", "PACTO_PARASOCIAL", "REGLAMENTO", "POLITICA", "SISTEMA"],
    qtsp: "EAD Trust",
    registry_boundary: "prepared_for_registry_demo_no_real_filing",
    evidence_scope: "demo_operativa_no_final_productiva",
    as_of: today(),
    ...overrides,
  };
}

function complianceSnapshot(entityId: string, materia: string, adoptionMode: string, overrides: Json = {}) {
  return {
    schema_version: "agreement-compliance-snapshot.golden-path.v1",
    normative_profile: profile(entityId),
    normative_snapshot_id: stableUuid(`snapshot:${entityId}:${materia}:${adoptionMode}`),
    rule_pack: {
      materia,
      adoption_mode: adoptionMode,
      status: "PASS",
      source: "arga_golden_path_consolidation",
    },
    disclaimers: {
      registry: "PROMOTED/FILED significa preparado para registro; no presentado.",
      evidence: "Evidencia de apoyo demo/operativa; no evidencia final productiva.",
      qtsp: "EAD Trust",
    },
    ...overrides,
  };
}

function executionMode(mode: string, code: string, templateId?: string | null) {
  return {
    mode,
    seed_code: code,
    selected_template_id: templateId ?? null,
    agreement_360: {
      version: "agreement-360.v1",
      origin: "ARGA_GOLDEN_PATH_CONSOLIDATION",
      seed_code: code,
      selected_template_id: templateId ?? null,
      normative_snapshot_id: stableUuid(`agreement-360:${code}`),
      materialized: true,
      materialized_at: nowIso(),
    },
  };
}

async function mutate(
  supabase: SupabaseClient,
  repairs: string[],
  label: string,
  fn: () => Promise<{ error: { message: string } | null }>,
) {
  if (!apply) {
    repairs.push(`[PLAN] ${label}`);
    return;
  }
  const result = await fn();
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  repairs.push(`[OK] ${label}`);
}

async function fetchOne<T extends Row>(supabase: SupabaseClient, table: string, id: string) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`${table}/${id}: ${error.message}`);
  return data as T | null;
}

async function patchRow(
  supabase: SupabaseClient,
  repairs: string[],
  table: string,
  id: string,
  patch: Json,
) {
  await mutate(supabase, repairs, `${table}/${id}: patch ${Object.keys(patch).join(", ")}`, () =>
    supabase.from(table).update(patch).eq("id", id)
  );
}

async function ensureCondition(
  supabase: SupabaseClient,
  repairs: string[],
  input: {
    label: string;
    entityId: string;
    bodyId: string | null;
    personId: string;
    tipo: string;
    metadata?: Json;
  },
) {
  const seedId = stableUuid(`condition:${input.label}`);
  const { data: bySeedId, error: seedProbeError } = await supabase
    .from("condiciones_persona")
    .select("id")
    .eq("id", seedId)
    .maybeSingle();
  if (seedProbeError) throw new Error(`condiciones_persona seed probe ${input.label}: ${seedProbeError.message}`);

  let query = supabase
    .from("condiciones_persona")
    .select("id")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", input.entityId)
    .eq("person_id", input.personId)
    .eq("tipo_condicion", input.tipo)
    .limit(1);
  query = input.bodyId ? query.eq("body_id", input.bodyId) : query.is("body_id", null);

  const { data, error } = await query;
  if (error) throw new Error(`condiciones_persona probe ${input.label}: ${error.message}`);
  const existingId = data?.[0]?.id as string | undefined;
  const row = {
    tenant_id: DEMO_TENANT,
    entity_id: input.entityId,
    body_id: input.bodyId,
    person_id: input.personId,
    tipo_condicion: input.tipo,
    estado: "VIGENTE",
    fecha_inicio: "2025-01-01",
    fecha_fin: "2029-12-31",
    representative_person_id: null,
    metadata: {
      source: "arga_golden_path_consolidation",
      ...(input.metadata ?? {}),
    },
    fuente_designacion: "BOOTSTRAP",
    inscripcion_rm_referencia: "RM-DEMO-ARGA-GOLDEN-2026",
    inscripcion_rm_fecha: "2026-01-15",
  };

  if (existingId) {
    await patchRow(supabase, repairs, "condiciones_persona", existingId, row);
    return existingId;
  }

  if (bySeedId?.id) {
    await patchRow(supabase, repairs, "condiciones_persona", bySeedId.id, row);
    return bySeedId.id as string;
  }

  const insertRow = { id: seedId, ...row };
  await mutate(supabase, repairs, `condiciones_persona/${insertRow.id}: insert ${input.label}`, () =>
    supabase.from("condiciones_persona").insert(insertRow)
  );
  return insertRow.id;
}

async function ensureAuthority(
  supabase: SupabaseClient,
  repairs: string[],
  input: {
    label: string;
    entityId: string;
    bodyId: string | null;
    personId: string;
    cargo: string;
  },
) {
  const seedId = stableUuid(`authority:${input.label}`);
  const { data: bySeedId, error: seedProbeError } = await supabase
    .from("authority_evidence")
    .select("id")
    .eq("id", seedId)
    .maybeSingle();
  if (seedProbeError) throw new Error(`authority_evidence seed probe ${input.label}: ${seedProbeError.message}`);

  let query = supabase
    .from("authority_evidence")
    .select("id")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", input.entityId)
    .eq("person_id", input.personId)
    .eq("cargo", input.cargo)
    .eq("estado", "VIGENTE")
    .limit(1);
  query = input.bodyId ? query.eq("body_id", input.bodyId) : query.is("body_id", null);

  const { data, error } = await query;
  if (error) throw new Error(`authority_evidence probe ${input.label}: ${error.message}`);
  const existingId = data?.[0]?.id as string | undefined;
  const row = {
    tenant_id: DEMO_TENANT,
    entity_id: input.entityId,
    body_id: input.bodyId,
    person_id: input.personId,
    cargo: input.cargo,
    fecha_inicio: "2025-01-01",
    fecha_fin: null,
    fuente_designacion: "BOOTSTRAP",
    inscripcion_rm_referencia: "RM-DEMO-ARGA-GOLDEN-2026",
    inscripcion_rm_fecha: "2026-01-15",
    estado: "VIGENTE",
    metadata: { source: "arga_golden_path_consolidation" },
  };

  if (existingId) {
    await patchRow(supabase, repairs, "authority_evidence", existingId, row);
    return existingId;
  }

  if (bySeedId?.id) {
    await patchRow(supabase, repairs, "authority_evidence", bySeedId.id, row);
    return bySeedId.id as string;
  }

  const insertRow = { id: seedId, ...row };
  await mutate(supabase, repairs, `authority_evidence/${insertRow.id}: insert ${input.label}`, () =>
    supabase.from("authority_evidence").insert(insertRow)
  );
  return insertRow.id;
}

function isHiddenTestBody(body: Row) {
  const slug = String(body.slug ?? "");
  const name = String(body.name ?? "");
  const config = (body.config ?? {}) as Json;
  return slug.startsWith("e2e-real-") || name.includes("[E2E REAL]") || Boolean(config.e2e_real_run_id);
}

async function normalizeBodies(supabase: SupabaseClient, repairs: string[]) {
  await patchRow(supabase, repairs, "governing_bodies", ARGA_CDA, {
    config: { organo_tipo: "CONSEJO_ADMIN", voto_calidad_presidente: true },
    quorum_rule: { quorum_asistencia: 0.5, mayoria_simple: 0.5, voto_calidad_presidente: true },
  });
  await patchRow(supabase, repairs, "governing_bodies", ARGA_JGA, {
    config: { organo_tipo: "JUNTA_GENERAL", voto_distancia: true, canal_publicidad: ["BORME", "CNMV", "WEB_SOCIEDAD"] },
    quorum_rule: { primera_convocatoria_pct: 25, segunda_convocatoria_pct: 0, cotizada: true },
  });

  const { data: legacyAgreements, error: legacyAgreementError } = await supabase
    .from("agreements")
    .select("id")
    .eq("tenant_id", DEMO_TENANT)
    .eq("body_id", LEGACY_JGA);
  if (legacyAgreementError) throw new Error(`legacy JGA agreement probe: ${legacyAgreementError.message}`);
  for (const agreement of legacyAgreements ?? []) {
    await patchRow(supabase, repairs, "agreements", agreement.id, { body_id: ARGA_JGA });
  }
  const legacyBody = await fetchOne<Row>(supabase, "governing_bodies", LEGACY_JGA);
  if (legacyBody) {
    await patchRow(supabase, repairs, "governing_bodies", LEGACY_JGA, {
      config: {
        ...(legacyBody.config as Json | null ?? {}),
        reference_only: true,
        hidden_from_secretaria_operational_flows: true,
        consolidated_into_body_id: ARGA_JGA,
      },
    });
  }

  const { data: bodies, error } = await supabase
    .from("governing_bodies")
    .select("id,slug,name,config")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG);
  if (error) throw new Error(`governing_bodies ARGA probe: ${error.message}`);
  for (const body of (bodies ?? []) as Row[]) {
    if (!isHiddenTestBody(body)) continue;
    await patchRow(supabase, repairs, "governing_bodies", body.id, {
      config: {
        ...(body.config as Json | null ?? {}),
        reference_only: true,
        hidden_from_secretaria_operational_flows: true,
        quarantine_reason: "E2E real destructive test residue; excluded from ARGA golden path.",
      },
    });
  }
}

async function closeE2EResidue(supabase: SupabaseClient, repairs: string[]) {
  const { data: e2eConditions, error: conditionError } = await supabase
    .from("condiciones_persona")
    .select("id,metadata")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .eq("estado", "VIGENTE")
    .contains("metadata", { purpose: "single-voter-no-session" });
  if (conditionError) throw new Error(`e2e condiciones probe: ${conditionError.message}`);
  for (const row of e2eConditions ?? []) {
    await patchRow(supabase, repairs, "condiciones_persona", row.id, {
      estado: "CESADO",
      fecha_fin: today(),
      metadata: {
        ...(row.metadata as Json | null ?? {}),
        archived_by: "arga_golden_path_consolidation",
      },
    });
  }

  const { data: socioConditions, error: socioError } = await supabase
    .from("condiciones_persona")
    .select("id,metadata")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .eq("estado", "VIGENTE")
    .eq("tipo_condicion", "SOCIO");
  if (socioError) throw new Error(`socio e2e condiciones probe: ${socioError.message}`);
  for (const row of (socioConditions ?? []) as Row[]) {
    const metadata = (row.metadata ?? {}) as Json;
    if (!metadata.e2e_real_run_id && metadata.purpose !== "capital-transmission-destination" && metadata.purpose !== "capital-transmission-source") continue;
    await patchRow(supabase, repairs, "condiciones_persona", row.id, {
      estado: "CESADO",
      fecha_fin: today(),
      metadata: { ...metadata, archived_by: "arga_golden_path_consolidation" },
    });
  }

  const { data: e2eAuthority, error: authorityError } = await supabase
    .from("authority_evidence")
    .select("id,metadata,body_id")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .eq("estado", "VIGENTE");
  if (authorityError) throw new Error(`e2e authority probe: ${authorityError.message}`);
  const { data: e2eBodies } = await supabase
    .from("governing_bodies")
    .select("id,slug,name,config")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG);
  const hiddenBodyIds = new Set(((e2eBodies ?? []) as Row[]).filter(isHiddenTestBody).map((body) => body.id));
  for (const row of (e2eAuthority ?? []) as Row[]) {
    if (!hiddenBodyIds.has(String(row.body_id ?? ""))) continue;
    await patchRow(supabase, repairs, "authority_evidence", row.id, {
      estado: "CESADO",
      fecha_fin: today(),
      metadata: {
        ...(row.metadata as Json | null ?? {}),
        archived_by: "arga_golden_path_consolidation",
      },
    });
  }

  const { data: zeroHoldings, error: holdingsError } = await supabase
    .from("capital_holdings")
    .select("id,metadata")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .is("effective_to", null)
    .lte("porcentaje_capital", 0);
  if (holdingsError) throw new Error(`zero holdings probe: ${holdingsError.message}`);
  for (const row of (zeroHoldings ?? []) as Row[]) {
    await patchRow(supabase, repairs, "capital_holdings", row.id, {
      effective_to: today(),
      metadata: {
        ...(row.metadata as Json | null ?? {}),
        archived_by: "arga_golden_path_consolidation",
        reason: "Zero-percent E2E holder excluded from live ARGA cap table.",
      },
    });
  }
}

async function seedCoreConditions(supabase: SupabaseClient, repairs: string[]) {
  await ensureCondition(supabase, repairs, {
    label: "arga-jga-presidente",
    entityId: ARGA_SEG,
    bodyId: ARGA_JGA,
    personId: PRESIDENTE_ARGA,
    tipo: "PRESIDENTE",
  });
  await ensureCondition(supabase, repairs, {
    label: "arga-jga-secretario",
    entityId: ARGA_SEG,
    bodyId: ARGA_JGA,
    personId: SECRETARIA_ARGA,
    tipo: "SECRETARIO",
  });
  const jgaSecretaryAuthority = await ensureAuthority(supabase, repairs, {
    label: "arga-jga-secretario",
    entityId: ARGA_SEG,
    bodyId: ARGA_JGA,
    personId: SECRETARIA_ARGA,
    cargo: "SECRETARIO",
  });
  await ensureAuthority(supabase, repairs, {
    label: "arga-jga-presidente",
    entityId: ARGA_SEG,
    bodyId: ARGA_JGA,
    personId: PRESIDENTE_ARGA,
    cargo: "PRESIDENTE",
  });

  const { data: boardConditions, error } = await supabase
    .from("condiciones_persona")
    .select("person_id,tipo_condicion")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .eq("body_id", ARGA_CDA)
    .eq("estado", "VIGENTE");
  if (error) throw new Error(`board conditions probe: ${error.message}`);
  const consejeros = (boardConditions ?? [])
    .filter((row) => String(row.tipo_condicion).includes("CONSEJERO"))
    .map((row) => String(row.person_id));
  const committeeMembers = [PRESIDENTE_ARGA, ...consejeros].filter(Boolean);

  const { data: bodies, error: bodyError } = await supabase
    .from("governing_bodies")
    .select("id,slug,name,body_type,config")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .in("body_type", ["COMISION", "COMITE"]);
  if (bodyError) throw new Error(`committee bodies probe: ${bodyError.message}`);

  let index = 0;
  for (const body of (bodies ?? []) as Row[]) {
    if (isHiddenTestBody(body)) continue;
    const config = (body.config ?? {}) as Json;
    await patchRow(supabase, repairs, "governing_bodies", body.id, {
      config: {
        ...config,
        organo_tipo: String(body.body_type) === "COMITE" ? "COMISION_DELEGADA" : "COMISION_DELEGADA",
        voto_calidad_presidente: Boolean(config.es_comite_ejecutivo),
      },
    });
    const president = committeeMembers[index % Math.max(committeeMembers.length, 1)] ?? PRESIDENTE_ARGA;
    const memberA = committeeMembers[(index + 1) % Math.max(committeeMembers.length, 1)] ?? PRESIDENTE_ARGA;
    const memberB = committeeMembers[(index + 2) % Math.max(committeeMembers.length, 1)] ?? PRESIDENTE_ARGA;
    await ensureCondition(supabase, repairs, {
      label: `${body.slug}:presidente`,
      entityId: ARGA_SEG,
      bodyId: body.id,
      personId: president,
      tipo: "PRESIDENTE",
      metadata: { committee: body.slug },
    });
    await ensureCondition(supabase, repairs, {
      label: `${body.slug}:secretario`,
      entityId: ARGA_SEG,
      bodyId: body.id,
      personId: SECRETARIA_ARGA,
      tipo: "SECRETARIO",
      metadata: { committee: body.slug },
    });
    await ensureCondition(supabase, repairs, {
      label: `${body.slug}:consejero-a`,
      entityId: ARGA_SEG,
      bodyId: body.id,
      personId: memberA,
      tipo: "CONSEJERO",
      metadata: { committee: body.slug },
    });
    await ensureCondition(supabase, repairs, {
      label: `${body.slug}:consejero-b`,
      entityId: ARGA_SEG,
      bodyId: body.id,
      personId: memberB,
      tipo: "CONSEJERO",
      metadata: { committee: body.slug },
    });
    index += 1;
  }

  return { jgaSecretaryAuthority };
}

async function rescopeLegacyAgreements(supabase: SupabaseClient, repairs: string[]) {
  await patchRow(supabase, repairs, "agreements", "00000000-0000-0000-0000-000000000202", {
    entity_id: CARTERA_SLU,
    body_id: CARTERA_SOCIO_UNICO,
    code: "LEGACY_RESCOPED_CARTERA_CUENTAS_2026",
    agreement_kind: "APROBACION_CUENTAS",
    adoption_mode: "UNIPERSONAL_SOCIO",
    proposal_text: "Decision del socio unico de Cartera ARGA S.L.U.: aprobacion de cuentas 2025.",
    decision_text: "Aprobadas las cuentas de Cartera ARGA S.L.U. por su socio unico.",
    statutory_basis: "Rescope demo desde acuerdo legacy ambiguo; evidencia demo/operativa.",
    compliance_snapshot: complianceSnapshot(CARTERA_SLU, "APROBACION_CUENTAS", "UNIPERSONAL_SOCIO"),
    compliance_explain: {
      normative_snapshot: complianceSnapshot(CARTERA_SLU, "APROBACION_CUENTAS", "UNIPERSONAL_SOCIO"),
      rescope_source: "arga_golden_path_consolidation",
    },
    execution_mode: executionMode("UNIPERSONAL_SOCIO", "LEGACY_RESCOPED_CARTERA_CUENTAS_2026"),
  });

  await patchRow(supabase, repairs, "agreements", "00000000-0000-0000-0000-000000000203", {
    entity_id: REASEGUROS,
    body_id: REASEGUROS_CDA,
    code: "LEGACY_RESCOPED_REASEGUROS_NOMBRAMIENTO_2026",
    agreement_kind: "NOMBRAMIENTO_CONSEJERO",
    adoption_mode: "MEETING",
    proposal_text: "Nombramiento de consejero por el Consejo de Administracion de ARGA Reaseguros, S.A. en vacante sobrevenida.",
    decision_text: "El Consejo acuerda elevar la propuesta de nombramiento y dejar trazabilidad para la siguiente Junta.",
    statutory_basis: "LSC art. 244 y art. 247; rescope demo desde acuerdo legacy ambiguo.",
    compliance_snapshot: complianceSnapshot(REASEGUROS, "NOMBRAMIENTO_CONSEJERO", "MEETING"),
    compliance_explain: {
      normative_snapshot: complianceSnapshot(REASEGUROS, "NOMBRAMIENTO_CONSEJERO", "MEETING"),
      rescope_source: "arga_golden_path_consolidation",
    },
    execution_mode: executionMode("MEETING", "LEGACY_RESCOPED_REASEGUROS_NOMBRAMIENTO_2026"),
  });
}

async function normalizePolicyAgreements(supabase: SupabaseClient, repairs: string[]) {
  const { data: policies, error } = await supabase
    .from("agreements")
    .select("id,proposal_text,decision_text,status")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG)
    .eq("agreement_kind", "APROBACION_POLITICA");
  if (error) throw new Error(`APROBACION_POLITICA probe: ${error.message}`);

  for (const agreement of policies ?? []) {
    const code = `ARGA_SEG_POLITICAS_${agreement.id.slice(0, 8).toUpperCase()}`;
    await patchRow(supabase, repairs, "agreements", agreement.id, {
      code,
      agreement_kind: "POLITICAS_CORPORATIVAS",
      matter_class: "ORDINARIA",
      required_majority_code: "SIMPLE",
      compliance_snapshot: complianceSnapshot(ARGA_SEG, "POLITICAS_CORPORATIVAS", "MEETING", {
        policy_source_text: agreement.proposal_text ?? null,
      }),
      compliance_explain: {
        normative_snapshot: complianceSnapshot(ARGA_SEG, "POLITICAS_CORPORATIVAS", "MEETING"),
        normalized_from: "APROBACION_POLITICA",
      },
      execution_mode: executionMode("MEETING", code),
    });
  }
}

async function completeMeetingCensus(supabase: SupabaseClient, repairs: string[]) {
  const { data: bodies, error: bodyError } = await supabase
    .from("governing_bodies")
    .select("id,body_type,entity_id,config")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG);
  if (bodyError) throw new Error(`bodies for censo probe: ${bodyError.message}`);
  const bodyById = new Map(((bodies ?? []) as Row[]).map((body) => [String(body.id), body]));
  const visibleBodyIds = ((bodies ?? []) as Row[])
    .filter((body) => !(body.config as Json | null ?? {}).hidden_from_secretaria_operational_flows)
    .map((body) => body.id);

  const { data: meetings, error: meetingError } = await supabase
    .from("meetings")
    .select("id,body_id,president_id,secretary_id,meeting_type")
    .eq("tenant_id", DEMO_TENANT)
    .in("body_id", visibleBodyIds.length ? visibleBodyIds : ["00000000-0000-0000-0000-000000000000"]);
  if (meetingError) throw new Error(`meetings for censo probe: ${meetingError.message}`);

  const { data: existingCenso, error: censoError } = await supabase
    .from("censo_snapshot")
    .select("meeting_id")
    .eq("tenant_id", DEMO_TENANT)
    .eq("entity_id", ARGA_SEG);
  if (censoError) throw new Error(`censo existing probe: ${censoError.message}`);
  const meetingsWithCenso = new Set((existingCenso ?? []).map((row) => row.meeting_id));

  for (const meeting of (meetings ?? []) as Row[]) {
    const body = bodyById.get(String(meeting.body_id ?? ""));
    if (!body) continue;
    const { data: conditions, error: conditionError } = await supabase
      .from("condiciones_persona")
      .select("person_id,tipo_condicion")
      .eq("tenant_id", DEMO_TENANT)
      .eq("entity_id", ARGA_SEG)
      .eq("body_id", body.id)
      .eq("estado", "VIGENTE");
    if (conditionError) throw new Error(`meeting ${meeting.id} conditions: ${conditionError.message}`);

    const president = conditions?.find((row) => row.tipo_condicion === "PRESIDENTE")?.person_id ?? PRESIDENTE_ARGA;
    const secretary = conditions?.find((row) => row.tipo_condicion === "SECRETARIO")?.person_id ?? SECRETARIA_ARGA;
    const meetingPatch: Json = {};
    if (!meeting.president_id) meetingPatch.president_id = president;
    if (!meeting.secretary_id) meetingPatch.secretary_id = secretary;
    if (String(meeting.meeting_type ?? "").toUpperCase() === "CONSEJO_ADMINISTRACION") meetingPatch.meeting_type = "CONSEJO_ADMIN";
    if (Object.keys(meetingPatch).length > 0) {
      await patchRow(supabase, repairs, "meetings", meeting.id, meetingPatch);
    }

    if (meetingsWithCenso.has(String(meeting.id))) continue;
    const isJunta = String(body.body_type ?? "").toUpperCase().includes("JUNTA");
    const snapshotType = isJunta ? "ECONOMICO" : "POLITICO";
    const bodyIdForSnapshot = isJunta ? null : String(body.id);

    if (!apply) {
      repairs.push(`[PLAN] censo_snapshot/${meeting.id}: create ${snapshotType}`);
      continue;
    }

    const { error: rpcError } = await supabase.rpc("fn_crear_censo_snapshot", {
      p_meeting_id: meeting.id,
      p_session_kind: "MEETING",
      p_entity_id: ARGA_SEG,
      p_body_id: bodyIdForSnapshot,
      p_snapshot_type: snapshotType,
    });
    if (!rpcError) {
      repairs.push(`[OK] censo_snapshot/${meeting.id}: created ${snapshotType} by RPC`);
      continue;
    }

    const payload = (conditions ?? []).map((condition) => ({
      person_id: condition.person_id,
      tipo_condicion: condition.tipo_condicion,
    }));
    const { error: insertError } = await supabase.from("censo_snapshot").insert({
      id: stableUuid(`censo:${meeting.id}:${snapshotType}`),
      tenant_id: DEMO_TENANT,
      meeting_id: meeting.id,
      session_kind: "MEETING",
      entity_id: ARGA_SEG,
      body_id: bodyIdForSnapshot,
      snapshot_type: snapshotType,
      payload,
      capital_total_base: isJunta ? 100 : payload.length,
      total_partes: payload.length,
    });
    if (insertError) throw new Error(`censo ${meeting.id}: rpc=${rpcError.message}; insert=${insertError.message}`);
    repairs.push(`[OK] censo_snapshot/${meeting.id}: inserted ${snapshotType} fallback`);
  }
}

async function linkLegacyCertification(supabase: SupabaseClient, repairs: string[], authorityId: string) {
  await patchRow(supabase, repairs, "certifications", "ff224b50-c2cb-5d5f-ad88-90e7ba6cf98c", {
    authority_evidence_id: authorityId,
  });
}

async function main() {
  const supabase = client();
  const repairs: string[] = [];
  console.log(JSON.stringify({
    mode: apply ? "apply" : "plan",
    target: EXPECTED_PROJECT_REF,
    tenant: DEMO_TENANT,
    entity: ARGA_SEG,
    boundary: "ARGA Seguros golden path only; no real Registry filing; EAD Trust only QTSP",
  }, null, 2));

  await normalizeBodies(supabase, repairs);
  await closeE2EResidue(supabase, repairs);
  const { jgaSecretaryAuthority } = await seedCoreConditions(supabase, repairs);
  await rescopeLegacyAgreements(supabase, repairs);
  await normalizePolicyAgreements(supabase, repairs);
  await completeMeetingCensus(supabase, repairs);
  await linkLegacyCertification(supabase, repairs, jgaSecretaryAuthority);

  console.log(JSON.stringify({ apply, repairs }, null, 2));
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
