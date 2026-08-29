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

export interface AimsComplianceCheckLike {
  id: string;
  system_id?: string | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  description?: string | null;
  status?: string | null;
  evidence_url?: string | null;
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
  /**
   * Si el dominio se apoya en algún dato. Un dominio sin dato no puede
   * contribuir a declarar el sistema operable: la ausencia no acredita.
   */
  hasData: boolean;
}

export interface AimsComplianceMonitorDomain {
  id: string;
  label: string;
  area: "EU AI Act" | "ISO 42001" | "Operativo AIMS" | "Cross-module";
  status: AimsReadinessStatus;
  metric: string;
  detail: string;
  route: string;
  source: "ai_systems" | "ai_risk_assessments" | "ai_compliance_checks" | "ai_incidents" | "derived";
  handoff?: string;
}

export interface AimsReadinessInput {
  systems: AimsSystemLike[];
  assessments: AimsAssessmentLike[];
  incidents: AimsIncidentLike[];
  complianceChecks?: AimsComplianceCheckLike[];
}

export interface AimsReadinessSummary {
  sourcePosture: AimsSourcePosture;
  contractId: "aims-p0-readiness";
  sourceTables: string[];
  migrationPath: string;
  standaloneReady: boolean;
  domains: AimsReadinessDomain[];
  complianceMonitors: AimsComplianceMonitorDomain[];
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
    route: "/ai-governance/sistemas/nuevo",
    screen: "Alta de Sistema IA",
    owner: "AIMS 360",
    hooks: ["useCreateAiSystem"],
    tables: ["ai_systems"],
    posture: "legacy_write",
    sourceOfTruth: "ai_systems",
    operation: "owner-write",
    crossModuleHandoffs: ["No aplica; alta propietaria AIMS"],
    migrationRequired: false,
    notes: "Reactivacion owner-write sobre tabla legacy existente; no escribe aims_* ni modulos externos.",
  },
  {
    route: "/ai-governance/sistemas/:id",
    screen: "Detalle de Sistema IA",
    owner: "AIMS 360",
    hooks: [
      "useAiSystemById", "useAssessmentsBySystem", "useComplianceChecksBySystem",
      "useAiIncidentsBySystem", "useAimsTechnicalFile*", "useFriaBySystem", "useFriaDetails",
    ],
    tables: [
      "ai_systems", "ai_risk_assessments", "ai_compliance_checks", "ai_incidents",
      "aims_technical_file_sections", "aims_system_versions", "aims_monitoring_indicators",
      "aims_model_registry", "aims_dataset_registry", "aims_fria_*",
    ],
    posture: "legacy_write",
    sourceOfTruth: "ai_systems como owner; expediente técnico y FRIA sobre aims_*",
    operation: "owner-write",
    crossModuleHandoffs: ["Referencia contextual a evaluaciones e incidentes AIMS"],
    migrationRequired: true,
    // CORRECCIÓN (review A5): declaraba `read-only` sobre `ai_*` y
    // `migrationRequired: false`, y la pantalla lee seis tablas `aims_*` y
    // ESCRIBE en `aims_technical_file_sections`. El contrato se afirmaba a sí
    // mismo sin mirar el consumidor, y `readiness.test.ts` lo blindaba.
    notes: "Consume el backbone aims_* además de ai_*; escribe secciones del expediente técnico.",
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
  {
    route: "/ai-governance/incidentes/nuevo",
    screen: "Alta de Incidente IA",
    owner: "AIMS 360",
    hooks: ["useCreateAiIncident", "useAiSystemsList"],
    tables: ["ai_incidents", "ai_systems"],
    posture: "legacy_write",
    sourceOfTruth: "ai_incidents con system_id a ai_systems",
    operation: "owner-write",
    crossModuleHandoffs: [
      "Post-alta, AIMS_INCIDENT_MATERIAL -> /grc/incidentes si aplica",
      "Post-alta, AIMS_INCIDENT_MATERIAL -> /secretaria/reuniones/nueva si aplica",
    ],
    migrationRequired: false,
    notes: "Probe de permisos alcanzo FK segura; no escribe GRC ni Secretaria.",
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

const COMPLIANT_STATUSES = new Set(["CONFORME", "APROBADO", "OK", "CERRADO", "COMPLETO"]);
const WATCH_STATUSES = new Set(["EN_CURSO", "EN_REVISION", "EN_REVISIÓN", "PENDIENTE", "PARCIAL", "BORRADOR"]);
const GAP_STATUSES = new Set(["NO_CONFORME", "ABIERTO", "BLOQUEADO", "VENCIDO", "CRITICO", "CRÍTICO"]);

type MonitorDefinition = Omit<AimsComplianceMonitorDomain, "status" | "metric"> & {
  keywords: string[];
};

const complianceMonitorDefinitions: MonitorDefinition[] = [
  {
    id: "governance-accountability",
    label: "Gobierno, roles y accountability",
    area: "ISO 42001",
    detail: "Responsables, aprobación, segregación y gobernanza del sistema de gestión IA.",
    route: "/ai-governance/sistemas",
    source: "derived",
    keywords: ["governance", "accountability", "responsable", "owner", "rol", "iso-42001-5", "iso-42001-6"],
  },
  {
    id: "inventory-classification",
    label: "Inventario y clasificación de riesgo",
    area: "EU AI Act",
    detail: "Registro completo, estado operativo, riesgo AI Act y uso previsto.",
    route: "/ai-governance/sistemas",
    source: "ai_systems",
    keywords: ["inventario", "clasificacion", "clasificación", "risk classification", "risk_level", "aia-6"],
  },
  {
    id: "prohibited-practices",
    label: "Prácticas prohibidas",
    area: "EU AI Act",
    detail: "Detección temprana de usos inaceptables o prácticas no permitidas.",
    route: "/ai-governance/sistemas",
    source: "derived",
    keywords: ["prohibited", "prohibida", "inaceptable", "aia-5"],
  },
  {
    id: "high-risk-obligations",
    label: "Obligaciones alto riesgo",
    area: "EU AI Act",
    detail: "Cobertura aprobada para sistemas de alto riesgo y estado de evaluación.",
    route: "/ai-governance/evaluaciones",
    source: "ai_risk_assessments",
    keywords: ["high-risk", "alto riesgo", "aia-8", "aia-9", "aia-10", "aia-14", "aia-15"],
  },
  {
    id: "technical-documentation",
    label: "Expediente técnico",
    area: "EU AI Act",
    detail: "Documentación técnica, trazabilidad y gaps derivables a GRC como intake.",
    route: "/ai-governance/evaluaciones",
    source: "ai_risk_assessments",
    handoff: "AIMS_TECHNICAL_FILE_GAP",
    keywords: ["technical file", "expediente tecnico", "expediente técnico", "documentacion tecnica", "documentación técnica", "aia-11"],
  },
  {
    id: "data-governance",
    label: "Gobierno del dato",
    area: "EU AI Act",
    detail: "Calidad, linaje, sesgo, representatividad y control de datasets.",
    route: "/ai-governance/evaluaciones",
    source: "ai_compliance_checks",
    keywords: ["data governance", "datos", "dataset", "sesgo", "bias", "calidad", "linaje", "aia-10"],
  },
  {
    id: "transparency-user-information",
    label: "Transparencia e información al usuario",
    area: "EU AI Act",
    detail: "Información a usuarios, instrucciones de uso, explicación y avisos.",
    route: "/ai-governance/evaluaciones",
    source: "ai_compliance_checks",
    keywords: ["transparency", "transparencia", "usuario", "informacion", "información", "explicabilidad", "aia-13"],
  },
  {
    id: "human-oversight",
    label: "Supervisión humana",
    area: "EU AI Act",
    detail: "Human-in-the-loop, intervención, override y responsabilidades operativas.",
    route: "/ai-governance/evaluaciones",
    source: "ai_compliance_checks",
    keywords: ["human oversight", "supervision humana", "supervisión humana", "override", "intervencion", "intervención", "aia-14"],
  },
  {
    id: "accuracy-robustness-cybersecurity",
    label: "Precisión, robustez y ciberseguridad",
    area: "EU AI Act",
    detail: "Rendimiento, resiliencia, drift, seguridad y fallos materiales.",
    route: "/ai-governance/incidentes",
    source: "ai_incidents",
    keywords: ["accuracy", "precision", "precisión", "robustez", "robustness", "cyber", "ciber", "drift", "aia-15"],
  },
  {
    id: "provider-vendor-third-party",
    label: "Proveedor y terceros",
    area: "Operativo AIMS",
    detail: "Identificación de vendor, dependencia crítica y handoff potencial a GRC TPRM.",
    route: "/ai-governance/sistemas",
    source: "ai_systems",
    handoff: "AIMS_VENDOR_CONTEXT",
    keywords: ["vendor", "proveedor", "third party", "tercero", "outsourcing"],
  },
  {
    id: "post-market-monitoring",
    label: "Post-market monitoring",
    area: "EU AI Act",
    detail: "Seguimiento operativo, causa raíz, acciones correctivas e incidentes recurrentes.",
    route: "/ai-governance/incidentes",
    source: "ai_incidents",
    keywords: ["post-market", "monitoring", "seguimiento", "corrective", "correctiva", "root cause", "causa raiz", "causa raíz"],
  },
  {
    id: "incident-reporting-escalation",
    label: "Reporting de incidentes y escalado",
    area: "Cross-module",
    detail: "Incidentes materiales con posible intake GRC o escalado formal a Secretaría.",
    route: "/ai-governance/incidentes",
    source: "ai_incidents",
    handoff: "AIMS_INCIDENT_MATERIAL",
    keywords: ["incident", "incidente", "material", "reporting", "escalado", "notificacion", "notificación"],
  },
  {
    id: "fundamental-rights-dpia",
    label: "Derechos fundamentales / DPIA",
    area: "Cross-module",
    detail: "Impacto sobre personas, privacidad, no discriminación y enlace con GDPR cuando proceda.",
    route: "/ai-governance/evaluaciones",
    source: "derived",
    handoff: "AIMS_GDPR_CONTEXT",
    keywords: ["fundamental rights", "derechos fundamentales", "dpia", "privacidad", "gdpr", "discriminacion", "discriminación"],
  },
  {
    id: "iso-42001-management-system",
    label: "Sistema de gestión ISO 42001",
    area: "ISO 42001",
    detail: "Políticas, objetivos, mejora continua, auditoría interna y revisión de dirección.",
    route: "/ai-governance/evaluaciones",
    source: "ai_risk_assessments",
    keywords: ["iso 42001", "iso_42001", "management system", "sistema de gestion", "sistema de gestión", "auditoria interna"],
  },
  {
    id: "evidence-recordkeeping",
    label: "Evidencia y recordkeeping",
    area: "Operativo AIMS",
    detail: "Referencias, evidencias operativas y límites probatorios explícitos.",
    route: "/ai-governance/evaluaciones",
    source: "ai_compliance_checks",
    keywords: ["evidence", "evidencia", "recordkeeping", "registro", "logs", "trazabilidad", "aia-12"],
  },
];

function normalizeSearchText(...parts: Array<string | null | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function checksForDefinition(checks: AimsComplianceCheckLike[], definition: MonitorDefinition) {
  const keywords = definition.keywords.map((keyword) => normalizeSearchText(keyword));
  return checks.filter((check) => {
    const haystack = normalizeSearchText(check.requirement_code, check.requirement_title, check.description);
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function statusFromChecks(checks: AimsComplianceCheckLike[]): AimsReadinessStatus | null {
  if (checks.length === 0) return null;
  const statuses = checks.map((check) => check.status ?? "");
  if (statuses.some((status) => GAP_STATUSES.has(status))) return "gap";
  if (statuses.every((status) => COMPLIANT_STATUSES.has(status))) return "ready";
  if (statuses.some((status) => WATCH_STATUSES.has(status))) return "watch";
  return "watch";
}

function fallbackMonitorStatus(
  definition: MonitorDefinition,
  input: Required<Pick<AimsReadinessInput, "systems" | "assessments" | "incidents">>,
): { status: AimsReadinessStatus; metric: string } {
  const { systems, assessments, incidents } = input;
  const totalSystems = systems.length;
  const activeSystems = systems.filter((system) => system.status === "ACTIVO").length;
  const highRiskSystems = systems.filter((system) => system.risk_level === "Alto");
  const inacceptableSystems = systems.filter((system) => system.risk_level === "Inaceptable");
  const assessedSystemIds = new Set(
    assessments
      .filter((assessment) => assessment.status === "APROBADO" && assessment.system_id)
      .map((assessment) => assessment.system_id as string),
  );
  const highRiskAssessed = highRiskSystems.filter((system) => assessedSystemIds.has(system.id)).length;
  const technicalGaps = assessments.filter(isAimsTechnicalFileGapCandidate).length;
  const materialIncidents = incidents.filter(isAimsMaterialIncidentCandidate).length;
  const incidentsWithClosureEvidence = incidents.filter(
    (incident) => incident.root_cause || incident.corrective_action || incident.closed_at,
  ).length;
  const systemsWithVendor = systems.filter((system) => Boolean(system.vendor)).length;
  const isoAssessments = assessments.filter((assessment) =>
    normalizeSearchText((assessment as { framework?: string | null }).framework).includes("iso"),
  );
  const approvedIsoAssessments = isoAssessments.filter((assessment) => assessment.status === "APROBADO").length;

  switch (definition.id) {
    case "inventory-classification":
      return {
        status: domainStatus(pct(activeSystems, totalSystems), 50, 80),
        metric: totalSystems === 0 ? "0 sistemas" : `${activeSystems}/${totalSystems} activos`,
      };
    case "prohibited-practices":
      return {
        status: inacceptableSystems.length > 0 ? "gap" : totalSystems > 0 ? "watch" : "gap",
        metric: systems.length === 0 ? "Sin inventario" : `${inacceptableSystems.length} inaceptables`,
      };
    case "high-risk-obligations":
      return {
        status: domainStatus(pct(highRiskAssessed, highRiskSystems.length), 50, 100),
        metric: highRiskSystems.length === 0 ? "Sin alto riesgo" : `${highRiskAssessed}/${highRiskSystems.length} alto riesgo`,
      };
    case "technical-documentation":
      return {
        status: technicalGaps === 0 && assessments.length > 0 ? "ready" : technicalGaps <= 2 ? "watch" : "gap",
        metric: assessments.length === 0 ? "Sin evaluaciones" : `${technicalGaps} gaps`,
      };
    case "accuracy-robustness-cybersecurity":
    case "incident-reporting-escalation":
      return {
        status: incidents.length === 0 ? "watch" : materialIncidents === 0 ? "ready" : materialIncidents <= 2 ? "watch" : "gap",
        metric: incidents.length === 0 ? "Sin incidentes registrados" : `${materialIncidents} materiales`,
      };
    case "provider-vendor-third-party":
      return {
        status: domainStatus(pct(systemsWithVendor, totalSystems), 50, 80),
        metric: totalSystems === 0 ? "0 proveedores" : `${systemsWithVendor}/${totalSystems} con vendor`,
      };
    case "post-market-monitoring":
    case "evidence-recordkeeping":
      return {
        status: incidents.length === 0 ? "watch" : domainStatus(pct(incidentsWithClosureEvidence, incidents.length), 50, 80),
        metric: incidents.length === 0 ? "Sin incidentes" : `${incidentsWithClosureEvidence}/${incidents.length} con cierre`,
      };
    case "iso-42001-management-system":
      return {
        status: isoAssessments.length === 0 ? "gap" : domainStatus(pct(approvedIsoAssessments, isoAssessments.length), 50, 80),
        metric: isoAssessments.length === 0 ? "Sin ISO" : `${approvedIsoAssessments}/${isoAssessments.length} aprobadas`,
      };
    case "governance-accountability":
    case "fundamental-rights-dpia":
    case "data-governance":
    case "transparency-user-information":
    case "human-oversight":
    default:
      return {
        status: assessments.length > 0 ? "watch" : "gap",
        metric: assessments.length > 0 ? "Derivado" : "Sin cobertura",
      };
  }
}

export function buildAimsComplianceMonitors(input: AimsReadinessInput): AimsComplianceMonitorDomain[] {
  const checks = input.complianceChecks ?? [];
  const base = {
    systems: input.systems,
    assessments: input.assessments,
    incidents: input.incidents,
  };

  return complianceMonitorDefinitions.map((definition) => {
    const matchingChecks = checksForDefinition(checks, definition);
    const checkedStatus = statusFromChecks(matchingChecks);
    const fallback = fallbackMonitorStatus(definition, base);
    const status = checkedStatus ?? fallback.status;
    const metric = matchingChecks.length > 0
      ? `${matchingChecks.filter((check) => COMPLIANT_STATUSES.has(check.status ?? "")).length}/${matchingChecks.length} conformes`
      : fallback.metric;

    return {
      id: definition.id,
      label: definition.label,
      area: definition.area,
      status,
      metric,
      detail: definition.detail,
      route: definition.route,
      source: matchingChecks.length > 0 ? "ai_compliance_checks" : definition.source,
      handoff: definition.handoff,
    };
  });
}

export function buildAimsReadiness({
  systems,
  assessments,
  incidents,
  complianceChecks = [],
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
      hasData: systems.length > 0,
      label: "Inventario",
      status: domainStatus(inventoryCoverage, 50, 80),
      metric: totalSystems === 0 ? "0 sistemas" : `${activeSystems}/${totalSystems} activos`,
      detail: "Registro operativo de sistemas IA, proveedor, tipo, estado y riesgo.",
      route: "/ai-governance/sistemas",
    },
    {
      id: "ai-act-assessments",
      hasData: assessments.length > 0,
      label: "Evaluaciones AI Act",
      status: domainStatus(assessmentCoverage, 50, 100),
      metric: highRiskSystems.length === 0 ? "Sin alto riesgo" : `${highRiskAssessed}/${highRiskSystems.length} alto riesgo`,
      detail: "Cobertura aprobada para sistemas de riesgo alto y trazabilidad de evaluaciones.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "incidents",
      hasData: incidents.length > 0,
      label: "Incidentes",
      // Sin un solo incidente registrado no se sabe si hay incidencias: es
      // ausencia de dato, no conformidad.
      status: incidents.length === 0 ? "watch" : openIncidents === 0 ? "ready" : openIncidents <= 2 ? "watch" : "gap",
      metric: incidents.length === 0 ? "Sin incidentes registrados" : `${openIncidents} abiertos`,
      detail: "Registro de severidad, investigación, causa raíz y acción correctiva.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "controls",
      hasData: controlFindings.length > 0,
      label: "Controles",
      status: controlFindings.length === 0 ? "watch" : domainStatus(controlCoverage, 40, 75),
      metric: controlFindings.length === 0 ? "Derivado" : `${closedControlFindings}/${controlFindings.length} cerrados`,
      detail: "Postura derivada de findings de evaluación; no crea controles paralelos.",
      route: "/ai-governance/evaluaciones",
    },
    {
      id: "operational-evidence",
      hasData: incidents.length > 0,
      label: "Evidencias operativas",
      status: incidents.length === 0 ? "watch" : domainStatus(incidentClosureCoverage, 50, 80),
      metric: incidents.length === 0 ? "Pendiente" : `${incidentsWithClosureEvidence}/${incidents.length} con cierre`,
      detail: "Evidencia funcional para demo; no se presenta como evidencia probatoria final.",
      route: "/ai-governance/incidentes",
    },
    {
      id: "migration",
      hasData: false,
      label: "Migración ai_* → aims_*",
      status: "watch",
      // No se mide desde aquí: `buildAimsReadiness` sólo recibe `ai_*`.
      // Antes afirmaba "Sin schema nuevo", que además era falso — las tablas
      // `aims_*` del backbone existen desde abril.
      metric: "No medido",
      detail: "Postura sobre ai_* legacy; el estado del backbone aims_* no se mide en este resumen.",
      route: "/ai-governance",
    },
  ];
  const complianceMonitors = buildAimsComplianceMonitors({ systems, assessments, incidents, complianceChecks });

  return {
    sourcePosture: "legacy-ai",
    contractId: "aims-p0-readiness",
    sourceTables: ["ai_systems", "ai_risk_assessments", "ai_incidents"],
    migrationPath: "Read model ai_* en este resumen; el expediente técnico ya lee y escribe aims_* fuera de él.",
    // No se declara operable sobre la ausencia de dato: además de no tener
    // brechas, todo dominio tiene que apoyarse en algún dato. Antes bastaba
    // con que ninguno fuera "gap", y "watch" es justo el marcador de
    // "no tengo dato" — cuatro dominios diciendo eso se compactaban en un
    // tick verde de "Demo operable".
    // `migration` queda fuera del cómputo: es una nota de postura sobre el
    // backbone, no un dominio de cumplimiento con dato propio, y por eso su
    // `hasData` es false por definición.
    standaloneReady: domains
      .filter((domain) => domain.id !== "migration")
      .every((domain) => domain.status !== "gap" && domain.hasData),
    domains,
    complianceMonitors,
    nextSteps: [
      "Cerrar evaluación aprobada de cada sistema de riesgo Alto.",
      "Completar monitorización por dominios AI Act, ISO 42001, proveedores, post-market y derechos fundamentales.",
      "Convertir findings abiertos en controles GRC solo mediante contrato cross-module aprobado.",
      "Preparar mapping ai_systems → aims_systems antes de cualquier migración.",
      "Enlazar evidencia final únicamente cuando evidence_bundles y audit_log estén declarados aptos.",
    ],
  };
}

export function filterSystemsByScope<T extends { name: string; description?: string | null }>(
  systems: T[],
  _scope: string,
): T[] {
  // MINA DESACTIVADA (A5, 2026-08-29): esta función recortaba el inventario
  // buscando `auto`, `siniestros`, `salud`, `fraude`, `motor`, `suscripción` y
  // `patrimonial` en el nombre y la descripción. Con un inventario que no fuera
  // asegurador devolvía cero sistemas — medido: 3 de 3 sistemas de despacho
  // desaparecían en el ámbito "España".
  //
  // CORRECCIÓN (review A5): NO era una mina latente, estaba ARMADA. Se creyó
  // inofensiva porque `branding.scopes` es NULL en los dos tenants, pero
  // `scopesForTenant` (`src/lib/tenant-scopes.ts:14`) devuelve `ARGA_SCOPES`
  // justamente cuando el branding es NULL, y `src/data/scopes.ts` incluye
  // "España", "LATAM", "Europa", "Brasil" y "México". Es decir: en ARGA el
  // recorte por vocabulario se disparaba de verdad y ocultaba EN SILENCIO
  // cualquier sistema cuyo nombre no contuviera esas palabras.
  //
  // `ai_systems` no tiene columna de jurisdicción ni de ámbito: no hay nada por
  // lo que filtrar. Cuando la haya, se filtra por el dato declarado, nunca por
  // palabras del nombre.
  return systems;
}

