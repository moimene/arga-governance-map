import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720137000_secretaria_convocation_authority_and_representation_gate.sql",
  ),
  "utf8",
);

const executableSql = migration.replace(/^\s*--.*$/gm, "");
const triggerFunction =
  executableSql.match(
    /CREATE OR REPLACE FUNCTION secretaria_private\.fn_convocatoria_authority_representation_guard\(\)[\s\S]*?\$function\$;/i,
  )?.[0] ?? "";

describe("convocatoria — autoridad y representación autoritativas", () => {
  it("estructura la autoridad convocante y limita el Consejo al presidente", () => {
    expect(executableSql).toContain("convocante_person_id uuid");
    expect(executableSql).toContain("convocante_authority_evidence_id uuid");
    expect(executableSql).toContain("convocation_authority_route text");
    expect(executableSql).toContain("convocatorias_convocante_person_fk");
    expect(executableSql).toContain("convocatorias_convocante_authority_evidence_fk");
    expect(executableSql).toContain("PRESIDENTE_ART_246_1");
    expect(executableSql).not.toContain("CONSEJEROS_ART_246_2");
  });

  it("deriva una única authority_evidence presidencial en tenant, entidad, órgano y fecha", () => {
    expect(triggerFunction).toContain("v_body.body_type = 'CDA'");
    expect(triggerFunction).toContain("evidence.tenant_id = NEW.tenant_id");
    expect(triggerFunction).toContain("evidence.entity_id = v_source_entity.id");
    expect(triggerFunction).toContain("evidence.body_id = v_body.id");
    expect(triggerFunction).toContain("evidence.cargo = 'PRESIDENTE'");
    expect(triggerFunction).toContain("evidence.estado = 'VIGENTE'");
    expect(triggerFunction).toContain("evidence.fecha_inicio <= NEW.fecha_emision");
    expect(triggerFunction).toContain("v_authority_count <> 1");
    expect(triggerFunction).toContain("NEW.convocante_person_id := v_authority_person_id");
    expect(triggerFunction).toContain(
      "NEW.convocante_authority_evidence_id := v_authority_id",
    );
  });

  it("permite borradores sin órgano y resuelve estado, órgano y fecha solo al emitir", () => {
    expect(triggerFunction).toContain("NEW.estado IS DISTINCT FROM 'EMITIDA'");
    expect(triggerFunction).toContain("NEW.fecha_emision := NULL");
    expect(triggerFunction).toContain("CONVOCATION_BODY_REQUIRED_TO_ISSUE");
    expect(triggerFunction).toContain("AT TIME ZONE 'Europe/Madrid'");
    expect(executableSql).toMatch(/UPDATE OF[\s\S]*estado,[\s\S]*fecha_emision/i);
  });

  it("conserva íntegra la fuente emitida al cancelar o rectificar", () => {
    expect(triggerFunction).toContain("OLD.estado = 'EMITIDA'");
    expect(triggerFunction).toContain("NEW.estado IN ('CANCELADA', 'RECTIFICADA')");
    expect(triggerFunction).toContain("CONVOCATION_LIFECYCLE_MUST_PRESERVE_ISSUED_AUTHORITY");
    expect(triggerFunction).toContain("NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision");
    expect(triggerFunction).toContain("RETURN NEW");
  });

  it("mantiene el gate fuera de la API pública y fija el search_path", () => {
    expect(executableSql).toContain("CREATE SCHEMA IF NOT EXISTS secretaria_private");
    expect(executableSql).toContain("REVOKE ALL ON SCHEMA secretaria_private FROM PUBLIC");
    expect(triggerFunction).toContain("SECURITY DEFINER");
    expect(triggerFunction).toContain("SET search_path = pg_catalog");
    expect(executableSql).toContain(
      "REVOKE ALL ON FUNCTION secretaria_private.fn_convocatoria_authority_representation_guard()",
    );
    expect(executableSql).not.toMatch(/CREATE OR REPLACE FUNCTION public\./i);
  });

  it("valida target y representante y acredita titularidad exacta del 100 % con voto", () => {
    expect(triggerFunction).toContain("DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL");
    expect(triggerFunction).toContain("target_entity_id");
    expect(triggerFunction).toContain("representative_person_id");
    expect(triggerFunction).toContain("target.tenant_id = NEW.tenant_id");
    expect(triggerFunction).toContain("representative.tenant_id = NEW.tenant_id");
    expect(triggerFunction).toContain("representative.person_type = 'PF'");
    expect(triggerFunction).toContain("REPRESENTATION_AGENDA_REQUIRES_CDA");
    expect(triggerFunction).toContain("REPRESENTATION_AGENDA_REQUIRES_DECISORIO");
    expect(triggerFunction).toContain("REPRESENTATION_TARGET_MUST_BE_ACTIVE_ES_ENTITY");
    expect(triggerFunction).toContain("v_target_entity.id = v_source_entity.id");
    expect(triggerFunction).toContain("NOT IN ('SL', 'SLU')");
    expect(triggerFunction).toContain("holding.effective_from <= v_meeting_date");
    expect(triggerFunction).toContain("v_target_total <> 100");
    expect(triggerFunction).toContain("v_source_total <> 100");
    expect(triggerFunction).toContain("v_source_voting_total <> 100");
  });

  it("rechaza aliases legacy y cualquier claim representativo fuera de la materia exacta", () => {
    expect(triggerFunction).toContain("REPRESENTATION_LEGACY_MATTER_FORBIDDEN");
    expect(triggerFunction).toContain("'%REPRESENT%'");
    expect(triggerFunction).toContain("'%FILIAL%'");
    expect(triggerFunction).toContain("'%PARTICIPADA%'");
    expect(triggerFunction).toContain("'%SOCIO_UNICO%'");
    expect(triggerFunction).toContain("REPRESENTATION_CLAIMS_FORBIDDEN_OUTSIDE_CANONICAL_MATTER");
  });

  it("mantiene bloqueadas las fuentes autoritativas durante validación y normalización", () => {
    expect(triggerFunction).toMatch(/LOCK TABLE[\s\S]*public\.authority_evidence[\s\S]*IN SHARE MODE/);
    expect(triggerFunction).toContain("public.capital_holdings");
    expect(triggerFunction).toContain("public.condiciones_persona");
    expect(triggerFunction).toContain("public.delegations");
    expect(triggerFunction).toContain("FOR SHARE");
  });

  it("desvía el supuesto de administradora persona jurídica al art. 212 bis", () => {
    expect(triggerFunction).toContain("administrator.person_id = v_source_entity.person_id");
    expect(triggerFunction).toContain("'ADMIN_PJ'");
    expect(triggerFunction).toContain("'CONSEJERO'");
    expect(triggerFunction).toContain(
      "REPRESENTATION_SOURCE_IS_TARGET_CORPORATE_ADMIN_ART_212_BIS",
    );
  });

  it("bloquea una propuesta incoherente y deriva los nombres para documentos", () => {
    expect(triggerFunction).toContain("REPRESENTATION_PROPOSAL_REQUIRED");
    expect(triggerFunction).toContain("v_target_entity.legal_name");
    expect(triggerFunction).toContain("v_representative.full_name");
    expect(triggerFunction).toContain("REPRESENTATION_PROPOSAL_TARGET_NAME_MISMATCH");
    expect(triggerFunction).toContain(
      "REPRESENTATION_PROPOSAL_REPRESENTATIVE_NAME_MISMATCH",
    );
    expect(triggerFunction).toContain("- 'target_entity_name'");
    expect(triggerFunction).toContain("- 'representative_name'");
    expect(triggerFunction).toContain("'target_entity_name', v_target_entity.legal_name");
    expect(triggerFunction).toContain("'representative_name', v_representative.full_name");
  });

  it("implementa únicamente el poder general del art. 183.1 con evidencia estructurada", () => {
    expect(executableSql).toContain("representation_authority_route text");
    expect(executableSql).toContain("representation_evidence_status text");
    expect(executableSql).toContain("representation_source_reference text");
    expect(executableSql).toContain("representation_source_uri text");
    expect(executableSql).toContain("representation_source_hash_sha512 text");
    expect(executableSql).toContain("representation_legal_effect text");
    expect(triggerFunction).toContain("GENERAL_PUBLIC_POWER_ART_183_1");
    expect(triggerFunction).toContain("delegation.status = 'Vigente'");
    expect(triggerFunction).toContain("delegation.start_date <= v_meeting_date");
    expect(triggerFunction).toContain("v_delegation_count <> 1");
  });

  it("usa un título dedicado de Carmen y falla cerrado fuera del DEMO homogéneo", () => {
    expect(executableSql).toContain("e1cdf019-0833-4f46-a9e9-df209c6d6ca0");
    expect(executableSql).toContain("3b8da713-8353-4fa9-91c8-917cf0bcb9b3");
    expect(executableSql).toContain("DEMO-REP-183-CARMEN-001");
    expect(executableSql).toContain("PODER_GENERAL_REPRESENTACION_SOCIO_UNICO_DEMO");
    expect(executableSql).toContain("Dña. Carmen Delgado Ortiz");
    expect(executableSql).toContain("DEMO_SIMULATION_NO_LEGAL_EFFECT");
    expect(triggerFunction).toContain("v_source_entity.data_class IS DISTINCT FROM 'DEMO'");
    expect(triggerFunction).toContain("v_source_person.data_class IS DISTINCT FROM 'DEMO'");
    expect(triggerFunction).toContain("v_target_entity.data_class IS DISTINCT FROM 'DEMO'");
    expect(triggerFunction).toContain("v_representative.data_class IS DISTINCT FROM 'DEMO'");
    expect(triggerFunction).toContain("CONVOCATION_NON_DEMO_OR_MIXED_DATA_FAIL_CLOSED");
    expect(triggerFunction).toContain("delegation.representation_source_uri IS NULL");
    expect(triggerFunction).toContain("delegation.representation_source_hash_sha512 IS NULL");
    expect(triggerFunction).not.toContain("SOURCE_VERIFIED_LEGAL_EFFECT");
  });

  it("borra claims del cliente y sobrescribe ruta, delegación y estado en agenda", () => {
    expect(triggerFunction).toContain("- 'representation_authority_route'");
    expect(triggerFunction).toContain("- 'representation_delegation_id'");
    expect(triggerFunction).toContain("- 'representation_evidence_status'");
    expect(triggerFunction).toContain(
      "'representation_delegation_id', v_delegation.id",
    );
    expect(triggerFunction).toContain(
      "'representation_evidence_status', v_delegation.representation_evidence_status",
    );
    expect(triggerFunction).toContain("'source_shareholder_entity_id', v_source_entity.id");
  });

  it("reconcilia ARGA Digital como unipersonal solo desde capital demo y deja rastro", () => {
    expect(executableSql).toContain("f653c44c-15ce-4428-b3d3-f4ed17efe93b");
    expect(executableSql).toContain("es_unipersonal = true");
    expect(executableSql).toContain("secretaria_unipersonal_reconciliation_20260720");
    expect(executableSql).toContain("DEMO_DATA_RECONCILIATION_NO_SOURCE_SUBSTITUTION");
    expect(executableSql).toContain("holding_ids");
    expect(executableSql).toContain(
      "count(*) FILTER (WHERE holding.porcentaje_capital IS NULL) = 0",
    );
  });
});
