import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import {
  MATERIA_CANONICAL_ALIAS,
  buildMateriaCatalogRows,
  buildNormativeMatrixRows,
  buildTemplateDocumentBindings,
  compareTemplateVersions,
  detectTemplateDataDuplicates,
  documentTypeLabel,
  evaluateMateriaGlobalStatus,
  evaluateTemplateReadiness,
  getMateriaFunctionalGroup,
  groupStageBindingsForDisplay,
  pactoApplicaAMateria,
  resolveMateriaAlias,
  templateBindingDisplayLabel,
  type TemplateReadinessResult,
} from "../mesa-control-societaria";

function materiaRow(overrides: Partial<MateriaCatalogRow> & Pick<MateriaCatalogRow, "materia">): MateriaCatalogRow {
  return {
    materia_label_es: overrides.materia,
    requires_notary: false,
    requires_registry: false,
    inscribable: false,
    matter_class: "ORDINARIA",
    min_majority_code: "SIMPLE",
    publication_required: false,
    plazo_inscripcion_dias: null,
    referencia_legal: "art. 1 LSC",
    ...overrides,
  };
}

let plantillaSeq = 0;
function plantilla(overrides: Partial<PlantillaProtegidaRow>): PlantillaProtegidaRow {
  plantillaSeq += 1;
  return {
    id: `tpl-${plantillaSeq}`,
    tenant_id: "t-1",
    tipo: "MODELO_ACUERDO",
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comité Legal",
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: null,
    capa2_variables: [],
    capa3_editables: [],
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: false,
    adoption_mode: null,
    organo_tipo: null,
    contrato_variables_version: null,
    created_at: "2026-01-01T00:00:00Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...overrides,
  } as PlantillaProtegidaRow;
}

const READY: TemplateReadinessResult = { canStartCase: true, blockingMessage: null, items: [] };
const BLOCKED: TemplateReadinessResult = {
  canStartCase: false,
  blockingMessage: "No se puede iniciar expediente porque falta plantilla de acta.",
  items: [],
};

describe("alias de materias legacy", () => {
  it("resuelve alias a su materia canónica y deja pasar el resto", () => {
    expect(resolveMateriaAlias("MOD_ESTATUTOS")).toBe("MODIFICACION_ESTATUTOS");
    expect(resolveMateriaAlias("AMPLIACION_CAPITAL")).toBe("AUMENTO_CAPITAL");
    expect(resolveMateriaAlias("NOMBRAMIENTO_CESE")).toBe("NOMBRAMIENTO_CONSEJERO");
    expect(resolveMateriaAlias("CESE_CONSEJERO")).toBe("CESE_CONSEJERO");
  });

  it("colapsa la fila alias cuando existe la canónica (sin tarjetas duplicadas)", () => {
    const rows = buildMateriaCatalogRows([
      materiaRow({ materia: "NOMBRAMIENTO_CONSEJERO", materia_label_es: "Nombramiento de consejero" }),
      materiaRow({ materia: "NOMBRAMIENTO_CESE", materia_label_es: "Nombramiento de consejero" }),
    ]);
    const nombramientos = rows.filter((row) => row.materia_label_es === "Nombramiento de consejero");
    expect(nombramientos).toHaveLength(1);
    expect(nombramientos[0].materia).toBe("NOMBRAMIENTO_CONSEJERO");
  });

  it("remapea el alias a código canónico si la canónica no está en el catálogo", () => {
    const rows = buildMateriaCatalogRows([
      materiaRow({ materia: "MOD_ESTATUTOS", materia_label_es: "Modificación de estatutos sociales" }),
    ]);
    const mods = rows.filter((row) => row.materia_label_es === "Modificación de estatutos sociales");
    expect(mods).toHaveLength(1);
    expect(mods[0].materia).toBe("MODIFICACION_ESTATUTOS");
  });
});

describe("labels de materia_catalog (ortografía en BD tras 20260710103000)", () => {
  // El overlay ortográfico temporal se retiró el 2026-07-11: la BD es la única
  // fuente de verdad de los labels y el builder no debe transformarlos.
  it("respeta los labels de BD tal cual llegan", () => {
    const rows = buildMateriaCatalogRows([
      materiaRow({ materia: "EXCLUSION_SOCIO", materia_label_es: "Exclusión de socio" }),
      materiaRow({ materia: "CESE_CONSEJERO", materia_label_es: "Cese de consejero" }),
    ]);
    expect(rows.find((item) => item.materia === "EXCLUSION_SOCIO")?.materia_label_es).toBe("Exclusión de socio");
    expect(rows.find((item) => item.materia === "CESE_CONSEJERO")?.materia_label_es).toBe("Cese de consejero");
  });
});

describe("grupos funcionales de materias antes huérfanas", () => {
  it.each([
    ["ACCION_SOCIAL_RESPONSABILIDAD", "GOBIERNO_ORGANOS"],
    ["DISTRIBUCION_CARGOS", "GOBIERNO_ORGANOS"],
    ["NOMBRAMIENTO_CESE", "GOBIERNO_ORGANOS"],
    ["AMPLIACION_CAPITAL", "CAPITAL_FINANCIACION"],
    ["EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE", "CAPITAL_FINANCIACION"],
    ["AUTORIZACION_GARANTIA", "OPERACIONES_ESPECIALES_VINCULADAS"],
    ["MOD_ESTATUTOS", "ESTATUTOS_NORMATIVA_INTERNA"],
    ["TRASLADO_DOMICILIO_NACIONAL", "ESTATUTOS_NORMATIVA_INTERNA"],
  ])("%s pertenece a %s (no cae en el fallback)", (materia, groupId) => {
    expect(getMateriaFunctionalGroup(materia).id).toBe(groupId);
  });

  it("todos los alias apuntan al mismo grupo que su canónica", () => {
    for (const [alias, canonical] of Object.entries(MATERIA_CANONICAL_ALIAS)) {
      expect(getMateriaFunctionalGroup(alias).id).toBe(getMateriaFunctionalGroup(canonical).id);
    }
  });
});

describe("pactos con vocabulario legacy tras el colapso de alias (regresión review P1)", () => {
  // El pacto demo CONSENTIMIENTO_INVERSOR usa 'AMPLIACION_CAPITAL' en
  // materias_aplicables; la tarjeta canónica es AUMENTO_CAPITAL.
  const pactoDemo = { materias_aplicables: ["AMPLIACION_CAPITAL", "EMISION_CONVERTIBLES"] };

  it("pactoApplicaAMateria matchea la materia canónica contra el código legacy del pacto", () => {
    expect(pactoApplicaAMateria(pactoDemo, "AUMENTO_CAPITAL")).toBe(true);
    expect(pactoApplicaAMateria(pactoDemo, "EMISION_DEUDA_CONVERTIBLE")).toBe(true);
    expect(pactoApplicaAMateria(pactoDemo, "CESE_CONSEJERO")).toBe(false);
  });

  it("la matriz normativa conserva el pacto en la fila canónica AUMENTO_CAPITAL", () => {
    const rows = buildNormativeMatrixRows(
      [
        materiaRow({ materia: "AUMENTO_CAPITAL", materia_label_es: "Aumento de capital social" }),
        materiaRow({ materia: "AMPLIACION_CAPITAL", materia_label_es: "Aumento de capital social" }),
      ],
      { pactos: [pactoDemo] },
    );
    const aumento = rows.find((row) => row.materia === "AUMENTO_CAPITAL");
    expect(rows.filter((row) => row.label === "Aumento de capital social")).toHaveLength(1);
    expect(aumento?.pactos).toHaveLength(1);
    expect(aumento?.fuente).toContain("Pacto parasocial");
  });
});

describe("evaluateMateriaGlobalStatus", () => {
  it("materia informativa: no se bloquea por plantillas y ofrece ver la regla", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: BLOCKED,
      legalReference: "art. 253 LSC",
      informativa: true,
    });
    expect(result.status).toBe("lista");
    expect(result.label).toBe("Materia informativa");
    expect(result.ctaLabel).toBe("Ver regla aplicable");
  });

  it("materia informativa con pacto aplicable mantiene la advertencia sin CTA de expediente", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: BLOCKED,
      legalReference: "art. 253 LSC",
      applicablePactosCount: 1,
      informativa: true,
    });
    expect(result.status).toBe("advertencia");
    expect(result.ctaLabel).toBe("Ver regla aplicable");
  });

  it("bloqueada cuando falta plantilla mínima (precede a todo)", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: BLOCKED,
      conflictOfLaws: { conflict_of_laws_flag: true, expectedLawLabel: "", appliedLawLabel: "", explanation: "" },
      legalReference: null,
      applicablePactosCount: 2,
    });
    expect(result.status).toBe("bloqueada");
    expect(result.label).toBe("Bloqueada por falta de plantilla mínima");
    expect(result.ctaLabel).toBe("Resolver bloqueo");
    expect(result.explanation).toContain("falta plantilla de acta");
  });

  it("revisión legal cuando hay conflicto de ley aplicable", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: READY,
      conflictOfLaws: { conflict_of_laws_flag: true, expectedLawLabel: "", appliedLawLabel: "", explanation: "" },
      legalReference: "art. 285 LSC",
    });
    expect(result.status).toBe("revision_legal");
    expect(result.ctaLabel).toBe("Revisar fuentes");
  });

  it("revisión legal cuando la referencia legal está pendiente", () => {
    const result = evaluateMateriaGlobalStatus({ templateReadiness: READY, legalReference: null });
    expect(result.status).toBe("revision_legal");
    expect(result.explanation).toContain("referencia legal");
  });

  it("advertencia no bloqueante cuando hay pactos aplicables", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: READY,
      legalReference: "art. 296 LSC",
      applicablePactosCount: 1,
    });
    expect(result.status).toBe("advertencia");
    expect(result.label).toBe("Advertencia no bloqueante");
    expect(result.ctaLabel).toBe("Iniciar expediente");
  });

  it("lista cuando regla y documentos están resueltos", () => {
    const result = evaluateMateriaGlobalStatus({
      templateReadiness: READY,
      legalReference: "art. 223 LSC",
      applicablePactosCount: 0,
    });
    expect(result.status).toBe("lista");
    expect(result.label).toBe("Lista para iniciar expediente");
    expect(result.ctaLabel).toBe("Iniciar expediente");
  });
});

describe("versionado y presentación de plantillas", () => {
  it("compara versiones numéricamente por segmentos", () => {
    expect(compareTemplateVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareTemplateVersions("1.2.1", "1.2.1")).toBe(0);
    expect(compareTemplateVersions("v1.0.0", "1.0.1")).toBeLessThan(0);
  });

  it("documentTypeLabel traduce tipos conocidos y deja pasar desconocidos", () => {
    expect(documentTypeLabel("ACTA_CONSIGNACION")).toBe("Acta de consignación");
    expect(documentTypeLabel("TIPO_RARO")).toBe("TIPO_RARO");
  });

  it("marca como vigente la mayor versión ACTIVA y colapsa las anteriores", () => {
    const plantillas = [
      plantilla({ tipo: "CONVOCATORIA", version: "1.0.0" }),
      plantilla({ tipo: "CONVOCATORIA", version: "1.2.1" }),
      plantilla({ tipo: "CONVOCATORIA", version: "1.1.0" }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    const groups = groupStageBindingsForDisplay(bindings);
    expect(groups).toHaveLength(1);
    expect(groups[0].current.template.version).toBe("1.2.1");
    expect(groups[0].older.map((binding) => binding.template.version)).toEqual(["1.1.0", "1.0.0"]);
    expect(groups[0].duplicates).toHaveLength(0);
  });

  it("variantes Junta vs Consejo (misma adopción MEETING) discriminan por órgano y NO son duplicidad", () => {
    // Caso real Cloud: NOMBRAMIENTO_CONSEJERO v1.1.1 ×2 — junta (art. 214 LSC)
    // vs cooptación por consejo (art. 244 LSC). Solo difiere organo_tipo.
    const plantillas = [
      plantilla({
        tipo: "MODELO_ACUERDO",
        version: "1.1.1",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "JUNTA_GENERAL",
      }),
      plantilla({
        tipo: "MODELO_ACUERDO",
        version: "1.1.1",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "CONSEJO_ADMIN",
      }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "NOMBRAMIENTO_CONSEJERO" });
    const labels = bindings.map((binding) => templateBindingDisplayLabel(binding, bindings));
    expect(labels).toContain("Modelo de acuerdo · v1.1.1 · Junta General");
    expect(labels).toContain("Modelo de acuerdo · v1.1.1 · Consejo de Administración");
    expect(detectTemplateDataDuplicates(bindings)).toHaveLength(0);
  });

  it("no mezcla como versiones plantillas funcionalmente distintas (socio único vs admin único)", () => {
    const plantillas = [
      plantilla({
        tipo: "ACTA_CONSIGNACION",
        version: "1.2.1",
        materia: "DECISION_SOCIO_UNICO",
        adoption_mode: "UNIPERSONAL_SOCIO",
        organo_tipo: "SOCIO_UNICO",
      }),
      plantilla({
        tipo: "ACTA_CONSIGNACION",
        version: "1.2.1",
        materia: "DECISION_ADMIN_UNICO",
        adoption_mode: "UNIPERSONAL_ADMIN",
        organo_tipo: "ADMIN_UNICO",
      }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    const groups = groupStageBindingsForDisplay(bindings);
    expect(groups).toHaveLength(2);
    expect(detectTemplateDataDuplicates(bindings)).toHaveLength(0);

    const labels = bindings.map((binding) => templateBindingDisplayLabel(binding, bindings));
    expect(labels).toContain("Acta de consignación · v1.2.1 · Socio único");
    expect(labels).toContain("Acta de consignación · v1.2.1 · Administrador único");
  });

  it("detecta duplicados de datos reales (misma identidad funcional y versión)", () => {
    const plantillas = [
      plantilla({ tipo: "MODELO_ACUERDO", version: "1.1.1", materia_acuerdo: "NOMBRAMIENTO_CONSEJERO" }),
      plantilla({ tipo: "MODELO_ACUERDO", version: "1.1.1", materia_acuerdo: "NOMBRAMIENTO_CONSEJERO" }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "NOMBRAMIENTO_CONSEJERO" });
    const duplicates = detectTemplateDataDuplicates(bindings);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].tipo).toBe("MODELO_ACUERDO");
    expect(duplicates[0].version).toBe("1.1.1");
    expect(duplicates[0].ids).toHaveLength(2);

    const groups = groupStageBindingsForDisplay(bindings);
    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(1);
    expect(groups[0].older).toHaveLength(0);
  });

  it("detecta duplicidad VISIBLE: etiqueta final idéntica aunque difieran metadatos ocultos", () => {
    // Dos MODELO_ACUERDO idénticos salvo la jurisdicción (ES vs GLOBAL): ambos se
    // muestran para una sociedad ES y ningún discriminador visible los distingue.
    const plantillas = [
      plantilla({
        tipo: "MODELO_ACUERDO",
        version: "1.1.1",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "JUNTA_GENERAL",
        jurisdiccion: "ES",
      }),
      plantilla({
        tipo: "MODELO_ACUERDO",
        version: "1.1.1",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "JUNTA_GENERAL",
        jurisdiccion: "GLOBAL",
      }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, {
      materia: "NOMBRAMIENTO_CONSEJERO",
      jurisdiction: "ES",
    });
    expect(groupStageBindingsForDisplay(bindings)).toHaveLength(2);
    const duplicates = detectTemplateDataDuplicates(bindings);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].ids).toHaveLength(2);
  });

  it("no flagea como duplicidad plantillas cuya etiqueta discrimina (socio vs admin único)", () => {
    const plantillas = [
      plantilla({
        tipo: "ACTA_CONSIGNACION",
        version: "1.2.1",
        materia: "DECISION_SOCIO_UNICO",
        adoption_mode: "UNIPERSONAL_SOCIO",
        organo_tipo: "SOCIO_UNICO",
      }),
      plantilla({
        tipo: "ACTA_CONSIGNACION",
        version: "1.2.1",
        materia: "DECISION_ADMIN_UNICO",
        adoption_mode: "UNIPERSONAL_ADMIN",
        organo_tipo: "ADMIN_UNICO",
      }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    expect(detectTemplateDataDuplicates(bindings)).toHaveLength(0);
  });

  it("empate numérico con sufijos distintos es versión distinta, no duplicado", () => {
    const plantillas = [
      plantilla({ tipo: "CONVOCATORIA", version: "1.0.0-beta" }),
      plantilla({ tipo: "CONVOCATORIA", version: "1.0.0-rc" }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    const groups = groupStageBindingsForDisplay(bindings);
    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(0);
    expect(groups[0].older).toHaveLength(1);
  });

  it("ambigüedad a 3 bandas: acumula discriminadores hasta que la etiqueta es única", () => {
    const plantillas = [
      plantilla({ tipo: "ACTA_SESION", version: "1.2.1", organo_tipo: "JUNTA_GENERAL", adoption_mode: "MEETING" }),
      plantilla({ tipo: "ACTA_SESION", version: "1.2.1", organo_tipo: "CONSEJO", adoption_mode: "MEETING" }),
      plantilla({ tipo: "ACTA_SESION", version: "1.2.1", organo_tipo: "CONSEJO", adoption_mode: "NO_SESSION" }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    const labels = bindings.map((binding) => templateBindingDisplayLabel(binding, bindings));
    expect(new Set(labels).size).toBe(3);
    expect(labels).toContain("Acta de sesión · v1.2.1 · Junta General");
    expect(labels).toContain("Acta de sesión · v1.2.1 · Consejo de Administración · Sesión formal");
    expect(labels).toContain("Acta de sesión · v1.2.1 · Consejo de Administración · Acuerdo sin sesión");
    expect(detectTemplateDataDuplicates(bindings)).toHaveLength(0);
  });

  it("sin discriminador cuando el label ya es único", () => {
    const plantillas = [plantilla({ tipo: "CERTIFICACION", version: "1.3.0" })];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    expect(templateBindingDisplayLabel(bindings[0], bindings)).toBe("Certificación · v1.3.0");
  });

  it("la readiness sigue funcionando con los grupos de display (regresión)", () => {
    const plantillas = [
      plantilla({ tipo: "MODELO_ACUERDO", version: "1.0.1", materia_acuerdo: "CESE_CONSEJERO" }),
      plantilla({ tipo: "ACTA_ACUERDO_ESCRITO", version: "1.3.0" }),
      plantilla({ tipo: "CERTIFICACION", version: "1.3.0" }),
    ];
    const bindings = buildTemplateDocumentBindings(plantillas, { materia: "CESE_CONSEJERO" });
    expect(evaluateTemplateReadiness(bindings).canStartCase).toBe(true);
  });
});
