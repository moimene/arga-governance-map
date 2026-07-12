import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  activeTemplateBindingMatters,
  buildTemplateBindingMutationInput,
  buildTemplateTransitionMutationInput,
  buildTemplateVersionComparison,
  canonicalBindingTipoSocial,
  findExactCurrentTemplate,
  hasEffectiveTemplateBinding,
  normalizeApprovalChecklist,
  normalizeTemplateEditableFields,
  normalizeTemplateVariables,
  resolveTemplateMatterContext,
  templateAppliesToSocialType,
  templateAvailabilityPresentation,
} from "../template-library-ux";

function template(patch: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "template",
    tenant_id: "tenant",
    tipo: "MODELO_ACUERDO",
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comité Legal",
    fecha_aprobacion: "2026-07-11",
    contenido_template: null,
    capa1_inmutable: "Primera línea\nSegunda línea",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: "Art. 160 LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: "MEETING",
    organo_tipo: "JUNTA_GENERAL",
    tipo_social: null,
    contrato_variables_version: "1.1",
    created_at: "2026-07-11T00:00:00.000Z",
    materia_acuerdo: "AUMENTO_CAPITAL",
    approval_checklist: null,
    version_history: null,
    ...patch,
  };
}

describe("template-library-ux", () => {
  it("presenta disponibilidad sin equiparar versiones transitorias con una vigente", () => {
    const active = templateAvailabilityPresentation(template());
    const approved = templateAvailabilityPresentation(
      template({ estado: "APROBADA", version: "1.1.0" }),
    );
    const reviewed = templateAvailabilityPresentation(
      template({ estado: "REVISADA", materia_acuerdo: "AUTORIZACION_GARANTIA" }),
    );
    const blocked = templateAvailabilityPresentation(
      template({
        estado: "BORRADOR",
        tipo: "TIPO_SIN_PLAN",
        materia_acuerdo: null,
        aprobada_por: null,
        fecha_aprobacion: null,
      }),
    );
    const historical = templateAvailabilityPresentation(template({ estado: "ARCHIVADA" }));

    expect(active).toMatchObject({ canUse: true, isCurrent: true, tone: "current" });
    expect(approved).toMatchObject({ canUse: true, isCurrent: false, tone: "preparation" });
    expect(reviewed).toMatchObject({ canUse: true, isCurrent: false, tone: "preparation" });
    expect(blocked).toMatchObject({ canUse: false, isCurrent: false, tone: "blocked" });
    expect(historical).toMatchObject({ canUse: false, isCurrent: false, tone: "historical" });
  });

  it("normaliza checklist de objetos y strings sin convertir el legado en fallo", () => {
    expect(
      normalizeApprovalChecklist([
        "CAPA1_OPERATIVA",
        { check: "Referencia legal contrastada", passed: false },
        "",
      ]),
    ).toEqual([
      { check: "Capa1 operativa", passed: true },
      { check: "Referencia legal contrastada", passed: false },
    ]);
  });

  it("normaliza los dos contratos legacy de Capa 2 y Capa 3", () => {
    expect(
      normalizeTemplateVariables([
        { variable: "sociedad", fuente: "entities.legal_name", condicion: "SIEMPRE" },
        { name: "fecha", source: "meetings.date", condition: "SI_EXISTE" },
      ]),
    ).toEqual([
      { name: "fecha", source: "meetings.date", condition: "SI_EXISTE", display: "" },
      { name: "sociedad", source: "entities.legal_name", condition: "SIEMPRE", display: "" },
    ]);

    expect(
      normalizeTemplateVariables([
        { name: "presidente", source: "governing_bodies.president", display: "Presidencia" },
      ]),
    ).toEqual([
      {
        name: "presidente",
        source: "governing_bodies.president",
        condition: "",
        display: "Presidencia",
      },
    ]);
    expect(
      normalizeTemplateEditableFields([
        { field: "observaciones", required: true, hint: "Detalle del acuerdo" },
      ]),
    ).toEqual([
      {
        name: "observaciones",
        required: true,
        description: "Detalle del acuerdo",
        type: "",
        label: "observaciones",
      },
    ]);

    expect(
      normalizeTemplateEditableFields([
        { campo: "importe", obligatoriedad: "OBLIGATORIO", tipo: "currency" },
        { name: "comentario", required: false, type: "textarea", description: "Opcional" },
      ]),
    ).toEqual([
      {
        name: "comentario",
        required: false,
        description: "Opcional",
        type: "textarea",
        label: "comentario",
      },
      {
        name: "importe",
        required: true,
        description: "",
        type: "currency",
        label: "importe",
      },
    ]);
  });

  it("compara versiones idénticas tras normalizar shapes legacy", () => {
    const historical = template({
      id: "historical",
      estado: "ARCHIVADA",
      approval_checklist: ["CAPA1_OPERATIVA"],
      capa2_variables: [
        { variable: "sociedad", fuente: "entities.legal_name", condicion: "SIEMPRE" },
      ],
    });
    const current = template({
      id: "current",
      approval_checklist: [{ check: "Capa1 operativa", passed: true }],
      capa2_variables: [
        { variable: "sociedad", fuente: "entities.legal_name", condicion: "SIEMPRE" },
      ],
    });

    const comparison = buildTemplateVersionComparison(historical, current);
    expect(comparison.identical).toBe(true);
    expect(comparison.summary).toMatchObject({
      changedSections: 0,
      addedLines: 0,
      removedLines: 0,
    });
  });

  it("produce un diff por líneas y un resumen de secciones modificadas", () => {
    const comparison = buildTemplateVersionComparison(
      template({
        id: "historical",
        estado: "ARCHIVADA",
        capa1_inmutable: "Común\nTexto anterior\nCierre",
        referencia_legal: "Art. 160 LSC",
      }),
      template({
        id: "current",
        version: "1.1.0",
        capa1_inmutable: "Común\nTexto vigente\nCierre\nNueva cautela",
        referencia_legal: "Arts. 160 y 308 LSC",
      }),
    );

    expect(comparison.identical).toBe(false);
    expect(comparison.summary.changedSections).toBe(2);
    expect(comparison.summary.labels).toEqual(["Texto protegido", "Referencia legal"]);
    expect(comparison.summary.addedLines).toBe(2);
    expect(comparison.summary.removedLines).toBe(1);
    expect(comparison.lineDiff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "removed", text: "Texto anterior", oldLine: 2 }),
        expect.objectContaining({ kind: "added", text: "Texto vigente", newLine: 2 }),
        expect.objectContaining({ kind: "added", text: "Nueva cautela", newLine: 4 }),
      ]),
    );
  });

  it("solo resuelve una sustituta ACTIVA cuando la identidad exacta es única", () => {
    const historical = template({ id: "historical", estado: "ARCHIVADA" });
    const exact = template({ id: "exact", version: "1.1.0" });
    const otherOrgan = template({ id: "other", organo_tipo: "CONSEJO_ADMIN" });

    expect(findExactCurrentTemplate(historical, [historical, exact, otherOrgan])).toBe(exact);
    expect(findExactCurrentTemplate(historical, [historical, otherOrgan])).toBeNull();
    expect(
      findExactCurrentTemplate(historical, [
        historical,
        exact,
        template({ id: "ambiguous", version: "1.2.0" }),
      ]),
    ).toBeNull();
  });

  it("canonicaliza tipos sociales de binding sin persistir formas jurídicas", () => {
    expect(canonicalBindingTipoSocial("sa")).toBe("SA");
    expect(canonicalBindingTipoSocial("SLU")).toBe("SLU");
    expect(canonicalBindingTipoSocial(null)).toBe("ANY");
    expect(canonicalBindingTipoSocial("S.A.")).toBe("ANY");
  });

  it("mantiene las genéricas y filtra futuras variantes por tipo social", () => {
    expect(templateAppliesToSocialType(template({ tipo_social: null }), "SA")).toBe(true);
    expect(templateAppliesToSocialType(template({ tipo_social: "SA" }), "SA")).toBe(true);
    expect(templateAppliesToSocialType(template({ tipo_social: "SL" }), "SA")).toBe(false);
    expect(templateAppliesToSocialType(template({ tipo_social: "SA" }), null)).toBe(false);
  });

  it("detecta binding efectivo por plantilla, materia, ámbito y comodines válidos", () => {
    const selected = template({ id: "current", tipo_social: null });
    const baseBinding = {
      active: true,
      materia: "AMPLIACION_CAPITAL",
      organo_tipo: "JUNTA_GENERAL",
      tipo_social: "ANY",
      jurisdiccion: "ES",
      adoption_mode: "MEETING",
      doc_type: "MODELO_ACUERDO",
      template_id: "current",
    };
    const criteria = {
      template: selected,
      materia: "AUMENTO_CAPITAL",
      jurisdiccion: "ES",
      tipoSocial: "SA",
    };

    expect(hasEffectiveTemplateBinding([baseBinding], criteria)).toBe(true);
    expect(
      hasEffectiveTemplateBinding([{ ...baseBinding, organo_tipo: "JUNTA" }], criteria),
    ).toBe(true);
    expect(
      hasEffectiveTemplateBinding([{ ...baseBinding, tipo_social: "SA" }], criteria),
    ).toBe(true);
    expect(
      hasEffectiveTemplateBinding([{ ...baseBinding, tipo_social: "SL" }], criteria),
    ).toBe(false);
    expect(
      hasEffectiveTemplateBinding([{ ...baseBinding, tipo_social: "S.A." }], criteria),
    ).toBe(false);
    expect(
      hasEffectiveTemplateBinding([{ ...baseBinding, active: false }], criteria),
    ).toBe(false);
  });

  it("conserva una materia explícita vinculada y no inventa un binding compuesto legacy", () => {
    const bindings = [
      { active: true, template_id: "fusion", materia: "FUSION" },
      { active: true, template_id: "fusion", materia: "ESCISION" },
      { active: true, template_id: "fusion", materia: "CESION_GLOBAL_ACTIVO" },
      { active: false, template_id: "fusion", materia: "FUSION_ESCISION" },
    ];
    const boundMatters = activeTemplateBindingMatters(bindings, "fusion");
    const knownMatters = ["FUSION", "ESCISION"];

    expect(boundMatters).toEqual(["FUSION", "ESCISION", "CESION_GLOBAL_ACTIVO"]);
    expect(
      resolveTemplateMatterContext({
        requestedMatter: "FUSION",
        templateMatter: "FUSION_ESCISION",
        boundMatters,
        knownMatters,
      }),
    ).toBe("FUSION");
    expect(
      resolveTemplateMatterContext({
        templateMatter: "FUSION_ESCISION",
        boundMatters,
        knownMatters,
      }),
    ).toBe("");
    expect(
      resolveTemplateMatterContext({
        requestedMatter: "DIVIDENDO_A_CUENTA",
        templateMatter: "FUSION_ESCISION",
        boundMatters,
        knownMatters: [...knownMatters, "DIVIDENDO_A_CUENTA"],
      }),
    ).toBe("");
  });

  it("solo usa como fallback una materia propia registrada e inequívoca", () => {
    expect(
      resolveTemplateMatterContext({
        templateMatter: "AUMENTO_CAPITAL",
        boundMatters: [],
        knownMatters: ["AUMENTO_CAPITAL"],
      }),
    ).toBe("AUMENTO_CAPITAL");
    expect(
      resolveTemplateMatterContext({
        templateMatter: "FUSION_ESCISION",
        boundMatters: ["FUSION"],
        knownMatters: ["FUSION"],
      }),
    ).toBe("FUSION");
  });

  it("ensambla aprobación con actor autenticado distinto del aprobador y conserva la fecha", () => {
    expect(
      buildTemplateTransitionMutationInput({
        templateId: "template",
        nextState: "APROBADA",
        actor: "admin@arga-seguros.com",
        aprobadaPor: "Comité Legal ARGA",
        fechaAprobacion: "2026-07-11",
      }),
    ).toEqual({
      id: "template",
      nuevo_estado: "APROBADA",
      motivo: undefined,
      ackWarnings: undefined,
      actor: "admin@arga-seguros.com",
      aprobadaPor: "Comité Legal ARGA",
      fechaAprobacion: "2026-07-11",
    });
  });

  it("ensambla binding SA canónico y devuelve null si ya es efectivo", () => {
    const selected = template({ id: "binding-template" });
    const input = {
      template: selected,
      bindings: [],
      materia: "AMPLIACION_CAPITAL",
      entityTipoSocial: "SA",
      jurisdiction: "ES",
      userRole: "admin" as const,
    };
    expect(buildTemplateBindingMutationInput(input)).toMatchObject({
      materia: "AUMENTO_CAPITAL",
      tipoSocial: "SA",
      templateId: "binding-template",
      userRole: "admin",
    });
    expect(
      buildTemplateBindingMutationInput({
        ...input,
        bindings: [
          {
            active: true,
            materia: "AUMENTO_CAPITAL",
            organo_tipo: "JUNTA_GENERAL",
            tipo_social: "SA",
            jurisdiccion: "ES",
            adoption_mode: "MEETING",
            doc_type: "MODELO_ACUERDO",
            template_id: "binding-template",
          },
        ],
      }),
    ).toBeNull();
  });
});
