import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "../legal-template-fixtures";
import {
  buildTemplateTraceEvidence,
  buildTemplateProcessMatrixIndex,
  CLOUD_PRE_TEMPLATE_IDS,
  resolveTemplateProcessMatrix,
  selectTemplateProcessEntry,
  templateMatchesProcess,
  validatePreTemplateParity,
} from "../template-process-matrix";

function template(patch: Partial<PlantillaProtegidaRow> & Pick<PlantillaProtegidaRow, "id" | "tipo">) {
  return {
    id: patch.id,
    tenant_id: "tenant",
    tipo: patch.tipo,
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: null,
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: "contenido",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: null,
    organo_tipo: null,
    contrato_variables_version: null,
    created_at: "2026-04-29T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  } as PlantillaProtegidaRow;
}

describe("template-process-matrix", () => {
  it("resuelve proceso y fuente de variables para convocatoria", () => {
    const convocatoria = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === "legal-fixture-convocatoria-junta-es");
    const resolution = resolveTemplateProcessMatrix(convocatoria, {
      processHint: "convocatoria",
      variables: {
        denominacion_social: "ARGA Seguros, S.A.",
        organo_nombre: "Junta General",
        materia_acuerdo: "APROBACION_CUENTAS",
        tipo_convocatoria: "ORDINARIA",
        fecha_junta: "2026-06-30",
        hora_junta: "10:00",
      },
      capa3Values: {
        lugar: "Madrid",
        orden_dia_texto: "Aprobacion de cuentas",
        firma_organo_administracion: "Consejo",
      },
    });

    expect(resolution?.processId).toBe("convocatoria");
    expect(resolution?.templateSource).toBe("fixture");
    expect(resolution?.variables.template_tipo).toBe("CONVOCATORIA");
    expect(resolution?.variables.denominacion_social).toBe("ARGA Seguros, S.A.");
    expect(resolution?.variables.lugar).toBe("Madrid");
    expect(resolution?.sources.lugar).toBe("capa3");
    expect(resolution?.sources.template_tipo).toBe("template");
  });

  it("distingue acta unipersonal y acta sin sesion por adoptionMode", () => {
    const socioUnico = template({
      id: "socio",
      tipo: "ACTA_CONSIGNACION",
      adoption_mode: "UNIPERSONAL_SOCIO",
    });
    const sinSesion = template({
      id: "sin-sesion",
      tipo: "ACTA_ACUERDO_ESCRITO",
      adoption_mode: "NO_SESSION",
    });

    expect(selectTemplateProcessEntry(socioUnico)?.processId).toBe("decision_unipersonal");
    expect(selectTemplateProcessEntry(sinSesion)?.processId).toBe("acuerdo_sin_sesion");
  });

  it("enruta CO_APROBACION y SOLIDARIO al proceso sin sesion sin tratarlos como acta generica", () => {
    const decisionConjunta = template({
      id: "co-aprobacion",
      tipo: "ACTA_DECISION_CONJUNTA",
      adoption_mode: "CO_APROBACION",
      capa3_editables: [
        { campo: "administradores_firmantes", obligatoriedad: "OBLIGATORIO", descripcion: "Firmantes" },
      ],
    });
    const organoSolidario = template({
      id: "solidario",
      tipo: "ACTA_ORGANO_ADMIN",
      adoption_mode: "SOLIDARIO",
      capa3_editables: [
        { campo: "administrador_actuante", obligatoriedad: "OBLIGATORIO", descripcion: "Administrador" },
      ],
    });

    const conjunta = resolveTemplateProcessMatrix(decisionConjunta, {
      processHint: "ACUERDO_SIN_SESION",
      variables: { denominacion_social: "ARGA Seguros, S.A." },
      derived: { materia_acuerdo: "DELEGACION_FACULTADES", ventana_consenso: "15d" },
      capa3Values: { administradores_firmantes: "Admin 1; Admin 2" },
    });
    const solidario = resolveTemplateProcessMatrix(organoSolidario, {
      processHint: "acuerdo_sin_sesion",
      variables: { denominacion_social: "ARGA Seguros, S.A." },
      derived: { materia_acuerdo: "AUTORIZACION_GARANTIA", restricciones_estatutarias: "Sin cofirma" },
      capa3Values: { administrador_actuante: "Admin solidario 1" },
    });

    expect(conjunta?.entry.key).toBe("acta-decision-conjunta");
    expect(conjunta?.processId).toBe("acuerdo_sin_sesion");
    expect(conjunta?.documentKinds).toEqual(["ACUERDO_SIN_SESION"]);
    expect(conjunta?.variables.modo_adopcion).toBe("CO_APROBACION");
    expect(conjunta?.sources.administradores_firmantes).toBe("capa3");
    expect(templateMatchesProcess(decisionConjunta, "ACTA")).toBe(false);

    expect(solidario?.entry.key).toBe("acta-organo-admin-solidario");
    expect(solidario?.processId).toBe("acuerdo_sin_sesion");
    expect(solidario?.variables.modo_adopcion).toBe("SOLIDARIO");
    expect(solidario?.sources.administrador_actuante).toBe("capa3");
    expect(templateMatchesProcess(organoSolidario, "ACTA")).toBe(false);
  });

  it("valida faltantes obligatorios sin inventar fuentes", () => {
    const registral = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === "legal-fixture-documento-registral-es");
    const resolution = resolveTemplateProcessMatrix(registral, {
      processHint: "DOCUMENTO_REGISTRAL",
      variables: {
        denominacion_social: "ARGA Seguros, S.A.",
      },
    });

    expect(resolution?.processId).toBe("tramitador_registral");
    expect(resolution?.missingRequired).toContain("materia_acuerdo");
    expect(resolution?.missingRequired).toContain("documentacion_texto");
    expect(resolution?.sources.materia_acuerdo).toBe("capa3");
    expect(resolution?.sources.documentacion_texto).toBe("capa3");
  });

  it("construye indice por templateId y expone compatibilidad por proceso", () => {
    const index = buildTemplateProcessMatrixIndex(LEGAL_TEAM_TEMPLATE_FIXTURES, { processHint: "informe_pre" });

    expect(index["legal-fixture-informe-preceptivo-es"].processId).toBe("informe_pre");
    expect(templateMatchesProcess(template({ id: "cert", tipo: "CERTIFICACION" }), "CERTIFICACION")).toBe(true);
    expect(templateMatchesProcess(template({ id: "cert", tipo: "CERTIFICACION" }), "DOCUMENTO_REGISTRAL")).toBe(false);
  });

  it("enruta IDs PRE Cloud reales por la matriz y valida paridad activa", () => {
    const preCloud = template({
      id: CLOUD_PRE_TEMPLATE_IDS.INFORME_PRECEPTIVO,
      tipo: "INFORME_PRECEPTIVO",
      materia: "CONVOCATORIA_PRE",
      contrato_variables_version: "1.1.0",
      capa3_editables: [
        { campo: "materia_acuerdo", obligatoriedad: "OBLIGATORIO", descripcion: "Materia" },
        { campo: "objeto_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Objeto" },
        { campo: "fundamento_legal", obligatoriedad: "OBLIGATORIO", descripcion: "Fundamento" },
      ],
    });

    const resolution = resolveTemplateProcessMatrix(preCloud, {
      processHint: "INFORME_PRECEPTIVO",
      variables: {
        denominacion_social: "ARGA Seguros, S.A.",
        organo_nombre: "Consejo de Administracion",
      },
      capa3Values: {
        materia_acuerdo: "CONVOCATORIA_JGA",
        objeto_informe: "Revision de requisitos de convocatoria",
        fundamento_legal: "LSC y estatutos",
      },
    });

    expect(resolution?.processId).toBe("informe_pre");
    expect(resolution?.templateSource).toBe("cloud");
    expect(resolution?.missingRequired).toEqual([]);
    expect(validatePreTemplateParity(preCloud, resolution).status).toBe("CLOUD_ACTIVE");
  });

  it("acepta plantillas PRE Cloud-like sin convertirlas en fixture", () => {
    const documentalPre = template({
      id: "11111111-2222-4333-8444-555555555555",
      tipo: "INFORME_DOCUMENTAL_PRE",
      materia: "EXPEDIENTE_PRE",
      capa3_editables: [
        { campo: "materia_acuerdo", obligatoriedad: "OBLIGATORIO", descripcion: "Materia" },
        { campo: "comprobaciones_texto", obligatoriedad: "OBLIGATORIO", descripcion: "Comprobaciones" },
      ],
    });
    const resolution = resolveTemplateProcessMatrix(documentalPre, {
      processHint: "INFORME_DOCUMENTAL_PRE",
      variables: { denominacion_social: "ARGA Seguros, S.A." },
      capa3Values: {
        "Materia Acuerdo": "APROBACION_CUENTAS",
        comprobaciones_texto: "Cuentas formuladas\nInforme auditor",
      },
    });
    const parity = validatePreTemplateParity(documentalPre, resolution);

    expect(resolution?.processId).toBe("informe_pre");
    expect(resolution?.capa3Draft.legacyKeyMap).toEqual({ "Materia Acuerdo": "materia_acuerdo" });
    expect(parity.status).toBe("CLOUD_ACTIVE_WITH_WARNINGS");
    expect(parity.canClaimLegalTemplate).toBe(true);
  });

  it("produce evidencia determinista y fuentes estables sin persistir fixtures como verdad", () => {
    const preFixture = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === "legal-fixture-informe-preceptivo-es");
    const resolution = resolveTemplateProcessMatrix(preFixture, {
      processHint: "informe_pre",
      variables: {
        denominacion_social: "ARGA Seguros, S.A.",
        organo_nombre: "Junta General",
      },
      capa3Values: {
        materia_acuerdo: "APROBACION_CUENTAS",
        objeto_informe: "Informe previo",
        fundamento_legal: "Art. 272 LSC",
        comprobaciones_texto: "Documentacion disponible",
        conclusion_informe: "Sin incidencias bloqueantes",
        inesperado: "no persistir",
      },
    });
    const evidence = buildTemplateTraceEvidence(preFixture, resolution);

    expect(evidence.template.source).toBe("fixture");
    expect(evidence.template.source_of_truth).toBe("fixture_fallback_non_persistent");
    expect(evidence.template.fixture_persisted_as_source_of_truth).toBe(false);
    expect(evidence.pre_parity.status).toBe("FIXTURE_ONLY");
    expect(evidence.variables.sources.template_id).toBe("template");
    expect(evidence.variables.sources.denominacion_social).toBe("derived");
    expect(evidence.variables.sources.materia_acuerdo).toBe("capa3");
    expect(evidence.capa3.ignored_keys).toEqual(["inesperado"]);
    expect(evidence.evidence).toEqual({
      posture: "GENERATED_TRACE_ONLY",
      storage_ref: null,
      evidence_bundle_id: null,
    });
  });

  it("declara que no necesita cambios de contrato Supabase para la traza PRE", () => {
    const preFixture = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === "legal-fixture-informe-documental-pre-es");
    const resolution = resolveTemplateProcessMatrix(preFixture, { processHint: "informe_pre" });
    const evidence = buildTemplateTraceEvidence(preFixture, resolution);

    expect(Object.keys(evidence)).toEqual([
      "schema_version",
      "template",
      "process",
      "variables",
      "capa3",
      "pre_parity",
      "evidence",
    ]);
    expect(evidence.evidence.storage_ref).toBeNull();
    expect(evidence.evidence.evidence_bundle_id).toBeNull();
  });
});
