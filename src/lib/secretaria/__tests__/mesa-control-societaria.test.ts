import { describe, expect, it } from "vitest";
import {
  adoptionModeBusinessLabel,
  buildFeatureFlagDecision,
  buildMateriaCatalogRows,
  buildNormativeAuditEvent,
  buildNormativeHistoryEntries,
  buildNormativeMatrixRows,
  buildNormativeReadModelContracts,
  buildNormativeRolloutPlan,
  buildNormativeTelemetryEvent,
  buildP1A11yI18nContract,
  buildP1LegacyBackfillPlan,
  buildP1OperationalKpiContract,
  buildP1PerformanceBudgetContract,
  detectConflictOfLaws,
  displaySocietyLegalForm,
  resolveSocietySocialTypeForRules,
  buildTemplateDocumentBindings,
  canPerformNormativeAction,
  documentRequirements,
  evaluateTemplateReadiness,
  formalizationLabel,
  getMateriaFunctionalGroup,
  isInformativeMatter,
  matterComplexityLabel,
  normativeRoleFromAppRole,
  matterClassBusinessLabel,
  quorumLabel,
  validateNormativeOverrideDraft,
} from "@/lib/secretaria/mesa-control-societaria";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

const aumentoCapital: MateriaCatalogRow = {
  materia: "AUMENTO_CAPITAL",
  materia_label_es: "Aumento de capital social",
  requires_notary: true,
  requires_registry: true,
  inscribable: true,
  matter_class: "ESTATUTARIA",
  min_majority_code: "REFORZADA_2_3",
  publication_required: false,
  plazo_inscripcion_dias: 30,
  referencia_legal: "arts. 295-310 LSC",
};

const cuentas: MateriaCatalogRow = {
  materia: "APROBACION_CUENTAS",
  materia_label_es: "Aprobación de cuentas anuales",
  requires_notary: false,
  requires_registry: false,
  inscribable: false,
  matter_class: "ORDINARIA",
  min_majority_code: "SIMPLE",
  publication_required: false,
  plazo_inscripcion_dias: null,
  referencia_legal: "art. 253 LSC",
};

function plantilla(partial: Partial<PlantillaProtegidaRow>): PlantillaProtegidaRow {
  return {
    id: partial.id ?? crypto.randomUUID(),
    tenant_id: "tenant",
    tipo: partial.tipo ?? "MODELO_ACUERDO",
    materia: partial.materia ?? null,
    jurisdiccion: partial.jurisdiccion ?? "ES",
    version: partial.version ?? "1.0.0",
    estado: partial.estado ?? "ACTIVA",
    aprobada_por: partial.aprobada_por ?? "Comité Legal",
    fecha_aprobacion: partial.fecha_aprobacion ?? "2026-05-15",
    contenido_template: null,
    capa1_inmutable: null,
    capa2_variables: partial.capa2_variables ?? [{ variable: "sociedad", fuente: "entities.name", condicion: "required" }],
    capa3_editables: partial.capa3_editables ?? [{ campo: "area_responsable", obligatoriedad: "OBLIGATORIO" }],
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: false,
    adoption_mode: partial.adoption_mode ?? null,
    organo_tipo: partial.organo_tipo ?? null,
    tipo_social: partial.tipo_social ?? null,
    contrato_variables_version: null,
    created_at: "2026-05-15",
    materia_acuerdo: partial.materia_acuerdo ?? partial.materia ?? null,
    approval_checklist: null,
    version_history: null,
  };
}

describe("mesa-control-societaria", () => {
  it("agrupa materias por naturaleza funcional y añade materias informativas", () => {
    const rows = buildMateriaCatalogRows([aumentoCapital, cuentas]);

    expect(getMateriaFunctionalGroup("APROBACION_CUENTAS").title).toBe("Cuentas anuales, resultado y auditoría");
    expect(getMateriaFunctionalGroup("AUMENTO_CAPITAL").title).toBe("Capital y financiación");
    expect(rows.some((row) => row.materia === "SEGUIMIENTO_PLAN_NEGOCIO")).toBe(true);
  });

  it.each([
    "APROBACION_PRESUPUESTO",
    "APROBACION_PRESUPUESTOS",
    "ACUERDO_CONVOCATORIA_JUNTA",
    "APROBACION_PLAN_NEGOCIO",
  ])("%s sigue siendo decisoria aunque comparta grupo funcional con seguimiento", (materia) => {
    const row: MateriaCatalogRow = {
      ...cuentas,
      materia,
      materia_label_es: materia,
    };

    expect(isInformativeMatter(materia)).toBe(false);
    expect(matterComplexityLabel(row)).not.toBe("Informativa");
    expect(quorumLabel(row, "SA")).not.toContain("No aplica");
    expect(documentRequirements(row)).toEqual(["Acta"]);
    expect(formalizationLabel(row)).toBe("Archivo societario interno");
    expect(evaluateTemplateReadiness([], { materia: row }).openingStatus).toBe("blocked");
  });

  it.each([
    "INFORME_GESTION",
    "SEGUIMIENTO_PLAN_NEGOCIO",
    "ESTADO_CUMPLIMIENTO_NORMATIVO",
  ])("%s conserva la naturaleza informativa explícita", (materia) => {
    expect(isInformativeMatter(materia)).toBe(true);
  });

  it("proyecta matriz materia × requisitos con mayoría, documentos y formalización", () => {
    const [row] = buildNormativeMatrixRows([aumentoCapital], { tipoSocial: "SA" });

    expect(row.label).toBe("Aumento de capital social");
    expect(row.mayoria).toContain("dos tercios");
    expect(row.documentos).toContain("Escritura pública");
    expect(row.registro).toBe("Inscripción requerida");
    expect(row.plazos).toContain("30 días");
  });

  it("permite elevar requisitos y bloquea rebajar mínimos legales", () => {
    const elevated = validateNormativeOverrideDraft({
      tipoSocial: "SA",
      estatutosModelados: true,
      pactosModelados: true,
      statutoryMajorityPct: "75",
      sourceReference: "Artículo 15 estatutos",
      sourceJustification: "Mayoría estatutaria reforzada",
    });
    const lowered = validateNormativeOverrideDraft({
      tipoSocial: "SA",
      estatutosModelados: true,
      pactosModelados: true,
      statutoryMajorityPct: "51",
      sourceReference: "Artículo 15 estatutos",
      sourceJustification: "Mayoría inferior",
    });

    expect(elevated.ok).toBe(true);
    expect(lowered.ok).toBe(false);
    expect(lowered.issues.some((issue) => issue.message.includes("no puede rebajar"))).toBe(true);
  });

  it("vincula plantillas por fase documental y expone razón de selección", () => {
    const bindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "modelo",
          tipo: "MODELO_ACUERDO",
          materia: "AUMENTO_CAPITAL",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "acta",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
        }),
        plantilla({ id: "cert", tipo: "CERTIFICACION", organo_tipo: "DERIVADO_DEL_ACTO" }),
      ],
      { materia: "AUMENTO_CAPITAL", jurisdiction: "ES", organoTipo: "JUNTA_GENERAL" },
    );

    expect(bindings.map((binding) => binding.stage)).toContain("Modelo de acuerdo");
    expect(bindings.map((binding) => binding.stage)).toContain("Acta");
    expect(bindings.find((binding) => binding.template.id === "modelo")?.selectionReason).toContain("materia compatible");
    expect(bindings.every((binding) => binding.statusLabel.length > 0)).toBe(true);
  });

  // B15 Lote 4: la vinculación explícita del usuario (materia_template_binding)
  // prevalece sobre el matching de metadatos y se etiqueta como tal.
  it("prioriza la vinculación explícita y la señala en la razón de selección", () => {
    const plantillas = [
      plantilla({
        id: "modelo-metadatos",
        tipo: "MODELO_ACUERDO",
        materia: "AUMENTO_CAPITAL",
        organo_tipo: "JUNTA_GENERAL",
        adoption_mode: "MEETING",
        version: "2.0.0",
      }),
      plantilla({
        id: "modelo-vinculado",
        tipo: "MODELO_ACUERDO",
        materia: "AUMENTO_CAPITAL",
        organo_tipo: "JUNTA_GENERAL",
        adoption_mode: "MEETING",
        version: "1.0.0",
      }),
    ];
    const criteria = { materia: "AUMENTO_CAPITAL", jurisdiction: "ES", organoTipo: "JUNTA_GENERAL" };

    const sinVinculacion = buildTemplateDocumentBindings(plantillas, criteria);
    const modelosSinVinculacion = sinVinculacion.filter((b) => b.stage === "Modelo de acuerdo");
    expect(modelosSinVinculacion[0]?.template.id).toBe("modelo-metadatos");
    expect(modelosSinVinculacion.every((b) => !b.explicitAssignment)).toBe(true);

    const conVinculacion = buildTemplateDocumentBindings(plantillas, {
      ...criteria,
      explicitTemplateIds: ["modelo-vinculado"],
    });
    const modelosConVinculacion = conVinculacion.filter((b) => b.stage === "Modelo de acuerdo");
    expect(modelosConVinculacion[0]?.template.id).toBe("modelo-vinculado");
    expect(modelosConVinculacion[0]?.explicitAssignment).toBe(true);
    expect(modelosConVinculacion[0]?.selectionReason).toContain("vinculación explícita");
    expect(modelosConVinculacion[1]?.explicitAssignment).toBe(false);
  });

  it("conserva los tres meta-órganos transversales sin relajar actas adoptables", () => {
    const bindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "convocatoria-organo-admin",
          tipo: "CONVOCATORIA",
          organo_tipo: "ORGANO_ADMIN",
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "informe-soporte",
          tipo: "INFORME_PRECEPTIVO",
          organo_tipo: "SOPORTE_INTERNO",
          adoption_mode: null,
        }),
        plantilla({
          id: "certificacion-derivada",
          tipo: "CERTIFICACION",
          organo_tipo: "DERIVADO_DEL_ACTO",
          adoption_mode: null,
        }),
        plantilla({
          id: "acta-derivada-no-transversal",
          tipo: "ACTA_SESION",
          organo_tipo: "DERIVADO_DEL_ACTO",
          adoption_mode: "MEETING",
        }),
      ],
      {
        materia: "AUMENTO_CAPITAL",
        jurisdiction: "ES",
        organoTipo: "JUNTA_GENERAL",
        formaAdopcion: "MEETING",
        tipoSocial: "SA",
      },
    );

    expect(bindings.map((binding) => binding.template.id)).toEqual([
      "informe-soporte",
      "convocatoria-organo-admin",
      "certificacion-derivada",
    ]);

    const consejoBindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "convocatoria-organo-admin",
          tipo: "CONVOCATORIA",
          organo_tipo: "ORGANO_ADMIN",
          adoption_mode: "MEETING",
        }),
      ],
      {
        materia: "FORMULACION_CUENTAS",
        jurisdiction: "ES",
        organoTipo: "CONSEJO_ADMIN",
        formaAdopcion: "MEETING",
        tipoSocial: "SA",
      },
    );
    expect(consejoBindings).toEqual([]);
  });

  it("aplica órgano, adopción y tipo social también a plantillas transversales", () => {
    const bindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "modelo-compatible",
          tipo: "MODELO_ACUERDO",
          materia: "AUMENTO_CAPITAL",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
          tipo_social: "SA",
        }),
        plantilla({
          id: "modelo-sin-materia",
          tipo: "MODELO_ACUERDO",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "acta-organo-null",
          tipo: "ACTA_SESION",
          organo_tipo: null,
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "acta-organo-derivado",
          tipo: "ACTA_SESION",
          organo_tipo: "DERIVADO_DEL_ACTO",
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "acta-adopcion-null",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: null,
        }),
        plantilla({
          id: "acta-adopcion-any",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "ANY",
        }),
        plantilla({
          id: "acta-otro-tipo-social",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
          tipo_social: "SL",
        }),
        plantilla({
          id: "acta-todos",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: "MEETING",
          tipo_social: null,
        }),
        plantilla({
          id: "cert-adopcion-no-aplica",
          tipo: "CERTIFICACION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: null,
        }),
        plantilla({
          id: "cert-otro-organo",
          tipo: "CERTIFICACION",
          organo_tipo: "CONSEJO_ADMIN",
          adoption_mode: null,
        }),
      ],
      {
        materia: "AUMENTO_CAPITAL",
        jurisdiction: "ES",
        organoTipo: "JUNTA_GENERAL",
        formaAdopcion: "MEETING",
        tipoSocial: "SA",
      },
    );

    expect(bindings.map((binding) => binding.template.id)).toEqual([
      "modelo-compatible",
      "acta-todos",
      "cert-adopcion-no-aplica",
    ]);
    expect(
      bindings.find((binding) => binding.template.id === "cert-adopcion-no-aplica")
        ?.metadataComplete,
    ).toBe(true);
    expect(
      bindings.find((binding) => binding.template.id === "modelo-compatible")
        ?.metadataComplete,
    ).toBe(true);
  });

  it("acepta arrays de órganos y modos sin degradar los criterios escalares", () => {
    const candidates = [
      plantilla({
        id: "junta-meeting",
        tipo: "MODELO_ACUERDO",
        materia: "AUMENTO_CAPITAL",
        organo_tipo: "JUNTA_GENERAL",
        adoption_mode: "MEETING",
      }),
      plantilla({
        id: "consejo-no-session",
        tipo: "MODELO_ACUERDO",
        materia: "AUMENTO_CAPITAL",
        organo_tipo: "CONSEJO_ADMIN",
        adoption_mode: "NO_SESSION",
      }),
      plantilla({
        id: "socio-unico",
        tipo: "MODELO_ACUERDO",
        materia: "AUMENTO_CAPITAL",
        organo_tipo: "SOCIO_UNICO",
        adoption_mode: "UNIPERSONAL_SOCIO",
      }),
    ];

    expect(
      buildTemplateDocumentBindings(candidates, {
        materia: "AUMENTO_CAPITAL",
        organoTipo: ["JUNTA_GENERAL", "CONSEJO"],
        formaAdopcion: ["MEETING", "NO_SESSION"],
      }).map((binding) => binding.template.id),
    ).toEqual(["junta-meeting", "consejo-no-session"]);
    expect(
      buildTemplateDocumentBindings(candidates, {
        materia: "AUMENTO_CAPITAL",
        organoTipo: "JUNTA_GENERAL",
        formaAdopcion: "MEETING",
      }).map((binding) => binding.template.id),
    ).toEqual(["junta-meeting"]);
  });

  it("vincula modelos aunque catálogo y regla usen alias equivalentes", () => {
    const bindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "presupuesto",
          tipo: "MODELO_ACUERDO",
          materia: "APROBACION_PRESUPUESTOS",
          organo_tipo: "CONSEJO_ADMIN",
          adoption_mode: "MEETING",
        }),
      ],
      {
        materia: "APROBACION_PRESUPUESTO",
        organoTipo: "CONSEJO",
        formaAdopcion: "MEETING",
      },
    );
    expect(bindings.map((binding) => binding.template.id)).toEqual(["presupuesto"]);
  });

  it("calcula metadataComplete con la política del tipo documental", () => {
    const bindings = buildTemplateDocumentBindings(
      [
        plantilla({
          id: "acta-sin-organo",
          tipo: "ACTA_SESION",
          organo_tipo: null,
          adoption_mode: "MEETING",
        }),
        plantilla({
          id: "acta-sin-adopcion",
          tipo: "ACTA_SESION",
          organo_tipo: "JUNTA_GENERAL",
          adoption_mode: null,
        }),
        plantilla({
          id: "cert-completa",
          tipo: "CERTIFICACION",
          organo_tipo: "DERIVADO_DEL_ACTO",
          adoption_mode: null,
        }),
      ],
      { materia: "AUMENTO_CAPITAL" },
    );

    expect(bindings.find((binding) => binding.template.id === "acta-sin-organo")?.metadataComplete).toBe(false);
    expect(bindings.find((binding) => binding.template.id === "acta-sin-adopcion")?.metadataComplete).toBe(false);
    expect(bindings.find((binding) => binding.template.id === "cert-completa")?.metadataComplete).toBe(true);
  });

  it("mantiene nomenclatura jurisdiccional y alerta si LSC se aplica a sociedad alemana", () => {
    expect(displaySocietyLegalForm({ jurisdiction: "DE", legalForm: "AG", tipoSocial: "SA" })).toBe("AG");

    const conflict = detectConflictOfLaws({
      jurisdiction: "DE",
      legalForm: "AG",
      tipoSocial: "SA",
      appliedReferences: ["arts. 295-310 LSC"],
    });

    expect(conflict.conflict_of_laws_flag).toBe(true);
    expect(conflict.expectedLawLabel).toContain("alemán");
    expect(conflict.appliedLawLabel).toContain("Sociedades de Capital");
  });

  it("no resuelve una rama SA/SL cuando tipo social y forma jurídica españolas se contradicen", () => {
    const resolution = resolveSocietySocialTypeForRules({
      jurisdiction: "ES",
      tipoSocial: "SA",
      legalForm: "S.L.",
    });
    expect(resolution.value).toBeNull();
    expect(resolution.conflict).toBe(true);
    expect(resolution.explanation).toContain("familias distintas");

    const conflict = detectConflictOfLaws({
      jurisdiction: "ES",
      tipoSocial: "SA",
      legalForm: "S.L.",
      appliedReferences: ["art. 86 LSC"],
    });
    expect(conflict.conflict_of_laws_flag).toBe(true);
    expect(conflict.conflict_kind).toBe("social_form");

    expect(
      resolveSocietySocialTypeForRules({ jurisdiction: "ES", tipoSocial: "SL", legalForm: "S.L." }),
    ).toMatchObject({ value: "SL", conflict: false });
  });

  it("bloquea inicio de expediente si faltan plantillas mínimas", () => {
    const readiness = evaluateTemplateReadiness(
      buildTemplateDocumentBindings(
        [plantilla({ id: "cert", tipo: "CERTIFICACION" })],
        { materia: "AUMENTO_CAPITAL", jurisdiction: "ES" },
      ),
    );

    expect(readiness.canStartCase).toBe(false);
    expect(readiness.blockingMessage).toContain("No se puede iniciar la adopción");
    expect(readiness.items.some((item) => item.stage === "Acta" && item.blocking)).toBe(true);
  });

  it("una plantilla candidata no satisface una fase crítica de apertura", () => {
    const readiness = evaluateTemplateReadiness(
      buildTemplateDocumentBindings(
        [
          plantilla({
            id: "modelo-candidato",
            tipo: "MODELO_ACUERDO",
            materia: "AUMENTO_CAPITAL",
            estado: "REVISADA",
          }),
          plantilla({ id: "acta-activa", tipo: "ACTA_SESION" }),
          plantilla({ id: "cert-activa", tipo: "CERTIFICACION" }),
        ],
        { materia: "AUMENTO_CAPITAL", jurisdiction: "ES" },
      ),
      { materia: aumentoCapital },
    );

    expect(readiness.openingStatus).toBe("blocked");
    expect(readiness.canStartCase).toBe(false);
    expect(readiness.items.find((item) => item.stage === "Modelo de acuerdo")).toMatchObject({
      status: "pendiente_revision",
      criticality: "apertura",
      blocking: true,
    });
    expect(
      readiness.items.find((item) => item.stage === "Modelo de acuerdo")?.consequence,
    ).toContain("candidata");
  });

  it("una materia informativa no abre expediente y exige constancia de cierre", () => {
    const readiness = evaluateTemplateReadiness([], {
      materia: {
        materia: "SEGUIMIENTO_PLAN_NEGOCIO",
        requires_notary: false,
        requires_registry: false,
        inscribable: false,
      },
    });

    expect(readiness).toMatchObject({
      openingStatus: "not_applicable",
      canStartCase: false,
      blockingMessage: null,
      openingMessage: "No aplica abrir expediente · dejar constancia en acta.",
    });
    expect(readiness.items.find((item) => item.stage === "Acta")).toMatchObject({
      status: "faltante",
      criticality: "cierre",
      blocking: false,
    });
    expect(readiness.items.find((item) => item.stage === "Modelo de acuerdo")).toMatchObject({
      status: "no_aplica",
      criticality: "no_aplica",
      blocking: false,
    });
  });

  it("una restricción de tipo social marca la materia como no aplicable sin habilitar expediente", () => {
    const reason = "No aplica a S.L.; la regla versionada limita esta materia a S.A.";
    const readiness = evaluateTemplateReadiness([], {
      materia: cuentas,
      notApplicableReason: reason,
    });

    expect(readiness).toMatchObject({
      canStartCase: false,
      openingStatus: "not_applicable",
      openingMessage: reason,
    });
    expect(readiness.items.every((item) => item.criticality === "no_aplica")).toBe(true);
  });

  it("una materia estructural exige certificación activa para abrir si se formaliza", () => {
    const fusion: MateriaCatalogRow = {
      ...aumentoCapital,
      materia: "FUSION",
      materia_label_es: "Fusión",
      matter_class: "ESTRUCTURAL",
    };
    const readiness = evaluateTemplateReadiness(
      buildTemplateDocumentBindings(
        [
          plantilla({ id: "modelo-fusion", tipo: "MODELO_ACUERDO", materia: "FUSION" }),
          plantilla({ id: "acta-fusion", tipo: "ACTA_SESION" }),
        ],
        { materia: "FUSION", jurisdiction: "ES" },
      ),
      { materia: fusion },
    );

    expect(readiness.openingStatus).toBe("blocked");
    expect(readiness.items.find((item) => item.stage === "Certificación")).toMatchObject({
      status: "faltante",
      criticality: "apertura",
      blocking: true,
    });
  });

  it("gobierna permisos operativos por rol sin exponer controles técnicos", () => {
    expect(normativeRoleFromAppRole("ADMIN_TENANT")).toBe("admin");
    expect(normativeRoleFromAppRole("COMPLIANCE")).toBe("legal_ops");
    expect(normativeRoleFromAppRole("SECRETARIO")).toBe("editor");
    expect(normativeRoleFromAppRole("CONSEJERO")).toBe("viewer");

    expect(canPerformNormativeAction("editor", "assign_template").allowed).toBe(true);
    expect(canPerformNormativeAction("viewer", "assign_template")).toMatchObject({
      allowed: false,
      ctaLabel: "Solicitar edición",
    });
    expect(canPerformNormativeAction("editor", "resolve_conflict").allowed).toBe(false);
    expect(canPerformNormativeAction("legal_ops", "resolve_conflict").allowed).toBe(true);
  });

  it("prepara auditoría, historial y rollout del mantenimiento normativo", () => {
    const event = buildNormativeAuditEvent({
      action: "statute_version_published",
      societyId: "soc-1",
      matter: "AUMENTO_CAPITAL",
      userRole: "legal_ops",
      before: { status: "INCOMPLETO" },
      after: { status: "OK" },
      durationMs: 1200,
    });
    const history = buildNormativeHistoryEntries({
      actor: "Legal Ops",
      effectiveAt: "2026-05-15T10:00:00Z",
      sources: [{ layer: "ESTATUTOS", label: "Estatutos v3", reference: "Art. 15", version: "v3", status: "ACTIVE" }],
    });
    const rollout = buildNormativeRolloutPlan();

    expect(event).toMatchObject({
      action: "statute_version_published",
      societyId: "soc-1",
      userRole: "legal_ops",
      durationMs: 1200,
    });
    expect(history[0].action).toBe("Fuente validada");
    expect(history[0].comment).toContain("Art. 15");
    expect(rollout.flags.ff_ruleset_wizard).toBe(true);
    expect(rollout.cohorts.map((cohort) => cohort.percentage)).toEqual([10, 50, 100]);
    expect(rollout.killSwitch).toContain("ff_effective_rule_edit");
  });

  it("expone feature flags, telemetría y contrato de read model del carril P1", () => {
    const disabledEdit = buildFeatureFlagDecision("ff_effective_rule_edit");
    const enabledWizard = buildFeatureFlagDecision("ff_ruleset_wizard");
    const event = buildNormativeAuditEvent({
      action: "expediente_blocked",
      societyId: "soc-1",
      matter: "AUMENTO_CAPITAL",
      userRole: "editor",
      before: { templates: "incompletas" },
      after: { missing: ["Acta"] },
      durationMs: 25,
    });
    const telemetry = buildNormativeTelemetryEvent(event, "2026-05-15T12:00:00.000Z");
    const contracts = buildNormativeReadModelContracts();

    expect(disabledEdit).toMatchObject({
      enabled: false,
      label: "Edición directa de regla efectiva",
    });
    expect(enabledWizard.enabled).toBe(true);
    expect(telemetry).toMatchObject({
      name: "expediente_blocked",
      attributes: {
        society_id: "soc-1",
        matter: "AUMENTO_CAPITAL",
        user_role: "editor",
        duration_ms: 25,
        timestamp: "2026-05-15T12:00:00.000Z",
      },
    });
    expect(contracts.map((contract) => contract.table)).toEqual([
      "governing_bodies",
      "secretaria_organ_rules",
      "secretaria_statute_versions",
      "secretaria_statute_clause_mappings",
      "secretaria_normative_overrides",
      "materia_template_binding",
      "secretaria_effective_rule_matrix",
      "audit_log",
    ]);
    expect(contracts.find((contract) => contract.table === "audit_log")?.readiness).toBe("implementado");
  });

  it("fija criterios de salida P1: KPIs, rendimiento, accesibilidad e inventario legacy", () => {
    const kpis = buildP1OperationalKpiContract();
    const performance = buildP1PerformanceBudgetContract();
    const a11y = buildP1A11yI18nContract();
    const backfill = buildP1LegacyBackfillPlan();

    expect(kpis).toMatchObject({
      incompleteToOkMinutesP50: 15,
      incompleteToOkMinutesP95: 25,
      sourceCoverageTargetPct: 90,
      expedienteMissingTemplatesAllowed: 0,
      unexplainedJurisdictionMixesAllowed: 0,
    });
    expect(performance).toMatchObject({
      ttfbP95Ms: 500,
      renderP95Ms: 700,
      wizardAdditionalBundleKbGzip: 200,
    });
    expect(a11y.wcag).toBe("2.1 AA");
    expect(a11y.languages).toEqual(["ES", "EN", "DE"]);
    expect(backfill.preserveExistingOverrides).toBe(true);
    expect(backfill.markIncompleteWhenMissing).toContain("plantillas mínimas");
  });

  it("traduce claves internas a lenguaje jurídico de negocio", () => {
    expect(adoptionModeBusinessLabel("CO_APROBACION")).toBe("Decisión mancomunada");
    expect(adoptionModeBusinessLabel("SOLIDARIO")).toBe("Decisión de administrador solidario");
    expect(matterClassBusinessLabel("ESTRUCTURAL")).toBe("Operación estructural");
    expect(matterClassBusinessLabel("ESTATUTARIA")).toBe("Reforzada por estatutos o ley");
  });
});
