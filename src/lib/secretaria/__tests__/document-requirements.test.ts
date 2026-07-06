import { describe, expect, it } from "vitest";
import {
  buildDocumentAnnexManifest,
  buildDocumentRequirementExplainNodes,
  computeDocumentAnnexManifestHash,
  evaluateRequirementBlockingState,
  resolveDocumentRequirementsForAgreement,
  type DocumentRequirementRule,
} from "../document-requirements";

const baseRule: DocumentRequirementRule = {
  requirement_code: "INFORME_ADMIN",
  document_kind: "INFORME_PRECEPTIVO",
  title: "Informe de administradores",
  fase: "CONVOCATORIA",
  required_level: "OBLIGATORIO",
  blocking_policy: "BLOCKING",
  legal_basis: "LSC",
  annex_targets: ["CONVOCATORIA", "ACTA", "CERTIFICACION"],
  template_binding_key: "INFORME_ADMIN",
};

describe("document-requirements", () => {
  it("deduplica un mismo informe exigido por varias reglas sin perder trazabilidad", () => {
    const requirements = resolveDocumentRequirementsForAgreement({
      context: { matter_code: "MODIFICACION_ESTATUTOS", flags: {} },
      rules: [
        { ...baseRule, source_ref: "rulepack:A", dedup_key: "informe-admin" },
        {
          ...baseRule,
          requirement_code: "INFORME_ADMIN_REFUERZO",
          source_ref: "rulepack:B",
          dedup_key: "informe-admin",
          annex_targets: ["REGISTRO"],
        },
      ],
      templates: [{ id: "tpl-1", tipo: "INFORME_PRECEPTIVO", estado: "ACTIVA", template_binding_key: "INFORME_ADMIN" }],
    });

    expect(requirements).toHaveLength(1);
    expect(requirements[0].source_refs).toEqual(["rulepack:A", "rulepack:B"]);
    expect(requirements[0].annex_targets).toEqual(["CONVOCATORIA", "ACTA", "CERTIFICACION", "REGISTRO"]);
    expect(requirements[0].template_status).toBe("FOUND");
  });

  it("bloquea cuando un informe obligatorio aplicable no tiene plantilla activa", () => {
    const requirements = resolveDocumentRequirementsForAgreement({
      context: { matter_code: "AUMENTO_CAPITAL", flags: { requiereInforme: true } },
      rules: [{ ...baseRule, condition: { flag: "requiereInforme", equals: true } }],
      templates: [],
    });

    expect(requirements[0].severity).toBe("BLOCKING");
    expect(evaluateRequirementBlockingState(requirements).ok).toBe(false);
    expect(buildDocumentRequirementExplainNodes(requirements)[0].message).toContain("sin plantilla activa");
  });

  it("marca como no aplicable cuando la condición no se cumple", () => {
    const requirements = resolveDocumentRequirementsForAgreement({
      context: { matter_code: "DIVIDENDO", flags: { requiereInforme: false } },
      rules: [{ ...baseRule, condition: { flag: "requiereInforme", equals: true } }],
      templates: [],
    });

    expect(requirements[0].condition_met).toBe(false);
    expect(requirements[0].template_status).toBe("NOT_REQUIRED");
    expect(requirements[0].severity).toBe("INFO");
  });

  it("construye un manifiesto de anexos estable para certificación", async () => {
    const a = buildDocumentAnnexManifest({
      linkedDomain: "standalone_certification",
      linkedId: "cert-1",
      certificationBundleOnly: true,
      items: [
        {
          artifact_id: "artifact-b",
          linked_domain: "standalone_certification",
          linked_id: "cert-1",
          annex_role: "REGISTRO",
          annex_order: 2,
          included_in_certification_bundle: true,
          source_hash: "hash-b",
        },
        {
          artifact_id: "artifact-a",
          linked_domain: "standalone_certification",
          linked_id: "cert-1",
          annex_role: "CERTIFICACION",
          annex_order: 1,
          included_in_certification_bundle: true,
          source_hash: "hash-a",
        },
        {
          artifact_id: "artifact-c",
          linked_domain: "standalone_certification",
          linked_id: "cert-1",
          annex_role: "BOARD_PACK",
          annex_order: 3,
          included_in_certification_bundle: false,
          source_hash: "hash-c",
        },
      ],
    });
    const b = buildDocumentAnnexManifest({
      linkedDomain: "standalone_certification",
      linkedId: "cert-1",
      certificationBundleOnly: true,
      items: [...a.items].reverse(),
    });

    expect(a.count).toBe(2);
    expect(a.items.map((item) => item.artifact_id)).toEqual(["artifact-a", "artifact-b"]);
    await expect(computeDocumentAnnexManifestHash(a)).resolves.toBe(await computeDocumentAnnexManifestHash(b));
  });
});
