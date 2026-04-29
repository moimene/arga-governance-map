import { beforeAll, describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  resolveAgreementDocumentTrace,
  resolveDocumentEvidencePosture,
} from "@/lib/secretaria/agreement-document-contract";
import { LEGAL_TEAM_TEMPLATE_FIXTURES } from "@/lib/secretaria/legal-template-fixtures";

let buildProcessDocumentTraceFooterLines: typeof import("../process-documents").buildProcessDocumentTraceFooterLines;
let resolveProcessDocumentFinalEvidenceReadiness: typeof import("../process-document-readiness").resolveProcessDocumentFinalEvidenceReadiness;
let selectProcessTemplate: typeof import("../process-documents").selectProcessTemplate;

beforeAll(async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
  ({ buildProcessDocumentTraceFooterLines, selectProcessTemplate } = await import("../process-documents"));
  ({ resolveProcessDocumentFinalEvidenceReadiness } = await import("../process-document-readiness"));
});

function template(
  patch: Partial<PlantillaProtegidaRow> & Pick<PlantillaProtegidaRow, "id" | "tipo" | "estado">,
): PlantillaProtegidaRow {
  return {
    id: patch.id,
    tenant_id: "tenant",
    tipo: patch.tipo,
    materia: null,
    jurisdiccion: "ES",
    version: patch.version ?? "1.0.0",
    estado: patch.estado,
    aprobada_por: null,
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: patch.capa1_inmutable ?? `${patch.tipo} {{denominacion_social}}`,
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
    created_at: "2026-04-26T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  };
}

describe("process-documents", () => {
  it("prioriza ACTIVA sobre APROBADA e ignora REVISADA para documentos finales", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "revisada", tipo: "CONVOCATORIA", estado: "REVISADA" }),
        template({ id: "aprobada", tipo: "CONVOCATORIA", estado: "APROBADA" }),
        template({ id: "activa", tipo: "CONVOCATORIA", estado: "ACTIVA" }),
      ],
      ["CONVOCATORIA"],
    );

    expect(selected?.id).toBe("activa");
  });

  it("no selecciona plantillas solo revisadas para documentos finales", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "revisada", tipo: "CONVOCATORIA", estado: "REVISADA" }),
      ],
      ["CONVOCATORIA"],
    );

    expect(selected).toBeNull();
  });

  it("respeta prioridad de tipos para SL antes que convocatoria genérica", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "generica", tipo: "CONVOCATORIA", estado: "ACTIVA" }),
        template({ id: "sl", tipo: "CONVOCATORIA_SL_NOTIFICACION", estado: "APROBADA" }),
      ],
      ["CONVOCATORIA_SL_NOTIFICACION", "CONVOCATORIA"],
    );

    expect(selected?.id).toBe("sl");
  });

  it("ignora plantillas sin capa inmutable", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "sin-contenido", tipo: "INFORME_PRECEPTIVO", estado: "ACTIVA", capa1_inmutable: "" }),
        template({ id: "con-contenido", tipo: "INFORME_PRECEPTIVO", estado: "APROBADA" }),
      ],
      ["INFORME_PRECEPTIVO"],
    );

    expect(selected?.id).toBe("con-contenido");
  });

  it("filtra por jurisdicción y materia cuando el proceso aporta criterios", () => {
    const selected = selectProcessTemplate(
      [
        template({
          id: "global",
          tipo: "MODELO_ACUERDO",
          estado: "ACTIVA",
          jurisdiccion: "GLOBAL",
          materia_acuerdo: "NOMBRAMIENTO_AUDITOR",
        }),
        template({
          id: "es-cuentas",
          tipo: "MODELO_ACUERDO",
          estado: "ACTIVA",
          jurisdiccion: "ES",
          materia_acuerdo: "APROBACION_CUENTAS",
        }),
        template({
          id: "pt-cuentas",
          tipo: "MODELO_ACUERDO",
          estado: "ACTIVA",
          jurisdiccion: "PT",
          materia_acuerdo: "APROBACION_CUENTAS",
        }),
      ],
      ["MODELO_ACUERDO"],
      { jurisdiction: "ES", materia: "APROBACION_CUENTAS" },
    );

    expect(selected?.id).toBe("es-cuentas");
  });

  it("respeta plantilla preferida si es utilizable y compatible", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "activa-default", tipo: "CERTIFICACION", estado: "ACTIVA" }),
        template({ id: "aprobada-preferida", tipo: "CERTIFICACION", estado: "APROBADA" }),
      ],
      ["CERTIFICACION"],
      {},
      "aprobada-preferida",
    );

    expect(selected?.id).toBe("aprobada-preferida");
  });

  it("ignora plantilla preferida incompatible y usa fallback de selección", () => {
    const selected = selectProcessTemplate(
      [
        template({ id: "incompatible", tipo: "ACTA_SESION", estado: "ACTIVA" }),
        template({ id: "certificacion", tipo: "CERTIFICACION", estado: "ACTIVA" }),
      ],
      ["CERTIFICACION"],
      {},
      "incompatible",
    );

    expect(selected?.id).toBe("certificacion");
  });

  it("selecciona fixture legal de convocatoria segun familia de organo", () => {
    const consejo = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["CONVOCATORIA"],
      { jurisdiction: "ES", organoTipo: "CDA" },
    );
    const junta = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["CONVOCATORIA"],
      { jurisdiction: "ES", organoTipo: "JUNTA_GENERAL" },
    );

    expect(consejo?.id).toBe("legal-fixture-convocatoria-consejo-es");
    expect(junta?.id).toBe("legal-fixture-convocatoria-junta-es");
  });

  it("selecciona fixtures legales por modo de adopcion para procesos no reunidos", () => {
    const socioUnico = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["ACTA_CONSIGNACION"],
      { jurisdiction: "ES", adoptionMode: "UNIPERSONAL_SOCIO" },
    );
    const adminUnico = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["ACTA_CONSIGNACION"],
      { jurisdiction: "ES", adoptionMode: "UNIPERSONAL_ADMIN" },
    );
    const noSession = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["ACTA_ACUERDO_ESCRITO"],
      { jurisdiction: "ES", adoptionMode: "NO_SESSION" },
    );

    expect(socioUnico?.id).toBe("legal-fixture-acta-consignacion-socio-unico-es");
    expect(adminUnico?.id).toBe("legal-fixture-acta-consignacion-admin-unico-es");
    expect(noSession?.id).toBe("legal-fixture-acta-acuerdo-escrito-sin-sesion-es");
  });

  it("prioriza fixtures registrales especificos frente a informes PRE genericos", () => {
    const registral = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["DOCUMENTO_REGISTRAL", "INFORME_DOCUMENTAL_PRE", "INFORME_PRECEPTIVO"],
      { jurisdiction: "ES" },
    );
    const subsanacion = selectProcessTemplate(
      LEGAL_TEAM_TEMPLATE_FIXTURES,
      ["SUBSANACION_REGISTRAL", "DOCUMENTO_REGISTRAL", "INFORME_DOCUMENTAL_PRE"],
      { jurisdiction: "ES" },
    );

    expect(registral?.id).toBe("legal-fixture-documento-registral-es");
    expect(subsanacion?.id).toBe("legal-fixture-subsanacion-registral-es");
  });

  it("el footer DOCX mantiene postura probatoria demo-safe", () => {
    const lines = buildProcessDocumentTraceFooterLines(
      {
        kind: "CERTIFICACION",
        recordId: "cert-1",
        title: "Certificacion",
        templateTypes: ["CERTIFICACION"],
        plantillas: [],
        variables: { agreement_id: "00000000-0000-4000-8000-000000000001" },
        fallbackText: "Certificacion",
      },
      template({ id: "cert-template", tipo: "CERTIFICACION", estado: "ACTIVA" }),
      { agreement_id: "00000000-0000-4000-8000-000000000001" },
      {
        attempted: true,
        archived: true,
        documentUrls: ["matter-documents://doc"],
        evidenceBundleIds: ["bundle-1"],
        attachmentIds: [],
        agreementIds: ["00000000-0000-4000-8000-000000000001"],
        errors: [],
      },
    ).join("\n");

    expect(lines).toContain("TRAZABILIDAD DOCUMENTAL");
    expect(lines).toContain("Postura probatoria: Evidencia demo archivada");
    expect(lines).toContain("Evidencia final productiva: no");
    expect(lines).toContain("audit/retention/legal hold");
  });

  it("el diagnostico interno no promociona bundle demo archivado a evidencia final productiva", () => {
    const agreementTrace = resolveAgreementDocumentTrace({
      kind: "CERTIFICACION",
      explicitAgreementIds: ["00000000-0000-4000-8000-000000000001"],
    });
    const archive = {
      attempted: true,
      archived: true,
      documentUrls: ["matter-documents://doc"],
      evidenceBundleIds: ["bundle-1"],
      attachmentIds: [],
      agreementIds: ["00000000-0000-4000-8000-000000000001"],
      errors: [],
    };
    const evidencePosture = resolveDocumentEvidencePosture(agreementTrace, archive);
    const readiness = resolveProcessDocumentFinalEvidenceReadiness({
      agreementTrace,
      evidencePosture,
      archive,
      contentHash: "sha512-demo-hash",
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.finalProductiveEvidence).toBe(false);
    expect(readiness.blockedBy).toContain("SOURCE_ARTIFACT_NOT_PROMOTION_CANDIDATE");
    expect(readiness.blockedBy).toContain("AUDIT_NOT_CLOSED");
    expect(readiness.blockedBy).not.toContain("OWNER_RECORD_MISSING");
    expect(readiness.blockedBy).not.toContain("STORAGE_OBJECT_MISSING");
    expect(readiness.blockedBy).not.toContain("CONTENT_HASH_MISSING");
    expect(readiness.blockedBy).not.toContain("EVIDENCE_BUNDLE_MISSING");
  });
});
