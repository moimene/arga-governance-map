import { describe, expect, it } from "vitest";
import {
  computeBindingScore,
  resolveMatterRegistryFromRows,
  type MatterRegistryBindingRow,
  type MatterRegistryRulePackRow,
  type MatterRegistryTemplateRow,
} from "../matter-registry";

const tenantId = "tenant-1";

function binding(overrides: Partial<MatterRegistryBindingRow>): MatterRegistryBindingRow {
  return {
    id: overrides.id ?? `binding-${overrides.template_id ?? "x"}`,
    tenant_id: tenantId,
    materia: "CESE_CONSEJERO",
    organo_tipo: "CONSEJO_ADMIN",
    tipo_social: "ANY",
    jurisdiccion: "ES",
    adoption_mode: "MEETING",
    doc_type: "MODELO_ACUERDO",
    template_id: overrides.template_id ?? "tpl-consejo",
    priority: 100,
    active: true,
    selection_reason: "test",
    ...overrides,
  };
}

function template(overrides: Partial<MatterRegistryTemplateRow>): MatterRegistryTemplateRow {
  return {
    id: overrides.id ?? "tpl-consejo",
    tenant_id: tenantId,
    tipo: "MODELO_ACUERDO",
    materia_acuerdo: "CESE_CONSEJERO",
    materia: null,
    jurisdiccion: "ES",
    version: "1.1.0",
    estado: "ACTIVA",
    aprobada_por: "Comite Legal",
    fecha_aprobacion: "2026-05-01",
    referencia_legal: "art. 223 LSC",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    capa3_editables: [],
    ...overrides,
  };
}

function rulePack(overrides: Partial<MatterRegistryRulePackRow>): MatterRegistryRulePackRow {
  return {
    id: overrides.id ?? "rp-consejo",
    tenant_id: tenantId,
    materia: "CESE_CONSEJERO",
    organo_tipo: "CONSEJO_ADMIN",
    descripcion: "CESE_CONSEJERO Consejo",
    created_at: "2026-05-01T00:00:00.000Z",
    rule_pack_versions: [
      {
        id: `${overrides.id ?? "rp-consejo"}-v1`,
        pack_id: overrides.id ?? "rp-consejo",
        version: "1.1.0",
        is_active: true,
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("Matter Registry", () => {
  it("puntua órgano exacto por encima de órgano compuesto y meta-órgano", () => {
    const query = {
      tenantId,
      materia: "CESE_CONSEJERO",
      organoTipo: "CONSEJO_ADMIN",
      adoptionMode: "MEETING",
    };

    expect(computeBindingScore(query, binding({ organo_tipo: "CONSEJO_ADMIN" }))).toBe(5);
    expect(computeBindingScore(query, binding({ organo_tipo: "JUNTA_GENERAL_O_CONSEJO" }))).toBe(4);
    expect(computeBindingScore(query, binding({ organo_tipo: "DERIVADO_DEL_ACTO" }))).toBe(3);
    expect(computeBindingScore(query, binding({ organo_tipo: "JUNTA_GENERAL" }))).toBe(-1);
  });

  it("resuelve CESE_CONSEJERO por órgano y no permite que priority gane al contexto legal", () => {
    const entry = resolveMatterRegistryFromRows(
      {
        tenantId,
        materia: "CESE_CONSEJERO",
        organoTipo: "CONSEJO_ADMIN",
        adoptionMode: "MEETING",
      },
      {
        bindings: [
          binding({ id: "binding-junta", template_id: "tpl-junta", organo_tipo: "JUNTA_GENERAL", priority: 1 }),
          binding({ id: "binding-consejo", template_id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN", priority: 100 }),
        ],
        templates: [
          template({ id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN" }),
          template({ id: "tpl-junta", organo_tipo: "JUNTA_GENERAL" }),
        ],
        rulePacks: [rulePack({ id: "rp-consejo", organo_tipo: "CONSEJO_ADMIN" })],
        effectiveRule: { matter_code: "CESE_CONSEJERO", operational_status: "OK" },
      },
    );

    expect(entry.registry_status).toBe("RESUELTA");
    expect(entry.binding_id).toBe("binding-consejo");
    expect(entry.template_id).toBe("tpl-consejo");
  });

  it("exige selección manual cuando falta órgano y hay candidatos concretos indistinguibles", () => {
    const entry = resolveMatterRegistryFromRows(
      {
        tenantId,
        materia: "CESE_CONSEJERO",
        adoptionMode: "MEETING",
      },
      {
        bindings: [
          binding({ id: "binding-junta", template_id: "tpl-junta", organo_tipo: "JUNTA_GENERAL", priority: 1 }),
          binding({ id: "binding-consejo", template_id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN", priority: 100 }),
        ],
        templates: [
          template({ id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN" }),
          template({ id: "tpl-junta", organo_tipo: "JUNTA_GENERAL" }),
        ],
        rulePacks: [
          rulePack({ id: "rp-consejo", organo_tipo: "CONSEJO_ADMIN" }),
          rulePack({ id: "rp-junta", organo_tipo: "JUNTA_GENERAL" }),
        ],
        effectiveRule: { matter_code: "CESE_CONSEJERO", operational_status: "OK" },
      },
    );

    expect(entry.registry_status).toBe("REQUIERE_SELECCION_MANUAL");
    expect(entry.alternativas?.map((item) => item.binding_id)).toEqual(["binding-junta", "binding-consejo"]);
  });

  it("marca como parcial el match por órgano compuesto", () => {
    const entry = resolveMatterRegistryFromRows(
      {
        tenantId,
        materia: "ACUERDO_SIN_SESION",
        organoTipo: "CONSEJO_ADMIN",
        adoptionMode: "NO_SESSION",
      },
      {
        bindings: [
          binding({
            id: "binding-compuesto",
            materia: "ACUERDO_SIN_SESION",
            template_id: "tpl-compuesto",
            organo_tipo: "JUNTA_GENERAL_O_CONSEJO",
            adoption_mode: "NO_SESSION",
          }),
        ],
        templates: [
          template({
            id: "tpl-compuesto",
            materia_acuerdo: "ACUERDO_SIN_SESION",
            organo_tipo: "JUNTA_GENERAL_O_CONSEJO",
            adoption_mode: "NO_SESSION",
          }),
        ],
        effectiveRule: { matter_code: "ACUERDO_SIN_SESION", operational_status: "OK" },
      },
    );

    expect(entry.registry_status).toBe("PARCIAL");
    expect(entry.binding_id).toBe("binding-compuesto");
  });

  it("distingue borrador pendiente de ausencia total de cobertura", () => {
    const draft = resolveMatterRegistryFromRows(
      { tenantId, materia: "FUSION", organoTipo: "JUNTA_GENERAL" },
      {
        bindings: [],
        templates: [template({ id: "tpl-fusion-draft", materia_acuerdo: "FUSION", estado: "BORRADOR" })],
        effectiveRule: { matter_code: "FUSION", operational_status: "INCOMPLETO" },
      },
    );
    const missing = resolveMatterRegistryFromRows(
      { tenantId, materia: "ESCISION", organoTipo: "JUNTA_GENERAL" },
      {
        bindings: [],
        templates: [],
        effectiveRule: null,
      },
    );

    expect(draft.registry_status).toBe("BORRADOR_PENDIENTE");
    expect(draft.template_id).toBe("tpl-fusion-draft");
    expect(missing.registry_status).toBe("SIN_COBERTURA");
  });

  it("incluye contexto de rule pack activo coherente con el órgano resuelto", () => {
    const entry = resolveMatterRegistryFromRows(
      {
        tenantId,
        materia: "CESE_CONSEJERO",
        organoTipo: "CONSEJO_ADMIN",
        adoptionMode: "MEETING",
      },
      {
        bindings: [binding({ id: "binding-consejo", template_id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN" })],
        templates: [template({ id: "tpl-consejo", organo_tipo: "CONSEJO_ADMIN" })],
        rulePacks: [
          rulePack({ id: "rp-junta", organo_tipo: "JUNTA_GENERAL", descripcion: "CESE_CONSEJERO Junta" }),
          rulePack({ id: "rp-consejo", organo_tipo: "CONSEJO_ADMIN", descripcion: "CESE_CONSEJERO Consejo" }),
        ],
        effectiveRule: { matter_code: "CESE_CONSEJERO", operational_status: "OK" },
      },
    );

    expect(entry.rule_pack_id).toBe("rp-consejo");
    expect(entry.rule_pack_name).toBe("CESE_CONSEJERO Consejo");
    expect(entry.rule_pack_version_label).toBe("1.1.0");
  });
});
