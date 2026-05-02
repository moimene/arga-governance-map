export type AimsSourcePosture = "legacy-ai" | "aims-ready" | "local-derived";
export type AimsReadinessStatus = "ready" | "watch" | "gap";
export type AimsContractPosture =
  | "legacy_read"
  | "legacy_write"
  | "backbone_read"
  | "backbone_write"
  | "bridge_read"
  | "migration_candidate";
export type AimsScreenOperation = "read-only" | "owner-write" | "migration-candidate";
export type AimsEvidencePosture = "REFERENCE" | "BUNDLE_STUB" | "AUDITED_BUNDLE" | "LEGAL_HOLD_READY" | "NOT_EVIDENCE";

export interface AimsSystemLike {
  id: string;
  risk_level?: string | null;
  status?: string | null;
  vendor?: string | null;
}

export interface AimsAssessmentLike {
  id: string;
  system_id?: string | null;
  status?: string | null;
  score?: number | null;
  findings?: { code?: string | null; status?: string | null }[] | null;
  assessment_date?: string | null;
}

export interface AimsIncidentLike {
  id: string;
  system_id?: string | null;
  status?: string | null;
  severity?: string | null;
  root_cause?: string | null;
  corrective_action?: string | null;
  closed_at?: string | null;
}

export interface AimsScreenPosture {
  route: string;
  screen: string;
  owner: "AIMS 360";
  hooks: string[];
  tables: string[];
  posture: AimsContractPosture;
  sourceOfTruth: string;
  operation: AimsScreenOperation;
  crossModuleHandoffs: string[];
  migrationRequired: boolean;
  notes: string;
}

export interface AimsHandoffAffordance {
  id: string;
  label: string;
  sourceScreen: string;
  trigger: string;
  targetOwner: "GRC Compass" | "Secretaría Societaria" | "AIMS 360";
  targetRoute: string;
  contractEvent: string;
  evidencePosture: AimsEvidencePosture;
  mutation: "read-only route handoff";
}

export interface AimsReadinessDomain {
  id: string;
  label: string;
  status: AimsReadinessStatus;
  metric: string;
  detail: string;
  route: string;
}

export interface AimsReadinessInput {
  systems: AimsSystemLike[];
  assessments: AimsAssessmentLike[];
  incidents: AimsIncidentLike[];
}

export interface AimsReadinessSummary {
  sourcePosture: AimsSourcePosture;
  contractId: "aims-p0-readiness";
  sourceTables: string[];
  migrationPath: string;
  standaloneReady: boolean;
  domains: AimsReadinessDomain[];
  nextSteps: string[];
}

export const aimsScreenPostures: AimsScreenPosture[] = [
  {
    route: "/ai-governance",
    screen: "Dashboard AIMS",
    owner: "AIMS 360",
    hooks: ["useAiSystemsList", "useAiIncidentsList", "useAllAssessments"],
    tables: ["ai_systems", "ai_incidents", "ai_risk_assessments"],
    posture: "legacy_read",
    sourceOfTruth: "Supabase Cloud legacy ai_* read model",
    operation: "read-only",
    crossModuleHandoffs: ["Navegación interna AIMS", "Referencia Secretaría con evidence=REFERENCE"],
    migrationRequired: false,
    notes: "Standalone-ready; no depende del shell TGMS para navegación básica.",
  },
  {
    route: "/ai-governance/sistemas",
    screen: "Inventario de Sistemas IA",
    owner: "AIMS 360",
    hooks: ["useAiSystemsList"],
    tables: ["ai_systems"],
    posture: "legacy_read",
    sourceOfTruth: "ai_systems",
    operation: "read-only",
    crossModuleHandoffs: ["Drilldown propietario AIMS"],
    migrationRequired: false,
    notes: "No mezcla aims_*; el backbone queda candidato por workflow.",
  },
  {
    route: "/ai-governance/sistemas/:id",
    screen: "Detalle de Sistema IA",
    owner: "AIMS 360",
    hooks: ["useAiSystemById", "useAssessmentsBySystem", "useComplianceChecksBySystem", "useAiIncidentsBySystem"],
    tables: ["ai_systems", "ai_risk_assessments", "ai_compliance_checks", "ai_incidents"],
    posture: "legacy_read",
    sourceOfTruth: "ai_systems como owner; tablas hijas ai_* por system_id",
    operation: "read-only",
    crossModuleHandoffs: ["Referencia contextual a evaluaciones e incidentes AIMS"],
    migrationRequired: false,
    notes: "Pantalla más rica del owner AIMS; ai_compliance_checks se mantiene legacy_read.",
  },
  {
    route: "/ai-governance/evaluaciones",
    screen: "Evaluaciones AI Act / ISO 42001",
    owner: "AIMS 360",
    hooks: ["useAllAssessments"],
    tables: ["ai_risk_assessments", "ai_systems"],
    posture: "legacy_read",
    sourceOfTruth: "ai_risk_assessments con join tenant-scoped a ai_systems",
    operation: "read-only",
    crossModuleHandoffs: ["AIMS_TECHNICAL_FILE_GAP -> /grc/risk-360"],
    migrationRequired: false,
    notes: "Los gaps se proponen a GRC; AIMS no crea controles GRC directamente.",
  },
  {
    route: "/ai-governance/incidentes",
    screen: "Incidentes IA",
    owner: "AIMS 360",
    hooks: ["useAiIncidentsList"],
    tables: ["ai_incidents", "ai_systems"],
    posture: "legacy_read",
    sourceOfTruth: "ai_incidents con referencia a ai_systems",
    operation: "read-only",
    crossModuleHandoffs: [
      "AIMS_INCIDENT_MATERIAL -> /grc/incidentes",
      "AIMS_INCIDENT_MATERIAL -> /secretaria/reuniones/nueva",
    ],
    migrationRequired: false,
    notes: "AIMS registra la señal IA; GRC gestiona riesgo operativo y Secretaría decide escalado formal.",
  },
];

export const aimsReadOnlyHandoffs: AimsHandoffAffordance[] = [
  {
    id: "aims-technical-file-gap-to-grc",
    label: "Gap expediente técnico -> GRC",
    sourceScreen: "/ai-governance/evaluaciones",
    trigger: "Evaluación no aprobada, score bajo o finding abierto",
    targetOwner: "GRC Compass",
    targetRoute: "/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP",
    contractEvent: "AIMS_TECHNICAL_FILE_GAP",
    evidencePosture: "NOT_EVIDENCE",
    mutation: "read-only route handoff",
  },
  {
    id: "aims-material-incident-to-grc",
    label: "Incidente IA material -> GRC",
    sourceScreen: "/ai-governance/incidentes",
    trigger: "Severidad crítica/alta y estado abierto o en investigación",
    targetOwner: "GRC Compass",
    targetRoute: "/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL",
    contractEvent: "AIMS_INCIDENT_MATERIAL",
    evidencePosture: "NOT_EVIDENCE",
    mutation: "read-only route handoff",
  },
  {
    id: "aims-material-incident-to-secretaria",
    label: "Incidente IA material -> Secretaría",
    sourceScreen: "/ai-governance/incidentes",
    trigger: "Materialidad regulatoria o reputacional que puede requerir órgano",
    targetOwner: "Secretaría Societaria",
    targetRoute: "/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL",
    contractEvent: "AIMS_INCIDENT_MATERIAL",
    evidencePosture: "NOT_EVIDENCE",
    mutation: "read-only route handoff",
  },
  {
    id: "secretaria-certification-reference-to-aims",
    label: "Certificación Secretaría -> referencia AIMS",
    sourceScreen: "/ai-governance",
    trigger: "Acuerdo, acta o certificación con postura probatoria explícita",
    targetOwner: "AIMS 360",
    targetRoute: "/secretaria/actas?source=aims&handoff=SECRETARIA_CERTIFICATION_REFERENCE&evidence=REFERENCE",
    contractEvent: "SECRETARIA_CERTIFICATION_ISSUED",
    evidencePosture: "REFERENCE",
    mutation: "read-only route handoff",
  },
];

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function domainStatus(value: number, watchAt: number, readyAt: number): AimsReadinessStatus {
  if (value >= readyAt) return "ready";
  if (value >= watchAt) return "watch";
  return "gap";
}

export function isAimsTechnicalFileGapCandidate(assessment: AimsAssessmentLike) {
  const status = assessment.status ?? "";
  const hasUnapprovedStatus = status !== "" && status !== "APROBADO";
  const hasWeakScore = typeof assessment.score === "number" && assessment.score < 80;
  const hasOpenFinding = (assessment.findings ?? []).some((finding) =>
    ["NO_CONFORME", "PENDIENTE", "EN_CURSO", "ABIERTO"].includes(finding.status ?? ""),
  );

  return hasUnapprovedStatus || hasWeakScore || hasOpenFinding;
}

export function isAimsMaterialIncidentCandidate(incident: AimsIncidentLike) {
  const severity = incident.severity ?? "";
  const status = incident.status ?? "";
  const materialSeverity = ["CRITICO", "CRÍTICO", "ALTO"].includes(severity);
  const openStatus = ["ABIERTO", "EN_INVESTIGACION"].includes(status);

  return materialSeverity && openStatus;
}

export function buildAimsReadiness({
  systems,
  assessments,
  incidents,
}: AimsReadinessInput): AimsReadinessSummary {
  const totalSystems = systems.length;
  const activeSystems = systems.filter((system) => system.status === "ACTIVO").length;
  const assessedSystemIds = new Set(
    assessments
      .filter((assessment) => assessment.status === "APROBADO" && assessment.system_id)
      .map((assessment) => assessment.system_id as string),
  );
  const highRiskSystems = systems.filter((system) => system.risk_level === "Alto");
  const highRiskAssessed = highRiskSystems.filter((system) => assessedSystemIds.has(system.id)).length;
  const openIncidents = incidents.filter(
    (incident) => incident.status === "ABIERTO" || incident.status === "EN_INVESTIGACION",
  ).length;
  const incidentsWithClosureEvidence = incidents.filter(
    (incident) => incident.root_cause || incident.corrective_action || incident.closed_at,
  ).length;
  const findings = assessments.flatMap((assessment) => assessment.findings ?? []);
  const controlFindings = findings.filter((finding) => finding.code || finding.status);
  const closedControlFindings = controlFindings.filter(
    (finding) => finding.status === "CERRADO" || finding.status === "APROBADO" || finding.status === "OK",
  ).length;

  const inventoryCoverage = pct(activeSystems, totalSystems);
  const assessmentCoverage = pct(highRiskAssessed, highRiskSystems.length);
  const incidentClosureCoverage = pct(incidentsWithClosureEvidence, incidents.length);
  const controlCoverage = pct(closedControlFindings, controlFindings.length);

  const domains: AimsReadinessDomain[] = [
    {
      id: "inventory",
      label: "Inventario",
      status: domainStatus(inventoryCoverage, 50, 80),
      metric: totalSystems === 0 ? "0 sistemas" : `${activeSystems}/${totalSystems} activos`,
      detail: "Registro operativo de sistemas IA, proveedor, tipo, estado y riesgo.",
      route: "/ai-governance/sistemas",
    },
    {
      id: "ai-act-assessments",
      label: "Evaluaciones AI Act",
      status: domainStatus(assessmentCoverage, 50, 100),
      metric: highRiskSystems.length === 0 ? "Sin alto riesgo" : `${highRiskAssessed}/${highRiskSystems.length} alto riesgo`,
      detail: "Cobertura aprobada para sistemas de riesgo alto y trazabilidad de evaluaciones.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "incidents",
      label: "Incidentes",
      status: openIncidents === 0 ? "ready" : openIncidents <= 2 ? "watch" : "gap",
      metric: `${openIncidents} abiertos`,
      detail: "Registro de severidad, investigación, causa raíz y acción correctiva.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "controls",
      label: "Controles",
      status: controlFindings.length === 0 ? "watch" : domainStatus(controlCoverage, 40, 75),
      metric: controlFindings.length === 0 ? "Derivado" : `${closedControlFindings}/${controlFindings.length} cerrados`,
      detail: "Postura derivada de findings de evaluación; no crea controles paralelos.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "operational-evidence",
      label: "Evidencias operativas",
      status: incidents.length === 0 ? "watch" : domainStatus(incidentClosureCoverage, 50, 80),
      metric: incidents.length === 0 ? "Pendiente" : `${incidentsWithClosureEvidence}/${incidents.length} con cierre`,
      detail: "Evidencia funcional para demo; no se presenta como evidencia probatoria final.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "migration",
      label: "Migración ai_* → aims_*",
      status: "watch",
      metric: "Sin schema nuevo",
      detail: "Pantalla standalone-ready sobre ai_* legacy hasta activar backbone aims_*.",
      route: "/ai-governance",
    },
  ];

  return {
    sourcePosture: "legacy-ai",
    contractId: "aims-p0-readiness",
    sourceTables: ["ai_systems", "ai_risk_assessments", "ai_incidents"],
    migrationPath: "Read model ai_* actual; futura compatibilidad aims_* por contrato, sin writes nuevos.",
    standaloneReady: domains.every((domain) => domain.status !== "gap"),
    domains,
    nextSteps: [
      "Cerrar evaluación aprobada de cada sistema de riesgo Alto.",
      "Convertir findings abiertos en controles GRC solo mediante contrato cross-module aprobado.",
      "Preparar mapping ai_systems → aims_systems antes de cualquier migración.",
      "Enlazar evidencia final únicamente cuando evidence_bundles y audit_log estén declarados aptos.",
    ],
  };
}
