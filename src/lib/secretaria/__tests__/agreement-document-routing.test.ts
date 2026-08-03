import { describe, expect, it } from "vitest";
import {
  agreementTemplateDocumentType,
  templateTypesForAgreementAdoptionMode,
} from "../agreement-document-routing";
import { templateTypesForDocumentType } from "@/lib/motor-plantillas/composer";
import { prepareDocumentComposition } from "@/lib/motor-plantillas/composer";
import { buildSecretariaDocumentGenerationRequest } from "../document-generation-boundary";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

describe("Agreement 360 -> generador documental", () => {
  it("clasifica MODELO_ACUERDO de sesión como MODELO_ACUERDO, no como informe PRE", () => {
    expect(
      agreementTemplateDocumentType(
        { tipo: "MODELO_ACUERDO" },
        "MEETING",
      ),
    ).toBe("MODELO_ACUERDO");
    expect(templateTypesForDocumentType("MODELO_ACUERDO")).toEqual([
      "MODELO_ACUERDO",
    ]);
  });

  it("mantiene el filtro especializado para modos sin sesión", () => {
    expect(templateTypesForAgreementAdoptionMode("NO_SESSION")).toEqual([
      "ACTA_ACUERDO_ESCRITO",
    ]);
    expect(templateTypesForAgreementAdoptionMode("MEETING")).toBeNull();
  });

  it("el composer acepta el MODELO_ACUERDO CONSEJO_ADMIN v1.1.0 ofrecido por Agreement 360", async () => {
    const plantilla: PlantillaProtegidaRow = {
      id: "modelo-delegacion-consejo-v1-1-0",
      tenant_id: "00000000-0000-0000-0000-000000000001",
      tipo: "MODELO_ACUERDO",
      materia: "DELEGACION_FACULTADES",
      materia_acuerdo: "DELEGACION_FACULTADES",
      jurisdiccion: "ES",
      version: "1.1.0",
      estado: "ACTIVA",
      aprobada_por: "Comité Legal ARGA",
      fecha_aprobacion: "2026-07-01T00:00:00.000Z",
      contenido_template: null,
      capa1_inmutable:
        "ACUERDO DEL CONSEJO DE ADMINISTRACIÓN DE {{ENTIDAD.denominacion_social}} DE DELEGACIÓN DE FACULTADES. Carácter demo/operativo.",
      capa2_variables: null,
      capa3_editables: null,
      referencia_legal: "Arts. 249 y 249 bis LSC",
      notas_legal: null,
      variables: [],
      protecciones: {},
      snapshot_rule_pack_required: true,
      adoption_mode: "MEETING",
      organo_tipo: "CONSEJO_ADMIN",
      contrato_variables_version: null,
      created_at: "2026-07-01T00:00:00.000Z",
      approval_checklist: null,
      version_history: null,
    };
    const request = await buildSecretariaDocumentGenerationRequest({
      documentType: "MODELO_ACUERDO",
      tenantId: plantilla.tenant_id,
      entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
      agreementIds: ["77ea0000-0000-4000-8000-000000000001"],
      templateId: plantilla.id,
      expectedOrganoTipo: "CONSEJO_ADMIN",
      expectedAdoptionMode: "MEETING",
      requestedAt: "2026-07-19T10:00:00.000Z",
    });

    const prepared = await prepareDocumentComposition(request, {}, {
      plantilla,
      resolveCapa2: false,
      baseVariables: {
        ENTIDAD: { denominacion_social: "ARGA Seguros, S.A." },
        DELEGACION: { agreement_id: request.agreement_ids[0] },
      },
    });

    expect(prepared.template.id).toBe(plantilla.id);
    expect(prepared.request.document_type).toBe("MODELO_ACUERDO");
    expect(prepared.renderedBodyText).not.toContain(request.agreement_ids[0]);
    expect(prepared.postRenderValidation.ok).toBe(true);
  });
});
