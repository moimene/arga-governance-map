import { describe, expect, it } from "vitest";
import { buildSecretariaDocumentGenerationRequest } from "@/lib/secretaria/document-generation-boundary";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "@/lib/secretaria/legal-template-fixtures";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { composeDocument, finalizeEditableDocumentDraft, prepareDocumentComposition } from "../composer";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ENTITY_ID = "00000000-0000-0000-0000-000000000010";
const AGREEMENT_ID = "00000000-0000-4000-8000-000000000001";

function fixture(id: string): PlantillaProtegidaRow {
  const template = LEGAL_TEAM_TEMPLATE_FIXTURES.find((item) => item.id === id);
  if (!template) throw new Error(`Fixture no encontrada: ${id}`);
  return template;
}

async function smoke(
  template: PlantillaProtegidaRow,
  requestInput: Parameters<typeof buildSecretariaDocumentGenerationRequest>[0],
  capa3Values: Record<string, unknown>,
  baseVariables: Record<string, unknown> = {},
) {
  const request = await buildSecretariaDocumentGenerationRequest({
    ...requestInput,
    templateId: template.id,
    requestedAt: "2026-05-03T10:00:00.000Z",
  });

  const result = await composeDocument(request, capa3Values, {
    plantilla: template,
    resolveCapa2: false,
    archiveDraft: false,
    generatedAt: "2026-05-03",
    baseVariables: {
      denominacion_social: "ARGA Seguros, S.A.",
      cif: "A00000000",
      domicilio_social: "Madrid",
      registro_mercantil: "Madrid",
      organo_nombre: "Consejo de Administracion",
      fecha: "2026-06-01",
      presidente: "Antonio Rios",
      secretario: "Lucia Paredes",
      resultado_gate: "CONFORME",
      resultado_evaluacion: "Sin incidencias bloqueantes.",
      snapshot_hash: "hash-demo",
      ...baseVariables,
    },
  });

  expect(result.docxBuffer.length).toBeGreaterThan(0);
  expect(result.document.buffer).toBe(result.docxBuffer);
  expect(result.document.filename).toBe(result.filename);
  expect(result.document.evidenceStatus).toBe("DEMO_OPERATIVA");
  expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  expect(result.renderedText).not.toContain("{{");
  expect(result.unresolvedVariables).toEqual([]);
  expect(result.postRenderValidation.ok).toBe(true);
  expect(result.archive.skippedReason).toBe("archive_disabled");
  return result;
}

describe("motor-plantillas composer smoke", () => {
  it("finaliza un borrador editable con hash y DOCX del texto revisado", async () => {
    const template = fixture("legal-fixture-convocatoria-consejo-es");
    const request = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: TENANT_ID,
      entityId: ENTITY_ID,
      convocatoriaId: "conv-1",
      templateId: template.id,
      requestedAt: "2026-05-03T10:00:00.000Z",
    });
    const prepared = await prepareDocumentComposition(
      request,
      {
        lugar: "Madrid",
        fecha_primera_convocatoria: "2026-06-01",
        hora_primera_convocatoria: "10:00",
        orden_dia_texto: "Aprobacion de cuentas\nDelegacion de facultades",
        firma_organo_administracion: "El Presidente",
      },
      {
        plantilla: template,
        resolveCapa2: false,
        archiveDraft: false,
        generatedAt: "2026-05-03",
        baseVariables: {
          denominacion_social: "ARGA Seguros, S.A.",
          cif: "A00000000",
          domicilio_social: "Madrid",
          registro_mercantil: "Madrid",
          organo_nombre: "Consejo de Administracion",
          fecha: "2026-06-01",
          presidente: "Antonio Rios",
          secretario: "Lucia Paredes",
        },
      },
    );

    const reviewed = await finalizeEditableDocumentDraft(
      prepared,
      `${prepared.renderedBodyText}\n\nACLARACION OPERATIVA\nTexto incorporado por revision humana antes de generar el DOCX.`,
      { archiveDraft: false, generatedAt: "2026-05-03" },
    );

    expect(reviewed.renderedBodyText).toContain("ACLARACION OPERATIVA");
    expect(reviewed.renderedText).toContain("TRAZABILIDAD DOCUMENTAL");
    expect(reviewed.document.renderedText).toContain("Texto incorporado por revision humana");
    expect(reviewed.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(reviewed.docxBuffer.length).toBeGreaterThan(0);
    expect(reviewed.archive.skippedReason).toBe("archive_disabled");
  });

  it("selecciona BORRADOR revisado cuando es la version operativa mas reciente", async () => {
    const base = fixture("legal-fixture-convocatoria-consejo-es");
    const active: PlantillaProtegidaRow = {
      ...base,
      id: "composer-convocatoria-activa",
      version: "1.1.0",
      estado: "ACTIVA",
    };
    const reviewedDraft: PlantillaProtegidaRow = {
      ...base,
      id: "composer-convocatoria-borrador-revisado",
      version: "1.2.0",
      estado: "BORRADOR",
      aprobada_por: "Comite Legal ARGA - Secretaria Societaria (demo-operativo)",
      fecha_aprobacion: "2026-05-02",
    };
    const request = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: TENANT_ID,
      entityId: ENTITY_ID,
      convocatoriaId: "conv-1",
      templateProfileId: "CONVOCATORIA",
      requestedAt: "2026-05-03T10:00:00.000Z",
    });

    const result = await composeDocument(
      request,
      {
        lugar: "Madrid",
        fecha_primera_convocatoria: "2026-06-01",
        hora_primera_convocatoria: "10:00",
        orden_dia_texto: "Aprobacion de cuentas\nDelegacion de facultades",
        firma_organo_administracion: "El Presidente",
      },
      {
        plantillas: [active, reviewedDraft],
        resolveCapa2: false,
        archiveDraft: false,
        generatedAt: "2026-05-03",
        baseVariables: {
          denominacion_social: "ARGA Seguros, S.A.",
          cif: "A00000000",
          domicilio_social: "Madrid",
          registro_mercantil: "Madrid",
          organo_nombre: "Consejo de Administracion",
          fecha: "2026-06-01",
          presidente: "Antonio Rios",
          secretario: "Lucia Paredes",
        },
      },
    );

    expect(result.template.id).toBe("composer-convocatoria-borrador-revisado");
    expect(result.renderedText).not.toContain("{{");
  });

  it("genera CONVOCATORIA sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-convocatoria-consejo-es"),
      {
        documentType: "CONVOCATORIA",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        convocatoriaId: "conv-1",
      },
      {
        lugar: "Madrid",
        fecha_primera_convocatoria: "2026-06-01",
        hora_primera_convocatoria: "10:00",
        orden_dia_texto: "Aprobacion de cuentas\nDelegacion de facultades",
        firma_organo_administracion: "El Presidente",
      },
    );

    expect(result.renderedText).toContain("CONVOCATORIA");
  });

  it("genera ACTA sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-acta-consejo-es"),
      {
        documentType: "ACTA",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        agreementIds: [AGREEMENT_ID],
        meetingId: "meeting-1",
        minuteId: "minute-1",
      },
      {
        ciudad_emision: "Madrid",
        fecha: "2026-06-01",
        lugar: "Domicilio social",
        hora_inicio: "10:00",
        hora_fin: "11:15",
        miembros_presentes_texto: "Consejera A\nConsejero B",
        orden_dia_texto: "Formulacion de cuentas\nConvocatoria de junta",
        acuerdos_texto: "Se formulan las cuentas\nSe convoca la junta",
      },
    );

    expect(result.renderedText).toContain(AGREEMENT_ID);
  });

  it("genera CERTIFICACION sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-certificacion-es"),
      {
        documentType: "CERTIFICACION",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        agreementIds: [AGREEMENT_ID],
        certificationId: "cert-1",
      },
      {
        nombre_certificante: "Lucia Paredes",
        cargo_certificante: "Secretaria",
        ciudad_emision: "Madrid",
        fecha_emision: "2026-06-02",
        transcripcion_acuerdos: "Se certifica el acuerdo adoptado.",
      },
      { fecha: "2026-06-01" },
    );

    expect(result.renderedText).toContain("CERTIFICACION");
  });

  it("genera INFORME_PRECEPTIVO sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-informe-preceptivo-es"),
      {
        documentType: "INFORME_PRECEPTIVO",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        convocatoriaId: "conv-1",
      },
      {
        materia_acuerdo: "APROBACION_CUENTAS",
        fecha: "2026-06-01",
        objeto_informe: "Validar requisitos de convocatoria.",
        fundamento_legal: "LSC y estatutos sociales.",
        comprobaciones_texto: "Convocatoria revisada\nQuorum previsto",
        conclusion_informe: "Puede continuarse con el expediente.",
      },
    );

    expect(result.renderedText).toContain("INFORME PRECEPTIVO");
  });

  it("genera INFORME_DOCUMENTAL_PRE sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-informe-documental-pre-es"),
      {
        documentType: "INFORME_DOCUMENTAL_PRE",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
      },
      {
        expediente_ref: "EXP-ARGA-001",
        organo_nombre: "Consejo de Administracion",
        materia_acuerdo: "APROBACION_CUENTAS",
        fecha: "2026-06-01",
        documentacion_texto: "Cuentas anuales\nInforme auditor",
        conclusion_documental: "Documentacion suficiente para continuar.",
        canal_notificacion: "ERDS",
        erds_delivery_ref: "ERDS-DEMO-1",
      },
    );

    expect(result.renderedText).toContain("INFORME DOCUMENTAL PRE");
  });

  it("genera ACUERDO_SIN_SESION sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-acta-acuerdo-escrito-sin-sesion-es"),
      {
        documentType: "ACUERDO_SIN_SESION",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        agreementIds: [AGREEMENT_ID],
      },
      {
        ciudad_emision: "Madrid",
        fecha_cierre: "2026-06-01",
        tipo_proceso: "CIRCULACION_CONSEJO",
        propuesta_texto: "Aprobar la operacion.",
        relacion_respuestas_texto: "Consejera A - A favor\nConsejero B - A favor",
        condicion_adopcion: "Mayoria suficiente.",
        texto_decision: "Se aprueba la operacion.",
        expediente_hash: "hash-expediente",
        firma_qes_ref: "QES-DEMO",
      },
    );

    expect(result.renderedText).toContain("ACTA DE ACUERDO ESCRITO SIN SESION");
  });

  it("genera DECISION_UNIPERSONAL sin variables huerfanas", async () => {
    const result = await smoke(
      fixture("legal-fixture-acta-consignacion-socio-unico-es"),
      {
        documentType: "DECISION_UNIPERSONAL",
        tenantId: TENANT_ID,
        entityId: ENTITY_ID,
        agreementIds: [AGREEMENT_ID],
      },
      {
        ciudad_emision: "Madrid",
        fecha: "2026-06-01",
        identidad_decisor: "Fundacion ARGA",
        nif_decisor: "G00000000",
        texto_decision: "Se aprueban las cuentas anuales.",
        firma_qes_ref: "QES-DEMO",
      },
    );

    expect(result.renderedText).toContain("DECISION DEL SOCIO UNICO");
  });
});
