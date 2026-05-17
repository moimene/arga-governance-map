import { describe, expect, it, vi } from "vitest";
import {
  assignTemplateBinding,
  buildNormativeOverridePayload,
  buildOrganProfilePayload,
  buildOrganRulePayload,
  buildStatuteVersionPayload,
  buildTemplateBindingPayload,
  materializeEffectiveRuleMatrix,
  publishNormativeOverride,
  publishStatuteVersion,
  templateSelectionReason,
  upsertOrganRule,
  upsertOrganProfile,
} from "@/lib/secretaria/normative-governance";

const tenantId = "00000000-0000-0000-0000-000000000001";
const entityId = "11111111-1111-1111-1111-111111111111";

describe("normative governance contracts", () => {
  it("builds organ profile payloads for governed create/edit", () => {
    expect(
      buildOrganProfilePayload({
        tenantId,
        entityId,
        name: "Comité de Estrategia",
        bodyType: "COMITE",
        status: "Activo",
        regulationRef: "Reglamento del Comité art. 3",
        quorumRule: "Mayoría de miembros",
        userRole: "editor",
      }),
    ).toMatchObject({
      tenant_id: tenantId,
      entity_id: entityId,
      name: "Comité de Estrategia",
      body_type: "COMITE",
      regulation_ref: "Reglamento del Comité art. 3",
      user_role: "editor",
    });
  });

  it("builds organ rule payloads with documentary source", () => {
    expect(
      buildOrganRulePayload({
        tenantId,
        entityId,
        bodyId: "22222222-2222-2222-2222-222222222222",
        matterCode: "AUMENTO_CAPITAL",
        quorumRule: "Quórum reforzado",
        majorityRule: "Mayoría de dos tercios",
        sourceType: "ESTATUTOS",
        sourceRef: "Estatutos art. 12",
        documentUri: "secretaria://fuentes/estatutos-2026.pdf",
        sourceExcerpt: "La Junta es competente para modificar estatutos.",
        userRole: "editor",
      }),
    ).toMatchObject({
      tenant_id: tenantId,
      entity_id: entityId,
      matter_code: "AUMENTO_CAPITAL",
      source_ref: "Estatutos art. 12",
      document_uri: "secretaria://fuentes/estatutos-2026.pdf",
      source_excerpt: "La Junta es competente para modificar estatutos.",
      user_role: "editor",
    });
  });

  it("normalizes statute mappings into the RPC contract", () => {
    const payload = buildStatuteVersionPayload({
      tenantId,
      entityId,
      versionLabel: "Estatutos 2026",
      mappingCoverage: 92,
      criticalMappingsComplete: true,
      userRole: "legal_ops",
      mappings: [
        {
          clauseRef: "Art. 12",
          matterCode: "MODIFICACION_ESTATUTOS",
          requirementKey: "votacion.mayoria",
          requirementValue: { majority_code: "REFORZADA_2_3" },
        },
      ],
    });

    expect(payload.status).toBe("PUBLICADA");
    expect(payload.mapping_coverage).toBe(92);
    expect(payload.mappings).toEqual([
      expect.objectContaining({
        clause_ref: "Art. 12",
        matter_code: "MODIFICACION_ESTATUTOS",
        confidence: "VALIDADO",
      }),
    ]);
  });

  it("keeps override and template binding payloads deterministic", () => {
    expect(
      buildNormativeOverridePayload({
        tenantId,
        entityId,
        matterCode: "AUMENTO_CAPITAL",
        requirementKey: "votacion.mayoria",
        requirementValue: { majority_code: "UNANIMIDAD" },
        sourceType: "ESTATUTOS",
        sourceRef: "Estatutos art. 15",
        justification: "Los estatutos elevan el requisito legal.",
        userRole: "admin",
      }),
    ).toMatchObject({
      requirement_key: "votacion.mayoria",
      source_type: "ESTATUTOS",
      source_ref: "Estatutos art. 15",
    });

    expect(
      buildTemplateBindingPayload({
        tenantId,
        materia: "AUMENTO_CAPITAL",
        docType: "MODELO_ACUERDO",
        templateId: "33333333-3333-3333-3333-333333333333",
        selectionReason: "materia AUMENTO_CAPITAL · documento MODELO_ACUERDO",
        userRole: "editor",
      }),
    ).toMatchObject({
      organo_tipo: "ANY",
      tipo_social: "ANY",
      adoption_mode: "ANY",
      active: true,
    });
  });

  it("calls P2 RPCs by their public contract names", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "rpc-id", error: null });
    const client = { rpc };

    await upsertOrganRule(client, {
      tenantId,
      entityId,
      bodyId: "22222222-2222-2222-2222-222222222222",
      matterCode: "AUMENTO_CAPITAL",
      quorumRule: "Quórum reforzado",
      majorityRule: "Mayoría reforzada",
      sourceType: "REGLAMENTO",
      sourceRef: "Reglamento art. 4",
      userRole: "editor",
    });
    await upsertOrganProfile(client, {
      tenantId,
      entityId,
      bodyId: "22222222-2222-2222-2222-222222222222",
      name: "Consejo de Administración",
      bodyType: "CDA",
      userRole: "editor",
    });
    await publishStatuteVersion(client, {
      tenantId,
      entityId,
      versionLabel: "Estatutos 2026",
      mappingCoverage: 85,
      userRole: "editor",
    });
    await publishNormativeOverride(client, {
      tenantId,
      entityId,
      matterCode: "AUMENTO_CAPITAL",
      requirementKey: "votacion.mayoria",
      requirementValue: { majority_code: "UNANIMIDAD" },
      sourceType: "ESTATUTOS",
      sourceRef: "Estatutos art. 15",
      justification: "Eleva el mínimo legal.",
      userRole: "admin",
    });
    await assignTemplateBinding(client, {
      tenantId,
      materia: "AUMENTO_CAPITAL",
      docType: "MODELO_ACUERDO",
      templateId: "33333333-3333-3333-3333-333333333333",
      selectionReason: "Selección automática",
      userRole: "editor",
    });
    await materializeEffectiveRuleMatrix(client, { tenantId, entityId });

    expect(rpc).toHaveBeenCalledWith("fn_secretaria_upsert_organ_rule", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("fn_secretaria_upsert_organ_profile", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("fn_secretaria_publish_statute_version", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("fn_secretaria_publish_normative_override", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("fn_secretaria_assign_template_binding", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("fn_secretaria_materialize_effective_rule_matrix", expect.any(Object));
  });

  it("explains deterministic template selection in business language", () => {
    expect(
      templateSelectionReason({
        materia: "AUMENTO_CAPITAL",
        docType: "ACTA_SESION",
        jurisdiction: "ES",
        tipoSocial: "SA",
        organoTipo: "JUNTA_GENERAL",
        adoptionMode: "MEETING",
      }),
    ).toBe("materia AUMENTO_CAPITAL · documento ACTA_SESION · jurisdicción ES · tipo social SA · órgano JUNTA_GENERAL · forma de adopción MEETING");
  });
});
