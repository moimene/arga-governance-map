import { describe, expect, it } from "vitest";
import type { AgreementListRow } from "@/hooks/useAgreementsList";
import {
  buildRegistryFallback,
  buildRegistryVariables,
  registryDocumentGeneratedAt,
  registryNotaryLabel,
} from "../registry-document-variables";

const agreement: AgreementListRow = {
  id: "e530cc60-43d8-4b7a-862c-24c9b5b601e0",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  entity_id: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
  body_id: null,
  agreement_kind: "NOMBRAMIENTO_CONSEJERO",
  matter_class: "ORDINARIA",
  inscribable: true,
  adoption_mode: "MEETING",
  proposal_text: "Nombramiento de Dña. Beatriz Salas Ortega como consejera independiente",
  decision_text: "Nombramiento de Dña. Beatriz Salas Ortega como consejera independiente",
  decision_date: "2026-08-20",
  status: "CERTIFIED",
  created_at: "2026-08-20T12:00:00.000Z",
};

const context = {
  agreement,
  entityName: "ARGA Seguros, S.A.",
  legalName: "ARGA Seguros, S.A.",
  instrumentData: {
    notary: "Notaría Demo López García, Madrid",
    deedDate: "2026-08-21",
    protocolNumber: "DEMO/2026/BSO-001",
  },
  filingChannel: "REGISTRO_MERCANTIL",
  filingStatus: "DRAFT",
  filingType: "ESCRITURA",
  instrumentRequired: "ESCRITURA",
};

describe("registry document variables", () => {
  it("renders business labels and never duplicates the notary prefix", () => {
    const values = buildRegistryVariables(context);

    expect(values.modo_adopcion).toBe("Sesión formal");
    expect(values.materia_etiqueta).toBe("Nombramiento de consejero");
    expect(values.instrumento_requerido_label).toBe("Escritura pública");
    expect(values.tipo_presentacion_label).toBe("Inscripción mediante escritura pública");
    expect(values.canal_presentacion_label).toBe("Registro Mercantil (España)");
    expect(values.fecha).toBe("21/08/2026");
    expect(values.documentacion_texto).toContain("Notaría Demo López García, Madrid");
    expect(values.documentacion_texto).not.toContain("Notaría Notaría");
  });

  it("uses the deed date as the effective document date and keeps a readable fallback", () => {
    expect(registryDocumentGeneratedAt(context.instrumentData)).toBe("2026-08-21");
    expect(registryNotaryLabel("López García, Madrid")).toBe("Notaría López García, Madrid");
    const fallback = buildRegistryFallback(context);
    expect(fallback).toContain("Forma de adopción: Sesión formal");
    expect(fallback).toContain("Fecha de escritura: 21/08/2026");
    expect(fallback).toContain("Nombramiento de Dña. Beatriz Salas Ortega");
  });
});
