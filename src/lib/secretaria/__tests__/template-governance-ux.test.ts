import { describe, expect, it } from "bun:test";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { LegalTemplateCoverageRow } from "@/lib/secretaria/legal-template-coverage";
import type { LegalTemplateReviewRow } from "@/lib/secretaria/legal-template-review";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
import {
  buildTemplateGovernanceIncidents,
  compareTemplateGovernanceVersions,
  groupTemplatesForGovernance,
} from "@/lib/secretaria/template-governance-ux";

function template(patch: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "template-1",
    tenant_id: "tenant-1",
    tipo: "MODELO_ACUERDO",
    materia: "NOMBRAMIENTO_CONSEJERO",
    materia_acuerdo: "NOMBRAMIENTO_CONSEJERO",
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comité Legal",
    fecha_aprobacion: "2026-07-01",
    contenido_template: null,
    capa1_inmutable: "Texto protegido ".repeat(12),
    capa2_variables: [],
    capa3_editables: [],
    referencia_legal: "LSC art. 214",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: "MEETING",
    organo_tipo: "JUNTA_GENERAL",
    tipo_social: null,
    contrato_variables_version: "1.1",
    created_at: "2026-07-01T00:00:00.000Z",
    approval_checklist: [],
    version_history: [],
    ...patch,
  };
}

const emptyFlags: LegalTemplateReviewRow["flags"] = {
  missingApproval: false,
  draftVersion: false,
  notesRequireReview: false,
  missingReference: false,
  missingOwner: false,
  duplicateMatter: false,
  localFixture: false,
  legalReportApproved: false,
  legalReportApprovedWithVariants: false,
};

function review(
  templateId: string,
  patch: Partial<LegalTemplateReviewRow> = {},
): LegalTemplateReviewRow {
  return {
    templateId,
    status: "legally_approved",
    label: "Aprobada legalmente",
    requiresLegalReview: false,
    canClaimLegalApproval: true,
    isOperationalActive: true,
    reasons: [],
    flags: emptyFlags,
    duplicateKey: null,
    approvalPlan: null,
    approvalDecision: null,
    proposedVersion: null,
    ...patch,
    flags: { ...emptyFlags, ...patch.flags },
  };
}

function coverage(
  key: string,
  state: LegalTemplateCoverageRow["state"],
  patch: Partial<LegalTemplateCoverageRow> = {},
): LegalTemplateCoverageRow {
  return {
    key,
    label: key,
    tipo: "ACTA_SESION",
    organoTipo: null,
    adoptionMode: null,
    critical: true,
    state,
    sourceLabel: state,
    activeCloudCount: state === "cloud_active" ? 1 : 0,
    pendingCloudCount: state === "cloud_pending" ? 1 : 0,
    fixtureAvailable: state === "fixture_pending_load",
    cloudTemplateIds: [],
    fixtureTemplateId: null,
    ...patch,
  };
}

function issue(
  code: string,
  severity: GatePreIssue["severity"] = "BLOCKING",
): GatePreIssue {
  return { code, severity, message: code };
}

describe("template-governance-ux · catálogo agrupado", () => {
  it("elige como head la ACTIVA de mayor versión y conserva la serie completa", () => {
    const groups = groupTemplatesForGovernance([
      template({ id: "historical-1", estado: "ARCHIVADA", version: "1.0.0" }),
      template({ id: "active-1", estado: "ACTIVA", version: "1.2.0" }),
      template({ id: "future-archive", estado: "ARCHIVADA", version: "2.0.0" }),
      template({ id: "active-2", estado: "ACTIVA", version: "1.10.0" }),
    ]);

    const family = groups[0].matters[0].families[0];
    expect(family.head.id).toBe("active-2");
    expect(family.versions.map((row) => row.id)).toEqual([
      "active-2",
      "future-archive",
      "active-1",
      "historical-1",
    ]);
    expect(family.activeCount).toBe(2);
    expect(family.hasCurrent).toBe(true);
    expect(family.hasHistoricalOnly).toBe(false);
  });

  it("marca una serie solo histórica y elige su mayor versión semántica", () => {
    const groups = groupTemplatesForGovernance([
      template({ id: "v1-9", estado: "ARCHIVADA", version: "1.9.0" }),
      template({ id: "v1-10", estado: "ARCHIVADA", version: "1.10.0" }),
    ]);

    const family = groups[0].matters[0].families[0];
    expect(family.head.id).toBe("v1-10");
    expect(family.hasCurrent).toBe(false);
    expect(family.hasHistoricalOnly).toBe(true);
    expect(compareTemplateGovernanceVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareTemplateGovernanceVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
  });

  it("canoniza alias de materia sin mezclar variantes Junta/Consejo", () => {
    const groups = groupTemplatesForGovernance([
      template({ id: "junta", materia: "AMPLIACION_CAPITAL", materia_acuerdo: null }),
      template({
        id: "consejo",
        materia: "AUMENTO_CAPITAL",
        materia_acuerdo: null,
        organo_tipo: "CONSEJO_ADMIN",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].matters).toHaveLength(1);
    expect(groups[0].matters[0].canonicalMatter).toBe("AUMENTO_CAPITAL");
    expect(groups[0].matters[0].families).toHaveLength(2);
    expect(groups[0].matters[0].families.map((family) => family.organoTipo)).toEqual([
      "CONSEJO_ADMIN",
      "JUNTA_GENERAL",
    ]);
  });

  it("mantiene visible el target histórico exacto aunque no supere los filtros", () => {
    const groups = groupTemplatesForGovernance(
      [
        template({ id: "junta-current" }),
        template({
          id: "consejo-current",
          organo_tipo: "CONSEJO_ADMIN",
          version: "2.0.0",
        }),
        template({
          id: "consejo-historical-target",
          organo_tipo: "CONSEJO_ADMIN",
          version: "1.0.0",
          estado: "ARCHIVADA",
        }),
        template({
          id: "unrelated",
          materia: "CESE_CONSEJERO",
          materia_acuerdo: "CESE_CONSEJERO",
        }),
      ],
      {
        matchingTemplateIds: new Set(["junta-current"]),
        targetTemplateId: "consejo-historical-target",
      },
    );

    expect(groups[0].matters).toHaveLength(1);
    const families = groups[0].matters[0].families;
    expect(families).toHaveLength(2);
    const targetFamily = families.find((family) => family.containsTarget);
    expect(targetFamily?.targetTemplateId).toBe("consejo-historical-target");
    expect(targetFamily?.hasMatchingVersion).toBe(false);
    expect(targetFamily?.versions.map((row) => row.id)).toContain("consejo-current");
    expect(targetFamily?.versions.map((row) => row.id)).toContain("consejo-historical-target");
    expect(groups[0].templateCount).toBe(3);
  });
});

describe("template-governance-ux · cola de incidencias", () => {
  it("agrega fuentes canónicas, deduplica por concepto y ordena ERROR/WARNING/INFO", () => {
    const templates = [
      template({ id: "active-a" }),
      template({ id: "active-b" }),
      template({ id: "active-c" }),
      template({ id: "archived", estado: "ARCHIVADA" }),
      template({ id: "fixture", tenant_id: "local-legal-fixture" }),
    ];
    const legalReviewRows = [
      review("active-a", {
        status: "needs_review",
        requiresLegalReview: true,
        duplicateKey: "same-functional-key",
        flags: { ...emptyFlags, duplicateMatter: true, missingReference: true },
      }),
      review("active-b", {
        status: "needs_review",
        requiresLegalReview: true,
        duplicateKey: "same-functional-key",
        flags: { ...emptyFlags, duplicateMatter: true, missingReference: true },
      }),
      review("archived", {
        status: "needs_review",
        requiresLegalReview: true,
        flags: { ...emptyFlags, missingOwner: true },
      }),
      review("fixture", {
        status: "fixture_bridge",
        requiresLegalReview: true,
        flags: { ...emptyFlags, localFixture: true, missingApproval: true },
      }),
    ];

    const incidents = buildTemplateGovernanceIncidents({
      templates,
      legalReviewRows,
      extendedCoverage: [
        coverage("missing-acta", "missing"),
        coverage("provisional-cert", "fixture_pending_load", {
          fixtureTemplateId: "fixture-cert",
        }),
        coverage("pending-model", "cloud_pending", {
          cloudTemplateIds: ["pending-template"],
        }),
        coverage("covered", "cloud_active", { cloudTemplateIds: ["active-c"] }),
      ],
      coreGaps: [{ organo: "CONSEJO_ADMIN", materia: "FORMULACION_CUENTAS" }],
      coreGapCount: 2,
      orphanCount: 3,
      p0TemplateIds: new Set(["active-c", "archived"]),
      gateIssuesByTemplate: new Map([
        [
          "active-a",
          [
            issue("META_REF_LEGAL_FORMAT"),
            issue("DUP_ACTIVE_FUNCTIONAL_KEY"),
            issue("CAPA1_LENGTH"),
            issue("CAPA2_UNUSED_VARIABLE", "INFO"),
          ],
        ],
        ["active-b", [issue("CAPA1_LENGTH")]],
        ["archived", [issue("CAPA3_PREFIJO_PROTEGIDO")]],
      ]),
    });

    expect(incidents.map((incident) => incident.severity)).toEqual(
      [...incidents.map((incident) => incident.severity)].sort(
        (left, right) =>
          ({ ERROR: 0, WARNING: 1, INFO: 2 })[left] -
          ({ ERROR: 0, WARNING: 1, INFO: 2 })[right],
      ),
    );

    const duplicate = incidents.filter(
      (incident) => incident.concept === "active-functional-duplicate",
    );
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0].affected).toBe(2);
    expect(duplicate[0].firstTemplateId).toBe("active-a");

    const missingReference = incidents.find(
      (incident) => incident.concept === "legal-reference-missing",
    );
    expect(missingReference?.affected).toBe(2);

    const capa1 = incidents.find(
      (incident) => incident.concept === "document-check:CAPA1_LENGTH",
    );
    expect(capa1?.affected).toBe(2);
    expect(capa1?.technicalCodes).toEqual(["CAPA1_LENGTH"]);

    expect(
      incidents.some((incident) => incident.technicalCodes.includes("META_REF_LEGAL_FORMAT")),
    ).toBe(false);
    expect(
      incidents.some((incident) => incident.technicalCodes.includes("DUP_ACTIVE_FUNCTIONAL_KEY")),
    ).toBe(false);
    expect(
      incidents.some((incident) => incident.technicalCodes.includes("CAPA3_PREFIJO_PROTEGIDO")),
    ).toBe(false);

    expect(
      incidents.find((incident) => incident.concept === "core-coverage-missing")?.affected,
    ).toBe(2);
    expect(
      incidents.find((incident) => incident.concept === "traceability-without-changelog")
        ?.affected,
    ).toBe(3);
    expect(incidents.find((incident) => incident.concept === "known-p0-active")?.affected).toBe(
      1,
    );
    expect(
      incidents.filter((incident) => incident.concept.startsWith("extended-coverage-")),
    ).toHaveLength(3);
  });

  it("no convierte históricos incompletos en incidencias de salud vigente", () => {
    const incidents = buildTemplateGovernanceIncidents({
      templates: [template({ id: "historical", estado: "ARCHIVADA" })],
      legalReviewRows: [
        review("historical", {
          requiresLegalReview: true,
          flags: {
            ...emptyFlags,
            missingApproval: true,
            missingOwner: true,
            duplicateMatter: true,
          },
          duplicateKey: "historical-key",
        }),
      ],
      extendedCoverage: [],
      coreGaps: [],
      orphanCount: 0,
      gateIssuesByTemplate: { historical: [issue("CAPA1_LENGTH")] },
      p0TemplateIds: ["historical"],
    });

    expect(incidents).toEqual([]);
  });
});
