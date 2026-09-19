import { describe, expect, it } from "vitest";
import { AIMS_HANDOFFS } from "../handoffs";
import { AESIA_RIA_REQUIREMENTS } from "../catalog-aesia";
import {
  apartarChecksDeOtroCatalogo,
  buildAimsComplianceMonitors,
  buildAimsReadiness,
  isAimsMaterialIncidentCandidate,
  isAimsTechnicalFileGapCandidate,
  normalizeAimsStatus,
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
    // A5 (2026-08-29): este test blindaba la etiqueta "Sin schema nuevo", que
    // además era falsa —las tablas `aims_*` del backbone existen desde abril—.
    // El dominio no mide el backbone, así que ahora lo dice.
    expect(summary.domains.find((domain) => domain.id === "migration")?.metric).toBe("No medido");
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

  it("mantiene handoffs AIMS como rutas read-only con evidencia etiquetada", () => {
    expect(AIMS_HANDOFFS.map((handoff) => handoff.contractEvent)).toEqual([
      "AIMS_TECHNICAL_FILE_GAP",
      "AIMS_INCIDENT_MATERIAL",
      "AIMS_INCIDENT_MATERIAL",
      "SECRETARIA_CERTIFICATION_ISSUED",
    ]);

    for (const handoff of AIMS_HANDOFFS) {
      expect(handoff.mutation).toBe("read-only route handoff");
      expect(handoff.targetRoute).not.toContain("governance_module_events");
      expect(handoff.targetRoute).not.toContain("governance_module_links");
    }

    const secretariaReference = AIMS_HANDOFFS.find(
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

describe("D1 — las comprobaciones de otro catálogo se apartan, no se suman", () => {
  // 12 comprobaciones del catálogo del PROVEEDOR de alto riesgo, con el título
  // real de cada requisito para que caigan en algún monitor por keywords.
  const checksProveedor = AESIA_RIA_REQUIREMENTS.slice(0, 12).map((req, i) => ({
    id: `chk-${i}`,
    system_id: "sys-1",
    requirement_code: req.code,
    requirement_title: req.title,
    status: "NO_CONFORME",
  }));
  const desplegador = (regulatory_profile: Record<string, unknown> | null) => ({
    id: "sys-1",
    status: "ACTIVO",
    risk_level: "Limitado",
    regulatory_role: "RESPONSABLE_DESPLIEGUE",
    regulatory_profile,
  });

  it("con clasificación guiada, las 12 se apartan y ningún monitor las cuenta como brecha", () => {
    expect(checksProveedor.length).toBe(12);
    const { medibles, otroCatalogo } = apartarChecksDeOtroCatalogo(
      [desplegador({ cuestionario_id: "q-1" })],
      checksProveedor,
    );
    expect(medibles.length).toBe(0);
    expect(otroCatalogo.length).toBe(12);

    const monitors = buildAimsComplianceMonitors({
      systems: [desplegador({ cuestionario_id: "q-1" })],
      assessments: [],
      incidents: [],
      complianceChecks: checksProveedor,
    });
    for (const m of monitors) expect(m.metric, m.id).not.toContain("conformes");
    const data = monitors.find((m) => m.id === "data-governance")!;
    expect(data.otroCatalogo).toBeGreaterThan(0);
    expect(data.metric).toBe("Sin cobertura");
  });

  it("una comprobación ISO 42001 no es «otro catálogo RIA»: sigue contando aunque haya cuestionario", () => {
    // Un código del catálogo ISO alimenta su monitor por CÓDIGO
    // (`MONITORES_POR_REQUISITO`): ISO_ORG_ROLES → gobierno, con su título real.
    const iso = { id: "chk-iso", system_id: "sys-1", requirement_code: "ISO_ORG_ROLES", requirement_title: "Organización interna y roles (A.3)", status: "CONFORME" };
    const { medibles, otroCatalogo } = apartarChecksDeOtroCatalogo(
      [desplegador({ cuestionario_id: "q-1" })],
      [...checksProveedor, iso],
    );
    expect(otroCatalogo.length).toBe(12);
    expect(medibles).toEqual([iso]);
    const gov = buildAimsComplianceMonitors({
      systems: [desplegador({ cuestionario_id: "q-1" })],
      assessments: [],
      incidents: [],
      complianceChecks: [iso],
    }).find((m) => m.id === "governance-accountability")!;
    expect(gov.metric).toBe("1/1 conformes");
    expect(gov.otroCatalogo).toBe(0);
  });

  it("control: el mismo sistema sin cuestionario cuenta las 12 (fail-open, ARGA cero cambio)", () => {
    const { medibles, otroCatalogo } = apartarChecksDeOtroCatalogo([desplegador(null)], checksProveedor);
    expect(medibles.length).toBe(12);
    expect(otroCatalogo.length).toBe(0);

    const data = buildAimsComplianceMonitors({
      systems: [desplegador(null)],
      assessments: [],
      incidents: [],
      complianceChecks: checksProveedor,
    }).find((m) => m.id === "data-governance")!;
    expect(data.status).toBe("gap");
    expect(data.metric).toContain("conformes");
    expect(data.otroCatalogo).toBe(0);
  });
});

describe("D2 — un borrador es «no medido», no un gap", () => {
  it("BORRADOR con score 0 y findings PENDIENTE no es candidato", () => {
    expect(
      isAimsTechnicalFileGapCandidate({
        id: "draft",
        status: "BORRADOR",
        score: 0,
        findings: [{ code: "QUALITY_MGMT", status: "PENDIENTE" }],
      }),
    ).toBe(false);
  });

  it("control: CON_GAPS con score 49 sí lo es", () => {
    expect(isAimsTechnicalFileGapCandidate({ id: "gaps", status: "CON_GAPS", score: 49, findings: [] })).toBe(true);
  });
});

describe("D3 — el estado se compara normalizado, como el KPI del Dashboard", () => {
  it("una fila «Activo» cuenta igual en el KPI y en el dominio de inventario", () => {
    const systems = [
      { id: "s1", status: "Activo", risk_level: "Alto" },
      { id: "s2", status: "RETIRADO", risk_level: "Alto" },
    ];
    const incidents = [{ id: "i1", status: "En investigación", severity: "BAJO" }];
    // Mismo predicado que `Dashboard.tsx` para «Sistemas IA activos».
    const kpi = systems.filter((s) => normalizeAimsStatus(s.status) === "ACTIVO").length;
    expect(kpi).toBe(1);
    const resumen = buildAimsReadiness({ systems, assessments: [], incidents });
    expect(resumen.domains.find((d) => d.id === "inventory")?.metric).toBe(`${kpi}/2 activos`);
    expect(resumen.complianceMonitors.find((m) => m.id === "inventory-classification")?.metric).toBe(`${kpi}/2 activos`);
    expect(resumen.domains.find((d) => d.id === "incidents")?.metric).toBe("1 abiertos");
  });
});
