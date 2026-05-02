import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  buildLegalTemplateReviewRows,
  matchesLegalTemplateReviewFilter,
  summarizeLegalTemplateReview,
} from "../legal-template-review";
import {
  LEGAL_TEMPLATE_APPROVAL_PLAN,
  LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY,
} from "../legal-template-approval-plan";

function template(patch: Partial<PlantillaProtegidaRow> & Pick<PlantillaProtegidaRow, "id" | "tipo">) {
  return {
    id: patch.id,
    tenant_id: patch.tenant_id ?? "tenant",
    tipo: patch.tipo,
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comite Legal",
    fecha_aprobacion: "2026-04-30T00:00:00.000Z",
    contenido_template: null,
    capa1_inmutable: "contenido",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: "LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: null,
    organo_tipo: null,
    contrato_variables_version: null,
    created_at: "2026-04-30T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  } as PlantillaProtegidaRow;
}

describe("legal-template-review", () => {
  it("mantiene la matriz legal final cerrada por Legal", () => {
    const counts = LEGAL_TEMPLATE_APPROVAL_PLAN.reduce<Record<string, number>>((acc, item) => {
      acc[item.decision] = (acc[item.decision] ?? 0) + 1;
      return acc;
    }, {});

    expect(LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY.matrixRows).toBe(33);
    expect(LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY.approved).toBe(10);
    expect(LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY.approvedWithVariants).toBe(23);
    expect(LEGAL_TEMPLATE_APPROVAL_REPORT_SUMMARY.supportDocumentsApproved).toBe(2);
    expect(LEGAL_TEMPLATE_APPROVAL_PLAN).toHaveLength(35);
    expect(counts.APROBADA).toBe(12);
    expect(counts.APROBADA_CON_VARIANTES).toBe(23);
  });

  it("distingue plantilla activa operativa de aprobacion legal formal", () => {
    const [approved, unapproved] = buildLegalTemplateReviewRows([
      template({ id: "acta-ok", tipo: "ACTA_SESION" }),
      template({
        id: "acta-sin-aprobacion",
        tipo: "ACTA_SESION",
        aprobada_por: null,
        fecha_aprobacion: null,
      }),
    ]);

    expect(approved.status).toBe("legally_approved");
    expect(approved.canClaimLegalApproval).toBe(true);
    expect(unapproved.status).toBe("operational_unapproved");
    expect(unapproved.flags.missingApproval).toBe(true);
    expect(matchesLegalTemplateReviewFilter(unapproved, "MISSING_APPROVAL")).toBe(true);
  });

  it("marca modelos de acuerdo tecnicos con revision legal pendiente", () => {
    const [row] = buildLegalTemplateReviewRows([
      template({
        id: "modelo-draft",
        tipo: "MODELO_ACUERDO",
        version: "0.1.0",
        aprobada_por: null,
        fecha_aprobacion: null,
        referencia_legal: null,
        notas_legal: "Oleada 2 STUB - Pendiente revision legal.",
        adoption_mode: null,
        organo_tipo: null,
        materia_acuerdo: "AUMENTO_CAPITAL",
      }),
    ]);

    expect(row.status).toBe("needs_review");
    expect(row.flags.draftVersion).toBe(true);
    expect(row.flags.missingReference).toBe(true);
    expect(row.flags.missingOwner).toBe(true);
    expect(row.reasons.join(" ")).toContain("STUB");
  });

  it("detecta duplicados por materia para que Legal decida variante o consolidacion", () => {
    const rows = buildLegalTemplateReviewRows([
      template({
        id: "nombramiento-junta",
        tipo: "MODELO_ACUERDO",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "JUNTA_GENERAL",
      }),
      template({
        id: "nombramiento-consejo",
        tipo: "MODELO_ACUERDO",
        materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
        adoption_mode: "MEETING",
        organo_tipo: "CONSEJO_ADMINISTRACION",
      }),
    ]);

    expect(rows.every((row) => row.flags.duplicateMatter)).toBe(true);
    expect(rows.every((row) => matchesLegalTemplateReviewFilter(row, "DUPLICATE_MATTER"))).toBe(true);
  });

  it("aplica el informe legal final como plan de aprobacion", () => {
    const [pre, garantia] = buildLegalTemplateReviewRows([
      template({
        id: "pre",
        tipo: "INFORME_PRECEPTIVO",
        materia: "CONVOCATORIA_PRE",
        aprobada_por: null,
        fecha_aprobacion: null,
      }),
      template({
        id: "garantia",
        tipo: "MODELO_ACUERDO",
        materia_acuerdo: "AUTORIZACION_GARANTIA",
        version: "0.1.0",
        aprobada_por: null,
        fecha_aprobacion: null,
        adoption_mode: "MEETING",
        organo_tipo: "JUNTA_GENERAL",
      }),
    ]);

    expect(pre.approvalDecision).toBe("APROBADA");
    expect(pre.proposedVersion).toBe("1.0.1");
    expect(pre.canClaimLegalApproval).toBe(false);
    expect(matchesLegalTemplateReviewFilter(pre, "LEGAL_REPORT_APPROVED")).toBe(true);

    expect(garantia.approvalDecision).toBe("APROBADA");
    expect(garantia.proposedVersion).toBe("1.0.0");
    expect(garantia.reasons.join(" ")).toContain("Version tecnica");
    expect(matchesLegalTemplateReviewFilter(garantia, "LEGAL_REPORT_APPROVED")).toBe(true);
  });

  it("clasifica fixtures locales como puente no persistente", () => {
    const [row] = buildLegalTemplateReviewRows([
      template({
        id: "fixture",
        tenant_id: "local-legal-fixture",
        tipo: "DOCUMENTO_REGISTRAL",
        aprobada_por: null,
        fecha_aprobacion: null,
        version: "LEGAL-FIXTURE-2026-04-28",
      }),
    ]);

    expect(row.status).toBe("fixture_bridge");
    expect(row.flags.localFixture).toBe(true);
    expect(row.canClaimLegalApproval).toBe(false);
    expect(matchesLegalTemplateReviewFilter(row, "LOCAL_FIXTURE")).toBe(true);
  });

  it("resume contadores para el panel de revision legal", () => {
    const rows = buildLegalTemplateReviewRows([
      template({ id: "ok", tipo: "ACTA_SESION" }),
      template({ id: "sin-aprobacion", tipo: "CERTIFICACION", aprobada_por: null, fecha_aprobacion: null }),
      template({ id: "draft", tipo: "MODELO_ACUERDO", version: "1", materia_acuerdo: "FORMULACION_CUENTAS", adoption_mode: null, organo_tipo: null }),
      template({ id: "fixture", tenant_id: "local-legal-fixture", tipo: "DOCUMENTO_REGISTRAL" }),
    ]);

    const summary = summarizeLegalTemplateReview(rows);
    expect(summary.total).toBe(4);
    expect(summary.legallyApproved).toBe(1);
    expect(summary.operationalUnapproved).toBe(1);
    expect(summary.fixtureBridge).toBe(1);
    expect(summary.draftVersion).toBe(1);
    expect(summary.missingOwner).toBe(1);
    expect(summary.legalReportApproved).toBe(1);
    expect(summary.legalReportApprovedWithVariants).toBe(1);
  });
});
