#!/usr/bin/env bun
/* global process, console */
/**
 * Cloud smoke for migration 000051.
 *
 * Default mode is read-only: it checks PostgREST-visible columns and calls the
 * four RPCs with dummy UUIDs, accepting only expected business errors. This
 * proves the signatures exist without inserting WORM rows.
 *
 * Transactional mode requires psql plus SECRETARIA_P0_DATABASE_URL or
 * DATABASE_URL. It runs BEGIN/ROLLBACK and creates temporary fixtures that
 * exercise the success path for all four RPCs, including idempotent no-session
 * replay, certification, and paired capital movements. No rows are committed.
 *
 * Tenant isolation mode runs a second BEGIN/ROLLBACK fixture with temporary
 * tenant A/B data, switches to authenticated claims, and verifies same-tenant
 * positive paths plus cross-tenant denials. This deliberately avoids
 * service_role for the negative assertions.
 *
 * Env:
 * - VITE_SUPABASE_URL or SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SECRETARIA_P0_DATABASE_URL or DATABASE_URL, optional for SQL smoke if psql exists
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auditTemplateInventory, type TemplateInventoryRow } from "../src/lib/secretaria/template-inventory-audit";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DUMMY_UUID = "00000000-0000-0000-0000-00000000f051";
const DEFAULT_SECRET_ENV_FILE = "docs/superpowers/plans/.env";
const SUPABASE_CLI_PACKAGE = process.env.SUPABASE_CLI_PACKAGE ?? "supabase@2.98.1";

const args = new Set(process.argv.slice(2));
const runTransactional = args.has("--transactional") || process.env.SECRETARIA_P0_RUN_TRANSACTIONAL === "1";
const requireTransactional = args.has("--require-transactional") || process.env.SECRETARIA_P0_REQUIRE_TRANSACTIONAL === "1";
const runTenantIsolation = args.has("--tenant-isolation") || process.env.SECRETARIA_P0_RUN_TENANT_ISOLATION === "1";
const requireTenantIsolation =
  args.has("--require-tenant-isolation") || process.env.SECRETARIA_P0_REQUIRE_TENANT_ISOLATION === "1";
const runAuthUserIsolation = args.has("--auth-user-isolation") || process.env.SECRETARIA_P0_RUN_AUTH_USER_ISOLATION === "1";
const requireAuthUserIsolation =
  args.has("--require-auth-user-isolation") || process.env.SECRETARIA_P0_REQUIRE_AUTH_USER_ISOLATION === "1";
const readonlyOnly = args.has("--readonly-only");

type CheckStatus = "OK" | "SKIP" | "FAIL";
type Check = { status: CheckStatus; name: string; detail?: string };

function cleanEnvValue(value: string | undefined): string | undefined {
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

function readLocalSecretEnv(): Record<string, string> {
  const envPath = process.env.SECRETARIA_P0_ENV_FILE ?? DEFAULT_SECRET_ENV_FILE;
  try {
    const text = readFileSync(envPath, "utf8");
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

const localSecretEnv = readLocalSecretEnv();

function secretEnv(name: string): string | undefined {
  return cleanEnvValue(process.env[name]) ?? cleanEnvValue(localSecretEnv[name]);
}

function logCheck(check: Check) {
  const detail = check.detail ? ` - ${check.detail}` : "";
  console.log(`[${check.status}] ${check.name}${detail}`);
}

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

function projectRefFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const host = new URL(rawUrl).host;
    const [ref] = host.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function isMissingRpcError(message: string): boolean {
  return /function .* does not exist|could not find the function|schema cache|unknown function/i.test(message);
}

async function expectSelect(client: SupabaseClient, table: string, columns: string) {
  const { error } = await client.from(table).select(columns).limit(0);
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function expectRpcBusinessError(
  client: SupabaseClient,
  name: string,
  params: Record<string, unknown>,
  expected: RegExp,
) {
  const { error } = await client.rpc(name, params);
  const message = error?.message ?? "";
  if (!error) {
    throw new Error(`${name}: dummy probe unexpectedly succeeded`);
  }
  if (isMissingRpcError(message)) {
    throw new Error(`${name}: RPC missing or stale PostgREST schema cache (${message})`);
  }
  if (!expected.test(message)) {
    throw new Error(`${name}: expected ${expected}, got "${message}"`);
  }
}

async function runTemplateInventorySmoke(client: SupabaseClient): Promise<Check[]> {
  const { data, error } = await client
    .from("plantillas_protegidas")
    .select(
      [
        "id",
        "tipo",
        "estado",
        "materia",
        "materia_acuerdo",
        "version",
        "aprobada_por",
        "fecha_aprobacion",
        "organo_tipo",
        "adoption_mode",
        "referencia_legal",
        "capa1_inmutable",
        "capa2_variables",
        "capa3_editables",
      ].join(", "),
    );

  if (error) {
    throw new Error(`plantillas_protegidas inventory probe: ${error.message}`);
  }

  const rows = (data ?? []) as TemplateInventoryRow[];
  const audit = auditTemplateInventory(rows);
  const blocking = audit.issues.filter((issue) => issue.severity === "BLOCKING");

  if (blocking.length > 0) {
    const sample = blocking
      .slice(0, 5)
      .map((issue) => `${issue.code}:${issue.materia}:${issue.templateId}`)
      .join("; ");
    throw new Error(`plantillas_protegidas active closure audit failed (${blocking.length} blocking): ${sample}`);
  }

  const draftCount = rows.filter((row) => row.estado === "BORRADOR").length;
  return [
    {
      status: "OK",
      name: "template inventory: active closure audit",
      detail: `${audit.summary.active} active, ${draftCount} draft, ${audit.summary.blocking} blocking`,
    },
    {
      status: "OK",
      name: "template inventory: signed active templates",
      detail: "no active template without formal signature or semver metadata issues",
    },
  ];
}

async function runReadonlySmoke(): Promise<Check[]> {
  const url =
    secretEnv("VITE_SUPABASE_URL") ??
    secretEnv("SUPABASE_URL") ??
    `https://${EXPECTED_PROJECT_REF}.supabase.co`;
  const serviceKey = secretEnv("SUPABASE_SERVICE_ROLE_KEY") ?? secretEnv("SERVICE_ROLE_SECRET");

  if (!url || !serviceKey) {
    return [
      {
        status: "SKIP",
        name: "readonly cloud smoke",
        detail: "requires VITE_SUPABASE_URL or SUPABASE_URL plus SUPABASE_SERVICE_ROLE_KEY",
      },
    ];
  }

  const ref = projectRefFromUrl(url);
  if (ref !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_P0_ALLOW_NON_CANONICAL_PROJECT !== "1") {
    throw new Error(
      `Refusing to run against project ref ${ref ?? "unknown"}; expected ${EXPECTED_PROJECT_REF}. ` +
        "Set SECRETARIA_P0_ALLOW_NON_CANONICAL_PROJECT=1 only for an intentional non-demo target.",
    );
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks: Check[] = [];

  const schemaProbes: Array<[string, string]> = [
    [
      "no_session_resolutions",
      [
        "id",
        "tenant_id",
        "body_id",
        "title",
        "status",
        "proposal_text",
        "requires_unanimity",
        "total_members",
        "votes_for",
        "votes_against",
        "abstentions",
        "opened_at",
        "closed_at",
        "voting_deadline",
        "matter_class",
        "agreement_kind",
        "selected_template_id",
      ].join(", "),
    ],
    [
      "no_session_expedientes",
      [
        "id",
        "tenant_id",
        "agreement_id",
        "no_session_resolution_id",
        "selected_template_id",
        "entity_id",
        "body_id",
        "tipo_proceso",
        "estado",
        "condicion_adopcion",
        "snapshot_hash",
      ].join(", "),
    ],
    [
      "no_session_respuestas",
      [
        "id",
        "tenant_id",
        "expediente_id",
        "person_id",
        "sentido",
        "firma_qes_ref",
        "notificacion_certificada_ref",
      ].join(", "),
    ],
    [
      "agreements",
      [
        "id",
        "tenant_id",
        "entity_id",
        "body_id",
        "agreement_kind",
        "matter_class",
        "adoption_mode",
        "status",
        "no_session_resolution_id",
        "proposal_text",
        "decision_text",
        "gate_hash",
        "execution_mode",
        "compliance_snapshot",
      ].join(", "),
    ],
    [
      "certifications",
      [
        "id",
        "tenant_id",
        "agreement_id",
        "agreements_certified",
        "minute_id",
        "tipo_certificacion",
        "certificante_role",
        "visto_bueno_persona_id",
        "gate_hash",
        "authority_evidence_id",
        "requires_qualified_signature",
        "signature_status",
      ].join(", "),
    ],
    [
      "capital_holdings",
      [
        "id",
        "tenant_id",
        "entity_id",
        "holder_person_id",
        "share_class_id",
        "numero_titulos",
        "porcentaje_capital",
        "voting_rights",
        "is_treasury",
        "effective_from",
        "effective_to",
        "metadata",
      ].join(", "),
    ],
    [
      "capital_movements",
      [
        "id",
        "tenant_id",
        "entity_id",
        "agreement_id",
        "person_id",
        "share_class_id",
        "delta_shares",
        "delta_voting_weight",
        "delta_denominator_weight",
        "movement_type",
        "effective_date",
      ].join(", "),
    ],
    ["authority_evidence", "id, tenant_id, entity_id, body_id, person_id, cargo, estado"],
    ["governing_bodies", "id, tenant_id, entity_id, body_type, name"],
    ["entities", "id, tenant_id, legal_name, common_name, legal_form"],
    ["persons", "id, tenant_id, full_name, person_type, tax_id"],
  ];

  for (const [table, columns] of schemaProbes) {
    await expectSelect(client, table, columns);
    checks.push({ status: "OK", name: `schema columns visible: ${table}` });
  }

  const { data: bodies, error: bodyError } = await client
    .from("governing_bodies")
    .select("id, entity_id, body_type, name")
    .eq("tenant_id", DEMO_TENANT)
    .not("entity_id", "is", null)
    .limit(1);
  if (bodyError) throw new Error(`governing_bodies fixture probe: ${bodyError.message}`);
  checks.push({
    status: (bodies?.length ?? 0) > 0 ? "OK" : "SKIP",
    name: "fixture availability: governing body with entity",
    detail: (bodies?.length ?? 0) > 0 ? `${bodies![0].name} (${bodies![0].id})` : "no body found",
  });

  const { data: authority, error: authorityError } = await client
    .from("authority_evidence")
    .select("cargo")
    .eq("tenant_id", DEMO_TENANT)
    .eq("estado", "VIGENTE")
    .in("cargo", ["SECRETARIO", "PRESIDENTE"])
    .limit(10);
  if (authorityError) throw new Error(`authority_evidence fixture probe: ${authorityError.message}`);
  checks.push({
    status: (authority?.length ?? 0) > 0 ? "OK" : "SKIP",
    name: "fixture availability: certifying authority",
    detail: (authority ?? []).map((row) => row.cargo).sort().join(", ") || "none",
  });

  const { data: holdings, error: holdingsError } = await client
    .from("capital_holdings")
    .select("id, entity_id, holder_person_id, numero_titulos")
    .eq("tenant_id", DEMO_TENANT)
    .is("effective_to", null)
    .eq("is_treasury", false)
    .gt("numero_titulos", 1)
    .limit(1);
  if (holdingsError) throw new Error(`capital_holdings fixture probe: ${holdingsError.message}`);
  checks.push({
    status: (holdings?.length ?? 0) > 0 ? "OK" : "SKIP",
    name: "fixture availability: current capital holding",
    detail: (holdings?.length ?? 0) > 0 ? holdings![0].id : "no current non-treasury holding found",
  });

  await expectRpcBusinessError(
    client,
    "fn_no_session_cast_response",
    {
      p_tenant_id: DEMO_TENANT,
      p_resolution_id: DUMMY_UUID,
      p_person_id: DUMMY_UUID,
      p_sentido: "CONSENTIMIENTO",
      p_texto_respuesta: null,
      p_firma_qes_ref: null,
      p_notificacion_certificada_ref: null,
    },
    /no_session_resolution not found/i,
  );
  checks.push({ status: "OK", name: "RPC probe: fn_no_session_cast_response rejects dummy source" });

  await expectRpcBusinessError(
    client,
    "fn_no_session_close_and_materialize_agreement",
    {
      p_tenant_id: DEMO_TENANT,
      p_resolution_id: DUMMY_UUID,
      p_resultado: "APROBADO",
      p_selected_template_id: null,
    },
    /no_session_resolution not found/i,
  );
  checks.push({ status: "OK", name: "RPC probe: fn_no_session_close_and_materialize_agreement rejects dummy source" });

  await expectRpcBusinessError(
    client,
    "fn_generar_certificacion_acuerdo_sin_sesion",
    {
      p_agreement_id: DUMMY_UUID,
      p_tipo: "NO_SESSION",
      p_certificante_role: "SECRETARIO",
      p_visto_bueno_persona_id: null,
    },
    /agreement not found/i,
  );
  checks.push({ status: "OK", name: "RPC probe: fn_generar_certificacion_acuerdo_sin_sesion rejects dummy source" });

  await expectRpcBusinessError(
    client,
    "fn_registrar_transmision_capital",
    {
      p_tenant_id: DEMO_TENANT,
      p_source_holding_id: DUMMY_UUID,
      p_destination_person_id: ZERO_UUID,
      p_titles_to_transfer: 1,
      p_effective_date: "2026-05-04",
      p_agreement_id: null,
      p_support_doc_ref: "ead-trust-demo-smoke",
      p_notas: "secretaria_p0_cloud_smoke_readonly_probe",
    },
    /current source holding not found|person .* does not belong to tenant/i,
  );
  checks.push({ status: "OK", name: "RPC probe: fn_registrar_transmision_capital rejects dummy source" });

  checks.push(...(await runTemplateInventorySmoke(client)));

  return checks;
}

async function runAuthUserIsolationSmoke(): Promise<Check[]> {
  const url =
    secretEnv("VITE_SUPABASE_URL") ??
    secretEnv("SUPABASE_URL") ??
    `https://${EXPECTED_PROJECT_REF}.supabase.co`;
  const serviceKey = secretEnv("SUPABASE_SERVICE_ROLE_KEY") ?? secretEnv("SERVICE_ROLE_SECRET");
  const anonKey = secretEnv("VITE_SUPABASE_ANON_KEY") ?? secretEnv("SUPABASE_ANON_KEY") ?? secretEnv("ANON_PUBLIC");

  if (!url || !serviceKey || !anonKey) {
    const check: Check = {
      status: "SKIP",
      name: "auth user isolation smoke",
      detail: "requires Supabase URL, service role key and anon key",
    };
    if (requireAuthUserIsolation) {
      throw new Error(check.detail);
    }
    return [check];
  }

  const ref = projectRefFromUrl(url);
  if (ref !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_P0_ALLOW_NON_CANONICAL_PROJECT !== "1") {
    throw new Error(
      `Refusing to run auth user smoke against project ref ${ref ?? "unknown"}; expected ${EXPECTED_PROJECT_REF}.`,
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runId = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const personA = randomUUID();
  const personB = randomUUID();
  const userEmail = `secretaria-p0-${runId}@arga-demo.invalid`;
  const userPassword = `TGMS-${runId}-p0!`;
  let userId: string | null = null;

  const cleanup = async () => {
    await userClient.auth.signOut().catch(() => undefined);
    if (userId) {
      await admin.from("user_profiles").delete().eq("user_id", userId);
    }
    await admin.from("persons").delete().in("id", [personA, personB]);
    await admin.from("tenants").delete().in("id", [tenantA, tenantB]);
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  };

  try {
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { smoke: "secretaria_p0_auth_user", run_id: runId },
    });
    if (createError || !createdUser.user) {
      throw new Error(`auth admin createUser failed: ${createError?.message ?? "missing user"}`);
    }
    userId = createdUser.user.id;

    const { error: tenantError } = await admin.from("tenants").insert([
      {
        id: tenantA,
        name: "Secretaria P0 Auth Tenant A",
        tenant_type: "group",
        country_code: "ES",
        is_active: true,
      },
      {
        id: tenantB,
        name: "Secretaria P0 Auth Tenant B",
        tenant_type: "group",
        country_code: "ES",
        is_active: true,
      },
    ]);
    if (tenantError) throw new Error(`tenant fixture insert failed: ${tenantError.message}`);

    const { error: personError } = await admin.from("persons").insert([
      {
        id: personA,
        tenant_id: tenantA,
        full_name: "Secretaria P0 Auth User A",
        person_type: "PF",
        tax_id: `P0-A-${runId.replaceAll("-", "").slice(0, 24)}`,
      },
      {
        id: personB,
        tenant_id: tenantB,
        full_name: "Secretaria P0 Auth User B",
        person_type: "PF",
        tax_id: `P0-B-${runId.replaceAll("-", "").slice(0, 24)}`,
      },
    ]);
    if (personError) throw new Error(`person fixture insert failed: ${personError.message}`);

    const { error: profileError } = await admin.from("user_profiles").insert({
      user_id: userId,
      tenant_id: tenantA,
      person_id: personA,
      role_code: "SECRETARIO",
    });
    if (profileError) throw new Error(`user_profiles fixture insert failed: ${profileError.message}`);

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: userEmail,
      password: userPassword,
    });
    if (signInError) throw new Error(`auth signInWithPassword failed: ${signInError.message}`);

    await expectRpcBusinessError(
      userClient,
      "fn_no_session_cast_response",
      {
        p_tenant_id: tenantA,
        p_resolution_id: DUMMY_UUID,
        p_person_id: personA,
        p_sentido: "CONSENTIMIENTO",
        p_texto_respuesta: "auth user smoke",
        p_firma_qes_ref: null,
        p_notificacion_certificada_ref: null,
      },
      /no_session_resolution not found/i,
    );

    await expectRpcBusinessError(
      userClient,
      "fn_no_session_cast_response",
      {
        p_tenant_id: tenantB,
        p_resolution_id: DUMMY_UUID,
        p_person_id: personA,
        p_sentido: "CONSENTIMIENTO",
        p_texto_respuesta: null,
        p_firma_qes_ref: null,
        p_notificacion_certificada_ref: null,
      },
      /tenant access denied/i,
    );

    await expectRpcBusinessError(
      userClient,
      "fn_no_session_cast_response",
      {
        p_tenant_id: tenantA,
        p_resolution_id: DUMMY_UUID,
        p_person_id: personB,
        p_sentido: "CONSENTIMIENTO",
        p_texto_respuesta: null,
        p_firma_qes_ref: null,
        p_notificacion_certificada_ref: null,
      },
      /person access denied/i,
    );

    await expectRpcBusinessError(
      userClient,
      "fn_no_session_close_and_materialize_agreement",
      {
        p_tenant_id: tenantA,
        p_resolution_id: DUMMY_UUID,
        p_resultado: "APROBADO",
        p_selected_template_id: null,
      },
      /no_session_resolution not found/i,
    );

    await expectRpcBusinessError(
      userClient,
      "fn_registrar_transmision_capital",
      {
        p_tenant_id: tenantA,
        p_source_holding_id: DUMMY_UUID,
        p_destination_person_id: personA,
        p_titles_to_transfer: 1,
        p_effective_date: "2026-05-04",
        p_agreement_id: null,
        p_support_doc_ref: "auth-user-smoke",
        p_notas: "secretaria_p0_auth_user_smoke",
      },
      /current source holding not found/i,
    );

    const { error: roleUpdateError } = await admin
      .from("user_profiles")
      .update({ role_code: "AUDITOR" })
      .eq("user_id", userId);
    if (roleUpdateError) throw new Error(`user_profiles role update failed: ${roleUpdateError.message}`);

    await expectRpcBusinessError(
      userClient,
      "fn_no_session_cast_response",
      {
        p_tenant_id: tenantA,
        p_resolution_id: DUMMY_UUID,
        p_person_id: personA,
        p_sentido: "CONSENTIMIENTO",
        p_texto_respuesta: null,
        p_firma_qes_ref: null,
        p_notificacion_certificada_ref: null,
      },
      /capability VOTE_EMISSION denied for role AUDITOR/i,
    );

    return [
      {
        status: "OK",
        name: "auth user isolation smoke",
        detail: "temporary Supabase Auth user exercised tenant, person and capability checks; fixture cleaned",
      },
    ];
  } finally {
    await cleanup();
  }
}

function buildTransactionalSql() {
  return String.raw`
BEGIN;
SET LOCAL "request.jwt.claim.role" = 'service_role';

DO $$
DECLARE
  v_tenant uuid := '${DEMO_TENANT}'::uuid;
  v_entity_id uuid;
  v_body_id uuid;
  v_legal_form text;
  v_voter_id uuid := gen_random_uuid();
  v_president_id uuid := gen_random_uuid();
  v_source_holder_id uuid := gen_random_uuid();
  v_destination_holder_id uuid := gen_random_uuid();
  v_resolution_id uuid := gen_random_uuid();
  v_response jsonb;
  v_materialized jsonb;
  v_reused jsonb;
  v_agreement_id uuid;
  v_certification_id uuid;
  v_source_holding_id uuid;
  v_transmission jsonb;
BEGIN
  SELECT gb.id, gb.entity_id, e.legal_form
    INTO v_body_id, v_entity_id, v_legal_form
    FROM governing_bodies gb
    JOIN entities e ON e.id = gb.entity_id
   WHERE gb.tenant_id = v_tenant
     AND gb.entity_id IS NOT NULL
   ORDER BY CASE WHEN e.legal_form = 'SA' THEN 0 ELSE 1 END, gb.created_at NULLS LAST, gb.id
   LIMIT 1;

  IF v_body_id IS NULL OR v_entity_id IS NULL THEN
    RAISE EXCEPTION 'No governing body fixture available for tenant %', v_tenant;
  END IF;

  INSERT INTO persons (id, tenant_id, full_name, person_type, tax_id)
  VALUES
    (v_voter_id, v_tenant, 'Secretaria P0 Smoke Voter', 'PF', 'SMOKE-P0-' || replace(v_voter_id::text, '-', '')),
    (v_president_id, v_tenant, 'Secretaria P0 Smoke Presidente', 'PF', 'SMOKE-P0-' || replace(v_president_id::text, '-', '')),
    (v_source_holder_id, v_tenant, 'Secretaria P0 Smoke Source Holder', 'PF', 'SMOKE-P0-' || replace(v_source_holder_id::text, '-', '')),
    (v_destination_holder_id, v_tenant, 'Secretaria P0 Smoke Destination Holder', 'PF', 'SMOKE-P0-' || replace(v_destination_holder_id::text, '-', ''));

  INSERT INTO condiciones_persona (
    tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion, metadata
  ) VALUES
    (v_tenant, v_voter_id, v_entity_id, v_body_id, 'CONSEJERO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"secretaria_p0"}'::jsonb),
    (v_tenant, v_voter_id, v_entity_id, v_body_id, 'SECRETARIO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"secretaria_p0"}'::jsonb),
    (v_tenant, v_president_id, v_entity_id, v_body_id, 'PRESIDENTE', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"secretaria_p0"}'::jsonb);

  INSERT INTO no_session_resolutions (
    id, tenant_id, body_id, title, status, proposal_text,
    requires_unanimity, total_members, voting_deadline, opened_at,
    matter_class, agreement_kind, selected_template_id
  ) VALUES (
    v_resolution_id, v_tenant, v_body_id,
    'Secretaria P0 transactional smoke',
    'VOTING_OPEN',
    'Acuerdo temporal de smoke transaccional Secretaria P0',
    true, 1, now() + interval '1 day', now(),
    'ORDINARIA', 'SMOKE_NO_SESSION', NULL
  );

  SELECT fn_no_session_cast_response(
    v_tenant,
    v_resolution_id,
    v_voter_id,
    'CONSENTIMIENTO',
    'Consentimiento de smoke transaccional',
    'ead-trust-smoke-qes',
    'ead-trust-smoke-erds'
  ) INTO v_response;

  IF v_response->>'status' <> 'APROBADO' THEN
    RAISE EXCEPTION 'fn_no_session_cast_response did not approve fixture: %', v_response;
  END IF;

  SELECT fn_no_session_cast_response(
    v_tenant,
    v_resolution_id,
    v_voter_id,
    'CONSENTIMIENTO',
    'Replay idempotente',
    'ead-trust-smoke-qes',
    'ead-trust-smoke-erds'
  ) INTO v_response;

  IF COALESCE((v_response->>'idempotent')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'fn_no_session_cast_response replay was not idempotent: %', v_response;
  END IF;

  SELECT fn_no_session_close_and_materialize_agreement(
    v_tenant,
    v_resolution_id,
    NULL,
    NULL
  ) INTO v_materialized;

  v_agreement_id := NULLIF(v_materialized->>'agreement_id', '')::uuid;
  IF v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'fn_no_session_close_and_materialize_agreement did not return agreement_id: %', v_materialized;
  END IF;

  SELECT fn_no_session_close_and_materialize_agreement(
    v_tenant,
    v_resolution_id,
    'APROBADO',
    NULL
  ) INTO v_reused;

  IF COALESCE((v_reused->>'idempotent')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'fn_no_session_close_and_materialize_agreement replay was not idempotent: %', v_reused;
  END IF;

  SELECT fn_generar_certificacion_acuerdo_sin_sesion(
    v_agreement_id,
    'NO_SESSION',
    'SECRETARIO',
    CASE WHEN v_legal_form = 'SA' THEN v_president_id ELSE NULL END
  ) INTO v_certification_id;

  IF v_certification_id IS NULL THEN
    RAISE EXCEPTION 'fn_generar_certificacion_acuerdo_sin_sesion returned NULL';
  END IF;

  INSERT INTO capital_holdings (
    tenant_id, entity_id, holder_person_id, share_class_id,
    numero_titulos, porcentaje_capital, voting_rights, is_treasury,
    effective_from, effective_to, metadata
  ) VALUES (
    v_tenant, v_entity_id, v_source_holder_id, NULL,
    100, 10, true, false,
    current_date, NULL, '{"smoke":"secretaria_p0_source"}'::jsonb
  ) RETURNING id INTO v_source_holding_id;

  SELECT fn_registrar_transmision_capital(
    v_tenant,
    v_source_holding_id,
    v_destination_holder_id,
    25,
    current_date,
    v_agreement_id,
    'ead-trust-smoke-support',
    'secretaria_p0_transactional_smoke'
  ) INTO v_transmission;

  IF v_transmission->>'status' <> 'OK'
     OR NULLIF(v_transmission->>'destination_holding_id', '') IS NULL
     OR NULLIF(v_transmission->>'movement_out_id', '') IS NULL
     OR NULLIF(v_transmission->>'movement_in_id', '') IS NULL THEN
    RAISE EXCEPTION 'fn_registrar_transmision_capital returned unexpected payload: %', v_transmission;
  END IF;

  RAISE NOTICE 'Secretaria P0 transactional smoke OK. resolution=%, agreement=%, certification=%, transmission=%',
    v_resolution_id, v_agreement_id, v_certification_id, v_transmission;
END $$;

ROLLBACK;
`;
}

function sqlUuid() {
  return randomUUID();
}

function buildTenantIsolationSql() {
  const tenantA = sqlUuid();
  const tenantB = sqlUuid();
  const entityPersonA = sqlUuid();
  const entityPersonB = sqlUuid();
  const entityA = sqlUuid();
  const entityB = sqlUuid();
  const bodyA = sqlUuid();
  const bodyB = sqlUuid();
  const voterA = sqlUuid();
  const voterB = sqlUuid();
  const presidentA = sqlUuid();
  const presidentB = sqlUuid();
  const sourceA = sqlUuid();
  const destinationA = sqlUuid();
  const sourceB = sqlUuid();
  const destinationB = sqlUuid();
  const sourceHoldingA = sqlUuid();
  const sourceHoldingB = sqlUuid();
  const resolutionA = sqlUuid();
  const resolutionB = sqlUuid();
  const agreementB = sqlUuid();
  const templateB = sqlUuid();

  return String.raw`
BEGIN;
SET LOCAL "request.jwt.claim.role" = 'service_role';

INSERT INTO tenants (id, name, tenant_type, country_code, is_active)
VALUES
  ('${tenantA}', 'Secretaria P0 Tenant A Smoke', 'group', 'ES', true),
  ('${tenantB}', 'Secretaria P0 Tenant B Smoke', 'group', 'ES', true);

INSERT INTO persons (id, tenant_id, full_name, person_type, tax_id, denomination)
VALUES
  ('${entityPersonA}', '${tenantA}', 'Secretaria P0 Entity A, S.A.', 'PJ', 'P0-A-' || replace('${entityPersonA}', '-', ''), 'Secretaria P0 Entity A, S.A.'),
  ('${entityPersonB}', '${tenantB}', 'Secretaria P0 Entity B, S.A.', 'PJ', 'P0-B-' || replace('${entityPersonB}', '-', ''), 'Secretaria P0 Entity B, S.A.'),
  ('${voterA}', '${tenantA}', 'Secretaria P0 Voter A', 'PF', 'P0-A-' || replace('${voterA}', '-', ''), NULL),
  ('${voterB}', '${tenantB}', 'Secretaria P0 Voter B', 'PF', 'P0-B-' || replace('${voterB}', '-', ''), NULL),
  ('${presidentA}', '${tenantA}', 'Secretaria P0 President A', 'PF', 'P0-A-' || replace('${presidentA}', '-', ''), NULL),
  ('${presidentB}', '${tenantB}', 'Secretaria P0 President B', 'PF', 'P0-B-' || replace('${presidentB}', '-', ''), NULL),
  ('${sourceA}', '${tenantA}', 'Secretaria P0 Source A', 'PF', 'P0-A-' || replace('${sourceA}', '-', ''), NULL),
  ('${destinationA}', '${tenantA}', 'Secretaria P0 Destination A', 'PF', 'P0-A-' || replace('${destinationA}', '-', ''), NULL),
  ('${sourceB}', '${tenantB}', 'Secretaria P0 Source B', 'PF', 'P0-B-' || replace('${sourceB}', '-', ''), NULL),
  ('${destinationB}', '${tenantB}', 'Secretaria P0 Destination B', 'PF', 'P0-B-' || replace('${destinationB}', '-', ''), NULL);

INSERT INTO entities (
  id, tenant_id, slug, legal_name, common_name, jurisdiction, legal_form,
  registration_number, entity_status, materiality, forma_administracion,
  es_unipersonal, es_cotizada, tipo_social, person_id, tipo_organo_admin
) VALUES
  ('${entityA}', '${tenantA}', 'secretaria-p0-tenant-a-' || replace('${tenantA}', '-', ''), 'Secretaria P0 Entity A, S.A.', 'Secretaria P0 A', 'ES', 'SA', 'P0-A', 'Active', 'Critical', 'CONSEJO', false, false, 'SA', '${entityPersonA}', 'CDA'),
  ('${entityB}', '${tenantB}', 'secretaria-p0-tenant-b-' || replace('${tenantB}', '-', ''), 'Secretaria P0 Entity B, S.A.', 'Secretaria P0 B', 'ES', 'SA', 'P0-B', 'Active', 'Critical', 'CONSEJO', false, false, 'SA', '${entityPersonB}', 'CDA');

INSERT INTO governing_bodies (id, slug, tenant_id, entity_id, name, body_type, quorum_rule)
VALUES
  ('${bodyA}', 'secretaria-p0-body-a-' || replace('${bodyA}', '-', ''), '${tenantA}', '${entityA}', 'Consejo P0 Tenant A', 'CDA', '{}'::jsonb),
  ('${bodyB}', 'secretaria-p0-body-b-' || replace('${bodyB}', '-', ''), '${tenantB}', '${entityB}', 'Consejo P0 Tenant B', 'CDA', '{}'::jsonb);

INSERT INTO condiciones_persona (
  tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fuente_designacion, metadata
) VALUES
  ('${tenantA}', '${voterA}', '${entityA}', '${bodyA}', 'CONSEJERO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_a"}'::jsonb),
  ('${tenantA}', '${voterA}', '${entityA}', '${bodyA}', 'SECRETARIO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_a"}'::jsonb),
  ('${tenantA}', '${presidentA}', '${entityA}', '${bodyA}', 'PRESIDENTE', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_a"}'::jsonb),
  ('${tenantB}', '${voterB}', '${entityB}', '${bodyB}', 'CONSEJERO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_b"}'::jsonb),
  ('${tenantB}', '${voterB}', '${entityB}', '${bodyB}', 'SECRETARIO', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_b"}'::jsonb),
  ('${tenantB}', '${presidentB}', '${entityB}', '${bodyB}', 'PRESIDENTE', 'VIGENTE', current_date, 'BOOTSTRAP', '{"smoke":"tenant_b"}'::jsonb);

INSERT INTO no_session_resolutions (
  id, tenant_id, body_id, title, status, proposal_text,
  requires_unanimity, total_members, voting_deadline, opened_at,
  matter_class, agreement_kind, selected_template_id
) VALUES
  ('${resolutionA}', '${tenantA}', '${bodyA}', 'Secretaria P0 Tenant A no-session', 'VOTING_OPEN', 'Tenant A proposal', true, 1, now() + interval '1 day', now(), 'ORDINARIA', 'P0_TENANT_A', NULL),
  ('${resolutionB}', '${tenantB}', '${bodyB}', 'Secretaria P0 Tenant B no-session', 'VOTING_OPEN', 'Tenant B proposal', true, 1, now() + interval '1 day', now(), 'ORDINARIA', 'P0_TENANT_B', NULL);

INSERT INTO agreements (
  id, tenant_id, entity_id, body_id, agreement_kind, matter_class, adoption_mode,
  status, proposal_text, decision_text, execution_mode, compliance_snapshot
) VALUES (
  '${agreementB}', '${tenantB}', '${entityB}', '${bodyB}', 'P0_TENANT_B', 'ORDINARIA', 'NO_SESSION',
  'ADOPTED', 'Tenant B adopted proposal', 'Tenant B adopted decision',
  '{"mode":"NO_SESSION","smoke":"tenant_b"}'::jsonb,
  '{"smoke":"tenant_b"}'::jsonb
);

INSERT INTO plantillas_protegidas (
  id, tenant_id, tipo, materia, jurisdiccion, version, estado,
  aprobada_por, fecha_aprobacion, capa1_inmutable, capa2_variables, capa3_editables,
  organo_tipo, adoption_mode, referencia_legal
) VALUES (
  '${templateB}', '${tenantB}', 'MODELO_ACUERDO', 'P0_TENANT_B', 'ES', '1.0.0', 'ACTIVA',
  'Comité Legal ARGA — Secretaría Societaria (demo-operativo)', now(),
  'Plantilla temporal tenant B smoke. Evidencia de apoyo demo/operativa. No constituye evidencia final productiva.',
  '[]'::jsonb, '[]'::jsonb, 'CONSEJO_ADMIN', 'NO_SESSION', 'LSC; RRM'
);

INSERT INTO capital_holdings (
  id, tenant_id, entity_id, holder_person_id, share_class_id,
  numero_titulos, porcentaje_capital, voting_rights, is_treasury,
  effective_from, effective_to, metadata
) VALUES
  ('${sourceHoldingA}', '${tenantA}', '${entityA}', '${sourceA}', NULL, 100, 10, true, false, current_date, NULL, '{"smoke":"source_a"}'::jsonb),
  ('${sourceHoldingB}', '${tenantB}', '${entityB}', '${sourceB}', NULL, 100, 10, true, false, current_date, NULL, '{"smoke":"source_b"}'::jsonb);

SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = '${voterA}';
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${voterA}","tenant_id":"${tenantA}","role_code":"SECRETARIO","person_id":"${voterA}"}';
SET LOCAL app.current_tenant_id = '${tenantA}';

DO $$
DECLARE
  v_response jsonb;
  v_materialized jsonb;
  v_agreement_id uuid;
  v_certification_id uuid;
  v_table_count integer;
BEGIN
  IF fn_secretaria_current_tenant_id() <> '${tenantA}'::uuid THEN
    RAISE EXCEPTION 'tenant claim did not resolve to tenant A';
  END IF;
  IF fn_secretaria_current_role_code() <> 'SECRETARIO' THEN
    RAISE EXCEPTION 'role claim did not resolve to SECRETARIO';
  END IF;
  IF fn_secretaria_current_person_id() <> '${voterA}'::uuid THEN
    RAISE EXCEPTION 'person claim did not resolve to voter A';
  END IF;

  SELECT fn_no_session_cast_response(
    '${tenantA}', '${resolutionA}', '${voterA}', 'CONSENTIMIENTO',
    'Tenant A authenticated consent', 'ead-trust-tenant-a-qes', 'ead-trust-tenant-a-erds'
  ) INTO v_response;
  IF v_response->>'status' <> 'APROBADO' THEN
    RAISE EXCEPTION 'tenant A authenticated vote did not approve: %', v_response;
  END IF;

  SELECT fn_no_session_close_and_materialize_agreement(
    '${tenantA}', '${resolutionA}', 'APROBADO', NULL
  ) INTO v_materialized;
  v_agreement_id := NULLIF(v_materialized->>'agreement_id', '')::uuid;
  IF v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'tenant A materialization did not return agreement_id: %', v_materialized;
  END IF;

  SELECT fn_generar_certificacion_acuerdo_sin_sesion(
    v_agreement_id, 'NO_SESSION', 'SECRETARIO', '${presidentA}'
  ) INTO v_certification_id;
  IF v_certification_id IS NULL THEN
    RAISE EXCEPTION 'tenant A authenticated certification returned null';
  END IF;

  PERFORM fn_registrar_transmision_capital(
    '${tenantA}', '${sourceHoldingA}', '${destinationA}', 10, current_date,
    v_agreement_id, 'ead-trust-tenant-a-support', 'tenant_a_positive_transmission'
  );

  SELECT COUNT(*) INTO v_table_count FROM capital_holdings WHERE tenant_id = '${tenantB}';
  IF v_table_count <> 0 THEN
    RAISE EXCEPTION 'RLS leak: tenant A can read tenant B capital_holdings count=%', v_table_count;
  END IF;

  BEGIN
    PERFORM fn_no_session_cast_response(
      '${tenantB}', '${resolutionB}', '${voterB}', 'CONSENTIMIENTO',
      'cross tenant vote', NULL, NULL
    );
    RAISE EXCEPTION 'expected tenant denial for cross-tenant vote was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(tenant access denied)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant vote error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_no_session_cast_response(
      '${tenantA}', '${resolutionA}', '${voterB}', 'CONSENTIMIENTO',
      'person spoof', NULL, NULL
    );
    RAISE EXCEPTION 'expected person denial for spoofed vote was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(person access denied)' THEN
      RAISE EXCEPTION 'unexpected spoofed vote error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_no_session_close_and_materialize_agreement('${tenantB}', '${resolutionB}', 'APROBADO', NULL);
    RAISE EXCEPTION 'expected tenant denial for cross-tenant materialization was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(tenant access denied)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant materialization error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_no_session_close_and_materialize_agreement('${tenantA}', '${resolutionA}', 'APROBADO', '${templateB}');
    RAISE EXCEPTION 'expected template tenant denial was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(template .* does not belong to tenant)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant template error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_generar_certificacion_acuerdo_sin_sesion('${agreementB}', 'NO_SESSION', 'SECRETARIO', NULL);
    RAISE EXCEPTION 'expected tenant denial for cross-tenant certification was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(tenant access denied)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant certification error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_registrar_transmision_capital(
      '${tenantA}', '${sourceHoldingA}', '${destinationB}', 1, current_date,
      v_agreement_id, 'ead-trust-cross-tenant-support', 'cross_tenant_destination'
    );
    RAISE EXCEPTION 'expected destination tenant denial was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(person .* does not belong to tenant)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant transmission destination error: %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM fn_cerrar_votaciones_vencidas('${tenantB}');
    RAISE EXCEPTION 'expected tenant denial for cross-tenant expired close was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(tenant access denied)' THEN
      RAISE EXCEPTION 'unexpected cross-tenant expired close error: %', SQLERRM;
    END IF;
  END;

END $$;

RESET ROLE;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = '${voterA}';
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${voterA}","tenant_id":"${tenantA}","role_code":"AUDITOR","person_id":"${voterA}"}';

DO $$
BEGIN
  BEGIN
    PERFORM fn_secretaria_assert_capability('${tenantA}', 'CERTIFICATION');
    RAISE EXCEPTION 'expected capability denial for AUDITOR was not raised';
  EXCEPTION WHEN others THEN
    IF SQLERRM !~ '(capability CERTIFICATION denied)' THEN
      RAISE EXCEPTION 'unexpected AUDITOR capability denial error: %', SQLERRM;
    END IF;
  END;
END $$;

ROLLBACK;
`;
}

function hasCommand(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function safeDbLabel(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/${parsed.pathname.replace(/^\//, "")}`;
  } catch {
    return "provided database URL";
  }
}

function runPsqlSmoke(name: string, sql: string): Check | null {
  const databaseUrl = secretEnv("SECRETARIA_P0_DATABASE_URL") ?? secretEnv("DATABASE_URL");
  if (databaseUrl && hasCommand("psql")) {
    const result = spawnSync(
      "psql",
      [
        databaseUrl,
        "--no-psqlrc",
        "--quiet",
        "--set",
        "ON_ERROR_STOP=1",
        "--set",
        "VERBOSITY=terse",
      ],
      {
        input: sql,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 4,
      },
    );

    if (result.status !== 0) {
      const stderr = result.stderr.trim();
      const stdout = result.stdout.trim();
      return {
        status: "FAIL",
        name,
        detail: [stdout, stderr].filter(Boolean).join("\n").slice(0, 6000),
      };
    }

    return {
      status: "OK",
      name,
      detail: `BEGIN/ROLLBACK fixture passed against ${safeDbLabel(databaseUrl)}`,
    };
  }

  return null;
}

function runLinkedSqlSmoke(name: string, sql: string, sentinel: string): Check {
  const psqlResult = runPsqlSmoke(name, sql);
  if (psqlResult) return psqlResult;

  const linkedRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  if (linkedRef !== EXPECTED_PROJECT_REF) {
    return {
      status: "FAIL",
      name,
      detail: `refusing Supabase CLI transactional smoke against ${linkedRef || "unknown"}; expected ${EXPECTED_PROJECT_REF}`,
    };
  }

  const tempDir = mkdtempSync(join(tmpdir(), "secretaria-p0-smoke-"));
  const tempFile = join(tempDir, "smoke.sql");
  writeFileSync(
    tempFile,
    `${sql}\nSELECT '${sentinel}' AS result;\n`,
    "utf8",
  );

  const result = spawnSync(process.execPath, ["x", SUPABASE_CLI_PACKAGE, "db", "query", "--linked", "--file", tempFile], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  rmSync(tempDir, { recursive: true, force: true });

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    return {
      status: "FAIL",
      name,
      detail: [stdout, stderr].filter(Boolean).join("\n").slice(0, 6000),
    };
  }

  if (!result.stdout.includes(sentinel)) {
    return {
      status: "FAIL",
      name,
      detail: `Supabase CLI smoke completed without expected sentinel: ${result.stdout.slice(0, 2000)}`,
    };
  }

  return {
    status: "OK",
    name,
    detail: `BEGIN/ROLLBACK fixture passed via linked Supabase CLI project ${EXPECTED_PROJECT_REF}`,
  };
}

function runTransactionalSmoke(): Check {
  return runLinkedSqlSmoke(
    "transactional cloud smoke",
    buildTransactionalSql(),
    "secretaria_p0_cloud_smoke_rollback_ok",
  );
}

function runTenantIsolationSmoke(): Check {
  return runLinkedSqlSmoke(
    "tenant isolation cloud smoke",
    buildTenantIsolationSql(),
    "secretaria_p0_tenant_isolation_rollback_ok",
  );
}

async function main() {
  console.log("== Secretaria P0 Cloud smoke ==");
  console.log(`Target project ref: ${EXPECTED_PROJECT_REF}`);
  console.log("");

  const checks: Check[] = [];

  try {
    checks.push(...(await runReadonlySmoke()));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ status: "FAIL", name: "readonly cloud smoke", detail: message });
  }

  if (!readonlyOnly && runTransactional) {
    checks.push(runTransactionalSmoke());
  } else if (!readonlyOnly) {
    checks.push({
      status: "SKIP",
      name: "transactional cloud smoke",
      detail: "pass --transactional or set SECRETARIA_P0_RUN_TRANSACTIONAL=1",
    });
  }

  if (!readonlyOnly && runTenantIsolation) {
    checks.push(runTenantIsolationSmoke());
  } else if (!readonlyOnly) {
    checks.push({
      status: requireTenantIsolation ? "FAIL" : "SKIP",
      name: "tenant isolation cloud smoke",
      detail: "pass --tenant-isolation or set SECRETARIA_P0_RUN_TENANT_ISOLATION=1",
    });
  }

  if (!readonlyOnly && runAuthUserIsolation) {
    try {
      checks.push(...(await runAuthUserIsolationSmoke()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({ status: "FAIL", name: "auth user isolation smoke", detail: message });
    }
  } else if (!readonlyOnly) {
    checks.push({
      status: requireAuthUserIsolation ? "FAIL" : "SKIP",
      name: "auth user isolation smoke",
      detail: "pass --auth-user-isolation or set SECRETARIA_P0_RUN_AUTH_USER_ISOLATION=1",
    });
  }

  for (const check of checks) logCheck(check);

  const failed = checks.filter((check) => check.status === "FAIL");
  if (failed.length > 0) {
    fail(`${failed.length} smoke check(s) failed`);
  }

  console.log("");
  console.log("Secretaria P0 Cloud smoke finished.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
