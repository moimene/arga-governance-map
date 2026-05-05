#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const ENV_FILE = "docs/superpowers/plans/.env";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || (!args.has("--apply") && !args.has("--verify"));
const apply = args.has("--apply");
const verifyOnly = args.has("--verify");

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

function uuid(label: string) {
  const hash = createHash("sha1").update(`arga-secretaria-demo-seed:${label}`).digest("hex").slice(0, 32).split("");
  hash[12] = "5";
  hash[16] = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  const value = hash.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function nowIso() {
  return "2026-05-05T12:00:00.000Z";
}

function today() {
  return "2026-05-05";
}

const ENTITIES = {
  ARGA_SEG: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
  CARTERA_SLU: "00000000-0000-0000-0000-000000000020",
  FUNDACION: "7b9dd701-1ed1-4911-88ba-e186a86083bc",
  REASEGUROS: "04d0a477-3b0d-41af-b5e4-9a46195da272",
  SERVICIOS: uuid("entity:arga-servicios-corporativos-sl"),
  TEC_JURIDICA: uuid("entity:arga-tecnologia-juridica-sl"),
};

const PERSONS = {
  FUNDACION_PJ: "b507cd1c-4444-4d1e-8ad5-fe0b62577317",
  CARTERA_SLU_PJ: "b50fad18-ca71-41bb-a940-45d43f4fcdb7",
  CARTERA_SA_PJ: "17aa1e03-769b-49ad-9296-d41a8f3cbc51",
  ARGA_SEG_PJ: uuid("person:arga-seguros-sa"),
  SERVICIOS_PJ: uuid("person:arga-servicios-corporativos-sl"),
  TEC_JURIDICA_PJ: uuid("person:arga-tecnologia-juridica-sl"),
  REASEGUROS_PJ: uuid("person:arga-reaseguros-sa"),
  FREE_FLOAT: "10000000-0000-0000-0000-000000000004",
  PRESIDENTE_ARGA: "12ab13c3-0a0e-4ab6-a17a-902a3eaeddf8",
  SECRETARIA_ARGA: "f8b64324-a19d-4050-98c2-8e34cff52087",
  ANA_CRESPO: uuid("person:ana-crespo"),
  JAVIER_NOVOA: uuid("person:javier-novoa"),
  MARTA_LEON: uuid("person:marta-leon"),
  DANIEL_PRADO: uuid("person:daniel-prado"),
  SOFIA_IBARRA: uuid("person:sofia-ibarra"),
  RE_SECRETARIA: uuid("person:laura-saiz"),
  RE_PRESIDENTE: uuid("person:ricardo-arias"),
  SERV_SOCIO_A: uuid("person:servicios-socio-a"),
  SERV_SOCIO_B: uuid("person:servicios-socio-b"),
  SERV_ADMIN_1: uuid("person:servicios-admin-1"),
  SERV_ADMIN_2: uuid("person:servicios-admin-2"),
  TEC_SOCIO_A: uuid("person:tech-socio-a"),
  TEC_SOCIO_B: uuid("person:tech-socio-b"),
  TEC_ADMIN_1: uuid("person:tech-admin-1"),
  TEC_ADMIN_2: uuid("person:tech-admin-2"),
};

const BODIES = {
  ARGA_SEG_CDA: "fe05ddd9-ce3e-47b0-8948-5b975c79ab59",
  ARGA_SEG_JUNTA: uuid("body:arga-seguros-junta-general"),
  CARTERA_SOCIO_UNICO: uuid("body:cartera-slu-socio-unico"),
  CARTERA_ADMIN_UNICO: uuid("body:cartera-slu-admin-unico"),
  SERV_JUNTA: uuid("body:servicios-junta-general"),
  SERV_ADMIN_SOLIDARIOS: uuid("body:servicios-admin-solidarios"),
  SERV_ADMIN_CONJUNTA: uuid("body:servicios-admin-conjunta"),
  TEC_JUNTA: uuid("body:tech-junta-general"),
  TEC_ADMIN_CONJUNTA: uuid("body:tech-admin-conjunta"),
  RE_JUNTA: uuid("body:reaseguros-junta-general"),
  RE_CDA: uuid("body:reaseguros-consejo"),
};

const SHARE_CLASSES = {
  ARGA_SEG_ORD: "e6fdfbbc-adfc-4b4d-90a1-2c2fb7221897",
  CARTERA_ORD: "3b13b08f-84bb-4036-9563-2da4f8034340",
  SERV_ORD: uuid("share-class:servicios:ord"),
  TECH_ORD: uuid("share-class:tech:ord"),
  RE_ORD: "172e3925-6c03-4492-beb7-ecdd578a4dfd",
};

const CODES = {
  ARGA_SEG_JGA: "ARGA_SEG_JGA_2026",
  ARGA_SEG_CDA: "ARGA_SEG_CDA_VINCULADA_2026",
  CARTERA_SOCIO_UNICO: "ARGA_CARTERA_SOCIO_UNICO_2026",
  SERV_NO_SESSION: "ARGA_SERV_NO_SESSION_2026_01",
  SERV_CO_APROBACION: "ARGA_SERV_CO_APROBACION_2026_01",
  SERV_SOLIDARIO: "ARGA_SERV_SOLIDARIO_2026_01",
  TECH_TRANSFER: "ARGA_TECH_TRANSFER_2026_01",
  RE_JGA: "ARGA_RE_JGA_2026",
};

function profile(entityId: string, overrides: Json = {}) {
  const base: Json = {
    schema_version: "entity-normative-profile.seed.v1",
    tenant_id: DEMO_TENANT,
    entity_id: entityId,
    jurisdiction: "ES",
    sources: ["LEY", "ESTATUTOS", "PACTO_PARASOCIAL", "REGLAMENTO", "POLITICA", "SISTEMA"],
    qtsp: "EAD Trust",
    registry_boundary: "prepared_for_registry_demo_no_real_filing",
    evidence_scope: "demo_operativa_no_final_productiva",
    as_of: today(),
  };
  return { ...base, ...overrides };
}

function complianceSnapshot(entityId: string, materia: string, adoptionMode: string, overrides: Json = {}) {
  const normative_profile = profile(entityId, overrides.normative_profile as Json | undefined);
  const normative_snapshot_id = uuid(`normative-snapshot:${entityId}:${materia}:${adoptionMode}`);
  return {
    schema_version: "agreement-compliance-snapshot.seed.v1",
    normative_profile,
    normative_snapshot_id,
    rule_pack: {
      materia,
      adoption_mode: adoptionMode,
      status: "PASS",
      source: "seed_demo_snapshot",
    },
    disclaimers: {
      registry: "PROMOTED/FILED significa preparado para registro; no presentado.",
      evidence: "Evidencia de apoyo demo/operativa; no evidencia final productiva.",
      qtsp: "EAD Trust",
    },
    ...overrides,
  };
}

function executionMode(kind: string, code: string, templateId?: string | null, extra: Json = {}) {
  const constrainedTipo = kind === "MEETING" ? "SESION" : ["CO_APROBACION", "SOLIDARIO"].includes(kind) ? kind : null;
  return {
    ...(constrainedTipo ? { tipo: constrainedTipo } : {}),
    mode: kind,
    seed_code: code,
    selected_template_id: templateId ?? null,
    agreement_360: {
      version: "agreement-360.v1",
      origin: "SECRETARIA_DEMO_SEED",
      seed_code: code,
      selected_template_id: templateId ?? null,
      normative_snapshot_id: uuid(`agreement-360-snapshot:${code}`),
      materialized: true,
      materialized_at: nowIso(),
    },
    ...extra,
  };
}

function personRows(): Row[] {
  return [
    { id: PERSONS.ARGA_SEG_PJ, tenant_id: DEMO_TENANT, full_name: "ARGA Seguros S.A.", denomination: "ARGA Seguros S.A.", tax_id: "A-00001001", person_type: "PJ", representative_person_id: PERSONS.PRESIDENTE_ARGA, email: null },
    { id: PERSONS.SERVICIOS_PJ, tenant_id: DEMO_TENANT, full_name: "ARGA Servicios Corporativos S.L.", denomination: "ARGA Servicios Corporativos S.L.", tax_id: "B-00001002", person_type: "PJ", representative_person_id: PERSONS.SERV_ADMIN_1, email: null },
    { id: PERSONS.TEC_JURIDICA_PJ, tenant_id: DEMO_TENANT, full_name: "ARGA Tecnologia Juridica S.L.", denomination: "ARGA Tecnologia Juridica S.L.", tax_id: "B-00001003", person_type: "PJ", representative_person_id: PERSONS.TEC_ADMIN_1, email: null },
    { id: PERSONS.REASEGUROS_PJ, tenant_id: DEMO_TENANT, full_name: "ARGA Reaseguros S.A.", denomination: "ARGA Reaseguros S.A.", tax_id: "A-00001004", person_type: "PJ", representative_person_id: PERSONS.RE_PRESIDENTE, email: null },
    { id: PERSONS.FREE_FLOAT, tenant_id: DEMO_TENANT, full_name: "Mercado libre (free float agregado)", denomination: "Mercado libre", tax_id: "FREE-FLOAT-ARGA", person_type: "PJ", representative_person_id: null, email: null },
    { id: PERSONS.ANA_CRESPO, tenant_id: DEMO_TENANT, full_name: "Dna. Ana Crespo Vidal", tax_id: "00000011A", email: "ana.crespo@arga-seguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.JAVIER_NOVOA, tenant_id: DEMO_TENANT, full_name: "D. Javier Novoa Beltran", tax_id: "00000012B", email: "javier.novoa@arga-seguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.MARTA_LEON, tenant_id: DEMO_TENANT, full_name: "Dna. Marta Leon Salgado", tax_id: "00000013C", email: "marta.leon@arga-seguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.DANIEL_PRADO, tenant_id: DEMO_TENANT, full_name: "D. Daniel Prado Estevez", tax_id: "00000014D", email: "daniel.prado@arga-seguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.SOFIA_IBARRA, tenant_id: DEMO_TENANT, full_name: "Dna. Sofia Ibarra Gil", tax_id: "00000015E", email: "sofia.ibarra@arga-seguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.RE_SECRETARIA, tenant_id: DEMO_TENANT, full_name: "Dna. Laura Saiz Ferrer", tax_id: "00000016F", email: "laura.saiz@arga-reaseguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.RE_PRESIDENTE, tenant_id: DEMO_TENANT, full_name: "D. Ricardo Arias Moreno", tax_id: "00000017G", email: "ricardo.arias@arga-reaseguros.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.SERV_SOCIO_A, tenant_id: DEMO_TENANT, full_name: "D. Ignacio Rivas Cano", tax_id: "00000018H", email: "ignacio.rivas@arga-servicios.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.SERV_SOCIO_B, tenant_id: DEMO_TENANT, full_name: "Dna. Clara Mendez Soto", tax_id: "00000019J", email: "clara.mendez@arga-servicios.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.SERV_ADMIN_1, tenant_id: DEMO_TENANT, full_name: "D. Tomas Vidal Martin", tax_id: "00000020K", email: "tomas.vidal@arga-servicios.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.SERV_ADMIN_2, tenant_id: DEMO_TENANT, full_name: "Dna. Nuria Calvo Reina", tax_id: "00000021L", email: "nuria.calvo@arga-servicios.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.TEC_SOCIO_A, tenant_id: DEMO_TENANT, full_name: "D. Alvaro Molina Pardo", tax_id: "00000022M", email: "alvaro.molina@arga-tech.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.TEC_SOCIO_B, tenant_id: DEMO_TENANT, full_name: "Dna. Beatriz Otero Sanz", tax_id: "00000023N", email: "beatriz.otero@arga-tech.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.TEC_ADMIN_1, tenant_id: DEMO_TENANT, full_name: "D. Sergio Navas Perez", tax_id: "00000024P", email: "sergio.navas@arga-tech.com", person_type: "PF", denomination: null, representative_person_id: null },
    { id: PERSONS.TEC_ADMIN_2, tenant_id: DEMO_TENANT, full_name: "Dna. Elena Pastor Roca", tax_id: "00000025Q", email: "elena.pastor@arga-tech.com", person_type: "PF", denomination: null, representative_person_id: null },
  ];
}

function entityRows(): Row[] {
  return [
    {
      id: ENTITIES.SERVICIOS,
      tenant_id: DEMO_TENANT,
      slug: "arga-servicios-corporativos",
      legal_name: "ARGA Servicios Corporativos S.L.",
      common_name: "ARGA Servicios Corporativos",
      jurisdiction: "ES",
      legal_form: "S.L.",
      tipo_social: "SL",
      es_cotizada: false,
      es_unipersonal: false,
      forma_administracion: "ADMINISTRADORES_SOLIDARIOS",
      tipo_organo_admin: "ADMIN_SOLIDARIOS",
      parent_entity_id: ENTITIES.ARGA_SEG,
      ownership_percentage: 60,
      entity_status: "Active",
      materiality: "High",
      person_id: PERSONS.SERVICIOS_PJ,
    },
    {
      id: ENTITIES.TEC_JURIDICA,
      tenant_id: DEMO_TENANT,
      slug: "arga-tecnologia-juridica",
      legal_name: "ARGA Tecnologia Juridica S.L.",
      common_name: "ARGA Tecnologia Juridica",
      jurisdiction: "ES",
      legal_form: "S.L.",
      tipo_social: "SL",
      es_cotizada: false,
      es_unipersonal: false,
      forma_administracion: "ADMINISTRADORES_MANCOMUNADOS",
      tipo_organo_admin: "ADMIN_MANCOMUNADOS",
      parent_entity_id: ENTITIES.SERVICIOS,
      ownership_percentage: 70,
      entity_status: "Active",
      materiality: "High",
      person_id: PERSONS.TEC_JURIDICA_PJ,
    },
    {
      id: ENTITIES.CARTERA_SLU,
      tenant_id: DEMO_TENANT,
      slug: "cartera-arga-slu",
      legal_name: "Cartera ARGA S.L.U.",
      common_name: "Cartera ARGA",
      jurisdiction: "ES",
      legal_form: "SLU",
      tipo_social: "SLU",
      es_cotizada: false,
      es_unipersonal: true,
      forma_administracion: "ADMINISTRADOR_UNICO",
      tipo_organo_admin: "ADMIN_UNICO",
      entity_status: "Active",
      person_id: PERSONS.CARTERA_SLU_PJ,
    },
    {
      id: ENTITIES.ARGA_SEG,
      tenant_id: DEMO_TENANT,
      slug: "arga-seguros",
      legal_name: "ARGA Seguros, S.A.",
      common_name: "ARGA Seguros",
      jurisdiction: "ES",
      legal_form: "S.A.",
      tipo_social: "SA",
      es_cotizada: true,
      es_unipersonal: false,
      forma_administracion: "CONSEJO",
      tipo_organo_admin: "CDA",
      entity_status: "Active",
      person_id: PERSONS.ARGA_SEG_PJ,
    },
    {
      id: ENTITIES.REASEGUROS,
      tenant_id: DEMO_TENANT,
      slug: "arga-reaseguros",
      legal_name: "ARGA Reaseguros, S.A.",
      common_name: "ARGA RE",
      jurisdiction: "ES",
      legal_form: "S.A.",
      tipo_social: "SA",
      es_cotizada: false,
      es_unipersonal: false,
      forma_administracion: "CONSEJO",
      tipo_organo_admin: "CDA",
      entity_status: "Active",
      person_id: PERSONS.REASEGUROS_PJ,
    },
  ];
}

function bodyRows(): Row[] {
  return [
    { id: BODIES.ARGA_SEG_JUNTA, slug: "junta-general-arga-seguros", tenant_id: DEMO_TENANT, entity_id: ENTITIES.ARGA_SEG, name: "Junta General de Accionistas", body_type: "JUNTA", quorum_rule: { primera_convocatoria_pct: 25, segunda_convocatoria_pct: 0, cotizada: true }, config: { organo_tipo: "JUNTA_GENERAL", voto_distancia: true, canal_publicidad: ["BORME", "CNMV", "WEB_SOCIEDAD"] }, legal_hold: false },
    { id: BODIES.CARTERA_SOCIO_UNICO, slug: "socio-unico-cartera-arga-slu", tenant_id: DEMO_TENANT, entity_id: ENTITIES.CARTERA_SLU, name: "Socio unico", body_type: "JUNTA", quorum_rule: { unipersonal: true }, config: { organo_tipo: "SOCIO_UNICO", adoption_mode: "UNIPERSONAL_SOCIO" }, legal_hold: false },
    { id: BODIES.CARTERA_ADMIN_UNICO, slug: "admin-unico-cartera-arga-slu", tenant_id: DEMO_TENANT, entity_id: ENTITIES.CARTERA_SLU, name: "Administrador unico", body_type: "CDA", quorum_rule: { unipersonal_admin: true }, config: { organo_tipo: "ADMIN_UNICO", adoption_mode: "UNIPERSONAL_ADMIN" }, legal_hold: false },
    { id: BODIES.SERV_JUNTA, slug: "junta-general-arga-servicios", tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, name: "Junta General de Socios", body_type: "JUNTA", quorum_rule: { primera_convocatoria_pct: 50, segunda_convocatoria_pct: 0 }, config: { organo_tipo: "JUNTA_GENERAL", tipo_social: "SL" }, legal_hold: false },
    { id: BODIES.SERV_ADMIN_SOLIDARIOS, slug: "admin-solidarios-arga-servicios", tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, name: "Administradores solidarios", body_type: "CDA", quorum_rule: { accion_individual: true }, config: { organo_tipo: "ADMIN_SOLIDARIOS", adoption_mode: "SOLIDARIO" }, legal_hold: false },
    { id: BODIES.SERV_ADMIN_CONJUNTA, slug: "admin-conjunta-arga-servicios", tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, name: "Administradores mancomunados", body_type: "CDA", quorum_rule: { firmas_requeridas: 2, total_administradores: 2 }, config: { organo_tipo: "ADMIN_CONJUNTA", adoption_mode: "CO_APROBACION" }, legal_hold: false },
    { id: BODIES.TEC_JUNTA, slug: "junta-general-arga-tecnologia", tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, name: "Junta General de Socios", body_type: "JUNTA", quorum_rule: { primera_convocatoria_pct: 50, segunda_convocatoria_pct: 0 }, config: { organo_tipo: "JUNTA_GENERAL", tipo_social: "SL" }, legal_hold: false },
    { id: BODIES.TEC_ADMIN_CONJUNTA, slug: "admin-conjunta-arga-tecnologia", tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, name: "Administradores mancomunados", body_type: "CDA", quorum_rule: { firmas_requeridas: 2, total_administradores: 2 }, config: { organo_tipo: "ADMIN_CONJUNTA", adoption_mode: "CO_APROBACION" }, legal_hold: false },
    { id: BODIES.RE_JUNTA, slug: "junta-general-arga-reaseguros", tenant_id: DEMO_TENANT, entity_id: ENTITIES.REASEGUROS, name: "Junta General de Accionistas", body_type: "JUNTA", quorum_rule: { primera_convocatoria_pct: 25, segunda_convocatoria_pct: 0, cotizada: false }, config: { organo_tipo: "JUNTA_GENERAL" }, legal_hold: false },
    { id: BODIES.RE_CDA, slug: "consejo-arga-reaseguros", tenant_id: DEMO_TENANT, entity_id: ENTITIES.REASEGUROS, name: "Consejo de Administracion", body_type: "CDA", quorum_rule: { quorum_asistencia: 0.5, mayoria_simple: 0.5, voto_calidad_presidente: true }, config: { organo_tipo: "CONSEJO_ADMIN", voto_calidad_presidente: true }, legal_hold: false },
  ];
}

function conditionRows(): Row[] {
  const rows: Row[] = [];
  const add = (label: string, person_id: string, entity_id: string, body_id: string | null, tipo_condicion: string, metadata: Json = {}) => {
    rows.push({
      id: uuid(`condicion:${label}`),
      tenant_id: DEMO_TENANT,
      person_id,
      entity_id,
      body_id,
      tipo_condicion,
      estado: "VIGENTE",
      fecha_inicio: "2025-01-01",
      fecha_fin: "2029-12-31",
      representative_person_id: null,
      metadata,
      fuente_designacion: "BOOTSTRAP",
      inscripcion_rm_referencia: "RM-DEMO-ARGA-2026",
      inscripcion_rm_fecha: "2026-01-15",
    });
  };

  add("cartera-socio-unico", PERSONS.FUNDACION_PJ, ENTITIES.CARTERA_SLU, null, "SOCIO");
  add("cartera-admin-unico", PERSONS.ANA_CRESPO, ENTITIES.CARTERA_SLU, null, "ADMIN_UNICO");
  add("cartera-admin-body-presidente", PERSONS.ANA_CRESPO, ENTITIES.CARTERA_SLU, BODIES.CARTERA_ADMIN_UNICO, "PRESIDENTE");
  add("cartera-admin-body-secretario", PERSONS.ANA_CRESPO, ENTITIES.CARTERA_SLU, BODIES.CARTERA_ADMIN_UNICO, "SECRETARIO");
  add("serv-presidente-junta", PERSONS.SERV_SOCIO_A, ENTITIES.SERVICIOS, BODIES.SERV_JUNTA, "PRESIDENTE");
  add("serv-secretario-junta", PERSONS.SERV_ADMIN_2, ENTITIES.SERVICIOS, BODIES.SERV_JUNTA, "SECRETARIO");
  add("serv-admin-solidario-1", PERSONS.SERV_ADMIN_1, ENTITIES.SERVICIOS, null, "ADMIN_SOLIDARIO");
  add("serv-admin-solidario-2", PERSONS.SERV_ADMIN_2, ENTITIES.SERVICIOS, null, "ADMIN_SOLIDARIO");
  add("serv-admin-solidarios-presidente", PERSONS.SERV_ADMIN_1, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_SOLIDARIOS, "PRESIDENTE");
  add("serv-admin-solidarios-secretario", PERSONS.SERV_ADMIN_2, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_SOLIDARIOS, "SECRETARIO");
  add("serv-admin-conjunta-1", PERSONS.SERV_ADMIN_1, ENTITIES.SERVICIOS, null, "ADMIN_MANCOMUNADO");
  add("serv-admin-conjunta-2", PERSONS.SERV_ADMIN_2, ENTITIES.SERVICIOS, null, "ADMIN_MANCOMUNADO");
  add("serv-admin-conjunta-presidente", PERSONS.SERV_ADMIN_1, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_CONJUNTA, "PRESIDENTE");
  add("serv-admin-conjunta-secretario", PERSONS.SERV_ADMIN_2, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_CONJUNTA, "SECRETARIO");
  add("tech-presidente-junta", PERSONS.TEC_SOCIO_A, ENTITIES.TEC_JURIDICA, BODIES.TEC_JUNTA, "PRESIDENTE");
  add("tech-secretario-junta", PERSONS.TEC_ADMIN_2, ENTITIES.TEC_JURIDICA, BODIES.TEC_JUNTA, "SECRETARIO");
  add("tech-admin-conjunta-1", PERSONS.TEC_ADMIN_1, ENTITIES.TEC_JURIDICA, null, "ADMIN_MANCOMUNADO");
  add("tech-admin-conjunta-2", PERSONS.TEC_ADMIN_2, ENTITIES.TEC_JURIDICA, null, "ADMIN_MANCOMUNADO");
  add("tech-admin-conjunta-presidente", PERSONS.TEC_ADMIN_1, ENTITIES.TEC_JURIDICA, BODIES.TEC_ADMIN_CONJUNTA, "PRESIDENTE");
  add("tech-admin-conjunta-secretario", PERSONS.TEC_ADMIN_2, ENTITIES.TEC_JURIDICA, BODIES.TEC_ADMIN_CONJUNTA, "SECRETARIO");
  add("re-presidente-cda", PERSONS.RE_PRESIDENTE, ENTITIES.REASEGUROS, BODIES.RE_CDA, "PRESIDENTE");
  add("re-secretario-cda", PERSONS.RE_SECRETARIA, ENTITIES.REASEGUROS, BODIES.RE_CDA, "SECRETARIO");
  add("re-consejero-1", PERSONS.JAVIER_NOVOA, ENTITIES.REASEGUROS, BODIES.RE_CDA, "CONSEJERO");
  add("re-presidente-junta", PERSONS.RE_PRESIDENTE, ENTITIES.REASEGUROS, BODIES.RE_JUNTA, "PRESIDENTE");
  add("re-secretario-junta", PERSONS.RE_SECRETARIA, ENTITIES.REASEGUROS, BODIES.RE_JUNTA, "SECRETARIO");

  return rows;
}

function shareClassRows(): Row[] {
  return [
    { id: SHARE_CLASSES.CARTERA_ORD, tenant_id: DEMO_TENANT, entity_id: ENTITIES.CARTERA_SLU, class_code: "ORD", name: "Participaciones ordinarias", votes_per_title: 1, economic_rights_coeff: 1, voting_rights: true, veto_rights: false },
    { id: SHARE_CLASSES.SERV_ORD, tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, class_code: "ORD", name: "Participaciones ordinarias", votes_per_title: 1, economic_rights_coeff: 1, voting_rights: true, veto_rights: false },
    { id: SHARE_CLASSES.TECH_ORD, tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, class_code: "ORD", name: "Participaciones ordinarias", votes_per_title: 1, economic_rights_coeff: 1, voting_rights: true, veto_rights: false },
    { id: SHARE_CLASSES.RE_ORD, tenant_id: DEMO_TENANT, entity_id: ENTITIES.REASEGUROS, class_code: "ORD", name: "Acciones ordinarias", votes_per_title: 1, economic_rights_coeff: 1, voting_rights: true, veto_rights: false },
  ];
}

function capitalHoldingRows(): Row[] {
  return [
    { id: "c6e93837-b6b5-49e4-9355-34a20de073c3", tenant_id: DEMO_TENANT, entity_id: ENTITIES.CARTERA_SLU, holder_person_id: PERSONS.FUNDACION_PJ, share_class_id: SHARE_CLASSES.CARTERA_ORD, numero_titulos: 3000, porcentaje_capital: 100, voting_rights: true, is_treasury: false, effective_from: "2025-01-01", effective_to: null, metadata: { seed_code: CODES.CARTERA_SOCIO_UNICO } },
    { id: uuid("holding:servicios:cartera:60"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, holder_person_id: PERSONS.CARTERA_SLU_PJ, share_class_id: SHARE_CLASSES.SERV_ORD, numero_titulos: 6000, porcentaje_capital: 60, voting_rights: true, is_treasury: false, effective_from: "2026-01-01", effective_to: null, metadata: { seed_code: CODES.SERV_NO_SESSION } },
    { id: uuid("holding:servicios:socio-a:20"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, holder_person_id: PERSONS.SERV_SOCIO_A, share_class_id: SHARE_CLASSES.SERV_ORD, numero_titulos: 2000, porcentaje_capital: 20, voting_rights: true, is_treasury: false, effective_from: "2026-01-01", effective_to: null, metadata: { seed_code: CODES.SERV_NO_SESSION } },
    { id: uuid("holding:servicios:socio-b:20"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.SERVICIOS, holder_person_id: PERSONS.SERV_SOCIO_B, share_class_id: SHARE_CLASSES.SERV_ORD, numero_titulos: 2000, porcentaje_capital: 20, voting_rights: true, is_treasury: false, effective_from: "2026-01-01", effective_to: null, metadata: { seed_code: CODES.SERV_NO_SESSION } },
    { id: uuid("holding:tech:servicios:70"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, holder_person_id: PERSONS.ARGA_SEG_PJ, share_class_id: SHARE_CLASSES.TECH_ORD, numero_titulos: 7000, porcentaje_capital: 70, voting_rights: true, is_treasury: false, effective_from: "2026-05-01", effective_to: null, metadata: { seed_code: CODES.TECH_TRANSFER, note: "Post-transfer 10 pct moved to socio B" } },
    { id: uuid("holding:tech:socio-a:20"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, holder_person_id: PERSONS.TEC_SOCIO_A, share_class_id: SHARE_CLASSES.TECH_ORD, numero_titulos: 2000, porcentaje_capital: 20, voting_rights: true, is_treasury: false, effective_from: "2026-05-01", effective_to: null, metadata: { seed_code: CODES.TECH_TRANSFER, transfer_from_pct: 30, transfer_to_pct: 20 } },
    { id: uuid("holding:tech:socio-b:10"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, holder_person_id: PERSONS.TEC_SOCIO_B, share_class_id: SHARE_CLASSES.TECH_ORD, numero_titulos: 1000, porcentaje_capital: 10, voting_rights: true, is_treasury: false, effective_from: "2026-05-01", effective_to: null, metadata: { seed_code: CODES.TECH_TRANSFER, acquired_pct: 10 } },
    { id: uuid("holding:reaseguros:arga-seg:100"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.REASEGUROS, holder_person_id: PERSONS.ARGA_SEG_PJ, share_class_id: SHARE_CLASSES.RE_ORD, numero_titulos: 20000000, porcentaje_capital: 100, voting_rights: true, is_treasury: false, effective_from: "2025-01-01", effective_to: null, metadata: { seed_code: CODES.RE_JGA } },
  ];
}

function capitalMovementRows(): Row[] {
  return [
    { id: uuid("capital-movement:tech:socio-a:-10"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, agreement_id: uuid("agreement:tech-transfer"), person_id: PERSONS.TEC_SOCIO_A, share_class_id: SHARE_CLASSES.TECH_ORD, delta_shares: -1000, delta_voting_weight: -10, delta_denominator_weight: 0, movement_type: "TRANSMISION", effective_date: "2026-05-01", notas: "ARGA_TECH_TRANSFER_2026_01: transmision demo de 10 pct de participaciones de socio A a socio B." },
    { id: uuid("capital-movement:tech:socio-b:+10"), tenant_id: DEMO_TENANT, entity_id: ENTITIES.TEC_JURIDICA, agreement_id: uuid("agreement:tech-transfer"), person_id: PERSONS.TEC_SOCIO_B, share_class_id: SHARE_CLASSES.TECH_ORD, delta_shares: 1000, delta_voting_weight: 10, delta_denominator_weight: 0, movement_type: "TRANSMISION", effective_date: "2026-05-01", notas: "ARGA_TECH_TRANSFER_2026_01: adquisicion demo vinculada a soporte documental." },
  ];
}

function bookRows(): Row[] {
  const books: Array<[string, string, string, number, string, string]> = [
    [ENTITIES.ARGA_SEG, "LIBRO_ACTAS", "ARGA_SEG", 2026, "OPEN", "PENDIENTE"],
    [ENTITIES.ARGA_SEG, "LIBRO_ACCIONES_NOMINATIVAS", "ARGA_SEG", 2026, "OPEN", "LEGALIZADO"],
    [ENTITIES.CARTERA_SLU, "LIBRO_CONTRATOS_SOCIO_UNICO", "CARTERA", 2026, "OPEN", "PENDIENTE"],
    [ENTITIES.SERVICIOS, "LIBRO_REGISTRO_SOCIOS", "SERV", 2026, "OPEN", "PENDIENTE"],
    [ENTITIES.TEC_JURIDICA, "LIBRO_REGISTRO_SOCIOS", "TECH", 2026, "OPEN", "PENDIENTE"],
    [ENTITIES.REASEGUROS, "LIBRO_ACTAS", "RE", 2026, "OPEN", "PENDIENTE"],
  ];
  return books.map(([entity_id, book_kind, label, period, status, legalization_status]) => ({
    id: uuid(`book:${label}:${book_kind}:${period}`),
    tenant_id: DEMO_TENANT,
    entity_id,
    book_kind,
    volume_number: 1,
    period,
    status,
    opened_at: "2026-01-01",
    closed_at: null,
    legalization_deadline: "2027-04-30",
    legalization_status,
    legalization_evidence_url: legalization_status === "LEGALIZADO" ? `evidence://ead-trust/${label}/${book_kind}/2026` : null,
  }));
}

function convocatoriaRows(): Row[] {
  return [
    {
      id: uuid("convocatoria:arga-seg:cda-golden-path-2026"),
      tenant_id: DEMO_TENANT,
      body_id: BODIES.ARGA_SEG_CDA,
      estado: "EMITIDA",
      fecha_emision: "2026-05-05",
      fecha_1: "2026-06-18",
      fecha_2: null,
      is_second_call: false,
      modalidad: "PRESENCIAL",
      junta_universal: false,
      urgente: false,
      publication_channels: ["PORTAL_CONSEJEROS", "ERDS"],
      publication_evidence_url: "evidence://ead-trust/ARGA_SEG_CDA_GOLDEN_2026/convocatoria",
      statutory_basis: "LSC art. 247; Estatutos y Reglamento del Consejo ARGA.",
      tipo_convocatoria: "CONSEJO_ADMINISTRACION",
      agenda_items: [
        { order: 1, title: "Aprobacion de cuentas anuales y propuesta de acuerdo", materia: "APROBACION_CUENTAS" },
      ],
      lugar: "Sala Consejo",
      convocatoria_text: "Convocatoria demo-operativa de Consejo de Administracion ARGA Seguros para golden path. Evidencia de apoyo demo/operativa; no constituye evidencia final productiva.",
      rule_trace: { seed_code: "ARGA_SEG_CDA_GOLDEN_2026", qtsp: "EAD Trust" },
      reminders_trace: { canal_convocatoria: "Portal consejeros + ERDS EAD Trust" },
      accepted_warnings: [],
    },
    {
      id: uuid("convocatoria:arga-seg:jga-2026"),
      tenant_id: DEMO_TENANT,
      body_id: BODIES.ARGA_SEG_JUNTA,
      estado: "EMITIDA",
      fecha_emision: "2026-04-20",
      fecha_1: "2026-05-30",
      fecha_2: "2026-05-31",
      is_second_call: false,
      modalidad: "MIXTA",
      junta_universal: false,
      urgente: false,
      publication_channels: ["BORME", "CNMV", "WEB_SOCIEDAD"],
      publication_evidence_url: "evidence://ead-trust/ARGA_SEG_JGA_2026/convocatoria",
      statutory_basis: "LSC arts. 176, 197, 517; Estatutos y Reglamento de Junta ARGA.",
      tipo_convocatoria: "JUNTA_GENERAL_ORDINARIA",
      agenda_items: [
        { order: 1, title: "Aprobacion de cuentas anuales 2025", materia: "APROBACION_CUENTAS" },
        { order: 2, title: "Aplicacion del resultado y distribucion de dividendo", materia: "DISTRIBUCION_DIVIDENDOS" },
        { order: 3, title: "Nombramiento de auditor de cuentas", materia: "NOMBRAMIENTO_AUDITOR" },
        { order: 4, title: "Politica de remuneraciones de consejeros", materia: "POLITICA_REMUNERACION" },
      ],
      lugar: "Sede social y asistencia telematica",
      convocatoria_text: "Convocatoria demo-operativa de Junta General Ordinaria ARGA 2026. Evidencia de apoyo demo/operativa; no constituye evidencia final productiva.",
      rule_trace: { seed_code: CODES.ARGA_SEG_JGA, qtsp: "EAD Trust" },
      reminders_trace: { derecho_informacion: "documentacion disponible desde convocatoria hasta celebracion" },
      accepted_warnings: [],
    },
    {
      id: uuid("convocatoria:reaseguros:jga-2026"),
      tenant_id: DEMO_TENANT,
      body_id: BODIES.RE_JUNTA,
      estado: "EMITIDA",
      fecha_emision: "2026-04-24",
      fecha_1: "2026-05-28",
      fecha_2: "2026-05-29",
      is_second_call: false,
      modalidad: "PRESENCIAL",
      junta_universal: false,
      urgente: false,
      publication_channels: ["BORME", "WEB_SOCIEDAD"],
      publication_evidence_url: "evidence://ead-trust/ARGA_RE_JGA_2026/convocatoria",
      statutory_basis: "LSC arts. 176, 197; Estatutos ARGA Reaseguros.",
      tipo_convocatoria: "JUNTA_GENERAL_ORDINARIA",
      agenda_items: [
        { order: 1, title: "Nombramiento de auditor", materia: "NOMBRAMIENTO_AUDITOR" },
        { order: 2, title: "Reduccion de capital por dotacion de reserva", materia: "REDUCCION_CAPITAL" },
      ],
      lugar: "Domicilio social",
      convocatoria_text: "Convocatoria demo-operativa de Junta General Ordinaria ARGA Reaseguros 2026.",
      rule_trace: { seed_code: CODES.RE_JGA, qtsp: "EAD Trust" },
      reminders_trace: {},
      accepted_warnings: [],
    },
  ];
}

function meetingRows(): Row[] {
  return [
    { id: uuid("meeting:arga-seg:jga-2026"), slug: "arga-seg-jga-2026", tenant_id: DEMO_TENANT, body_id: BODIES.ARGA_SEG_JUNTA, meeting_type: "JUNTA_GENERAL", scheduled_start: "2026-05-30T10:00:00.000Z", scheduled_end: "2026-05-30T13:00:00.000Z", status: "CELEBRADA", president_id: PERSONS.PRESIDENTE_ARGA, secretary_id: PERSONS.SECRETARIA_ARGA, quorum_data: { seed_code: CODES.ARGA_SEG_JGA, convocatoria_id: uuid("convocatoria:arga-seg:jga-2026"), quorum: { capital_concurrente_pct: 72.4, calculo_capital_ref: "capital_holdings vigentes + representacion" }, cotizada: true }, location: "Sede social y canal telematico", confidentiality_level: "NORMAL", legal_hold: false },
    { id: uuid("meeting:arga-seg:cda-vinculada-2026"), slug: "arga-seg-cda-vinculada-2026", tenant_id: DEMO_TENANT, body_id: BODIES.ARGA_SEG_CDA, meeting_type: "CONSEJO_ADMIN", scheduled_start: "2026-05-18T09:00:00.000Z", scheduled_end: "2026-05-18T11:00:00.000Z", status: "CELEBRADA", president_id: PERSONS.PRESIDENTE_ARGA, secretary_id: PERSONS.SECRETARIA_ARGA, quorum_data: { seed_code: CODES.ARGA_SEG_CDA, quorum: { presentes: 5, representados: 1, ausentes: 1 }, conflicto: "Operacion vinculada con proveedor intragrupo" }, location: "Sala Consejo", confidentiality_level: "CONFIDENTIAL", legal_hold: false },
    { id: uuid("meeting:tech:junta-transfer-2026"), slug: "arga-tech-junta-transfer-2026", tenant_id: DEMO_TENANT, body_id: BODIES.TEC_JUNTA, meeting_type: "JUNTA_GENERAL", scheduled_start: "2026-05-20T10:00:00.000Z", scheduled_end: "2026-05-20T11:30:00.000Z", status: "CELEBRADA", president_id: PERSONS.TEC_SOCIO_A, secretary_id: PERSONS.TEC_ADMIN_2, quorum_data: { seed_code: CODES.TECH_TRANSFER, quorum: { capital_concurrente_pct: 100 }, libro_registro_ref: "mandatory_books:LIBRO_REGISTRO_SOCIOS" }, location: "Domicilio social", confidentiality_level: "NORMAL", legal_hold: false },
    { id: uuid("meeting:reaseguros:jga-2026"), slug: "arga-re-jga-2026", tenant_id: DEMO_TENANT, body_id: BODIES.RE_JUNTA, meeting_type: "JUNTA_GENERAL", scheduled_start: "2026-05-28T10:00:00.000Z", scheduled_end: "2026-05-28T12:00:00.000Z", status: "CELEBRADA", president_id: PERSONS.RE_PRESIDENTE, secretary_id: PERSONS.RE_SECRETARIA, quorum_data: { seed_code: CODES.RE_JGA, convocatoria_id: uuid("convocatoria:reaseguros:jga-2026"), quorum: { capital_concurrente_pct: 100 } }, location: "Domicilio social", confidentiality_level: "NORMAL", legal_hold: false },
  ];
}

function agendaRows(): Row[] {
  const items: Array<[string, string, number, string, string]> = [
    [uuid("meeting:arga-seg:jga-2026"), CODES.ARGA_SEG_JGA, 1, "Aprobacion de cuentas anuales 2025", "APROBACION_CUENTAS"],
    [uuid("meeting:arga-seg:jga-2026"), CODES.ARGA_SEG_JGA, 2, "Aplicacion del resultado y distribucion de dividendo", "DISTRIBUCION_DIVIDENDOS"],
    [uuid("meeting:arga-seg:jga-2026"), CODES.ARGA_SEG_JGA, 3, "Nombramiento de auditor de cuentas", "NOMBRAMIENTO_AUDITOR"],
    [uuid("meeting:arga-seg:jga-2026"), CODES.ARGA_SEG_JGA, 4, "Politica de remuneraciones de consejeros", "POLITICA_REMUNERACION"],
    [uuid("meeting:arga-seg:cda-vinculada-2026"), CODES.ARGA_SEG_CDA, 1, "Operacion vinculada con proveedor intragrupo", "OPERACION_VINCULADA"],
    [uuid("meeting:arga-seg:cda-vinculada-2026"), CODES.ARGA_SEG_CDA, 2, "Delegacion de facultades ejecutivas", "DELEGACION_FACULTADES"],
    [uuid("meeting:tech:junta-transfer-2026"), CODES.TECH_TRANSFER, 1, "Toma de razon de transmision de participaciones", "TRANSMISION_PARTICIPACIONES"],
    [uuid("meeting:reaseguros:jga-2026"), CODES.RE_JGA, 1, "Nombramiento de auditor", "NOMBRAMIENTO_AUDITOR"],
    [uuid("meeting:reaseguros:jga-2026"), CODES.RE_JGA, 2, "Reduccion de capital con proteccion de acreedores", "REDUCCION_CAPITAL"],
  ];
  return items.map(([meeting_id, code, order_number, title, materia]) => ({
    id: uuid(`agenda:${code}:${order_number}`),
    tenant_id: DEMO_TENANT,
    meeting_id,
    order_number,
    title,
    description: `${code}: ${materia}`,
  }));
}

function attendeeRows(): Row[] {
  const rows: Row[] = [];
  const add = (
    meeting: string,
    person: string,
    type: string,
    capitalPct: number,
    representedBy: string | null = null,
    titles = Math.round(capitalPct * 100_000),
  ) => {
    rows.push({
      id: uuid(`attendee:${meeting}:${person}`),
      tenant_id: DEMO_TENANT,
      meeting_id: uuid(meeting),
      person_id: person,
      attendance_type: type,
      represented_by_id: representedBy,
      shares_represented: titles,
      voting_rights: titles,
      capital_representado: capitalPct,
      via_representante: Boolean(representedBy),
    });
  };
  add("meeting:arga-seg:jga-2026", PERSONS.CARTERA_SLU_PJ, "PRESENTE", 69.69);
  add("meeting:arga-seg:jga-2026", PERSONS.FREE_FLOAT, "REPRESENTADO", 2.71, PERSONS.SECRETARIA_ARGA);
  add("meeting:arga-seg:cda-vinculada-2026", PERSONS.PRESIDENTE_ARGA, "PRESENTE", 1);
  add("meeting:arga-seg:cda-vinculada-2026", PERSONS.SECRETARIA_ARGA, "PRESENTE", 1);
  add("meeting:arga-seg:cda-vinculada-2026", PERSONS.ANA_CRESPO, "PRESENTE", 1);
  add("meeting:arga-seg:cda-vinculada-2026", PERSONS.JAVIER_NOVOA, "PRESENTE", 1);
  add("meeting:arga-seg:cda-vinculada-2026", PERSONS.MARTA_LEON, "REPRESENTADO", 1, PERSONS.PRESIDENTE_ARGA);
  add("meeting:tech:junta-transfer-2026", PERSONS.ARGA_SEG_PJ, "PRESENTE", 70);
  add("meeting:tech:junta-transfer-2026", PERSONS.TEC_SOCIO_A, "PRESENTE", 20);
  add("meeting:tech:junta-transfer-2026", PERSONS.TEC_SOCIO_B, "PRESENTE", 10);
  add("meeting:reaseguros:jga-2026", PERSONS.ARGA_SEG_PJ, "PRESENTE", 100);
  return rows;
}

function agreementRows(templateIds: Record<string, string | null>): Row[] {
  const rows: Row[] = [];
  const persistedAdoptionMode = (mode: string) => (["CO_APROBACION", "SOLIDARIO"].includes(mode) ? "NO_SESSION" : mode);
  const majorityCodeFor = (agreementKind: string, matterClass: string) => {
    if (["AUMENTO_CAPITAL", "REDUCCION_CAPITAL", "MODIFICACION_ESTATUTOS", "FUSION_ESCISION"].includes(agreementKind)) {
      return "REFORZADA_2_3";
    }
    if (matterClass === "ESTRUCTURAL" || matterClass === "ESTATUTARIA") return "REFORZADA_2_3";
    return "SIMPLE";
  };
  const add = (label: string, code: string, entity_id: string, body_id: string | null, agreement_kind: string, matter_class: string, adoption_mode: string, status: string, decision_text: string, extra: Json = {}) => {
    const templateId = templateIds[agreement_kind] ?? null;
    rows.push({
      id: uuid(`agreement:${label}`),
      tenant_id: DEMO_TENANT,
      entity_id,
      body_id,
      code,
      agreement_kind,
      matter_class,
      inscribable: ["AUMENTO_CAPITAL", "REDUCCION_CAPITAL", "NOMBRAMIENTO_AUDITOR", "TRANSMISION_PARTICIPACIONES"].includes(agreement_kind),
      adoption_mode: persistedAdoptionMode(adoption_mode),
      required_quorum_code: adoption_mode === "MEETING" ? "LSC_STANDARD" : null,
      required_majority_code: majorityCodeFor(agreement_kind, matter_class),
      proposal_text: decision_text,
      decision_text,
      decision_date: today(),
      effective_date: today(),
      status,
      statutory_basis: "Seed societario demo ARGA; preparado para registro si aplica, sin envio real al Registro Mercantil.",
      compliance_snapshot: complianceSnapshot(entity_id, agreement_kind, adoption_mode, extra),
      compliance_explain: { normative_snapshot: complianceSnapshot(entity_id, agreement_kind, adoption_mode, extra), seed_code: code },
      execution_mode: executionMode(adoption_mode, code, templateId, extra.execution_mode as Json | undefined),
      parent_meeting_id: extra.parent_meeting_id ?? null,
      unipersonal_decision_id: extra.unipersonal_decision_id ?? null,
      no_session_resolution_id: extra.no_session_resolution_id ?? null,
      document_url: extra.document_url ?? null,
      legal_hold: false,
    });
  };

  add("arga-seg-cuentas", CODES.ARGA_SEG_JGA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_JUNTA, "APROBACION_CUENTAS", "ORDINARIA", "MEETING", "CERTIFIED", "Se aprueban las cuentas anuales 2025 y la gestion social.", { parent_meeting_id: uuid("meeting:arga-seg:jga-2026") });
  add("arga-seg-dividendo", CODES.ARGA_SEG_JGA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_JUNTA, "DISTRIBUCION_DIVIDENDOS", "ORDINARIA", "MEETING", "CERTIFIED", "Se aprueba la distribucion de dividendo con cargo a resultado distribuible.", { parent_meeting_id: uuid("meeting:arga-seg:jga-2026") });
  add("arga-seg-auditor", CODES.ARGA_SEG_JGA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_JUNTA, "NOMBRAMIENTO_AUDITOR", "ORDINARIA", "MEETING", "CERTIFIED", "Se nombra auditor de cuentas para el periodo legal aplicable.", { parent_meeting_id: uuid("meeting:arga-seg:jga-2026") });
  add("arga-seg-remuneracion", CODES.ARGA_SEG_JGA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_JUNTA, "POLITICA_REMUNERACION", "ORDINARIA", "MEETING", "ADOPTED", "Se aprueba la politica de remuneraciones de consejeros para el periodo 2026-2028.", { parent_meeting_id: uuid("meeting:arga-seg:jga-2026") });
  add("arga-seg-operacion-vinculada", CODES.ARGA_SEG_CDA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_CDA, "OPERACION_VINCULADA", "ORDINARIA", "MEETING", "ADOPTED", "Se aprueba operacion vinculada con abstencion del consejero afectado y soporte de mercado independiente.", { parent_meeting_id: uuid("meeting:arga-seg:cda-vinculada-2026"), normative_profile: { conflict: "intra_group_related_party", abstention_required: true } });
  add("arga-seg-delegacion", CODES.ARGA_SEG_CDA, ENTITIES.ARGA_SEG, BODIES.ARGA_SEG_CDA, "DELEGACION_FACULTADES", "ORDINARIA", "MEETING", "CERTIFIED", "Se delegan facultades ejecutivas con exclusion de facultades indelegables.", { parent_meeting_id: uuid("meeting:arga-seg:cda-vinculada-2026") });
  add("cartera-aumento", CODES.CARTERA_SOCIO_UNICO, ENTITIES.CARTERA_SLU, BODIES.CARTERA_SOCIO_UNICO, "AUMENTO_CAPITAL", "ESTRUCTURAL", "UNIPERSONAL_SOCIO", "FILED", "El socio unico decide aumentar el capital social con desembolso integro.", { unipersonal_decision_id: uuid("unipersonal:cartera:aumento") });
  add("serv-no-session", CODES.SERV_NO_SESSION, ENTITIES.SERVICIOS, BODIES.SERV_JUNTA, "APROBACION_CUENTAS", "ORDINARIA", "NO_SESSION", "CERTIFIED", "Acuerdo escrito sin sesion aprobado por unanimidad de socios.", { no_session_resolution_id: uuid("no-session-resolution:servicios:cuentas") });
  add("serv-co-aprobacion", CODES.SERV_CO_APROBACION, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_CONJUNTA, "APROBACION_PLAN_NEGOCIO", "ORDINARIA", "CO_APROBACION", "ADOPTED", "Los administradores mancomunados aprueban conjuntamente el plan de integracion operativa.", { execution_mode: { config: { k: 2, n: 2, firmas: [PERSONS.SERV_ADMIN_1, PERSONS.SERV_ADMIN_2] } } });
  add("serv-solidario", CODES.SERV_SOLIDARIO, ENTITIES.SERVICIOS, BODIES.SERV_ADMIN_SOLIDARIOS, "DELEGACION_FACULTADES", "ORDINARIA", "SOLIDARIO", "ADOPTED", "Un administrador solidario adopta decision individual dentro de sus facultades vigentes.", { execution_mode: { config: { adminActuante: PERSONS.SERV_ADMIN_1 } } });
  add("tech-transfer", CODES.TECH_TRANSFER, ENTITIES.TEC_JURIDICA, BODIES.TEC_JUNTA, "TRANSMISION_PARTICIPACIONES", "ORDINARIA", "MEETING", "ADOPTED", "Se toma razon de la transmision de 10 pct de participaciones y se actualiza el libro registro de socios.", { parent_meeting_id: uuid("meeting:tech:junta-transfer-2026") });
  add("re-auditor", CODES.RE_JGA, ENTITIES.REASEGUROS, BODIES.RE_JUNTA, "NOMBRAMIENTO_AUDITOR", "ORDINARIA", "MEETING", "CERTIFIED", "Se nombra auditor de cuentas por plazo dentro del rango legal.", { parent_meeting_id: uuid("meeting:reaseguros:jga-2026") });
  add("re-reduccion", CODES.RE_JGA, ENTITIES.REASEGUROS, BODIES.RE_JUNTA, "REDUCCION_CAPITAL", "ESTRUCTURAL", "MEETING", "ADOPTED", "Se aprueba reduccion de capital con gate de oposicion de acreedores documentado.", { parent_meeting_id: uuid("meeting:reaseguros:jga-2026"), normative_profile: { creditor_opposition_gate: true } });

  return rows;
}

function resolutionRows(): Row[] {
  const byPoint: Array<[string, string, number, string, string, string, string]> = [
    ["arga-seg-cuentas", "meeting:arga-seg:jga-2026", 1, "Aprobacion de cuentas anuales 2025", "APROBACION_CUENTAS", "SIMPLE", "ADOPTED"],
    ["arga-seg-dividendo", "meeting:arga-seg:jga-2026", 2, "Aplicacion del resultado y distribucion de dividendo", "DISTRIBUCION_DIVIDENDOS", "SIMPLE", "ADOPTED"],
    ["arga-seg-auditor", "meeting:arga-seg:jga-2026", 3, "Nombramiento de auditor de cuentas", "NOMBRAMIENTO_AUDITOR", "SIMPLE", "ADOPTED"],
    ["arga-seg-remuneracion", "meeting:arga-seg:jga-2026", 4, "Politica de remuneraciones de consejeros", "POLITICA_REMUNERACION", "SIMPLE", "ADOPTED"],
    ["arga-seg-operacion-vinculada", "meeting:arga-seg:cda-vinculada-2026", 1, "Operacion vinculada con proveedor intragrupo", "OPERACION_VINCULADA", "SIMPLE", "ADOPTED"],
    ["arga-seg-delegacion", "meeting:arga-seg:cda-vinculada-2026", 2, "Delegacion de facultades ejecutivas", "DELEGACION_FACULTADES", "REFORZADA_2_3", "ADOPTED"],
    ["tech-transfer", "meeting:tech:junta-transfer-2026", 1, "Toma de razon de transmision de participaciones", "TRANSMISION_PARTICIPACIONES", "SIMPLE", "ADOPTED"],
    ["re-auditor", "meeting:reaseguros:jga-2026", 1, "Nombramiento de auditor", "NOMBRAMIENTO_AUDITOR", "SIMPLE", "ADOPTED"],
    ["re-reduccion", "meeting:reaseguros:jga-2026", 2, "Reduccion de capital", "REDUCCION_CAPITAL", "REFORZADA_2_3", "ADOPTED"],
  ];
  return byPoint.map(([agreementLabel, meetingLabel, agenda_item_index, resolution_text, resolution_type, required_majority_code, status]) => ({
    id: uuid(`resolution:${meetingLabel}:${agenda_item_index}`),
    tenant_id: DEMO_TENANT,
    meeting_id: uuid(meetingLabel),
    agenda_item_index,
    resolution_text,
    resolution_type,
    required_majority_code,
    status,
    agreement_id: uuid(`agreement:${agreementLabel}`),
  }));
}

function voteRows(): Row[] {
  const rows: Row[] = [];
  const add = (resolutionLabel: string, attendeeLabel: string, vote_value: string, conflict = false, reason: string | null = null) => {
    rows.push({
      id: uuid(`vote:${resolutionLabel}:${attendeeLabel}`),
      tenant_id: DEMO_TENANT,
      resolution_id: uuid(resolutionLabel),
      attendee_id: uuid(attendeeLabel),
      vote_value,
      conflict_flag: conflict,
      reason,
    });
  };
  for (const point of [1, 2, 3, 4]) {
    add(`resolution:meeting:arga-seg:jga-2026:${point}`, `attendee:meeting:arga-seg:jga-2026:${PERSONS.CARTERA_SLU_PJ}`, "FOR");
    add(`resolution:meeting:arga-seg:jga-2026:${point}`, `attendee:meeting:arga-seg:jga-2026:${PERSONS.FREE_FLOAT}`, point === 4 ? "ABSTAIN" : "FOR");
  }
  add(`resolution:meeting:arga-seg:cda-vinculada-2026:1`, `attendee:meeting:arga-seg:cda-vinculada-2026:${PERSONS.PRESIDENTE_ARGA}`, "FOR");
  add(`resolution:meeting:arga-seg:cda-vinculada-2026:1`, `attendee:meeting:arga-seg:cda-vinculada-2026:${PERSONS.SECRETARIA_ARGA}`, "ABSTAIN", true, "Conflicto documentado por operacion vinculada intragrupo.");
  add(`resolution:meeting:arga-seg:cda-vinculada-2026:1`, `attendee:meeting:arga-seg:cda-vinculada-2026:${PERSONS.ANA_CRESPO}`, "FOR");
  add(`resolution:meeting:arga-seg:cda-vinculada-2026:1`, `attendee:meeting:arga-seg:cda-vinculada-2026:${PERSONS.JAVIER_NOVOA}`, "FOR");
  add(`resolution:meeting:arga-seg:cda-vinculada-2026:1`, `attendee:meeting:arga-seg:cda-vinculada-2026:${PERSONS.MARTA_LEON}`, "AGAINST");
  add(`resolution:meeting:tech:junta-transfer-2026:1`, `attendee:meeting:tech:junta-transfer-2026:${PERSONS.ARGA_SEG_PJ}`, "FOR");
  add(`resolution:meeting:tech:junta-transfer-2026:1`, `attendee:meeting:tech:junta-transfer-2026:${PERSONS.TEC_SOCIO_A}`, "ABSTAIN", true, "Transmitente afectado por la operacion.");
  add(`resolution:meeting:tech:junta-transfer-2026:1`, `attendee:meeting:tech:junta-transfer-2026:${PERSONS.TEC_SOCIO_B}`, "FOR");
  add(`resolution:meeting:reaseguros:jga-2026:1`, `attendee:meeting:reaseguros:jga-2026:${PERSONS.ARGA_SEG_PJ}`, "FOR");
  add(`resolution:meeting:reaseguros:jga-2026:2`, `attendee:meeting:reaseguros:jga-2026:${PERSONS.ARGA_SEG_PJ}`, "FOR");
  return rows;
}

function unipersonalRows(): Row[] {
  return [
    {
      id: uuid("unipersonal:cartera:aumento"),
      tenant_id: DEMO_TENANT,
      entity_id: ENTITIES.CARTERA_SLU,
      decision_type: "AUMENTO_CAPITAL",
      title: "Decision de socio unico: aumento de capital",
      content: "Fundacion ARGA, como socio unico, decide aumentar el capital social de Cartera ARGA S.L.U. Evidencia demo/operativa.",
      decision_date: today(),
      decided_by_id: PERSONS.FUNDACION_PJ,
      status: "FIRMADA",
      requires_registry: true,
    },
  ];
}

function noSessionRows(templateIds: Record<string, string | null>) {
  return {
    resolutions: [
      {
        id: uuid("no-session-resolution:servicios:cuentas"),
        tenant_id: DEMO_TENANT,
        body_id: BODIES.SERV_JUNTA,
        title: "Aprobacion escrita de cuentas abreviadas 2025",
        status: "APROBADO",
        proposal_text: "Aprobacion por escrito y sin sesion de cuentas abreviadas 2025 de ARGA Servicios Corporativos S.L.",
        voting_deadline: "2026-05-12T23:59:59.000Z",
        votes_for: 3,
        votes_against: 0,
        abstentions: 0,
        requires_unanimity: true,
        opened_at: "2026-05-05T09:00:00.000Z",
        closed_at: "2026-05-06T18:00:00.000Z",
        matter_class: "ORDINARIA",
        agreement_kind: "APROBACION_CUENTAS",
        total_members: 3,
        selected_template_id: templateIds.ACUERDO_SIN_SESION,
      },
    ],
    expedientes: [
      {
        id: uuid("no-session-expediente:servicios:cuentas"),
        tenant_id: DEMO_TENANT,
        agreement_id: uuid("agreement:serv-no-session"),
        entity_id: ENTITIES.SERVICIOS,
        body_id: BODIES.SERV_JUNTA,
        tipo_proceso: "UNANIMIDAD_ESCRITA_SL",
        propuesta_texto: "Aprobacion por escrito de cuentas abreviadas 2025.",
        propuesta_documentos: [{ name: "cuentas_abreviadas_2025.pdf", hash: "sha256-demo-cuentas-servicios" }],
        propuesta_fecha: "2026-05-05",
        propuesta_firmada_por: PERSONS.SERV_ADMIN_1,
        ventana_inicio: "2026-05-05",
        ventana_fin: "2026-05-12",
        ventana_dias_habiles: 5,
        ventana_fuente: "ESTATUTOS",
        estado: "PROCLAMADO",
        condicion_adopcion: "UNANIMIDAD_CAPITAL",
        fecha_cierre: "2026-05-06",
        motivo_cierre: "Unanimidad alcanzada antes del vencimiento.",
        rule_pack_id: "APROBACION_CUENTAS",
        rule_pack_version: "1.0.0",
        snapshot_hash: "sha256-demo-no-session-servicios",
        no_session_resolution_id: uuid("no-session-resolution:servicios:cuentas"),
        selected_template_id: templateIds.ACUERDO_SIN_SESION,
      },
    ],
    notificaciones: [PERSONS.CARTERA_SLU_PJ, PERSONS.SERV_SOCIO_A, PERSONS.SERV_SOCIO_B].map((personId) => ({
      id: uuid(`no-session-notificacion:servicios:cuentas:${personId}`),
      tenant_id: DEMO_TENANT,
      expediente_id: uuid("no-session-expediente:servicios:cuentas"),
      person_id: personId,
      canal: "NOTIFICACION_CERTIFICADA",
      enviada_at: "2026-05-05T09:15:00.000Z",
      entregada_at: "2026-05-05T10:00:00.000Z",
      evidencia_ref: `EADTrust-ERDS-${personId.slice(0, 8)}`,
      evidencia_hash: `sha256-erds-${personId.slice(0, 8)}`,
      estado: "ENTREGADA",
      erds_evidence_id: uuid(`erds-evidence:servicios:cuentas:${personId}`),
      erds_delivery_ref: `ERDS-${CODES.SERV_NO_SESSION}-${personId.slice(0, 8)}`,
      erds_evidence_hash: `sha256-erds-${CODES.SERV_NO_SESSION}-${personId.slice(0, 8)}`,
      erds_tsq_token: `TSQ-EADTrust-${personId.slice(0, 8)}`,
      erds_delivered_at: "2026-05-05T10:00:00.000Z",
      erds_status: "COMPLETED",
      erds_error_message: null,
    })),
    respuestas: [
      [PERSONS.CARTERA_SLU_PJ, 60],
      [PERSONS.SERV_SOCIO_A, 20],
      [PERSONS.SERV_SOCIO_B, 20],
    ].map(([personId, pct]) => ({
      id: uuid(`no-session-respuesta:servicios:cuentas:${personId}`),
      tenant_id: DEMO_TENANT,
      expediente_id: uuid("no-session-expediente:servicios:cuentas"),
      person_id: personId,
      capital_participacion: pct,
      porcentaje_capital: pct,
      es_consejero: false,
      sentido: "CONSENTIMIENTO",
      texto_respuesta: "Consentimiento emitido por medio autentico demo.",
      fecha_respuesta: "2026-05-06T12:00:00.000Z",
      firma_qes_ref: `EADTrust-QES-${String(personId).slice(0, 8)}`,
      firma_qes_timestamp: "2026-05-06T12:00:00.000Z",
      ocsp_status: "GOOD",
      notificacion_certificada_ref: `ERDS-${CODES.SERV_NO_SESSION}-${String(personId).slice(0, 8)}`,
    })),
  };
}

function minuteRows(): Row[] {
  return [
    { id: uuid("minute:arga-seg:jga-2026"), tenant_id: DEMO_TENANT, meeting_id: uuid("meeting:arga-seg:jga-2026"), content: "Acta demo-operativa de Junta General Ordinaria ARGA Seguros 2026 con proclamaciones por punto y trazabilidad agreements.id. No constituye acta registral productiva.", signed_at: "2026-05-30T13:30:00.000Z", signed_by_secretary_id: PERSONS.SECRETARIA_ARGA, signed_by_president_id: PERSONS.PRESIDENTE_ARGA, registered_at: "2026-05-30T14:00:00.000Z", is_locked: true, body_id: BODIES.ARGA_SEG_JUNTA, entity_id: ENTITIES.ARGA_SEG, content_hash: "sha256-demo-acta-arga-seg-jga-2026", rules_applied: { seed_code: CODES.ARGA_SEG_JGA, qtsp: "EAD Trust" } },
    { id: uuid("minute:arga-seg:cda-vinculada-2026"), tenant_id: DEMO_TENANT, meeting_id: uuid("meeting:arga-seg:cda-vinculada-2026"), content: "Acta demo-operativa de Consejo ARGA Seguros con operacion vinculada, abstencion y delegacion de facultades.", signed_at: "2026-05-18T11:30:00.000Z", signed_by_secretary_id: PERSONS.SECRETARIA_ARGA, signed_by_president_id: PERSONS.PRESIDENTE_ARGA, registered_at: "2026-05-18T12:00:00.000Z", is_locked: true, body_id: BODIES.ARGA_SEG_CDA, entity_id: ENTITIES.ARGA_SEG, content_hash: "sha256-demo-acta-arga-seg-cda-2026", rules_applied: { seed_code: CODES.ARGA_SEG_CDA, qtsp: "EAD Trust" } },
    { id: uuid("minute:reaseguros:jga-2026"), tenant_id: DEMO_TENANT, meeting_id: uuid("meeting:reaseguros:jga-2026"), content: "Acta demo-operativa de Junta General ARGA Reaseguros 2026.", signed_at: "2026-05-28T12:30:00.000Z", signed_by_secretary_id: PERSONS.RE_SECRETARIA, signed_by_president_id: PERSONS.RE_PRESIDENTE, registered_at: "2026-05-28T13:00:00.000Z", is_locked: true, body_id: BODIES.RE_JUNTA, entity_id: ENTITIES.REASEGUROS, content_hash: "sha256-demo-acta-reaseguros-jga-2026", rules_applied: { seed_code: CODES.RE_JGA, qtsp: "EAD Trust" } },
  ];
}

function certificationRows(): Row[] {
  return [
    { id: uuid("cert:arga-seg:jga-2026:cuentas"), tenant_id: DEMO_TENANT, minute_id: uuid("minute:arga-seg:jga-2026"), content: "Certificacion demo-operativa del acuerdo de aprobacion de cuentas. Preparada para registro; no presentada.", agreements_certified: [uuid("agreement:arga-seg-cuentas")], certifier_id: PERSONS.SECRETARIA_ARGA, requires_qualified_signature: true, signature_status: "SIGNED", jurisdictional_requirements: { rrm: "108-109", qtsp: "EAD Trust" }, agreement_id: uuid("agreement:arga-seg-cuentas"), gate_hash: "sha256-demo-cert-cuentas", hash_certificacion: "sha256-demo-cert-cuentas", certificante_role: "SECRETARIO", tipo_certificacion: "ACUERDO", visto_bueno_persona_id: PERSONS.PRESIDENTE_ARGA, visto_bueno_fecha: today() },
    { id: uuid("cert:serv:no-session:cuentas"), tenant_id: DEMO_TENANT, minute_id: null, content: "Certificacion demo-operativa de acuerdo escrito sin sesion tras cierre efectivo.", agreements_certified: [uuid("agreement:serv-no-session")], certifier_id: PERSONS.SERV_ADMIN_2, requires_qualified_signature: true, signature_status: "SIGNED", jurisdictional_requirements: { rrm: "108-109", qtsp: "EAD Trust", no_session: true }, agreement_id: uuid("agreement:serv-no-session"), gate_hash: "sha256-demo-cert-serv-no-session", hash_certificacion: "sha256-demo-cert-serv-no-session", certificante_role: "SECRETARIO", tipo_certificacion: "NO_SESSION", visto_bueno_persona_id: PERSONS.SERV_ADMIN_1, visto_bueno_fecha: today() },
    { id: uuid("cert:cartera:aumento"), tenant_id: DEMO_TENANT, minute_id: null, content: "Certificacion demo-operativa de decision de socio unico sobre aumento de capital.", agreements_certified: [uuid("agreement:cartera-aumento")], certifier_id: PERSONS.ANA_CRESPO, requires_qualified_signature: true, signature_status: "SIGNED", jurisdictional_requirements: { rrm: "decisiones socio unico", qtsp: "EAD Trust" }, agreement_id: uuid("agreement:cartera-aumento"), gate_hash: "sha256-demo-cert-cartera-aumento", hash_certificacion: "sha256-demo-cert-cartera-aumento", certificante_role: "ADMIN_UNICO", tipo_certificacion: "UNIPERSONAL", visto_bueno_persona_id: null, visto_bueno_fecha: null },
  ];
}

function registryRows(): Row[] {
  return [
    { id: uuid("registry:cartera:aumento"), tenant_id: DEMO_TENANT, deed_id: null, filing_via: "DEMO_PREPARACION_REGISTRAL", filing_number: `PREP-${CODES.CARTERA_SOCIO_UNICO}`, presentation_date: today(), status: "PREPARADA", estimated_resolution: "2026-06-05", agreement_id: uuid("agreement:cartera-aumento"), deed_reference: "Minuta demo preparada; sin envio real al Registro Mercantil", deed_date: today(), notary_name: "Notaria demo ARGA", protocol_number: "DEMO-2026-001", elevated_at: nowIso() },
    { id: uuid("registry:reaseguros:auditor"), tenant_id: DEMO_TENANT, deed_id: null, filing_via: "DEMO_PREPARACION_REGISTRAL", filing_number: `PREP-${CODES.RE_JGA}`, presentation_date: today(), status: "PREPARADA", estimated_resolution: "2026-06-05", agreement_id: uuid("agreement:re-auditor"), deed_reference: "Preparado para registro demo; sin presentacion real", deed_date: today(), notary_name: "Notaria demo ARGA", protocol_number: "DEMO-2026-002", elevated_at: nowIso() },
  ];
}

function evidenceRows(): Row[] {
  const pairs = [
    [CODES.ARGA_SEG_JGA, uuid("agreement:arga-seg-cuentas")],
    [CODES.ARGA_SEG_CDA, uuid("agreement:arga-seg-operacion-vinculada")],
    [CODES.CARTERA_SOCIO_UNICO, uuid("agreement:cartera-aumento")],
    [CODES.SERV_NO_SESSION, uuid("agreement:serv-no-session")],
    [CODES.TECH_TRANSFER, uuid("agreement:tech-transfer")],
    [CODES.RE_JGA, uuid("agreement:re-auditor")],
  ] as const;
  return pairs.map(([code, agreement_id]) => ({
    id: uuid(`evidence:${code}`),
    tenant_id: DEMO_TENANT,
    agreement_id,
    reference_code: code,
    manifest: { seed_code: code, qtsp: "EAD Trust", scope: "demo_operativa", registry_boundary: "no_real_filing" },
    manifest_hash: `sha256-demo-${code}`,
    qseal_token: `EADTrust-QSeal-${code}`,
    tsq_token: `EADTrust-TSQ-${code}`,
    status: "SEALED",
    document_url: `evidence://ead-trust/${code}`,
    hash_sha512: `sha512-demo-${code}`,
    signed_by: "EAD Trust demo QTSP",
    signature_date: today(),
    chain_of_custody: { source: "secretaria-seed-societario-demo", no_final_productive_evidence: true },
    legal_hold: false,
    source_module: "secretaria",
    source_object_type: "agreement",
    source_object_id: agreement_id,
  }));
}

async function fetchTemplateIds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("id,tipo,materia,estado,organo_tipo,adoption_mode")
    .eq("tenant_id", DEMO_TENANT)
    .eq("estado", "ACTIVA");
  if (error) throw error;

  const rows = (data ?? []) as Array<{ id: string; tipo: string; materia: string; organo_tipo: string | null; adoption_mode: string | null }>;
  const byMatter = new Map(rows.map((row) => [`${row.tipo}:${row.materia}:${row.organo_tipo ?? ""}:${row.adoption_mode ?? ""}`, row.id]));
  const firstByMatter = (tipo: string, materia: string) => rows.find((row) => row.tipo === tipo && row.materia === materia)?.id ?? null;
  const model = (materia: string) => rows.find((row) => row.tipo === "MODELO_ACUERDO" && row.materia === materia)?.id ?? null;
  return {
    activeCount: rows.length,
    byMatter,
    APROBACION_CUENTAS: model("APROBACION_CUENTAS"),
    DISTRIBUCION_DIVIDENDOS: model("DISTRIBUCION_DIVIDENDOS"),
    NOMBRAMIENTO_AUDITOR: model("NOMBRAMIENTO_AUDITOR"),
    POLITICA_REMUNERACION: model("POLITICA_REMUNERACION"),
    OPERACION_VINCULADA: model("OPERACION_VINCULADA"),
    DELEGACION_FACULTADES: model("DELEGACION_FACULTADES"),
    AUMENTO_CAPITAL: model("AUMENTO_CAPITAL"),
    REDUCCION_CAPITAL: model("REDUCCION_CAPITAL"),
    APROBACION_PLAN_NEGOCIO: model("APROBACION_PLAN_NEGOCIO"),
    ACUERDO_SIN_SESION: firstByMatter("ACTA_ACUERDO_ESCRITO", "ACUERDO_SIN_SESION"),
    DECISION_SOCIO_UNICO: firstByMatter("ACTA_CONSIGNACION", "DECISION_SOCIO_UNICO"),
    CERTIFICACION_ACUERDOS: firstByMatter("CERTIFICACION", "CERTIFICACION_ACUERDOS"),
  };
}

async function upsertRows(supabase: SupabaseClient, table: string, rows: Row[]) {
  if (rows.length === 0) return { planned: 0, changed: 0 };
  if (dryRun || verifyOnly) {
    console.log(`[DRY] ${table}: ${rows.length} upserts planned`);
    return { planned: rows.length, changed: 0 };
  }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`[OK] ${table}: ${rows.length} upserted`);
  return { planned: rows.length, changed: rows.length };
}

async function insertMissingRows(supabase: SupabaseClient, table: string, rows: Row[]) {
  if (rows.length === 0) return { planned: 0, changed: 0 };
  if (dryRun || verifyOnly) {
    console.log(`[DRY] ${table}: ${rows.length} insert-if-missing planned`);
    return { planned: rows.length, changed: 0 };
  }
  const ids = rows.map((row) => row.id);
  const { data, error } = await supabase.from(table).select("id").in("id", ids);
  if (error) throw new Error(`${table} existing-id probe: ${error.message}`);
  const existing = new Set((data ?? []).map((row) => row.id));
  const missing = rows.filter((row) => !existing.has(row.id));
  if (missing.length === 0) {
    console.log(`[OK] ${table}: 0 inserted (${rows.length} already present)`);
    return { planned: rows.length, changed: 0 };
  }
  const { error: insertError } = await supabase.from(table).insert(missing);
  if (insertError) throw new Error(`${table}: ${insertError.message}`);
  console.log(`[OK] ${table}: ${missing.length} inserted (${rows.length - missing.length} already present)`);
  return { planned: rows.length, changed: missing.length };
}

async function upsertConditionRows(supabase: SupabaseClient, rows: Row[]) {
  if (rows.length === 0) return { planned: 0, changed: 0 };
  if (dryRun || verifyOnly) {
    console.log(`[DRY] condiciones_persona: ${rows.length} unique-key upserts planned`);
    return { planned: rows.length, changed: 0 };
  }

  let changed = 0;
  for (const row of rows) {
    let query = supabase
      .from("condiciones_persona")
      .select("id")
      .eq("tenant_id", row.tenant_id as string)
      .eq("person_id", row.person_id as string)
      .eq("entity_id", row.entity_id as string)
      .eq("tipo_condicion", row.tipo_condicion as string)
      .eq("estado", "VIGENTE")
      .limit(1);

    query = row.body_id
      ? query.eq("body_id", row.body_id as string)
      : query.is("body_id", null);

    const { data, error } = await query;
    if (error) throw new Error(`condiciones_persona probe: ${error.message}`);
    const existingId = data?.[0]?.id as string | undefined;

    if (existingId) {
      const { id: _seedId, ...patch } = row;
      const { error: updateError } = await supabase
        .from("condiciones_persona")
        .update(patch)
        .eq("id", existingId);
      if (updateError) throw new Error(`condiciones_persona update: ${updateError.message}`);
    } else {
      const { error: insertError } = await supabase.from("condiciones_persona").insert(row);
      if (insertError) throw new Error(`condiciones_persona insert: ${insertError.message}`);
    }
    changed += 1;
  }

  console.log(`[OK] condiciones_persona: ${changed} unique-key upserted`);
  return { planned: rows.length, changed };
}

async function verify(supabase: SupabaseClient) {
  const expectedEntities = Object.values(ENTITIES);
  const expectedAgreements = agreementRows({}).map((row) => row.id);
  const expectedBooks = bookRows().map((row) => row.id);

  const [entitiesRes, agreementsRes, booksRes, templatesRes] = await Promise.all([
    supabase.from("entities").select("id,legal_name,tipo_social,es_cotizada,es_unipersonal").in("id", expectedEntities),
    supabase.from("agreements").select("id,code,adoption_mode,status,compliance_snapshot,execution_mode").in("id", expectedAgreements),
    supabase.from("mandatory_books").select("id,book_kind,entity_id,legalization_status").in("id", expectedBooks),
    supabase.from("plantillas_protegidas").select("id,estado").eq("tenant_id", DEMO_TENANT).eq("estado", "ACTIVA"),
  ]);

  for (const [name, result] of Object.entries({ entitiesRes, agreementsRes, booksRes, templatesRes })) {
    if (result.error) throw new Error(`${name}: ${result.error.message}`);
  }

  const missingSnapshots = ((agreementsRes.data ?? []) as Array<{ compliance_snapshot?: Json | null; execution_mode?: Json | null }>)
    .filter((row) => !row.compliance_snapshot || !row.execution_mode);

  const result = {
    templatesActive: templatesRes.data?.length ?? 0,
    societiesFound: entitiesRes.data?.length ?? 0,
    agreementsFound: agreementsRes.data?.length ?? 0,
    booksFound: booksRes.data?.length ?? 0,
    missingSnapshots: missingSnapshots.length,
  };
  console.log(JSON.stringify({ verify: result }, null, 2));

  if (result.templatesActive !== 37) throw new Error(`Expected 37 active templates, got ${result.templatesActive}`);
  if (result.societiesFound < 6) throw new Error(`Expected 6 societies, got ${result.societiesFound}`);
  if (result.agreementsFound < expectedAgreements.length) {
    throw new Error(`Expected ${expectedAgreements.length} seeded agreements, got ${result.agreementsFound}`);
  }
  if (result.missingSnapshots > 0) throw new Error(`${result.missingSnapshots} seeded agreements lack snapshots/execution_mode`);
}

async function main() {
  if (apply && verifyOnly) throw new Error("Use only one of --apply or --verify.");
  const supabase = client();
  const templates = await fetchTemplateIds(supabase);
  if (templates.activeCount !== 37) throw new Error(`Expected 37 active templates, got ${templates.activeCount}`);

  console.log(JSON.stringify({
    mode: verifyOnly ? "verify" : dryRun ? "dry-run" : "apply",
    tenant: DEMO_TENANT,
    templatesActive: templates.activeCount,
    boundary: "PROMOTED/FILED prepared-for-registry demo only; no real Registry filing",
    qtsp: "EAD Trust",
  }, null, 2));

  if (verifyOnly) {
    await verify(supabase);
    return;
  }

  const noSession = noSessionRows(templates);
  const operations: Array<Promise<unknown>> = [];
  operations.push(upsertRows(supabase, "persons", personRows()));
  operations.push(upsertRows(supabase, "entities", entityRows()));
  await Promise.all(operations);

  await upsertRows(supabase, "governing_bodies", bodyRows());
  await upsertConditionRows(supabase, conditionRows());
  await upsertRows(supabase, "share_classes", shareClassRows());
  await upsertRows(supabase, "capital_holdings", capitalHoldingRows());
  await upsertRows(supabase, "mandatory_books", bookRows());
  await upsertRows(supabase, "convocatorias", convocatoriaRows());
  await upsertRows(supabase, "meetings", meetingRows());
  await upsertRows(supabase, "agenda_items", agendaRows());
  await upsertRows(supabase, "meeting_attendees", attendeeRows());
  await upsertRows(supabase, "unipersonal_decisions", unipersonalRows());
  await upsertRows(supabase, "no_session_resolutions", noSession.resolutions);
  await upsertRows(supabase, "agreements", agreementRows(templates));
  await upsertRows(supabase, "no_session_expedientes", noSession.expedientes);
  await insertMissingRows(supabase, "no_session_notificaciones", noSession.notificaciones);
  await insertMissingRows(supabase, "no_session_respuestas", noSession.respuestas);
  await insertMissingRows(supabase, "capital_movements", capitalMovementRows());
  await upsertRows(supabase, "meeting_resolutions", resolutionRows());
  await upsertRows(supabase, "meeting_votes", voteRows());
  await upsertRows(supabase, "minutes", minuteRows());
  await upsertRows(supabase, "certifications", certificationRows());
  await upsertRows(supabase, "registry_filings", registryRows());
  await insertMissingRows(supabase, "evidence_bundles", evidenceRows());

  if (dryRun) {
    console.log("[DRY] plan complete; no Cloud rows were mutated.");
    return;
  }

  await verify(supabase);
}

main().catch((error) => {
  console.error(`[FAIL] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
