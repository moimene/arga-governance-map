import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  organoFamily,
  templateCompatibleWithAgreement,
  templateOrganoMatches,
} from "../agreement-template-compatibility";

function template(patch: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "template",
    tenant_id: "tenant",
    tipo: "ACTA_SESION",
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comité Legal ARGA",
    fecha_aprobacion: "2026-05-04T00:00:00.000Z",
    contenido_template: null,
    capa1_inmutable: "Contenido legal operativo de prueba.",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: "MEETING",
    organo_tipo: "CONSEJO_ADMINISTRACION",
    contrato_variables_version: null,
    created_at: "2026-05-04T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  };
}

describe("agreement-template-compatibility", () => {
  it("normaliza familias de organo entre BD, plantillas y motor", () => {
    expect(organoFamily("CDA")).toBe("CONSEJO");
    expect(organoFamily("CONSEJO_ADMIN")).toBe("CONSEJO");
    expect(organoFamily("CONSEJO_ADMINISTRACION")).toBe("CONSEJO");
    expect(organoFamily("JUNTA_GENERAL")).toBe("JUNTA");
    expect(templateOrganoMatches("CONSEJO_ADMINISTRACION", "CDA")).toBe(true);
    expect(templateOrganoMatches("JUNTA_GENERAL", "CDA")).toBe(false);
  });

  it("acepta plantilla compatible aunque organo_tipo use alias distinto", () => {
    const ok = templateCompatibleWithAgreement(
      template({ organo_tipo: "CONSEJO_ADMINISTRACION" }),
      {
        adoption_mode: "MEETING",
        agreement_kind: "APROBACION_CUENTAS",
        matter_class: "ORDINARIA",
        governing_bodies: { body_type: "CDA" },
        entities: { jurisdiction: "ES" },
      },
      ["ACTA_SESION"],
    );

    expect(ok).toBe(true);
  });

  it("rechaza modo de adopcion, tipo documental o jurisdiccion incompatibles", () => {
    const agreement = {
      adoption_mode: "NO_SESSION",
      agreement_kind: "APROBACION_CUENTAS",
      matter_class: "ORDINARIA",
      governing_bodies: { body_type: "CDA" },
      entities: { jurisdiction: "ES" },
    };

    expect(templateCompatibleWithAgreement(template({ adoption_mode: "MEETING" }), agreement, ["ACTA_SESION"])).toBe(false);
    expect(templateCompatibleWithAgreement(template({ tipo: "CERTIFICACION" }), agreement, ["ACTA_SESION"])).toBe(false);
    expect(templateCompatibleWithAgreement(template({ jurisdiccion: "PT", adoption_mode: "NO_SESSION" }), agreement, ["ACTA_SESION"])).toBe(false);
  });

  it("permite materia por agreement_kind o por matter_class", () => {
    const baseAgreement = {
      adoption_mode: "MEETING",
      agreement_kind: "AUMENTO_CAPITAL",
      matter_class: "ESTRUCTURAL",
      governing_bodies: { body_type: "JUNTA" },
      entities: { jurisdiction: "ES" },
    };

    expect(templateCompatibleWithAgreement(
      template({ organo_tipo: "JUNTA_GENERAL", materia_acuerdo: "AUMENTO_CAPITAL" }),
      baseAgreement,
      ["ACTA_SESION"],
    )).toBe(true);
    expect(templateCompatibleWithAgreement(
      template({ organo_tipo: "JUNTA_GENERAL", materia_acuerdo: "ESTRUCTURAL" }),
      baseAgreement,
      ["ACTA_SESION"],
    )).toBe(true);
    expect(templateCompatibleWithAgreement(
      template({ organo_tipo: "JUNTA_GENERAL", materia_acuerdo: "APROBACION_CUENTAS" }),
      baseAgreement,
      ["ACTA_SESION"],
    )).toBe(false);
  });
});

