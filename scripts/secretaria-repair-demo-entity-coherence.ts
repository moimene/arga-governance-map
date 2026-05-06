#!/usr/bin/env bun
/* global process, console */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  inferAgreementScopePatch,
  type ScopeBody,
  type ScopeMeeting,
  type ScopeNoSessionResolution,
} from "../src/lib/secretaria/entity-demo-readiness";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ENV_FILE = "docs/superpowers/plans/.env";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const applySafeAll = args.has("--apply-safe");
const all = args.has("--all");
const plan = args.has("--plan");
const json = args.has("--json");
const printSql = args.has("--sql");
const failOnBroken = args.has("--fail-on-broken");
const entityArg = optionValue("--entity");

type Json = Record<string, unknown>;
type Row = Record<string, unknown> & { id: string };
type IssueSeverity = "BLOCKING" | "WARNING" | "INFO";
type EntityStatus = "Completa" | "Parcial" | "Rota" | "No usable para flujo";

type Issue = {
  severity: IssueSeverity;
  code: string;
  entity_id?: string | null;
  object_type?: string;
  object_id?: string;
  detail: string;
  repair?: "auto" | "manual" | "none";
};

type MatrixRow = {
  sociedad: string;
  entity_id: string;
  tipo: string;
  socios_accionistas: string;
  cap_table: string;
  organos: string;
  cargos_vigentes: string;
  authority_evidence: string;
  rule_overrides: string;
  pactos: string;
  flujos_habilitados: string;
  estado: EntityStatus;
};

type Report = {
  mode: "report" | "plan" | "apply";
  tenant: string;
  societies: number;
  matrix: MatrixRow[];
  issues: Issue[];
  flowGaps: Array<{ entity_id: string; sociedad: string; missing: string[] }>;
  summary: Record<EntityStatus, number>;
  repairs?: string[];
  sqlProbeNames: string[];
};

function optionValue(name: string) {
  const raw = process.argv.slice(2);
  const index = raw.indexOf(name);
  if (index >= 0) return raw[index + 1] || "";
  const prefix = `${name}=`;
  const match = raw.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

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
  if (ref !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_REPAIR_ALLOW_NON_CANONICAL_PROJECT !== "1") {
    throw new Error(`Refusing to run against ${ref ?? "unknown"}; expected ${EXPECTED_PROJECT_REF}.`);
  }

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const SQL_PROBES: Record<string, string> = {
  cross_entity_meeting_agreements: `
select
  a.id as agreement_id,
  a.agreement_kind,
  a.entity_id as agreement_entity_id,
  a.body_id as agreement_body_id,
  a.parent_meeting_id,
  m.body_id as meeting_body_id,
  gb.entity_id as meeting_entity_id
from agreements a
left join meetings m on m.id = a.parent_meeting_id
left join governing_bodies gb on gb.id = coalesce(a.body_id, m.body_id)
where a.tenant_id = '${DEMO_TENANT}'
  and a.entity_id is not null
  and gb.entity_id is not null
  and a.entity_id <> gb.entity_id;`.trim(),
  societies_without_bodies: `
select e.id, e.legal_name, count(gb.id) as bodies
from entities e
left join governing_bodies gb on gb.entity_id = e.id
where e.tenant_id = '${DEMO_TENANT}'
  and e.person_id is not null
group by e.id, e.legal_name
having count(gb.id) = 0;`.trim(),
  societies_without_active_cap_table: `
select e.id, e.legal_name, count(ch.id) as holdings
from entities e
left join capital_holdings ch on ch.entity_id = e.id and ch.effective_to is null
where e.tenant_id = '${DEMO_TENANT}'
  and e.person_id is not null
group by e.id, e.legal_name
having count(ch.id) = 0;`.trim(),
  agreements_missing_scope: `
select id, agreement_kind, status, entity_id, body_id, parent_meeting_id, no_session_resolution_id
from agreements
where tenant_id = '${DEMO_TENANT}'
  and (entity_id is null or body_id is null);`.trim(),
  condition_body_entity_mismatch: `
select cp.id, cp.tipo_condicion, cp.entity_id as condition_entity_id,
       cp.body_id, gb.entity_id as body_entity_id
from condiciones_persona cp
join governing_bodies gb on gb.id = cp.body_id
where cp.tenant_id = '${DEMO_TENANT}'
  and cp.estado = 'VIGENTE'
  and cp.entity_id <> gb.entity_id;`.trim(),
  authority_body_entity_mismatch: `
select ae.id, ae.cargo, ae.entity_id as authority_entity_id,
       ae.body_id, gb.entity_id as body_entity_id
from authority_evidence ae
join governing_bodies gb on gb.id = ae.body_id
where ae.tenant_id = '${DEMO_TENANT}'
  and ae.estado = 'VIGENTE'
  and ae.entity_id <> gb.entity_id;`.trim(),
  meetings_without_census: `
select m.id, m.slug, m.body_id, gb.entity_id
from meetings m
join governing_bodies gb on gb.id = m.body_id
where m.tenant_id = '${DEMO_TENANT}'
  and not exists (
    select 1 from censo_snapshot cs
    where cs.tenant_id = m.tenant_id and cs.meeting_id = m.id
  );`.trim(),
};

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildSqlProbes(entityId?: string) {
  if (!entityId) return SQL_PROBES;
  const id = sqlLiteral(entityId);
  return {
    cross_entity_meeting_agreements: `
select
  a.id as agreement_id,
  a.agreement_kind,
  a.entity_id as agreement_entity_id,
  a.body_id as agreement_body_id,
  a.parent_meeting_id,
  m.body_id as meeting_body_id,
  gb.entity_id as meeting_entity_id
from agreements a
left join meetings m on m.id = a.parent_meeting_id
left join governing_bodies gb on gb.id = coalesce(a.body_id, m.body_id)
where a.tenant_id = '${DEMO_TENANT}'
  and (a.entity_id = ${id}::uuid or gb.entity_id = ${id}::uuid)
  and a.entity_id is not null
  and gb.entity_id is not null
  and a.entity_id <> gb.entity_id;`.trim(),
    societies_without_bodies: `
select e.id, e.legal_name, count(gb.id) as bodies
from entities e
left join governing_bodies gb on gb.entity_id = e.id
where e.tenant_id = '${DEMO_TENANT}'
  and e.id = ${id}::uuid
group by e.id, e.legal_name
having count(gb.id) = 0;`.trim(),
    societies_without_active_cap_table: `
select e.id, e.legal_name, count(ch.id) as holdings
from entities e
left join capital_holdings ch on ch.entity_id = e.id and ch.effective_to is null
where e.tenant_id = '${DEMO_TENANT}'
  and e.id = ${id}::uuid
group by e.id, e.legal_name
having count(ch.id) = 0;`.trim(),
    agreements_missing_scope: `
select id, agreement_kind, status, entity_id, body_id, parent_meeting_id, no_session_resolution_id
from agreements
where tenant_id = '${DEMO_TENANT}'
  and entity_id = ${id}::uuid
  and (entity_id is null or body_id is null);`.trim(),
    condition_body_entity_mismatch: `
select cp.id, cp.tipo_condicion, cp.entity_id as condition_entity_id,
       cp.body_id, gb.entity_id as body_entity_id
from condiciones_persona cp
join governing_bodies gb on gb.id = cp.body_id
where cp.tenant_id = '${DEMO_TENANT}'
  and (cp.entity_id = ${id}::uuid or gb.entity_id = ${id}::uuid)
  and cp.estado = 'VIGENTE'
  and cp.entity_id <> gb.entity_id;`.trim(),
    authority_body_entity_mismatch: `
select ae.id, ae.cargo, ae.entity_id as authority_entity_id,
       ae.body_id, gb.entity_id as body_entity_id
from authority_evidence ae
join governing_bodies gb on gb.id = ae.body_id
where ae.tenant_id = '${DEMO_TENANT}'
  and (ae.entity_id = ${id}::uuid or gb.entity_id = ${id}::uuid)
  and ae.estado = 'VIGENTE'
  and ae.entity_id <> gb.entity_id;`.trim(),
    meetings_without_census: `
select m.id, m.slug, m.body_id, gb.entity_id
from meetings m
join governing_bodies gb on gb.id = m.body_id
where m.tenant_id = '${DEMO_TENANT}'
  and gb.entity_id = ${id}::uuid
  and not exists (
    select 1 from censo_snapshot cs
    where cs.tenant_id = m.tenant_id and cs.meeting_id = m.id
  );`.trim(),
    certification_entity_mismatch: `
select
  c.id as certification_id,
  c.minute_id,
  c.agreement_id,
  m.entity_id as minute_entity_id,
  a.entity_id as agreement_entity_id
from certifications c
left join minutes m on m.id = c.minute_id
left join agreements a on a.id = c.agreement_id
where c.tenant_id = '${DEMO_TENANT}'
  and (m.entity_id = ${id}::uuid or a.entity_id = ${id}::uuid)
  and m.entity_id is not null
  and a.entity_id is not null
  and m.entity_id <> a.entity_id;`.trim(),
  };
}

async function selectAll(supabase: SupabaseClient, table: string, columns = "*") {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("tenant_id", DEMO_TENANT);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Row[];
}

async function loadData(supabase: SupabaseClient) {
  const [
    entities,
    capitalProfiles,
    holdings,
    bodies,
    conditions,
    authority,
    meetings,
    convocatorias,
    agreements,
    minutes,
    certifications,
    censo,
    overrides,
    pactos,
    noSession,
    unipersonal,
    templates,
  ] = await Promise.all([
    selectAll(supabase, "entities", [
      "id",
      "tenant_id",
      "slug",
      "legal_name",
      "common_name",
      "jurisdiction",
      "legal_form",
      "tipo_social",
      "es_cotizada",
      "es_unipersonal",
      "forma_administracion",
      "tipo_organo_admin",
      "person_id",
      "parent_entity_id",
      "ownership_percentage",
      "entity_status",
    ].join(",")),
    selectAll(supabase, "entity_capital_profile"),
    selectAll(supabase, "capital_holdings"),
    selectAll(supabase, "governing_bodies", "id,tenant_id,entity_id,name,body_type,config,quorum_rule,slug"),
    selectAll(supabase, "condiciones_persona"),
    selectAll(supabase, "authority_evidence"),
    selectAll(supabase, "meetings", [
      "id",
      "tenant_id",
      "slug",
      "body_id",
      "meeting_type",
      "status",
      "scheduled_start",
      "president_id",
      "secretary_id",
      "quorum_data",
    ].join(",")),
    selectAll(supabase, "convocatorias", "id,tenant_id,body_id,estado,fecha_1,tipo_convocatoria"),
    selectAll(supabase, "agreements"),
    selectAll(supabase, "minutes", "id,tenant_id,meeting_id,body_id,entity_id,snapshot_id,signed_at,is_locked"),
    selectAll(supabase, "certifications", [
      "id",
      "tenant_id",
      "minute_id",
      "agreement_id",
      "agreements_certified",
      "certifier_id",
      "certificante_role",
      "tipo_certificacion",
      "authority_evidence_id",
      "signature_status",
    ].join(",")),
    selectAll(supabase, "censo_snapshot", "id,tenant_id,meeting_id,entity_id,body_id,session_kind,snapshot_type,total_partes"),
    selectAll(supabase, "rule_param_overrides", "id,tenant_id,entity_id,materia,clave,fuente"),
    selectAll(supabase, "pactos_parasociales", "id,tenant_id,entity_id,estado"),
    selectAll(supabase, "no_session_resolutions", "id,tenant_id,body_id,status,agreement_kind,matter_class,total_members"),
    selectAll(supabase, "unipersonal_decisions", "id,tenant_id,entity_id,status,decision_type,decided_by_id"),
    selectAll(supabase, "plantillas_protegidas", [
      "id",
      "tenant_id",
      "tipo",
      "estado",
      "materia",
      "materia_acuerdo",
      "organo_tipo",
      "adoption_mode",
      "jurisdiccion",
    ].join(",")),
  ]);

  return {
    entities,
    capitalProfiles,
    holdings,
    bodies,
    conditions,
    authority,
    meetings,
    convocatorias,
    agreements,
    minutes,
    certifications,
    censo,
    overrides,
    pactos,
    noSession,
    unipersonal,
    templates,
  };
}

function byId(rows: Row[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function groupBy<T extends Row>(rows: T[], key: string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    const id = String(value);
    map.set(id, [...(map.get(id) ?? []), row]);
  }
  return map;
}

function active(rows: Row[]) {
  return rows.filter((row) => row.estado === "VIGENTE" || row.effective_to === null || row.status === "Active");
}

function nameOf(entity: Row) {
  return String(entity.legal_name ?? entity.common_name ?? entity.slug ?? entity.id);
}

function entityType(entity: Row) {
  const flags = [
    entity.tipo_social,
    entity.legal_form,
    entity.es_cotizada ? "cotizada" : null,
    entity.es_unipersonal ? "unipersonal" : null,
    entity.tipo_organo_admin,
  ].filter(Boolean);
  return flags.length > 0 ? flags.join(" / ") : "sin tipo";
}

function bodyConfig(body: Row) {
  return (body.config ?? {}) as Json;
}

function bodyOrganType(body: Row) {
  const config = bodyConfig(body);
  return String(config.organo_tipo ?? body.body_type ?? body.name ?? "");
}

function isJunta(body: Row) {
  const label = `${body.body_type ?? ""} ${body.name ?? ""} ${bodyOrganType(body)}`.toUpperCase();
  return label.includes("JUNTA") || label.includes("SOCIO_UNICO");
}

function isBoard(body: Row) {
  const label = `${body.body_type ?? ""} ${body.name ?? ""} ${bodyOrganType(body)}`.toUpperCase();
  return label.includes("CDA") || label.includes("CONSEJO") || label.includes("ADMIN");
}

function capTableSummary(holdings: Row[]) {
  const activeHoldings = holdings.filter((row) => row.effective_to == null);
  const sum = activeHoldings.reduce((acc, row) => acc + Number(row.porcentaje_capital ?? 0), 0);
  const ok = activeHoldings.length > 0 && Math.abs(sum - 100) < 0.05;
  return {
    count: activeHoldings.length,
    sum,
    ok,
    label: activeHoldings.length === 0 ? "0" : `${activeHoldings.length} / ${sum.toFixed(2)}%`,
  };
}

function hasTemplateForAgreement(agreement: Row, activeTemplates: Row[]) {
  const kind = String(agreement.agreement_kind ?? "");
  if (!kind) return false;
  const selectedId =
    ((agreement.execution_mode as Json | null)?.selected_template_id as string | undefined) ??
    (((agreement.execution_mode as Json | null)?.agreement_360 as Json | undefined)?.selected_template_id as string | undefined);
  if (selectedId && activeTemplates.some((template) => template.id === selectedId)) return true;
  return activeTemplates.some((template) => {
    const materia = String(template.materia ?? template.materia_acuerdo ?? "");
    return materia === kind && (template.tipo === "MODELO_ACUERDO" || template.tipo === "CERTIFICACION");
  });
}

function resolveEntityFilter(data: Awaited<ReturnType<typeof loadData>>, value: string | null) {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  const candidates = data.entities.filter((entity) => {
    const labels = [
      entity.id,
      entity.legal_name,
      entity.common_name,
      entity.slug,
    ].filter(Boolean).map((label) => String(label).toLowerCase());
    return labels.includes(needle);
  });
  if (candidates.length === 1) return candidates[0];

  const partial = data.entities.filter((entity) => {
    const labels = [entity.legal_name, entity.common_name, entity.slug]
      .filter(Boolean)
      .map((label) => String(label).toLowerCase());
    return labels.some((label) => label.includes(needle));
  });
  if (partial.length === 1) return partial[0];
  if (partial.length > 1 || candidates.length > 1) {
    throw new Error(`Entity filter "${value}" is ambiguous (${Math.max(partial.length, candidates.length)} matches). Use the UUID.`);
  }
  throw new Error(`Entity filter "${value}" did not match any demo entity.`);
}

function bodyEntityIdForRow(row: Row, data: Awaited<ReturnType<typeof loadData>>) {
  const body = byId(data.bodies).get(String(row.body_id ?? ""));
  return body?.entity_id ? String(body.entity_id) : null;
}

function isAgreementRelevantToEntity(agreement: Row, data: Awaited<ReturnType<typeof loadData>>, entityId: string) {
  const bodyById = byId(data.bodies);
  const meetingById = byId(data.meetings);
  const noSessionById = byId(data.noSession);
  if (agreement.entity_id === entityId) return true;
  if (agreement.body_id && bodyById.get(String(agreement.body_id))?.entity_id === entityId) return true;
  if (agreement.parent_meeting_id) {
    const meeting = meetingById.get(String(agreement.parent_meeting_id));
    if (meeting?.body_id && bodyById.get(String(meeting.body_id))?.entity_id === entityId) return true;
  }
  if (agreement.no_session_resolution_id) {
    const resolution = noSessionById.get(String(agreement.no_session_resolution_id));
    if (resolution?.body_id && bodyById.get(String(resolution.body_id))?.entity_id === entityId) return true;
  }
  return false;
}

function inferFlows(params: {
  entity: Row;
  bodies: Row[];
  conditions: Row[];
  authority: Row[];
  holdings: Row[];
  meetings: Row[];
  agreements: Row[];
  noSession: Row[];
  unipersonal: Row[];
  activeTemplates: Row[];
}) {
  const { entity, bodies, conditions, authority, holdings, meetings, agreements, noSession, unipersonal, activeTemplates } = params;
  const cap = capTableSummary(holdings);
  const activeConditions = conditions.filter((row) => row.estado === "VIGENTE");
  const activeAuthority = authority.filter((row) => row.estado === "VIGENTE");
  const hasPresident = activeAuthority.some((row) => row.cargo === "PRESIDENTE");
  const hasSecretary = activeAuthority.some((row) => row.cargo === "SECRETARIO");
  const hasCertifier = activeAuthority.some((row) =>
    ["SECRETARIO", "ADMIN_UNICO", "ADMIN_SOLIDARIO", "ADMIN_MANCOMUNADO", "PRESIDENTE"].includes(String(row.cargo)),
  );
  const hasJunta = bodies.some(isJunta);
  const hasBoard = bodies.some(isBoard);
  const hasAdminUnico = activeConditions.some((row) => row.tipo_condicion === "ADMIN_UNICO");
  const solidarios = activeConditions.filter((row) => row.tipo_condicion === "ADMIN_SOLIDARIO");
  const mancomunados = activeConditions.filter((row) => row.tipo_condicion === "ADMIN_MANCOMUNADO");
  const hasCoBody = bodies.some((body) => bodyConfig(body).adoption_mode === "CO_APROBACION");
  const hasSolidarioBody = bodies.some((body) => bodyConfig(body).adoption_mode === "SOLIDARIO");
  const agreementTemplatesOk = agreements.length > 0 && agreements.some((agreement) => hasTemplateForAgreement(agreement, activeTemplates));
  const isUnipersonal = entity.es_unipersonal === true || ["SLU", "SAU"].includes(String(entity.tipo_social ?? ""));

  const flows: string[] = [];
  const missing: string[] = [];

  if (hasJunta && cap.ok && hasPresident && hasSecretary) flows.push("Junta/convocatoria");
  else if (hasJunta) missing.push("Junta completa: cap table 100%, presidente y secretario");

  if (hasBoard && hasPresident && hasSecretary) flows.push("Consejo/acta");
  else if (hasBoard) missing.push("Consejo completo: presidente y secretario vigentes");

  if (isUnipersonal && hasJunta && cap.count === 1 && (hasAdminUnico || hasCertifier)) flows.push("Socio unico");
  else if (isUnipersonal) missing.push("Socio unico: socio 100% y administrador/certificante");

  if ((hasSolidarioBody || solidarios.length > 0) && solidarios.length >= 1 && hasCertifier) flows.push("Administrador solidario");
  else if (hasSolidarioBody || String(entity.tipo_organo_admin ?? "") === "ADMIN_SOLIDARIOS") {
    missing.push("Administrador solidario: cargo y evidence vigente");
  }

  if ((hasCoBody || mancomunados.length > 0) && mancomunados.length >= 2 && hasCertifier) flows.push("Co-aprobacion");
  else if (hasCoBody || String(entity.tipo_organo_admin ?? "") === "ADMIN_MANCOMUNADOS") {
    missing.push("Co-aprobacion: dos administradores mancomunados y evidence");
  }

  if (noSession.length > 0 || (hasJunta && cap.ok && hasSecretary)) flows.push("Acuerdo sin sesion");
  if (meetings.length > 0) flows.push("Acta");
  if (hasCertifier && agreements.length > 0) flows.push("Certificacion");
  if (agreementTemplatesOk) flows.push("Tramitador/documento");
  else if (agreements.length > 0) missing.push("Plantilla activa compatible con acuerdos");

  if (unipersonal.length > 0 && !flows.includes("Socio unico")) flows.push("Decision unipersonal legacy");

  return { flows, missing };
}

function buildReport(
  data: Awaited<ReturnType<typeof loadData>>,
  mode: "report" | "apply",
  repairs: string[] = [],
  entityFilterId?: string | null,
): Report {
  const entityRows = data.entities
    .filter((entity) => entity.person_id)
    .filter((entity) => !entityFilterId || entity.id === entityFilterId)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "es"));

  const bodiesByEntity = groupBy(data.bodies, "entity_id");
  const holdingsByEntity = groupBy(data.holdings, "entity_id");
  const profilesByEntity = groupBy(data.capitalProfiles, "entity_id");
  const conditionsByEntity = groupBy(data.conditions, "entity_id");
  const authorityByEntity = groupBy(data.authority, "entity_id");
  const overridesByEntity = groupBy(data.overrides, "entity_id");
  const pactosByEntity = groupBy(data.pactos, "entity_id");
  const agreementsByEntity = groupBy(data.agreements, "entity_id");
  const unipersonalByEntity = groupBy(data.unipersonal, "entity_id");
  const bodyById = byId(data.bodies);
  const meetingById = byId(data.meetings);
  const agreementById = byId(data.agreements);
  const minuteById = byId(data.minutes);
  const activeTemplates = data.templates.filter((template) => template.estado === "ACTIVA");

  const meetingsByEntity = new Map<string, Row[]>();
  for (const meeting of data.meetings) {
    const body = bodyById.get(String(meeting.body_id ?? ""));
    if (!body?.entity_id) continue;
    const entityId = String(body.entity_id);
    meetingsByEntity.set(entityId, [...(meetingsByEntity.get(entityId) ?? []), meeting]);
  }

  const noSessionByEntity = new Map<string, Row[]>();
  for (const resolution of data.noSession) {
    const body = bodyById.get(String(resolution.body_id ?? ""));
    if (!body?.entity_id) continue;
    const entityId = String(body.entity_id);
    noSessionByEntity.set(entityId, [...(noSessionByEntity.get(entityId) ?? []), resolution]);
  }

  const censoByMeeting = groupBy(data.censo, "meeting_id");
  const issues: Issue[] = [];
  const matrix: MatrixRow[] = [];
  const flowGaps: Array<{ entity_id: string; sociedad: string; missing: string[] }> = [];

  for (const condition of data.conditions.filter((row) => row.estado === "VIGENTE" && row.body_id)) {
    const body = bodyById.get(String(condition.body_id));
    const relevant = !entityFilterId || condition.entity_id === entityFilterId || body?.entity_id === entityFilterId;
    if (!relevant) continue;
    if (!body) {
      issues.push({
        severity: "BLOCKING",
        code: "CONDITION_BODY_MISSING",
        entity_id: String(condition.entity_id ?? ""),
        object_type: "condiciones_persona",
        object_id: condition.id,
        detail: `Cargo ${condition.tipo_condicion} points to missing body ${condition.body_id}.`,
        repair: "manual",
      });
    } else if (String(body.entity_id) !== String(condition.entity_id)) {
      issues.push({
        severity: "BLOCKING",
        code: "CONDITION_BODY_ENTITY_MISMATCH",
        entity_id: String(condition.entity_id ?? ""),
        object_type: "condiciones_persona",
        object_id: condition.id,
        detail: `Cargo ${condition.tipo_condicion} entity ${condition.entity_id} uses body ${body.id} from entity ${body.entity_id}.`,
        repair: "manual",
      });
    }
  }

  for (const evidence of data.authority.filter((row) => row.estado === "VIGENTE" && row.body_id)) {
    const body = bodyById.get(String(evidence.body_id));
    const relevant = !entityFilterId || evidence.entity_id === entityFilterId || body?.entity_id === entityFilterId;
    if (!relevant) continue;
    if (!body) {
      issues.push({
        severity: "BLOCKING",
        code: "AUTHORITY_BODY_MISSING",
        entity_id: String(evidence.entity_id ?? ""),
        object_type: "authority_evidence",
        object_id: evidence.id,
        detail: `Authority ${evidence.cargo} points to missing body ${evidence.body_id}.`,
        repair: "manual",
      });
    } else if (String(body.entity_id) !== String(evidence.entity_id)) {
      issues.push({
        severity: "BLOCKING",
        code: "AUTHORITY_BODY_ENTITY_MISMATCH",
        entity_id: String(evidence.entity_id ?? ""),
        object_type: "authority_evidence",
        object_id: evidence.id,
        detail: `Authority ${evidence.cargo} entity ${evidence.entity_id} uses body ${body.id} from entity ${body.entity_id}.`,
        repair: "manual",
      });
    }
  }

  for (const meeting of data.meetings) {
    const body = bodyById.get(String(meeting.body_id ?? ""));
    if (entityFilterId && body?.entity_id !== entityFilterId) continue;
    if (!body) {
      issues.push({
        severity: "BLOCKING",
        code: "MEETING_BODY_MISSING",
        object_type: "meetings",
        object_id: meeting.id,
        detail: `Meeting ${meeting.slug ?? meeting.id} has missing body ${meeting.body_id}.`,
        repair: "manual",
      });
      continue;
    }
    const snapshots = censoByMeeting.get(meeting.id) ?? [];
    if (snapshots.length === 0) {
      issues.push({
        severity: "WARNING",
        code: "MEETING_WITHOUT_CENSUS",
        entity_id: String(body.entity_id),
        object_type: "meetings",
        object_id: meeting.id,
        detail: `Meeting ${meeting.slug ?? meeting.id} has no censo_snapshot.`,
        repair: "manual",
      });
    }
    for (const snapshot of snapshots) {
      if (String(snapshot.entity_id) !== String(body.entity_id)) {
        issues.push({
          severity: "BLOCKING",
          code: "CENSUS_ENTITY_MISMATCH",
          entity_id: String(snapshot.entity_id ?? ""),
          object_type: "censo_snapshot",
          object_id: snapshot.id,
          detail: `Snapshot ${snapshot.id} entity ${snapshot.entity_id} does not match meeting body entity ${body.entity_id}.`,
          repair: "manual",
        });
      }
    }
  }

  for (const agreement of data.agreements) {
    if (entityFilterId && !isAgreementRelevantToEntity(agreement, data, entityFilterId)) continue;
    const entityId = agreement.entity_id ? String(agreement.entity_id) : null;
    const body = agreement.body_id ? bodyById.get(String(agreement.body_id)) : null;
    const parentMeeting = agreement.parent_meeting_id ? meetingById.get(String(agreement.parent_meeting_id)) : null;
    const parentBody = parentMeeting?.body_id ? bodyById.get(String(parentMeeting.body_id)) : null;
    const noSession = agreement.no_session_resolution_id
      ? data.noSession.find((row) => row.id === agreement.no_session_resolution_id)
      : null;
    const noSessionBody = noSession?.body_id ? bodyById.get(String(noSession.body_id)) : null;

    if (!agreement.entity_id || !agreement.body_id) {
      issues.push({
        severity: "BLOCKING",
        code: "AGREEMENT_MISSING_SCOPE",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `Agreement ${agreement.agreement_kind ?? agreement.id} lacks entity_id or body_id.`,
        repair: parentBody || noSessionBody || body ? "auto" : "manual",
      });
    }
    if (body && entityId && String(body.entity_id) !== entityId) {
      issues.push({
        severity: "BLOCKING",
        code: "AGREEMENT_BODY_ENTITY_MISMATCH",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `Agreement body ${body.id} belongs to entity ${body.entity_id}, not ${entityId}.`,
        repair: "manual",
      });
    }
    if (parentBody && entityId && String(parentBody.entity_id) !== entityId) {
      issues.push({
        severity: "BLOCKING",
        code: "AGREEMENT_MEETING_ENTITY_MISMATCH",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `Agreement parent meeting belongs to entity ${parentBody.entity_id}, not ${entityId}.`,
        repair: "manual",
      });
    }
    if (parentMeeting && agreement.body_id && String(parentMeeting.body_id) !== String(agreement.body_id)) {
      issues.push({
        severity: "BLOCKING",
        code: "AGREEMENT_MEETING_BODY_MISMATCH",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `Agreement body ${agreement.body_id} differs from parent meeting body ${parentMeeting.body_id}.`,
        repair: "manual",
      });
    }
    if (noSessionBody && entityId && String(noSessionBody.entity_id) !== entityId) {
      issues.push({
        severity: "BLOCKING",
        code: "AGREEMENT_NO_SESSION_ENTITY_MISMATCH",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `Agreement no-session resolution belongs to entity ${noSessionBody.entity_id}, not ${entityId}.`,
        repair: "manual",
      });
    }
    if (!hasTemplateForAgreement(agreement, activeTemplates)) {
      issues.push({
        severity: "WARNING",
        code: "AGREEMENT_WITHOUT_ACTIVE_TEMPLATE",
        entity_id: entityId,
        object_type: "agreements",
        object_id: agreement.id,
        detail: `No active template selected or found for agreement_kind ${agreement.agreement_kind ?? "unknown"}.`,
        repair: "manual",
      });
    }
  }

  for (const minute of data.minutes) {
    const meeting = minute.meeting_id ? meetingById.get(String(minute.meeting_id)) : null;
    const meetingBody = meeting?.body_id ? bodyById.get(String(meeting.body_id)) : null;
    const relevant = !entityFilterId || minute.entity_id === entityFilterId || meetingBody?.entity_id === entityFilterId;
    if (!relevant) continue;
    if (!minute.entity_id || !minute.body_id) {
      issues.push({
        severity: "BLOCKING",
        code: "MINUTE_MISSING_SCOPE",
        entity_id: String(minute.entity_id ?? ""),
        object_type: "minutes",
        object_id: minute.id,
        detail: `Minute ${minute.id} lacks entity_id or body_id.`,
        repair: meetingBody ? "auto" : "manual",
      });
    }
    if (meetingBody && minute.entity_id && String(meetingBody.entity_id) !== String(minute.entity_id)) {
      issues.push({
        severity: "BLOCKING",
        code: "MINUTE_MEETING_ENTITY_MISMATCH",
        entity_id: String(minute.entity_id),
        object_type: "minutes",
        object_id: minute.id,
        detail: `Minute entity ${minute.entity_id} differs from meeting body entity ${meetingBody.entity_id}.`,
        repair: "manual",
      });
    }
    if (meeting && minute.body_id && String(meeting.body_id) !== String(minute.body_id)) {
      issues.push({
        severity: "BLOCKING",
        code: "MINUTE_MEETING_BODY_MISMATCH",
        entity_id: String(minute.entity_id ?? ""),
        object_type: "minutes",
        object_id: minute.id,
        detail: `Minute body ${minute.body_id} differs from meeting body ${meeting.body_id}.`,
        repair: "manual",
      });
    }
  }

  for (const certification of data.certifications) {
    const agreement = certification.agreement_id ? agreementById.get(String(certification.agreement_id)) : null;
    const minute = certification.minute_id ? minuteById.get(String(certification.minute_id)) : null;
    const agreementEntity = agreement?.entity_id ? String(agreement.entity_id) : null;
    const minuteEntity = minute?.entity_id ? String(minute.entity_id) : null;
    if (entityFilterId && agreementEntity !== entityFilterId && minuteEntity !== entityFilterId) continue;
    if (agreementEntity && minuteEntity && agreementEntity !== minuteEntity) {
      issues.push({
        severity: "BLOCKING",
        code: "CERTIFICATION_ENTITY_MISMATCH",
        entity_id: minuteEntity,
        object_type: "certifications",
        object_id: certification.id,
        detail: `Certification agreement entity ${agreementEntity} differs from minute entity ${minuteEntity}.`,
        repair: "manual",
      });
    }
    if (!certification.authority_evidence_id && certification.certifier_id && certification.certificante_role) {
      const evidence = findAuthorityForCertification(certification, data);
      issues.push({
        severity: "WARNING",
        code: "CERTIFICATION_WITHOUT_AUTHORITY_LINK",
        entity_id: agreementEntity ?? minuteEntity,
        object_type: "certifications",
        object_id: certification.id,
        detail: `Certification ${certification.id} has no authority_evidence_id link.`,
        repair: evidence ? "auto" : "manual",
      });
    }
  }

  for (const entity of entityRows) {
    const entityId = String(entity.id);
    const entityBodies = bodiesByEntity.get(entityId) ?? [];
    const entityHoldings = holdingsByEntity.get(entityId) ?? [];
    const entityProfiles = profilesByEntity.get(entityId) ?? [];
    const entityConditions = conditionsByEntity.get(entityId) ?? [];
    const entityAuthority = authorityByEntity.get(entityId) ?? [];
    const entityOverrides = overridesByEntity.get(entityId) ?? [];
    const entityPactos = pactosByEntity.get(entityId) ?? [];
    const entityMeetings = meetingsByEntity.get(entityId) ?? [];
    const entityAgreements = agreementsByEntity.get(entityId) ?? [];
    const entityNoSession = noSessionByEntity.get(entityId) ?? [];
    const entityUnipersonal = unipersonalByEntity.get(entityId) ?? [];
    const cap = capTableSummary(entityHoldings);
    const activeConditions = entityConditions.filter((row) => row.estado === "VIGENTE");
    const activeAuthority = entityAuthority.filter((row) => row.estado === "VIGENTE");
    const entityIssues = issues.filter((issue) => issue.entity_id === entityId);
    const flows = inferFlows({
      entity,
      bodies: entityBodies,
      conditions: entityConditions,
      authority: entityAuthority,
      holdings: entityHoldings,
      meetings: entityMeetings,
      agreements: entityAgreements,
      noSession: entityNoSession,
      unipersonal: entityUnipersonal,
      activeTemplates,
    });

    const hasBlocking = entityIssues.some((issue) => issue.severity === "BLOCKING");
    const hasCoreGap =
      !entity.jurisdiction ||
      !entity.tipo_social ||
      entityBodies.length === 0 ||
      cap.count === 0 ||
      !cap.ok ||
      activeAuthority.length === 0;
    let estado: EntityStatus = "Completa";
    if (flows.flows.length === 0) estado = "No usable para flujo";
    if (hasCoreGap || flows.missing.length > 0 || entityIssues.some((issue) => issue.severity === "WARNING")) estado = "Parcial";
    if (hasBlocking) estado = "Rota";
    if (flows.flows.length === 0 && !hasBlocking) estado = "No usable para flujo";

    if (flows.missing.length > 0) {
      flowGaps.push({ entity_id: entityId, sociedad: nameOf(entity), missing: flows.missing });
    }

    matrix.push({
      sociedad: nameOf(entity),
      entity_id: entityId,
      tipo: entityType(entity),
      socios_accionistas: `${activeConditions.filter((row) => row.tipo_condicion === "SOCIO").length} socios / ${cap.count} holdings`,
      cap_table: entityProfiles.length === 0 ? `${cap.label} / sin perfil capital` : cap.label,
      organos: entityBodies.length === 0 ? "0" : entityBodies.map((body) => `${body.name ?? body.id}`).join("; "),
      cargos_vigentes: activeConditions.length === 0
        ? "0"
        : activeConditions.map((row) => String(row.tipo_condicion)).sort().join(", "),
      authority_evidence: activeAuthority.length === 0
        ? "0"
        : activeAuthority.map((row) => String(row.cargo)).sort().join(", "),
      rule_overrides: String(entityOverrides.length),
      pactos: entityPactos.length === 0
        ? "0"
        : entityPactos.map((pacto) => `${pacto.pacto_ref ?? pacto.id}:${pacto.estado}`).join(", "),
      flujos_habilitados: flows.flows.length === 0 ? "Ninguno" : flows.flows.join(", "),
      estado,
    });
  }

  const summary: Record<EntityStatus, number> = {
    Completa: 0,
    Parcial: 0,
    Rota: 0,
    "No usable para flujo": 0,
  };
  for (const row of matrix) summary[row.estado] += 1;

  return {
    mode,
    tenant: DEMO_TENANT,
    societies: matrix.length,
    matrix,
    issues,
    flowGaps,
    summary,
    repairs,
    sqlProbeNames: Object.keys(buildSqlProbes(entityFilterId ?? undefined)),
  };
}

function findUnequivocalAgreementPatch(
  agreement: Row,
  data: Awaited<ReturnType<typeof loadData>>,
  targetEntityId?: string | null,
) {
  const result = inferAgreementScopePatch({
    agreement,
    bodies: data.bodies as ScopeBody[],
    meetings: data.meetings as ScopeMeeting[],
    noSessionResolutions: data.noSession as ScopeNoSessionResolution[],
    targetEntityId,
  });
  return result.ok ? { patch: result.patch as Json, source: result.source } : null;
}

function findMinutePatch(minute: Row, data: Awaited<ReturnType<typeof loadData>>) {
  if (!minute.meeting_id) return null;
  const meeting = byId(data.meetings).get(String(minute.meeting_id));
  if (!meeting?.body_id) return null;
  const body = byId(data.bodies).get(String(meeting.body_id));
  if (!body?.entity_id) return null;
  if (minute.entity_id && String(minute.entity_id) !== String(body.entity_id)) return null;
  if (minute.body_id && String(minute.body_id) !== String(body.id)) return null;
  const patch: Json = {};
  if (!minute.entity_id) patch.entity_id = String(body.entity_id);
  if (!minute.body_id) patch.body_id = String(body.id);
  return Object.keys(patch).length > 0 ? patch : null;
}

function findAuthorityForCertification(certification: Row, data: Awaited<ReturnType<typeof loadData>>) {
  if (!certification.certifier_id || !certification.certificante_role || certification.authority_evidence_id) return null;
  const agreement = certification.agreement_id ? byId(data.agreements).get(String(certification.agreement_id)) : null;
  const minute = certification.minute_id ? byId(data.minutes).get(String(certification.minute_id)) : null;
  const entityId = String(agreement?.entity_id ?? minute?.entity_id ?? "");
  const bodyId = String(agreement?.body_id ?? minute?.body_id ?? "");
  if (!entityId) return null;
  const matches = data.authority.filter((row) => {
    if (row.estado !== "VIGENTE") return false;
    if (String(row.entity_id) !== entityId) return false;
    if (String(row.person_id) !== String(certification.certifier_id)) return false;
    if (String(row.cargo) !== String(certification.certificante_role)) return false;
    if (!bodyId) return row.body_id == null;
    return String(row.body_id ?? ZERO_UUID) === bodyId || row.body_id == null;
  });
  return matches.length === 1 ? matches[0] : null;
}

function stableUuid(label: string) {
  const hash = createHash("sha1").update(`arga-demo-coherence:${label}`).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const value = hash.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function textBlob(row: Row) {
  return [
    row.content,
    row.proposal_text,
    row.decision_text,
    Array.isArray(row.agreements_certified) ? row.agreements_certified.join(" ") : null,
  ].filter(Boolean).join(" ").toUpperCase();
}

function findCertificationAgreementRepair(certification: Row, data: Awaited<ReturnType<typeof loadData>>, targetEntityId: string) {
  const agreementById = byId(data.agreements);
  const minuteById = byId(data.minutes);
  const currentAgreement = certification.agreement_id ? agreementById.get(String(certification.agreement_id)) : null;
  const minute = certification.minute_id ? minuteById.get(String(certification.minute_id)) : null;
  if (!minute || minute.entity_id !== targetEntityId) return null;
  if (currentAgreement?.entity_id === targetEntityId) return null;

  const text = textBlob(certification);
  const policyRefs = Array.from(new Set(text.match(/PR-\d{3}/g) ?? []));
  const candidates = data.agreements.filter((agreement) => {
    if (agreement.entity_id !== targetEntityId) return false;
    if (minute.meeting_id && agreement.parent_meeting_id && agreement.parent_meeting_id !== minute.meeting_id) return false;
    const agreementText = textBlob(agreement);
    if (policyRefs.length > 0) return policyRefs.some((ref) => agreementText.includes(ref));
    return false;
  });

  return candidates.length === 1 ? candidates[0] : null;
}

function activeCapitalHoldingsFor(data: Awaited<ReturnType<typeof loadData>>, entityId: string) {
  return data.holdings.filter((row) => row.entity_id === entityId && row.effective_to == null);
}

function activeBodyConditionsFor(data: Awaited<ReturnType<typeof loadData>>, bodyId: string) {
  return data.conditions.filter((row) => row.body_id === bodyId && row.estado === "VIGENTE");
}

async function createMissingCensusSnapshots(
  supabase: SupabaseClient,
  data: Awaited<ReturnType<typeof loadData>>,
  entityId: string,
  dryRun = false,
) {
  const repairs: string[] = [];
  const bodyById = byId(data.bodies);
  const censoByMeeting = groupBy(data.censo, "meeting_id");

  for (const meeting of data.meetings) {
    const body = bodyById.get(String(meeting.body_id ?? ""));
    if (!body || body.entity_id !== entityId) continue;
    if ((censoByMeeting.get(meeting.id) ?? []).length > 0) continue;

    const junta = isJunta(body);
    const bodyIdForSnapshot = junta ? null : String(body.id);
    const snapshotType = junta ? "ECONOMICO" : "POLITICO";
    const sourceCount = junta
      ? activeCapitalHoldingsFor(data, entityId).length
      : activeBodyConditionsFor(data, String(body.id)).length;
    if (sourceCount === 0) {
      repairs.push(`meetings/${meeting.id}: skipped censo; no canonical ${junta ? "capital_holdings" : "condiciones_persona"} source`);
      continue;
    }
    if (dryRun) {
      repairs.push(`meetings/${meeting.id}: would create ${snapshotType} censo snapshot from ${sourceCount} canonical rows`);
      continue;
    }

    const { data: createdId, error } = await supabase.rpc("fn_crear_censo_snapshot", {
      p_meeting_id: meeting.id,
      p_session_kind: "MEETING",
      p_entity_id: entityId,
      p_body_id: bodyIdForSnapshot,
      p_snapshot_type: snapshotType,
    });
    if (error) {
      const payload = junta
        ? activeCapitalHoldingsFor(data, entityId).map((holding) => ({
            holder_person_id: holding.holder_person_id,
            porcentaje_capital: holding.porcentaje_capital,
            voting_rights: holding.voting_rights,
          }))
        : activeBodyConditionsFor(data, String(body.id)).map((condition) => ({
            person_id: condition.person_id,
            tipo_condicion: condition.tipo_condicion,
          }));
      const totalBase = junta
        ? activeCapitalHoldingsFor(data, entityId).reduce((sum, holding) => sum + Number(holding.porcentaje_capital ?? 0), 0)
        : payload.length;
      const { error: insertError } = await supabase.from("censo_snapshot").insert({
        id: stableUuid(`censo:${meeting.id}:${snapshotType}`),
        tenant_id: DEMO_TENANT,
        meeting_id: meeting.id,
        session_kind: "MEETING",
        entity_id: entityId,
        body_id: bodyIdForSnapshot,
        snapshot_type: snapshotType,
        payload,
        capital_total_base: totalBase,
        total_partes: payload.length,
      });
      if (insertError) {
        throw new Error(`censo_snapshot ${meeting.id}: rpc=${error.message}; fallback=${insertError.message}`);
      }
      repairs.push(`meetings/${meeting.id}: inserted ${snapshotType} censo snapshot by direct fallback`);
    } else {
      repairs.push(`meetings/${meeting.id}: created ${snapshotType} censo snapshot ${createdId ?? ""}`.trim());
    }
  }

  return repairs;
}

async function applySafeRepairs(supabase: SupabaseClient, entityId: string, dryRun = false) {
  const repairs: string[] = [];
  let data = await loadData(supabase);

  for (const agreement of data.agreements) {
    if (!isAgreementRelevantToEntity(agreement, data, entityId)) continue;
    const repair = findUnequivocalAgreementPatch(agreement, data, entityId);
    if (!repair) continue;
    if (dryRun) {
      repairs.push(`agreements/${agreement.id}: would backfill ${Object.keys(repair.patch).join(",")} from ${repair.source}`);
      continue;
    }
    const { error } = await supabase.from("agreements").update(repair.patch).eq("id", agreement.id);
    if (error) throw new Error(`agreements ${agreement.id}: ${error.message}`);
    repairs.push(`agreements/${agreement.id}: backfilled ${Object.keys(repair.patch).join(",")} from ${repair.source}`);
  }

  data = await loadData(supabase);
  for (const minute of data.minutes) {
    if (minute.entity_id !== entityId && bodyEntityIdForRow(minute, data) !== entityId) continue;
    const patch = findMinutePatch(minute, data);
    if (!patch) continue;
    if (dryRun) {
      repairs.push(`minutes/${minute.id}: would backfill ${Object.keys(patch).join(",")} from meeting body`);
      continue;
    }
    const { error } = await supabase.from("minutes").update(patch).eq("id", minute.id);
    if (error) throw new Error(`minutes ${minute.id}: ${error.message}`);
    repairs.push(`minutes/${minute.id}: backfilled ${Object.keys(patch).join(",")} from meeting body`);
  }

  data = await loadData(supabase);
  for (const certification of data.certifications) {
    const agreement = findCertificationAgreementRepair(certification, data, entityId);
    if (!agreement) continue;
    if (dryRun) {
      repairs.push(`certifications/${certification.id}: would relink agreement_id to ${agreement.id}`);
      continue;
    }
    const { error } = await supabase
      .from("certifications")
      .update({ agreement_id: agreement.id })
      .eq("id", certification.id);
    if (error) throw new Error(`certifications ${certification.id}: ${error.message}`);
    repairs.push(`certifications/${certification.id}: relinked agreement_id to ${agreement.id}`);
  }

  data = await loadData(supabase);
  for (const certification of data.certifications) {
    const agreement = certification.agreement_id ? byId(data.agreements).get(String(certification.agreement_id)) : null;
    const minute = certification.minute_id ? byId(data.minutes).get(String(certification.minute_id)) : null;
    if (agreement?.entity_id !== entityId && minute?.entity_id !== entityId) continue;
    const evidence = findAuthorityForCertification(certification, data);
    if (!evidence) continue;
    if (dryRun) {
      repairs.push(`certifications/${certification.id}: would link authority_evidence ${evidence.id}`);
      continue;
    }
    const { error } = await supabase
      .from("certifications")
      .update({ authority_evidence_id: evidence.id })
      .eq("id", certification.id);
    if (error) throw new Error(`certifications ${certification.id}: ${error.message}`);
    repairs.push(`certifications/${certification.id}: linked authority_evidence ${evidence.id}`);
  }

  data = await loadData(supabase);
  repairs.push(...await createMissingCensusSnapshots(supabase, data, entityId, dryRun));

  return repairs;
}

async function safeRepairsForAllEntities(supabase: SupabaseClient, entityIds: string[], dryRun: boolean) {
  const repairs: string[] = [];
  for (const entityId of entityIds) {
    const entityRepairs = await applySafeRepairs(supabase, entityId, dryRun);
    repairs.push(...entityRepairs.map((repair) => `entity/${entityId}: ${repair}`));
  }
  return repairs;
}

function printReport(report: Report) {
  const compact = (value: string, max = 90) => value.length > max ? `${value.slice(0, max - 1)}...` : value;

  console.log(`Mode: ${report.mode}`);
  console.log(`Tenant: ${report.tenant}`);
  console.log(`Societies: ${report.societies}`);
  console.log(
    `Summary: Completa=${report.summary.Completa}, Parcial=${report.summary.Parcial}, Rota=${report.summary.Rota}, No usable=${report.summary["No usable para flujo"]}`,
  );
  if (report.repairs?.length) {
    console.log("");
    console.log("Repairs applied:");
    for (const repair of report.repairs) console.log(`- ${repair}`);
  }
  console.log("");
  console.table(report.matrix.map((row) => ({
    Sociedad: row.sociedad,
    Tipo: row.tipo,
    Socios: row.socios_accionistas,
    "Cap table": row.cap_table,
    Organos: compact(row.organos),
    Authority: compact(row.authority_evidence),
    Flujos: compact(row.flujos_habilitados, 120),
    Estado: row.estado,
  })));
  const blocking = report.issues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = report.issues.filter((issue) => issue.severity === "WARNING");
  console.log("");
  console.log(`Issues: ${blocking.length} blocking, ${warnings.length} warnings`);
  for (const issue of [...blocking, ...warnings].slice(0, 80)) {
    const entity = issue.entity_id ? ` entity=${issue.entity_id}` : "";
    const object = issue.object_type ? ` ${issue.object_type}/${issue.object_id}` : "";
    const repair = issue.repair ? ` repair=${issue.repair}` : "";
    console.log(`- [${issue.severity}] ${issue.code}${entity}${object}${repair}: ${issue.detail}`);
  }
  if (blocking.length + warnings.length > 80) {
    console.log(`- ... ${blocking.length + warnings.length - 80} more issues omitted. Use --json for full output.`);
  }
  if (report.flowGaps.length > 0) {
    console.log("");
    console.log("Flow gaps:");
    for (const gap of report.flowGaps) {
      console.log(`- ${gap.sociedad}: ${gap.missing.join("; ")}`);
    }
  }
  console.log("");
  console.log(`SQL probes available with --sql: ${report.sqlProbeNames.join(", ")}`);
}

async function main() {
  const supabase = client();
  const initialData = await loadData(supabase);
  const entityFilter = resolveEntityFilter(initialData, entityArg);

  if (apply && applySafeAll) {
    throw new Error("Use either --apply with --entity, or --all --apply-safe, not both.");
  }
  if (applySafeAll && !all) {
    throw new Error("--apply-safe requires --all.");
  }
  if (all && entityFilter) {
    throw new Error("--all cannot be combined with --entity.");
  }
  if (apply && !entityFilter) {
    throw new Error("--apply requires --entity. Global repair is intentionally disabled.");
  }

  if (printSql) {
    const probes = buildSqlProbes(entityFilter?.id ? String(entityFilter.id) : undefined);
    if (entityFilter) {
      console.log(`-- entity: ${nameOf(entityFilter)} (${entityFilter.id})`);
      console.log("");
    }
    for (const [name, sql] of Object.entries(probes)) {
      console.log(`-- ${name}`);
      console.log(sql);
      console.log("");
    }
    return;
  }

  const entityIds = initialData.entities.filter((entity) => entity.person_id).map((entity) => String(entity.id));
  const repairs = apply
    ? await applySafeRepairs(supabase, String(entityFilter!.id))
    : applySafeAll
      ? await safeRepairsForAllEntities(supabase, entityIds, false)
      : plan
        ? all
          ? await safeRepairsForAllEntities(supabase, entityIds, true)
          : entityFilter
            ? await applySafeRepairs(supabase, String(entityFilter.id), true)
            : []
        : [];
  const data = await loadData(supabase);
  const report = buildReport(
    data,
    apply || applySafeAll ? "apply" : plan ? "plan" : "report",
    repairs,
    entityFilter?.id ? String(entityFilter.id) : null,
  );
  if (json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);

  const broken = report.summary.Rota > 0 || report.issues.some((issue) => issue.severity === "BLOCKING");
  if (failOnBroken && broken) process.exit(1);
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
