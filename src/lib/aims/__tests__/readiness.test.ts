import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
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
      // Operable exige dato en todos los dominios: clasificación guiada
      // completada y cierre con fecha (F1.T2).
      systems: [
        { id: "sys-1", status: "ACTIVO", risk_level: "Alto", regulatory_profile: { cuestionario_id: "q-1" } },
        { id: "sys-2", status: "ACTIVO", risk_level: "Limitado", regulatory_profile: { cuestionario_id: "q-2" } },
      ],
      assessments: [
        {
          id: "assess-1",
          system_id: "sys-1",
          status: "APROBADO",
          // Acredita sólo lo congelado y revisado (F1.T4).
          frozen_at: "2026-01-01",
          reviewed_at: "2026-01-02",
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
          closed_at: "2026-01-01",
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
      systems: [{ id: "sys-1", status: "ACTIVO", risk_level: "Alto", regulatory_profile: { cuestionario_id: "q-1" } }],
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
        // Por CÓDIGO del catálogo (`mapa-monitores`): el título ya no decide.
        {
          id: "check-data",
          requirement_code: "DATA_GOVERNANCE",
          requirement_title: "Data governance",
          status: "NO_CONFORME",
        },
        {
          id: "check-human",
          requirement_code: "HUMAN_OVERSIGHT",
          requirement_title: "Supervisión humana",
          status: "CONFORME",
        },
      ],
    });

    expect(monitors.find((monitor) => monitor.id === "data-governance")?.status).toBe("gap");
    // Declarada conforme, pero ninguna evaluación del sistema está congelada y
    // revisada: no acredita (el caso positivo está en «las comprobaciones no mandan»).
    expect(monitors.find((monitor) => monitor.id === "human-oversight")?.status).toBe("watch");
    // F1.T3: el nivel «Inaceptable» declarado en la ficha no es un análisis del
    // art. 5. Sin análisis, «no medido» — y el control positivo es que, con la
    // misma entrada, las áreas con comprobaciones sí salen medidas (arriba).
    const prohibidas = monitors.find((monitor) => monitor.id === "prohibited-practices")!;
    expect(prohibidas.status).toBe("unmeasured");
    expect(prohibidas.metric).toBe("Sin análisis del art. 5");
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
    for (const m of monitors) expect(m.metric, m.id).not.toMatch(/acreditadas|conformes/);
    const data = monitors.find((m) => m.id === "data-governance")!;
    expect(data.otroCatalogo).toBeGreaterThan(0);
    expect(data.status).toBe("unmeasured");
  });

  it("una comprobación ISO 42001 no es «otro catálogo RIA»: sigue contando aunque haya cuestionario", () => {
    // Un código del catálogo ISO alimenta su monitor por CÓDIGO
    // (`mapa-monitores`), con su título real.
    const iso = { id: "chk-iso", system_id: "sys-1", requirement_code: "ISO_POLICIES", requirement_title: "Políticas relativas a la IA (A.2)", status: "CONFORME" };
    const { medibles, otroCatalogo } = apartarChecksDeOtroCatalogo(
      [desplegador({ cuestionario_id: "q-1" })],
      [...checksProveedor, iso],
    );
    expect(otroCatalogo.length).toBe(12);
    expect(medibles).toEqual([iso]);
    // `ISO_POLICIES` es del monitor del sistema de gestión ISO por su código.
    const gov = buildAimsComplianceMonitors({
      systems: [desplegador({ cuestionario_id: "q-1" })],
      assessments: [],
      incidents: [],
      complianceChecks: [iso],
    }).find((m) => m.id === "iso-42001-management-system")!;
    // Sin evaluación firme del sistema, declarada y no acreditada.
    expect(gov.metric).toBe("0/1 acreditadas · 1 declaradas conformes sin congelar y revisar");
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
    expect(data.metric).toContain("acreditadas");
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
  it("una fila «Activo» cuenta en el KPI; «En investigación» cuenta como abierto", () => {
    const systems = [
      { id: "s1", status: "Activo", risk_level: "Alto" },
      { id: "s2", status: "RETIRADO", risk_level: "Alto" },
    ];
    const incidents = [{ id: "i1", status: "En investigación", severity: "BAJO" }];
    // Mismo predicado que `Dashboard.tsx` para «Sistemas IA activos».
    const kpi = systems.filter((s) => normalizeAimsStatus(s.status) === "ACTIVO").length;
    expect(kpi).toBe(1);
    const resumen = buildAimsReadiness({ systems, assessments: [], incidents });
    // Desde F1.T2 el inventario se mide por clasificación guiada, no por activos.
    expect(resumen.domains.find((d) => d.id === "inventory")?.metric).toBe("0/2 con clasificación guiada");
    expect(resumen.complianceMonitors.find((m) => m.id === "inventory-classification")?.metric).toBe("0/2 con clasificación guiada");
    expect(resumen.domains.find((d) => d.id === "incidents")?.metric).toBe("1 abiertos");
  });
});

describe("F1.T2 — cierres, hallazgos y 0/0", () => {
  // Incidente REAL de Garrigues (Harvey), leído en Cloud el 2026-09-19: en
  // investigación, con causa raíz y acción correctiva escritas, sin cierre.
  // Con «basta con tener texto de causa raíz», el monitor lo daba por cerrado.
  const harveyEnInvestigacion = {
    id: "447d97c2",
    system_id: "2f877e8c",
    status: "EN_INVESTIGACION",
    severity: "BAJO",
    root_cause: "Falta de formación y aplicación del procedimiento",
    corrective_action: "Formación",
    closed_at: null,
  };
  const harvey = { id: "2f877e8c", status: "EN_EVALUACION", risk_level: "Limitado" };

  it("un incidente en investigación no cuenta como cerrado, aunque tenga causa raíz", () => {
    const r = buildAimsReadiness({ systems: [harvey], assessments: [], incidents: [harveyEnInvestigacion] });
    const evidencia = r.domains.find((d) => d.id === "operational-evidence")!;
    expect(evidencia.metric).toBe("0/1 cerrados · 1 en investigación");
    expect(evidencia.status).not.toBe("ready");
    const postMarket = r.complianceMonitors.find((m) => m.id === "post-market-monitoring")!;
    expect(postMarket.status).not.toBe("ready");
  });

  it("control positivo: CERRADO con fecha de cierre sí cierra; CERRADO sin fecha, no", () => {
    const cerrado = { ...harveyEnInvestigacion, status: "CERRADO", closed_at: "2026-09-18T10:00:00Z" };
    const r = buildAimsReadiness({ systems: [harvey], assessments: [], incidents: [cerrado] });
    expect(r.domains.find((d) => d.id === "operational-evidence")).toMatchObject({ status: "ready", metric: "1/1 cerrados" });
    expect(r.domains.find((d) => d.id === "incidents")).toMatchObject({ status: "ready", metric: "0 abiertos" });

    const sinFecha = { ...cerrado, closed_at: null };
    const r2 = buildAimsReadiness({ systems: [harvey], assessments: [], incidents: [sinFecha] });
    expect(r2.domains.find((d) => d.id === "operational-evidence")?.metric).toBe("0/1 cerrados");
    expect(r2.domains.find((d) => d.id === "incidents")?.metric).toBe("1 abiertos");
  });

  it("los hallazgos salen sólo de la última evaluación no borrador (ARGA medido: 8/11, no 35/38)", () => {
    // Las siete evaluaciones de ARGA leídas en Cloud el 2026-09-19.
    const val = (s: string) => Array.from({ length: 7 }, (_, i) => ({ code: `VAL-0${i + 1}`, status: s }));
    const triaje = "90000000-0000-0000-0000-000000000001";
    const suscripcion = "90000000-0000-0000-0000-000000000002";
    const assessments = [
      { id: "132042ee", system_id: suscripcion, framework: "ISO_42001", status: "BORRADOR", created_at: "2026-07-31T04:38:44Z", findings: Array.from({ length: 6 }, (_, i) => ({ code: `ISO-0${i + 5}`, status: "CONFORME" })) },
      { id: "f26e844b", system_id: triaje, framework: "EU_AI_ACT", status: "APROBADO", created_at: "2026-07-19T10:03:15Z", findings: val("CONFORME") },
      { id: "68f23d26", system_id: triaje, framework: "EU_AI_ACT", status: "APROBADO", created_at: "2026-07-19T10:05:42Z", findings: val("CONFORME") },
      { id: "802d9278", system_id: triaje, framework: "EU_AI_ACT", status: "APROBADO", created_at: "2026-07-19T10:04:27Z", findings: val("CONFORME") },
      { id: "137610a4", system_id: triaje, framework: "EU_AI_ACT", status: "APROBADO", created_at: "2026-05-21T11:41:16Z", findings: val("CONFORME") },
      { id: "3b160895", system_id: "1148370a", framework: "EU_AI_ACT", status: "APROBADO", created_at: "2026-04-18T15:44:31Z", findings: [{ code: "ART_9", status: "CONFORME" }, { code: "ART_13", status: "PENDIENTE" }] },
      { id: "d3234e6a", system_id: "900a2ea7", framework: "EU_AI_ACT", status: "EN_REVISION", created_at: "2026-04-18T15:44:31Z", findings: [{ code: "ART_9", status: "EN_CURSO" }, { code: "ART_10", status: "NO_CONFORME" }] },
    ];
    const r = buildAimsReadiness({ systems: [], assessments, incidents: [] });
    // Desde F1.T4 se dice además que ninguna de las 11 está congelada y revisada.
    expect(r.domains.find((d) => d.id === "controls")?.metric).toBe("8/11 cerrados · 11 sin congelar y revisar");
  });

  it("0/0 se pinta gris «no aplica» SÓLO con todos los sistemas clasificados por cuestionario", () => {
    // Harvey no tiene cuestionario: su «Limitado» es el declarado en ficha y no
    // dice si hay alto riesgo. No se afirma «no aplica»: no medido.
    const r = buildAimsReadiness({ systems: [harvey], assessments: [], incidents: [] });
    expect(r.domains.find((d) => d.id === "ai-act-assessments")).toMatchObject({ status: "unmeasured", metric: "1 sistemas sin cuestionario" });
    expect(r.complianceMonitors.find((m) => m.id === "high-risk-obligations")).toMatchObject({ status: "unmeasured", metric: "1 sistemas sin cuestionario" });
    // Control positivo: clasificado y no Alto → gris «no aplica».
    const guiado = { ...harvey, regulatory_profile: { cuestionario_id: "q-h" } };
    const na = buildAimsReadiness({ systems: [guiado], assessments: [], incidents: [] });
    expect(na.domains.find((d) => d.id === "ai-act-assessments")).toMatchObject({ status: "na", metric: "Sin sistemas de alto riesgo" });
    expect(na.complianceMonitors.find((m) => m.id === "high-risk-obligations")?.status).toBe("na");
    // Y clasificado Alto sin evaluar, sí es brecha.
    const alto = buildAimsReadiness({ systems: [{ ...guiado, risk_level: "Alto" }], assessments: [], incidents: [] });
    expect(alto.domains.find((d) => d.id === "ai-act-assessments")).toMatchObject({ status: "gap", metric: "0/1 alto riesgo" });
  });

  it("el «Alto» declarado en ficha sin cuestionario no se cuenta como alto riesgo (ARGA medido: 0/8 con cuestionario, 6 Alto)", () => {
    const declarados = Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, status: "ACTIVO", risk_level: "Alto" }));
    const otros = [{ id: "b1", status: "ACTIVO", risk_level: "Limitado" }, { id: "b2", status: "ACTIVO", risk_level: "Mínimo" }];
    const r = buildAimsReadiness({ systems: [...declarados, ...otros], assessments: [], incidents: [] });
    const dominio = r.domains.find((d) => d.id === "ai-act-assessments")!;
    expect(dominio).toMatchObject({ status: "unmeasured", metric: "8 sistemas sin cuestionario" });
    expect(dominio.metric).not.toMatch(/alto riesgo/);
    const detalle = r.nextSteps.map((p) => p.detalle).join(" | ");
    expect(detalle).toMatch(/6 declarados Alto en ficha, sin cuestionario/);
    expect(detalle).not.toMatch(/sistemas de alto riesgo sin autodiagnóstico acreditado/);
    expect(r.standaloneReady).toBe(false);
  });

  it("mezcla: un Alto clasificado y acreditado no lleva el dominio a Listo si queda algún sistema sin cuestionario", () => {
    const firme = { frozen_at: "2026-09-18T10:00:00Z", reviewed_at: "2026-09-18T11:00:00Z" };
    const r = buildAimsReadiness({
      systems: [
        { id: "g1", status: "ACTIVO", risk_level: "Alto", regulatory_profile: { cuestionario_id: "q" } },
        { id: "n1", status: "ACTIVO", risk_level: "Alto" },
      ],
      assessments: [{ id: "a", system_id: "g1", framework: "EU_AI_ACT", status: "CONFORME", findings: [], ...firme }],
      incidents: [],
    });
    expect(r.domains.find((d) => d.id === "ai-act-assessments")).toMatchObject({ status: "watch", metric: "1/1 alto riesgo · 1 sistemas sin cuestionario" });
  });

  it("el inventario se mide por cuestionarios COMPLETED, no por sistemas activos", () => {
    const systems = [
      { id: "s1", status: "ACTIVO", regulatory_profile: { cuestionario_id: "q-1" } },
      { id: "s2", status: "ACTIVO", regulatory_profile: null },
    ];
    const r = buildAimsReadiness({ systems, assessments: [], incidents: [] });
    expect(r.domains.find((d) => d.id === "inventory")?.metric).toBe("1/2 con clasificación guiada");
    expect(r.complianceMonitors.find((m) => m.id === "inventory-classification")?.metric).toBe("1/2 con clasificación guiada");
  });

  it("F1.T3 — sin su objeto, expediente, precisión, recordkeeping, post-market y supervisión dicen «no medido» y no caen a incidentes", () => {
    const materiales = [
      { id: "i1", system_id: "s1", status: "ABIERTO", severity: "CRITICO" },
      { id: "i2", system_id: "s1", status: "CERRADO", severity: "MEDIO", root_cause: "x", closed_at: "2026-01-01" },
    ];
    const r = buildAimsComplianceMonitors({
      systems: [{ id: "s1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a1", system_id: "s1", status: "CON_GAPS", score: 30, findings: [{ code: "X", status: "L1" }] }],
      incidents: materiales,
    });
    for (const id of [
      "technical-documentation",
      "accuracy-robustness-cybersecurity",
      "evidence-recordkeeping",
      "post-market-monitoring",
      "human-oversight",
    ]) {
      const m = r.find((x) => x.id === id)!;
      expect({ id, status: m.status }).toEqual({ id, status: "unmeasured" });
      expect(m.source, `${id} vuelve a leer incidentes`).not.toBe("ai_incidents");
      expect(m.source, `${id} vuelve a leer evaluaciones`).not.toBe("ai_risk_assessments");
    }
    // Control positivo: el monitor cuyo objeto SÍ son los incidentes los lee.
    expect(r.find((x) => x.id === "incident-reporting-escalation")).toMatchObject({ source: "ai_incidents", metric: "1 materiales" });
  });

  it("F1.T3 — el expediente lee sus secciones: sin revisor no acredita (ARGA medido: 0/5)", () => {
    // Secciones del «Motor de triaje» leídas en Cloud el 2026-09-19: «Conforme»
    // con fecha de revisión pero sin revisor, y una segunda versión pendiente.
    const s1 = "90000000-0000-0000-0000-000000000001";
    const seccion = (code: string, status: string, extra = {}) => ({ system_id: s1, section_code: code, status, reviewed_by_id: null, ...extra });
    const technicalFileSections = [
      seccion("AIV-01", "Conforme"), seccion("AIV-02", "Conforme"), seccion("AIV-03", "Conforme"),
      seccion("AIV-04", "Conforme"), seccion("AIV-01", "Pendiente"),
    ];
    const base = { systems: [{ id: s1, status: "En revision", risk_level: "Alto" }], assessments: [], incidents: [] };
    const r = buildAimsComplianceMonitors({ ...base, technicalFileSections });
    expect(r.find((m) => m.id === "technical-documentation")).toMatchObject({
      status: "watch", metric: "0/5 secciones con revisor", source: "aims_technical_file_sections",
    });
    expect(r.find((m) => m.id === "human-oversight")).toMatchObject({ status: "watch", metric: "0/1 secciones con revisor" });
    expect(r.find((m) => m.id === "accuracy-robustness-cybersecurity")).toMatchObject({ status: "watch", metric: "0/1 secciones con revisor" });

    // Una sección no conforme es brecha.
    const noConforme = buildAimsComplianceMonitors({ ...base, technicalFileSections: [seccion("AIV-03", "NO_CONFORME")] });
    expect(noConforme.find((m) => m.id === "technical-documentation")?.status).toBe("gap");

    // Control positivo: las nueve del anexo IV, conformes y con revisor, sí dan Listo.
    const nueve = Array.from({ length: 9 }, (_, i) => seccion(`AIV-0${i + 1}`, "APPROVED", { reviewed_by_id: "p-1" }));
    expect(buildAimsComplianceMonitors({ ...base, technicalFileSections: nueve })
      .find((m) => m.id === "technical-documentation")).toMatchObject({ status: "ready", metric: "9/9 secciones con revisor" });
    // …pero cuatro de nueve no son un expediente completo, aunque las cuatro acrediten.
    expect(buildAimsComplianceMonitors({ ...base, technicalFileSections: nueve.slice(0, 4) })
      .find((m) => m.id === "technical-documentation")?.status).toBe("watch");
  });

  it("F1.T3 — post-market lee los indicadores: sin valor medido no hay medición, diga lo que diga `status`", () => {
    const base = { systems: [{ id: "s1", status: "ACTIVO" }], assessments: [], incidents: [] };
    // Indicador de ARGA leído en Cloud el 2026-09-19: «Override humano en rechazos», 6,4 %.
    const medido = { system_id: "s1", status: "OK", current_value: { unit: "%", value: 6.4 } };
    const r = buildAimsComplianceMonitors({ ...base, monitoringIndicators: [medido] });
    // Con medición pero sin umbral evaluado: vigilancia, no Listo.
    expect(r.find((m) => m.id === "post-market-monitoring")).toMatchObject({
      status: "watch", metric: "1/1 indicadores con medición", source: "aims_monitoring_indicators",
    });
    const sinValor = buildAimsComplianceMonitors({ ...base, monitoringIndicators: [{ ...medido, current_value: null }] });
    expect(sinValor.find((m) => m.id === "post-market-monitoring")).toMatchObject({ status: "unmeasured", metric: "1 indicadores sin medición" });
  });

  it("terceros: tener un proveedor escrito no es haber evaluado al tercero", () => {
    const r = buildAimsReadiness({
      systems: [{ id: "s1", status: "ACTIVO", vendor: "Palantir" }],
      assessments: [],
      incidents: [],
    });
    const terceros = r.complianceMonitors.find((m) => m.id === "provider-vendor-third-party")!;
    expect(terceros.status).toBe("unmeasured");
    expect(terceros.metric).not.toMatch(/con vendor/);
  });
});

describe("las comprobaciones no mandan sobre el objeto del monitor ni acreditan sin evaluación firme", () => {
  const firme = { frozen_at: "2026-09-18T10:00:00Z", reviewed_at: "2026-09-18T11:00:00Z" };
  const sistema = { id: "s1", status: "ACTIVO", risk_level: "Alto", regulatory_profile: { cuestionario_id: "q" } };
  const evaluacion = { id: "a1", system_id: "s1", framework: "EU_AI_ACT", status: "CONFORME", created_at: "2026-09-18T09:00:00Z", findings: [] };
  const checks = [
    { id: "c1", system_id: "s1", requirement_code: "TECHNICAL_DOC", status: "CONFORME", created_at: "2026-09-18T09:00:00Z" },
    { id: "c2", system_id: "s1", requirement_code: "HUMAN_OVERSIGHT", status: "CONFORME", created_at: "2026-09-18T09:00:00Z" },
  ];
  const seccion = (code: string, status: string, reviewed_by_id: string | null) => ({ system_id: "s1", section_code: code, status, reviewed_by_id });
  const pendientes = ["AIV-01", "AIV-02", "AIV-03"].map((c) => seccion(c, "Pendiente", null));
  const nueveConRevisor = Array.from({ length: 9 }, (_, i) => seccion(`AIV-0${i + 1}`, "APPROVED", "p-1"));
  const monitor = (r: ReturnType<typeof buildAimsComplianceMonitors>, id: string) => r.find((m) => m.id === id)!;

  it("autodiagnóstico sin firmar y secciones pendientes: el expediente no sale Listo", () => {
    const r = buildAimsComplianceMonitors({
      systems: [sistema],
      assessments: [evaluacion],
      incidents: [],
      complianceChecks: checks,
      technicalFileSections: pendientes,
    });
    expect(monitor(r, "technical-documentation")).toMatchObject({
      status: "watch",
      metric: "0/1 acreditadas · 1 declaradas conformes sin congelar y revisar · 0/3 secciones con revisor",
      source: "ai_compliance_checks",
    });
    expect(monitor(r, "human-oversight")).toMatchObject({
      status: "watch",
      metric: "0/1 acreditadas · 1 declaradas conformes sin congelar y revisar · 0/1 secciones con revisor",
    });
  });

  it("evaluación firme pero sin el objeto acreditado: tampoco Listo", () => {
    const r = buildAimsComplianceMonitors({
      systems: [sistema],
      assessments: [{ ...evaluacion, ...firme }],
      incidents: [],
      complianceChecks: checks,
      technicalFileSections: pendientes,
    });
    expect(monitor(r, "technical-documentation")).toMatchObject({ status: "watch", metric: "1/1 acreditadas · 0/3 secciones con revisor" });
    const sinSecciones = buildAimsComplianceMonitors({ systems: [sistema], assessments: [{ ...evaluacion, ...firme }], incidents: [], complianceChecks: checks });
    expect(monitor(sinSecciones, "technical-documentation")).toMatchObject({ status: "watch", metric: "1/1 acreditadas · Sin expediente técnico" });
    // Una sección no conforme manda aunque las comprobaciones acrediten.
    const noConforme = buildAimsComplianceMonitors({
      systems: [sistema], assessments: [{ ...evaluacion, ...firme }], incidents: [], complianceChecks: checks,
      technicalFileSections: [seccion("AIV-03", "NON_CONFORMING", "p-1")],
    });
    expect(monitor(noConforme, "human-oversight").status).toBe("gap");
  });

  it("control positivo: evaluación firme y las nueve secciones con revisor dan Listo", () => {
    const r = buildAimsComplianceMonitors({
      systems: [sistema],
      assessments: [{ ...evaluacion, ...firme }],
      incidents: [],
      complianceChecks: checks,
      technicalFileSections: nueveConRevisor,
    });
    expect(monitor(r, "technical-documentation")).toMatchObject({ status: "ready", metric: "1/1 acreditadas · 9/9 secciones con revisor" });
    expect(monitor(r, "human-oversight")).toMatchObject({ status: "ready", metric: "1/1 acreditadas · 1/1 secciones con revisor" });
  });

  it("Harvey (Garrigues, leído en Cloud el 2026-09-19): ROBUSTNESS y CYBERSECURITY CONFORME de un autodiagnóstico sin firmar no acreditan", () => {
    const harvey = "2f877e8c-875d-4b11-9b39-aed0826cacb5";
    const creada = "2026-09-07T02:09:31.889226+00:00";
    // Las diez medidas del art. 15 de la evaluación fdcccf9e: L5 sin recuento de evidencia.
    const findings = [
      { code: "MG_ACCU_01", status: "L1" }, { code: "MG_ACCU_02", status: "L4" }, { code: "MG_ACCU_03", status: "L5" },
      { code: "MG_ROBU_01", status: "L5" }, { code: "MG_ROBU_02", status: "L5" }, { code: "MG_ROBU_03", status: "L5" },
      { code: "MG_CIBE_01", status: "L5" }, { code: "MG_CIBE_02", status: "L5" }, { code: "MG_CIBE_03", status: "L5" }, { code: "MG_CIBE_04", status: "L5" },
    ];
    const r = buildAimsComplianceMonitors({
      systems: [{ id: harvey, status: "EN_EVALUACION", risk_level: "Limitado", regulatory_role: null, regulatory_profile: null }],
      assessments: [{ id: "fdcccf9e-fff0-4346-a2f2-17e610981be3", system_id: harvey, framework: "EU_AI_ACT", status: "CON_GAPS", score: 49, created_at: "2026-09-07T02:09:31.47052+00:00", frozen_at: null, reviewed_at: null, findings }],
      incidents: [],
      complianceChecks: [
        { id: "69ffe2c8", system_id: harvey, requirement_code: "ACCURACY", status: "NO_CONFORME", created_at: creada },
        { id: "3eecef25", system_id: harvey, requirement_code: "ROBUSTNESS", status: "CONFORME", created_at: creada },
        { id: "a44294b3", system_id: harvey, requirement_code: "CYBERSECURITY", status: "CONFORME", created_at: creada },
      ],
    });
    const precision = monitor(r, "accuracy-robustness-cybersecurity");
    expect(precision.metric).toBe("0/3 acreditadas · 2 declaradas conformes sin congelar y revisar · Sin sección del anexo IV.4");
    expect(precision.metric).not.toMatch(/\b[1-9]\d*\/3 (conformes|acreditadas)/);
    expect(precision.status).toBe("gap");
  });
});

describe("G-ARISTA — incidente cerrado, un solo criterio", () => {
  const SUPERFICIES = ["src/pages/ai-governance/Dashboard.tsx", "src/pages/ai-governance/Incidentes.tsx"];
  const porEstado = /normalizeAimsStatus\(\s*\w+\.status\s*\)\s*===\s*"CERRADO"/;

  it("control positivo del detector sobre la forma retirada", () => {
    expect(porEstado.test('incidents.filter((i) => normalizeAimsStatus(i.status) === "CERRADO")')).toBe(true);
  });

  it("las superficies que cuentan cerrados importan `incidenteCerrado`, lo llaman y no cuentan por estado", () => {
    for (const f of SUPERFICIES) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(src, `${f} no importa incidenteCerrado`).toMatch(/import\s*\{[^}]*\bincidenteCerrado\b[^}]*\}\s*from\s*"@\/lib\/aims\/readiness"/);
      expect(src, `${f} importa y no llama`).toMatch(/incidenteCerrado\)|incidenteCerrado\(/);
      expect(porEstado.test(src), `${f} cuenta cerrados por el estado a secas`).toBe(false);
    }
  });
});
