import { describe, expect, it } from "vitest";
import {
  DOCUMENT_OUTPUT_VERSION,
  documentOutputContextFromVariables,
  documentFilenamePrefix,
  formatSpanishLegalDate,
  normalizeVisibleDocumentText,
  validateVisibleDocumentOutput,
} from "../document-output-normalizer";

describe("document-output-normalizer", () => {
  it("humaniza solo valores conocidos y deja visibles los enums desconocidos para bloquearlos", () => {
    expect(
      normalizeVisibleDocumentText(
        "D./D.ª Dña. Lucía · 2026-08-20 · MEETING · canal_documentacion · true · Notaría Notaría Demo",
      ),
    ).toBe(
      "Dña. Lucía · 20 de agosto de 2026 · Sesión formal · canal_documentacion · Sí · Notaría Demo",
    );
    expect(
      validateVisibleDocumentOutput(
        "ACTA",
        normalizeVisibleDocumentText("ACTA · VALOR_DESCONOCIDO · canal_documentacion"),
      ).map((issue) => issue.code),
    ).toContain("VISIBLE_MACHINE_VALUE");
  });

  it("humaniza todas las rutas habilitantes del convocante del Consejo", () => {
    expect(
      normalizeVisibleDocumentText(
        "PRESIDENTE · QUIEN_HAGA_SUS_VECES · CONSEJEROS_ART_246_2",
      ),
    ).toBe(
      "Presidente · quien haga sus veces · consejeros habilitados conforme al artículo 246.2 LSC",
    );
  });

  it("humaniza la materia autónoma de representación del socio único", () => {
    expect(
      normalizeVisibleDocumentText("DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"),
    ).toBe("designación de representante de la socia única en la filial");
    expect(
      normalizeVisibleDocumentText("NOMBRAMIENTO_REPRESENTANTE_FILIAL"),
    ).toBe("designación de representante de la sociedad en filial o participada");
  });

  it("bloquea trazas, UUID y un delegado obligatorio vacío", () => {
    const result = validateVisibleDocumentOutput(
      "MODELO_ACUERDO",
      "ACUERDO\nSe acuerda delegar en la figura de  (consejero delegado).\nTrazabilidad del acto: agreement_id = 77ea753c-d89e-4285-a946-d38c294bae06",
    );
    expect(result.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["VISIBLE_INTERNAL_UUID", "VISIBLE_INTERNAL_TRACE", "REQUIRED_RECIPIENT_BLANK"]),
    );
  });

  it("exige aviso y marca demo en documentos registrales", () => {
    const result = validateVisibleDocumentOutput(
      "DOCUMENTO_REGISTRAL",
      "DOCUMENTO REGISTRAL\nSociedad: ARGA Seguros, S.A.",
    );
    expect(result.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["REGISTRY_DEMO_MARKER_MISSING", "REGISTRY_SCOPE_NOTICE_MISSING"]),
    );
  });

  it("usa fecha jurídica española y nombre demo para salidas registrales", () => {
    expect(formatSpanishLegalDate("2026-08-08")).toBe("8 de agosto de 2026");
    expect(documentFilenamePrefix("DOCUMENTO_REGISTRAL", "documento_registral")).toBe(
      "DEMO_documento_registral",
    );
  });

  it("retira UUID técnicos del cuerpo y conserva una referencia jurídica legible", () => {
    const normalized = normalizeVisibleDocumentText(
      "Convocatoria documentada en el expediente 5076f488-d9c6-43ac-aa3e-5c3aaea484f4.",
    );

    expect(normalized).toBe(
      "La convocatoria se encuentra documentada en el expediente societario.",
    );
    expect(validateVisibleDocumentOutput("ACTA", normalized)).toEqual([]);
  });

  it("retira controles EAD vacíos sin reescribir referencias jurídicas", () => {
    const normalized = normalizeVisibleDocumentText(
      "Plazo conforme al artículo 245.3 de la Ley de Sociedades de Capital.\n" +
      "Firma del convocante:   \nSello de tiempo (si aplica): ",
    );

    expect(normalized).toBe(
      "Plazo conforme al artículo 245.3 de la Ley de Sociedades de Capital.",
    );
  });

  it("exige vigencia del cargo y circunstancias de aprobación en certificaciones", () => {
    const issues = validateVisibleDocumentOutput(
      "CERTIFICACION",
      "CERTIFICACIÓN\nFirma del certificante: Lucía.\nVisto bueno de la Presidencia: Antonio.",
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CERTIFICATION_CURRENT_ROLE_MISSING",
        "CERTIFICATION_MINUTE_APPROVAL_MISSING",
      ]),
    );
  });

  it("bloquea cronologías societarias imposibles", () => {
    const text =
      "CERTIFICACIÓN\nDña. Lucía, Secretaria, cargo vigente y en ejercicio.\n" +
      "El acta fue aprobada mediante firma por la Secretaría el 8 de agosto de 2026.\n" +
      "Firma del certificante: Lucía.\nVisto bueno de la Presidencia: Antonio.";
    const issues = validateVisibleDocumentOutput("CERTIFICACION", text, {
      meetingDateISO: "2026-08-08",
      approvalDateISO: "2026-08-08",
      emissionDateISO: "2026-07-20",
    });

    expect(issues.map((issue) => issue.code)).toContain("INVALID_CERTIFICATION_CHRONOLOGY");
  });

  it("deriva el contexto cronológico desde variables jurídicas y mantiene semver puro", () => {
    expect(
      documentOutputContextFromVariables(
        {
          fecha_junta: "8/8/2026",
          fecha_aprobacion_acta_iso: "2026-08-08",
          fecha_emision_iso: "2026-08-09",
        },
        "2026-07-20",
      ),
    ).toEqual({
      meetingDateISO: "8/8/2026",
      approvalDateISO: "2026-08-08",
      emissionDateISO: "2026-08-09",
    });
    expect(DOCUMENT_OUTPUT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
