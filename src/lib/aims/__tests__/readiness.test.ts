import { describe, expect, it } from "vitest";
import {
  aimsReadOnlyHandoffs,
  aimsScreenPostures,
  buildAimsComplianceMonitors,
  buildAimsReadiness,
  isAimsMaterialIncidentCandidate,
  isAimsTechnicalFileGapCandidate,
} from "../readiness";

describe("buildAimsReadiness", () => {
  it("declara los dominios P0 sin depender de schema aims_*", () => {
    const summary = buildAimsReadiness({
      systems: [
        { id: "sys-1", status: "ACTIVO", risk_level: "Alto" },
        { id: "sys-2", status: "ACTIVO", risk_level: "Limitado" },
      ],
      assessments: [
        {
          id: "assess-1",
          system_id: "sys-1",
          status: "APROBADO",
          findings: [{ code: "AIA-09", status: "CERRADO" }],
        },
      ],
      incidents: [
        {
          id: "incident-1",
          system_id: "sys-1",
          status: "CERRADO",
          severity: "MEDIO",
          root_cause: "Sesgo de muestra",
          corrective_action: "Recalibración documentada",
        },
      ],
    });

    expect(summary.contractId).toBe("aims-p0-readiness");
    expect(summary.sourcePosture).toBe("legacy-ai");
    expect(summary.sourceTables).toEqual(["ai_systems", "ai_risk_assessments", "ai_incidents"]);
    expect(summary.domains.map((domain) => domain.id)).toEqual([
      "inventory",
      "ai-act-assessments",
      "incidents",
      "controls",
      "operational-evidence",
      "migration",
    ]);
    expect(summary.complianceMonitors.map((monitor) => monitor.id)).toEqual([
      "governance-accountability",
      "inventory-classification",
      "prohibited-practices",
      "high-risk-obligations",
      "technical-documentation",
      "data-governance",
      "transparency-user-information",
      "human-oversight",
      "accuracy-robustness-cybersecurity",
      "provider-vendor-third-party",
      "post-market-monitoring",
      "incident-reporting-escalation",
      "fundamental-rights-dpia",
      "iso-42001-management-system",
      "evidence-recordkeeping",
    ]);
    expect(summary.domains.find((domain) => domain.id === "migration")?.metric).toBe("Sin schema nuevo");
    expect(summary.standaloneReady).toBe(true);
  });

  it("marca gap cuando hay alto riesgo sin evaluación aprobada e incidentes abiertos", () => {
    const summary = buildAimsReadiness({
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [],
      incidents: [
        { id: "incident-1", status: "ABIERTO", severity: "CRITICO" },
        { id: "incident-2", status: "EN_INVESTIGACION", severity: "ALTO" },
        { id: "incident-3", status: "ABIERTO", severity: "MEDIO" },
      ],
    });

    expect(summary.domains.find((domain) => domain.id === "ai-act-assessments")?.status).toBe("gap");
    expect(summary.domains.find((domain) => domain.id === "incidents")?.status).toBe("gap");
    expect(summary.standaloneReady).toBe(false);
  });

  it("declara postura pantalla por pantalla sin mezclar ai_* y aims_*", () => {
    expect(aimsScreenPostures.map((screen) => screen.route)).toEqual([
      "/ai-governance",
      "/ai-governance/sistemas",
      "/ai-governance/sistemas/nuevo",
      "/ai-governance/sistemas/:id",
      "/ai-governance/evaluaciones",
      "/ai-governance/incidentes",
      "/ai-governance/incidentes/nuevo",
    ]);

    for (const screen of aimsScreenPostures) {
      expect(screen.owner).toBe("AIMS 360");
      expect(screen.migrationRequired).toBe(false);
      expect(screen.tables.every((table) => table.startsWith("ai_"))).toBe(true);
    }

    const createSystem = aimsScreenPostures.find(
      (screen) => screen.route === "/ai-governance/sistemas/nuevo",
    );
    expect(createSystem?.posture).toBe("legacy_write");
    expect(createSystem?.operation).toBe("owner-write");

    const createIncident = aimsScreenPostures.find(
      (screen) => screen.route === "/ai-governance/incidentes/nuevo",
    );
    expect(createIncident?.posture).toBe("legacy_write");
    expect(createIncident?.operation).toBe("owner-write");

    for (const screen of aimsScreenPostures.filter((screen) => screen.operation !== "owner-write")) {
      expect(screen.posture).toBe("legacy_read");
      expect(screen.operation).toBe("read-only");
    }
  });

  it("mantiene handoffs AIMS como rutas read-only con evidencia etiquetada", () => {
    expect(aimsReadOnlyHandoffs.map((handoff) => handoff.contractEvent)).toEqual([
      "AIMS_TECHNICAL_FILE_GAP",
      "AIMS_INCIDENT_MATERIAL",
      "AIMS_INCIDENT_MATERIAL",
      "SECRETARIA_CERTIFICATION_ISSUED",
    ]);

    for (const handoff of aimsReadOnlyHandoffs) {
      expect(handoff.mutation).toBe("read-only route handoff");
      expect(handoff.targetRoute).not.toContain("governance_module_events");
      expect(handoff.targetRoute).not.toContain("governance_module_links");
    }

    const secretariaReference = aimsReadOnlyHandoffs.find(
      (handoff) => handoff.id === "secretaria-certification-reference-to-aims",
    );
    expect(secretariaReference?.evidencePosture).toBe("REFERENCE");
    expect(secretariaReference?.targetRoute).toContain("evidence=REFERENCE");
  });

  it("detecta gaps técnicos e incidentes materiales solo como candidatos de handoff", () => {
    expect(
      isAimsTechnicalFileGapCandidate({
        id: "assessment-gap",
        status: "EN_REVISION",
        score: 72,
        findings: [{ code: "AIA-12", status: "NO_CONFORME" }],
      }),
    ).toBe(true);

    expect(
      isAimsTechnicalFileGapCandidate({
        id: "assessment-ok",
        status: "APROBADO",
        score: 91,
        findings: [{ code: "AIA-12", status: "CONFORME" }],
      }),
    ).toBe(false);

    expect(
      isAimsMaterialIncidentCandidate({
        id: "incident-material",
        status: "ABIERTO",
        severity: "CRITICO",
      }),
    ).toBe(true);

    expect(
      isAimsMaterialIncidentCandidate({
        id: "incident-closed",
        status: "CERRADO",
        severity: "CRITICO",
      }),
    ).toBe(false);
  });

  it("monitoriza dominios amplios de compliance AIMS sin schema nuevo", () => {
    const monitors = buildAimsComplianceMonitors({
      systems: [
        { id: "sys-1", status: "ACTIVO", risk_level: "Alto", vendor: "Proveedor A" },
        { id: "sys-2", status: "ACTIVO", risk_level: "Inaceptable" },
      ],
      assessments: [
        { id: "assess-1", system_id: "sys-1", status: "EN_REVISION", score: 74 },
        { id: "assess-2", system_id: "sys-2", status: "APROBADO", score: 92 },
      ],
      incidents: [
        { id: "incident-1", status: "ABIERTO", severity: "CRITICO" },
      ],
      complianceChecks: [
        {
          id: "check-data",
          requirement_code: "AIA-10",
          requirement_title: "Data governance",
          status: "NO_CONFORME",
        },
        {
          id: "check-human",
          requirement_code: "AIA-14",
          requirement_title: "Supervisión humana",
          status: "CONFORME",
        },
      ],
    });

    expect(monitors.find((monitor) => monitor.id === "data-governance")?.status).toBe("gap");
    expect(monitors.find((monitor) => monitor.id === "human-oversight")?.status).toBe("ready");
    expect(monitors.find((monitor) => monitor.id === "prohibited-practices")?.status).toBe("gap");
    expect(monitors.find((monitor) => monitor.id === "incident-reporting-escalation")?.handoff).toBe("AIMS_INCIDENT_MATERIAL");
    expect(monitors.every((monitor) => monitor.route.startsWith("/ai-governance"))).toBe(true);
  });
});
