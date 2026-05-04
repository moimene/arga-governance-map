export type GrcReadinessStatus = "ready" | "watch" | "gap";
export type GrcSourcePosture = "legacy" | "frontend_connected";
export type GrcComplianceArea =
  | "Riesgo y control"
  | "Regulatorio y privacidad"
  | "Tecnología y resiliencia"
  | "Assurance y escalado";
export type GrcScreenSourcePosture =
  | "legacy_read"
  | "legacy_write"
  | "tgms_handoff"
  | "local_demo_read"
  | "backlog_placeholder";
export type GrcScreenAccessMode = "read-only" | "owner-write" | "backlog";

export type GrcHandoffCandidate = {
  id: string;
  label: string;
  sourceOwner: "GRC Compass" | "AIMS" | "Secretaría";
  targetOwner: "GRC Compass" | "Secretaría";
  targetRoute: string;
  contractEvent: string;
  mutation: "read-only-route";
};

export type GrcScreenPosture = {
  id: string;
  route: string;
  label: string;
  owner: "GRC Compass";
  tables: string[];
  hooks: string[];
  sourcePosture: GrcScreenSourcePosture;
  sourceOfTruth: string;
  accessMode: GrcScreenAccessMode;
  handoffCandidateIds: string[];
  notes: string;
};

export type GrcP0Domain = {
  id: string;
  label: string;
  executiveSignal: string;
  sourcePosture: GrcSourcePosture;
  sourceLabel: string;
  readiness: GrcReadinessStatus;
  coverage: number;
  route: string;
  nextStep: string;
  connectedRoutes: string[];
};

export type GrcComplianceMonitorDomain = {
  id: string;
  label: string;
  area: GrcComplianceArea;
  readiness: GrcReadinessStatus;
  route: string;
  executiveSignal: string;
  nextAction: string;
  sourceTables: string[];
  sourcePosture: GrcScreenSourcePosture;
  sourceOfTruth: string;
  handoffCandidateIds: string[];
};

export const GRC_P0_DOMAINS: GrcP0Domain[] = [
  {
    id: "gdpr-canal-interno",
    label: "GDPR / Canal interno",
    executiveSignal: "Privacidad, DSAR, ROPA y canal de información interna",
    sourcePosture: "frontend_connected",
    sourceLabel: "frontend conectado",
    readiness: "watch",
    coverage: 68,
    route: "/grc/m/gdpr",
    nextStep: "Usar ROPA, DPIA, DSAR y DPO como flujo de privacidad conectado; canal interno queda como extensión futura.",
    connectedRoutes: [
      "/grc/m/gdpr/operate/ropa",
      "/grc/m/gdpr/operate/dpias",
      "/grc/m/gdpr/operate/dsars",
      "/grc/m/gdpr/governance/dpo",
    ],
  },
  {
    id: "dora-ict",
    label: "DORA / ICT",
    executiveSignal: "Incidentes ICT, continuidad, RTO y notificación reguladora",
    sourcePosture: "frontend_connected",
    sourceLabel: "frontend conectado",
    readiness: "ready",
    coverage: 82,
    route: "/grc/m/dora",
    nextStep: "Preparar narrativa de impacto ejecutivo y simular escalado de incidente mayor.",
    connectedRoutes: [
      "/grc/m/dora/operate/incidents",
      "/grc/m/dora/operate/bcm",
      "/grc/m/dora/operate/rto",
      "/grc/m/dora/governance/policies",
      "/grc/m/dora/config/thresholds",
    ],
  },
  {
    id: "cyber",
    label: "Cyber",
    executiveSignal: "SOC, vulnerabilidades críticas y postura de remediación",
    sourcePosture: "frontend_connected",
    sourceLabel: "frontend conectado",
    readiness: "watch",
    coverage: 74,
    route: "/grc/m/cyber",
    nextStep: "Priorizar CVE críticas abiertas y vincularlas a excepciones aprobadas.",
    connectedRoutes: [
      "/grc/m/cyber/operate/vulnerabilities",
      "/grc/m/cyber/operate/incidents",
      "/grc/m/cyber/governance/soc",
    ],
  },
  {
    id: "erm-auditoria",
    label: "ERM / Auditoría",
    executiveSignal: "Riesgos críticos, hallazgos y planes de acción",
    sourcePosture: "frontend_connected",
    sourceLabel: "frontend conectado",
    readiness: "ready",
    coverage: 79,
    route: "/grc/m/audit",
    nextStep: "Conectar top risks con hallazgos de auditoría para comité ejecutivo.",
    connectedRoutes: [
      "/grc/m/audit/operate/findings",
      "/grc/m/audit/operate/plans",
      "/grc/m/audit/governance/program",
      "/grc/risk-360",
      "/grc/risk-360/nuevo",
      "/grc/risk-360/:id/editar",
      "/grc/penal-anticorrupcion",
    ],
  },
  {
    id: "work-alerts-exceptions",
    label: "Trabajo / Alertas / Excepciones",
    executiveSignal: "Bandeja operativa, deadlines regulatorios y excepciones pendientes",
    sourcePosture: "legacy",
    sourceLabel: "legacy conectado",
    readiness: "watch",
    coverage: 72,
    route: "/grc/mywork",
    nextStep: "Usar estas pantallas como cola ejecutiva real mientras se definen writes cross-module.",
    connectedRoutes: ["/grc/mywork", "/grc/alertas", "/grc/excepciones"],
  },
  {
    id: "country-packs",
    label: "Packs país",
    executiveSignal: "Cobertura jurisdiccional y accesos a módulos por país",
    sourcePosture: "legacy",
    sourceLabel: "legacy conectado",
    readiness: "ready",
    coverage: 76,
    route: "/grc/packs",
    nextStep: "Usar packs como navegación territorial hasta activar TPRM/penal como módulos propios.",
    connectedRoutes: ["/grc/packs", "/grc/packs/:countryCode"],
  },
];

export const GRC_NOT_CONNECTED_BACKLOG = [
  {
    id: "tprm",
    label: "TPRM",
    reason: "No hay pantalla TPRM específica conectada en el frontend GRC actual.",
  },
];

export const GRC_HANDOFF_CANDIDATES: GrcHandoffCandidate[] = [
  {
    id: "grc-incident-secretaria",
    label: "Incidente material GRC a propuesta de agenda Secretaría",
    sourceOwner: "GRC Compass",
    targetOwner: "Secretaría",
    targetRoute: "/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL",
    contractEvent: "GRC_INCIDENT_MATERIAL",
    mutation: "read-only-route",
  },
  {
    id: "grc-finding-secretaria",
    label: "Hallazgo crítico GRC a propuesta de agenda Secretaría",
    sourceOwner: "GRC Compass",
    targetOwner: "Secretaría",
    targetRoute: "/secretaria/reuniones/nueva?source=grc&event=GRC_FINDING_BOARD_ESCALATION",
    contractEvent: "GRC_FINDING_BOARD_ESCALATION",
    mutation: "read-only-route",
  },
  {
    id: "aims-gap-grc",
    label: "Gap AI Act/ISO a intake GRC",
    sourceOwner: "AIMS",
    targetOwner: "GRC Compass",
    targetRoute: "/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP",
    contractEvent: "AIMS_TECHNICAL_FILE_GAP",
    mutation: "read-only-route",
  },
  {
    id: "aims-incident-grc",
    label: "Incidente IA material a intake GRC",
    sourceOwner: "AIMS",
    targetOwner: "GRC Compass",
    targetRoute: "/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL",
    contractEvent: "AIMS_INCIDENT_MATERIAL",
    mutation: "read-only-route",
  },
];

export const GRC_COMPLIANCE_AREAS: GrcComplianceArea[] = [
  "Riesgo y control",
  "Regulatorio y privacidad",
  "Tecnología y resiliencia",
  "Assurance y escalado",
];

export const GRC_COMPLIANCE_MONITORS: GrcComplianceMonitorDomain[] = [
  {
    id: "regulatory-obligations",
    label: "Inventario normativo y obligaciones",
    area: "Regulatorio y privacidad",
    readiness: "ready",
    route: "/obligaciones",
    executiveSignal: "Obligaciones, políticas y vencimientos regulatorios trazables.",
    nextAction: "Mantener el mapa de obligaciones como entrada común de controles y alertas.",
    sourceTables: ["obligations", "policies", "regulatory_notifications"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "obligations and policies are the current GRC regulatory source of truth.",
    handoffCandidateIds: [],
  },
  {
    id: "controls-assurance",
    label: "Controles, evidencias y efectividad",
    area: "Riesgo y control",
    readiness: "watch",
    route: "/controles",
    executiveSignal: "Diseño de controles, evidencias asociadas y postura de test.",
    nextAction: "Separar controles críticos, evidencias faltantes y controles con excepción aprobada.",
    sourceTables: ["controls", "evidences", "exceptions"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "controls and evidences remain the connected control assurance read model.",
    handoffCandidateIds: [],
  },
  {
    id: "risk-rcsa",
    label: "RCSA / Riesgos y scoring",
    area: "Riesgo y control",
    readiness: "ready",
    route: "/grc/risk-360",
    executiveSignal: "Riesgos GRC con scoring inherente/residual y edición owner-write.",
    nextAction: "Usar alta/edición de riesgos GRC para completar riesgos de cumplimiento pendientes.",
    sourceTables: ["risks", "obligations", "findings"],
    sourcePosture: "legacy_write",
    sourceOfTruth: "risks is the current owner-write GRC risk source of truth.",
    handoffCandidateIds: ["aims-gap-grc"],
  },
  {
    id: "incident-regulatory",
    label: "Incidentes y notificación regulatoria",
    area: "Regulatorio y privacidad",
    readiness: "ready",
    route: "/grc/incidentes",
    executiveSignal: "Incidentes, severidad, materialidad y deadline regulatorio.",
    nextAction: "Convertir incidentes mayores en paquetes de escalado y notificación.",
    sourceTables: ["incidents", "regulatory_notifications"],
    sourcePosture: "legacy_write",
    sourceOfTruth: "incidents is the current owner-write incident source; regulatory_notifications is read model.",
    handoffCandidateIds: ["grc-incident-secretaria"],
  },
  {
    id: "dora-ict",
    label: "DORA / ICT risk",
    area: "Tecnología y resiliencia",
    readiness: "ready",
    route: "/grc/m/dora",
    executiveSignal: "Incidentes ICT, continuidad, RTO y notificación DORA.",
    nextAction: "Alinear incidentes mayores con umbrales DORA y evidencias de resiliencia.",
    sourceTables: ["incidents", "bcm_bia", "bcm_plans", "regulatory_notifications"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "DORA module reads existing incident, BCM and regulatory notification tables.",
    handoffCandidateIds: ["grc-incident-secretaria"],
  },
  {
    id: "cyber-remediation",
    label: "Cyber y vulnerabilidades",
    area: "Tecnología y resiliencia",
    readiness: "watch",
    route: "/grc/m/cyber",
    executiveSignal: "Vulnerabilidades críticas, incidentes cyber y excepciones compensatorias.",
    nextAction: "Priorizar CVE críticas y enlazarlas a controles o excepciones aprobadas.",
    sourceTables: ["vulnerabilities", "incidents", "exceptions"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Cyber workbench reads vulnerabilities, incidents and exceptions.",
    handoffCandidateIds: ["grc-incident-secretaria"],
  },
  {
    id: "bcm-operational-resilience",
    label: "BCM / Resiliencia operacional",
    area: "Tecnología y resiliencia",
    readiness: "watch",
    route: "/grc/m/dora/operate/bcm",
    executiveSignal: "Procesos críticos, BIA, RTO/RPO y continuidad operativa.",
    nextAction: "Completar dependencias críticas y pruebas de continuidad por proceso.",
    sourceTables: ["bcm_bia", "bcm_plans"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "BCM module reads the current business impact and continuity planning tables.",
    handoffCandidateIds: [],
  },
  {
    id: "privacy-gdpr",
    label: "GDPR / Privacidad operativa",
    area: "Regulatorio y privacidad",
    readiness: "watch",
    route: "/grc/m/gdpr",
    executiveSignal: "ROPA, DPIA, DSAR y gobierno DPO como flujo de privacidad.",
    nextAction: "Elevar privacidad de demo conectada a cola operativa con owners y deadlines.",
    sourceTables: ["obligations", "policies"],
    sourcePosture: "local_demo_read",
    sourceOfTruth: "GDPR nested module is connected as frontend demo/read model over current obligations and policies.",
    handoffCandidateIds: [],
  },
  {
    id: "tprm-outsourcing",
    label: "TPRM / Outsourcing",
    area: "Riesgo y control",
    readiness: "gap",
    route: "/grc/packs",
    executiveSignal: "Terceros, outsourcing crítico y due diligence no tienen workbench propio todavía.",
    nextAction: "Definir tabla/contrato de terceros antes de prometer workflows owner-write.",
    sourceTables: [],
    sourcePosture: "backlog_placeholder",
    sourceOfTruth: "Backlog; no dedicated TPRM table or screen is connected in this slice.",
    handoffCandidateIds: [],
  },
  {
    id: "penal-anticorruption",
    label: "Penal / Anticorrupción",
    area: "Riesgo y control",
    readiness: "watch",
    route: "/grc/penal-anticorrupcion",
    executiveSignal: "Mapa de riesgos penales, obligaciones y controles con taxonomía GRC.",
    nextAction: "Pasar de vista taxonómica a flujo de evaluación y evidencias por delito/riesgo.",
    sourceTables: ["risks", "obligations", "controls"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Penal/anticorruption is currently a GRC taxonomy over risks, obligations and controls.",
    handoffCandidateIds: ["grc-finding-secretaria"],
  },
  {
    id: "audit-remediation",
    label: "Auditoría interna y planes",
    area: "Assurance y escalado",
    readiness: "ready",
    route: "/grc/m/audit",
    executiveSignal: "Hallazgos, planes de acción y estado de remediación.",
    nextAction: "Agrupar hallazgos críticos por comité y fecha comprometida.",
    sourceTables: ["findings", "action_plans"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "findings and action_plans remain the connected audit remediation source.",
    handoffCandidateIds: ["grc-finding-secretaria"],
  },
  {
    id: "exceptions-waivers",
    label: "Excepciones y controles compensatorios",
    area: "Riesgo y control",
    readiness: "watch",
    route: "/grc/excepciones",
    executiveSignal: "Excepciones pendientes, vencimientos y compensating controls.",
    nextAction: "Distinguir excepción aceptable, excepción vencida y riesgo que requiere plan.",
    sourceTables: ["exceptions", "controls", "obligations"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "exceptions is the connected waiver register for GRC.",
    handoffCandidateIds: [],
  },
  {
    id: "policy-lifecycle",
    label: "Ciclo de políticas",
    area: "Regulatorio y privacidad",
    readiness: "watch",
    route: "/politicas",
    executiveSignal: "Políticas, aprobaciones, versiones y obligaciones derivadas.",
    nextAction: "Separar políticas vigentes, pendientes de revisión y obligaciones sin control.",
    sourceTables: ["policies", "obligations", "controls"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "policies is the current policy inventory source shared with TGMS shell.",
    handoffCandidateIds: [],
  },
  {
    id: "country-packs",
    label: "Packs país y jurisdicción",
    area: "Regulatorio y privacidad",
    readiness: "ready",
    route: "/grc/packs",
    executiveSignal: "Cobertura territorial y navegación por jurisdicción.",
    nextAction: "Usar packs como vista territorial mientras se formaliza matriz multi-país productiva.",
    sourceTables: ["country_packs", "pack_rules"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Country packs are the current jurisdictional GRC navigation contract.",
    handoffCandidateIds: [],
  },
  {
    id: "board-escalation",
    label: "Escalado a órganos",
    area: "Assurance y escalado",
    readiness: "watch",
    route: "/grc/alertas",
    executiveSignal: "Incidentes y hallazgos que requieren propuesta de agenda Secretaría.",
    nextAction: "Mantener handoff de solo lectura; Secretaría decide si crea acto formal.",
    sourceTables: ["incidents", "findings"],
    sourcePosture: "tgms_handoff",
    sourceOfTruth: "GRC owns source events; Secretaría owns formal corporate acts.",
    handoffCandidateIds: ["grc-incident-secretaria", "grc-finding-secretaria"],
  },
  {
    id: "aims-intake",
    label: "Intake desde AIMS",
    area: "Assurance y escalado",
    readiness: "watch",
    route: "/grc/risk-360",
    executiveSignal: "Gaps AI Act/ISO e incidentes IA llegan como contexto de intake GRC.",
    nextAction: "Convertir manualmente el intake en riesgo/control GRC cuando proceda.",
    sourceTables: ["risks", "incidents"],
    sourcePosture: "tgms_handoff",
    sourceOfTruth: "AIMS owns AI systems/evaluations/incidents; GRC owns risk/control workflow.",
    handoffCandidateIds: ["aims-gap-grc", "aims-incident-grc"],
  },
];

export const GRC_SCREEN_POSTURES: GrcScreenPosture[] = [
  {
    id: "grc-dashboard",
    route: "/grc",
    label: "Dashboard GRC Compass",
    owner: "GRC Compass",
    tables: ["risks", "incidents", "exceptions", "regulatory_notifications"],
    hooks: ["useGrcKpis", "getGrcP0ReadinessSummary", "getGrcScreenPostureSummary"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Supabase Cloud operational GRC tables plus local readiness contract.",
    accessMode: "read-only",
    handoffCandidateIds: ["aims-gap-grc", "aims-incident-grc", "grc-incident-secretaria", "grc-finding-secretaria"],
    notes: "Executive read model; no governance_module_events or governance_module_links writes.",
  },
  {
    id: "risk-360",
    route: "/grc/risk-360",
    label: "Risk 360",
    owner: "GRC Compass",
    tables: ["risks", "obligations", "findings"],
    hooks: ["useRisks"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "risks is the current GRC risk source of truth; grc_* remains candidate.",
    accessMode: "read-only",
    handoffCandidateIds: ["aims-gap-grc"],
    notes: "Accepts read-only AIMS intake query params for context only.",
  },
  {
    id: "risk-new",
    route: "/grc/risk-360/nuevo",
    label: "Nuevo riesgo",
    owner: "GRC Compass",
    tables: ["risks"],
    hooks: ["useCreateRisk"],
    sourcePosture: "legacy_write",
    sourceOfTruth: "risks remains the owner-write risk source; grc_* remains candidate.",
    accessMode: "owner-write",
    handoffCandidateIds: [],
    notes: "Writes only editable risks columns; inherent/residual scores are not inserted from UI.",
  },
  {
    id: "risk-edit",
    route: "/grc/risk-360/:id/editar",
    label: "Editar riesgo",
    owner: "GRC Compass",
    tables: ["risks"],
    hooks: ["useRiskById", "useUpdateRisk"],
    sourcePosture: "legacy_write",
    sourceOfTruth: "risks remains the owner-write risk source; grc_* remains candidate.",
    accessMode: "owner-write",
    handoffCandidateIds: [],
    notes: "Updates only GRC-owned risks; no AIMS or Secretaria mutation.",
  },
  {
    id: "penal-anticorrupcion",
    route: "/grc/penal-anticorrupcion",
    label: "Penal / Anticorrupción",
    owner: "GRC Compass",
    tables: ["risks", "obligations", "controls"],
    hooks: ["useRisks", "useObligationsList", "useAllControlsByObligationIds"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Taxonomy view over existing risks, obligations and controls; no dedicated penal table.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-finding-secretaria"],
    notes: "Connected GRC module view; risk creation remains in /grc/risk-360/nuevo?module=penal.",
  },
  {
    id: "packs-list",
    route: "/grc/packs",
    label: "Packs por País",
    owner: "GRC Compass",
    tables: ["country_packs", "pack_rules"],
    hooks: ["useCountryPacks"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "country_packs and pack_rules.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Territorial navigation only; TPRM and penal are not activated here.",
  },
  {
    id: "pack-detail",
    route: "/grc/packs/:countryCode",
    label: "Detalle pack país",
    owner: "GRC Compass",
    tables: ["country_packs", "pack_rules", "incidents", "risks", "regulatory_notifications"],
    hooks: ["useCountryPackDetail"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "country_packs plus existing GRC operational KPIs.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Country KPIs are read models, not pack-owned writes.",
  },
  {
    id: "incidents-list",
    route: "/grc/incidentes",
    label: "Incidentes",
    owner: "GRC Compass",
    tables: ["incidents", "obligations", "regulatory_notifications"],
    hooks: ["useIncidents"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "incidents and regulatory_notifications.",
    accessMode: "read-only",
    handoffCandidateIds: ["aims-incident-grc", "grc-incident-secretaria"],
    notes: "AIMS intake banner is navigation context only.",
  },
  {
    id: "incident-new",
    route: "/grc/incidentes/nuevo",
    label: "Nuevo incidente",
    owner: "GRC Compass",
    tables: ["incidents"],
    hooks: ["useCreateIncident"],
    sourcePosture: "legacy_write",
    sourceOfTruth: "incidents remains owner-write for the demo incident workflow.",
    accessMode: "owner-write",
    handoffCandidateIds: [],
    notes: "Only writes the GRC-owned incidents table; no Secretaría or AIMS mutations.",
  },
  {
    id: "incident-detail",
    route: "/grc/incidentes/:id",
    label: "Detalle incidente",
    owner: "GRC Compass",
    tables: ["incidents", "obligations", "regulatory_notifications"],
    hooks: ["useIncident", "hoursUntilDeadline", "deadlineLabel"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "incidents with joined regulatory_notifications.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-incident-secretaria"],
    notes: "Secretaría escalation is a proposed route handoff; Secretaría decides any formal act.",
  },
  {
    id: "my-work",
    route: "/grc/mywork",
    label: "Mi Trabajo",
    owner: "GRC Compass",
    tables: ["incidents", "action_plans", "findings", "exceptions"],
    hooks: ["useMyWork"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Operational queue assembled from GRC legacy tables.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "No task mutation in this screen.",
  },
  {
    id: "alerts",
    route: "/grc/alertas",
    label: "Alertas",
    owner: "GRC Compass",
    tables: ["regulatory_notifications", "incidents", "bcm_plans", "exceptions", "obligations"],
    hooks: ["useAlerts", "deadlineLabel"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "Deadlines from regulatory_notifications, bcm_plans and exceptions.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-incident-secretaria"],
    notes: "Alert rows link back to owner routes only.",
  },
  {
    id: "exceptions",
    route: "/grc/excepciones",
    label: "Excepciones",
    owner: "GRC Compass",
    tables: ["exceptions", "obligations"],
    hooks: ["useExceptions"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "exceptions with obligations join.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Request button is disabled; no write flow is advertised as connected.",
  },
  {
    id: "module-shell",
    route: "/grc/m/:moduleId",
    label: "Module dashboard",
    owner: "GRC Compass",
    tables: ["grc_module_nav"],
    hooks: ["useModuleNav"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "grc_module_nav controls available GRC module sections.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Module shell is navigation metadata, not domain mutation.",
  },
  {
    id: "module-dashboard",
    route: "/grc/m/:moduleId/dashboard",
    label: "Module dashboard explicit",
    owner: "GRC Compass",
    tables: ["grc_module_nav"],
    hooks: ["useModuleNav"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "grc_module_nav controls available GRC module sections.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Same source posture as the module index route.",
  },
  {
    id: "dora-incidents",
    route: "/grc/m/dora/operate/incidents",
    label: "Incidentes DORA",
    owner: "GRC Compass",
    tables: ["incidents", "obligations", "regulatory_notifications"],
    hooks: ["useIncidents"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "incidents filtered by incident_type=DORA.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-incident-secretaria"],
    notes: "Creation stays in /grc/incidentes/nuevo.",
  },
  {
    id: "dora-bcm",
    route: "/grc/m/dora/operate/bcm",
    label: "Business Continuity",
    owner: "GRC Compass",
    tables: ["bcm_bia", "bcm_plans"],
    hooks: ["useBcm"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "bcm_bia and bcm_plans.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Connected DORA continuity read model.",
  },
  {
    id: "dora-rto",
    route: "/grc/m/dora/operate/rto",
    label: "Objetivos RTO / RPO / MTD",
    owner: "GRC Compass",
    tables: ["bcm_bia"],
    hooks: ["useBia"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "bcm_bia.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Connected DORA recovery objectives read model.",
  },
  {
    id: "dora-policies",
    route: "/grc/m/dora/governance/policies",
    label: "Políticas DORA vinculadas",
    owner: "GRC Compass",
    tables: ["policies"],
    hooks: [],
    sourcePosture: "tgms_handoff",
    sourceOfTruth: "TGMS policies route; this GRC screen only routes to the owner surface.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Read-only handoff to core policy owner.",
  },
  {
    id: "dora-thresholds",
    route: "/grc/m/dora/config/thresholds",
    label: "Umbrales DORA",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "backlog_placeholder",
    sourceOfTruth: "Backlog; no connected threshold table in this slice.",
    accessMode: "backlog",
    handoffCandidateIds: [],
    notes: "Enterprise placeholder only.",
  },
  {
    id: "gdpr-ropa",
    route: "/grc/m/gdpr/operate/ropa",
    label: "ROPA",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "local_demo_read",
    sourceOfTruth: "Local demo constants in the screen; grc_* privacy source is not adopted.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Demo view, not a Cloud data source.",
  },
  {
    id: "gdpr-dpias",
    route: "/grc/m/gdpr/operate/dpias",
    label: "DPIAs",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "local_demo_read",
    sourceOfTruth: "Local demo constants in the screen; grc_* privacy source is not adopted.",
    accessMode: "read-only",
    handoffCandidateIds: ["aims-gap-grc"],
    notes: "AIMS remains owner for AI evaluations; this is a privacy demo view.",
  },
  {
    id: "gdpr-dsars",
    route: "/grc/m/gdpr/operate/dsars",
    label: "DSARs",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "local_demo_read",
    sourceOfTruth: "Local demo constants in the screen; grc_* privacy source is not adopted.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Demo view, not a Cloud data source.",
  },
  {
    id: "gdpr-dpo",
    route: "/grc/m/gdpr/governance/dpo",
    label: "Oficina DPO",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "backlog_placeholder",
    sourceOfTruth: "Backlog; no connected DPO workflow in this slice.",
    accessMode: "backlog",
    handoffCandidateIds: [],
    notes: "Enterprise placeholder only.",
  },
  {
    id: "cyber-vulnerabilities",
    route: "/grc/m/cyber/operate/vulnerabilities",
    label: "Vulnerabilidades",
    owner: "GRC Compass",
    tables: ["vulnerabilities"],
    hooks: ["useVulnerabilities"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "vulnerabilities.",
    accessMode: "read-only",
    handoffCandidateIds: [],
    notes: "Connected cyber read model.",
  },
  {
    id: "cyber-incidents",
    route: "/grc/m/cyber/operate/incidents",
    label: "Incidentes Cyber",
    owner: "GRC Compass",
    tables: ["incidents", "obligations", "regulatory_notifications"],
    hooks: ["useIncidents"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "incidents filtered by incident_type=CYBER.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-incident-secretaria"],
    notes: "Connected cyber incident view.",
  },
  {
    id: "cyber-soc",
    route: "/grc/m/cyber/governance/soc",
    label: "SOC & Threat Intel",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "backlog_placeholder",
    sourceOfTruth: "Backlog; no SOC integration table in this slice.",
    accessMode: "backlog",
    handoffCandidateIds: [],
    notes: "Enterprise placeholder only.",
  },
  {
    id: "audit-findings",
    route: "/grc/m/audit/operate/findings",
    label: "Hallazgos de Auditoría Interna",
    owner: "GRC Compass",
    tables: ["findings", "action_plans"],
    hooks: ["useAuditFindings"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "findings filtered by origin=AuditInterna plus action_plans.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-finding-secretaria"],
    notes: "Secretaría escalation is route-only; findings remain GRC-owned.",
  },
  {
    id: "audit-action-plans",
    route: "/grc/m/audit/operate/plans",
    label: "Planes de Acción",
    owner: "GRC Compass",
    tables: ["action_plans", "findings"],
    hooks: ["useAuditActionPlans"],
    sourcePosture: "legacy_read",
    sourceOfTruth: "action_plans with finding origin filter.",
    accessMode: "read-only",
    handoffCandidateIds: ["grc-finding-secretaria"],
    notes: "Read-only remediation portfolio.",
  },
  {
    id: "audit-program",
    route: "/grc/m/audit/governance/program",
    label: "Plan de Auditoría",
    owner: "GRC Compass",
    tables: [],
    hooks: [],
    sourcePosture: "backlog_placeholder",
    sourceOfTruth: "Backlog; no connected audit program table in this slice.",
    accessMode: "backlog",
    handoffCandidateIds: [],
    notes: "Enterprise placeholder only.",
  },
];

export function getGrcP0ReadinessSummary(domains: GrcP0Domain[] = GRC_P0_DOMAINS) {
  return {
    total: domains.length,
    ready: domains.filter((domain) => domain.readiness === "ready").length,
    watch: domains.filter((domain) => domain.readiness === "watch").length,
    gap: domains.filter((domain) => domain.readiness === "gap").length,
    legacySources: domains.filter((domain) => domain.sourcePosture === "legacy").length,
    connectedSources: domains.filter((domain) => domain.sourcePosture === "frontend_connected").length,
    connectedRoutes: domains.reduce((total, domain) => total + domain.connectedRoutes.length, 0),
    averageCoverage: Math.round(
      domains.reduce((total, domain) => total + domain.coverage, 0) / domains.length
    ),
  };
}

export function getGrcComplianceMonitorSummary(
  monitors: GrcComplianceMonitorDomain[] = GRC_COMPLIANCE_MONITORS,
) {
  return monitors.reduce(
    (summary, monitor) => {
      summary.total += 1;
      summary.byReadiness[monitor.readiness] += 1;
      summary.byArea[monitor.area] += 1;
      if (monitor.sourceTables.length > 0) summary.withSourceTables += 1;
      if (monitor.handoffCandidateIds.length > 0) summary.withHandoffs += 1;
      if (monitor.sourcePosture === "backlog_placeholder") summary.backlog += 1;
      return summary;
    },
    {
      total: 0,
      withSourceTables: 0,
      withHandoffs: 0,
      backlog: 0,
      byReadiness: {
        ready: 0,
        watch: 0,
        gap: 0,
      },
      byArea: {
        "Riesgo y control": 0,
        "Regulatorio y privacidad": 0,
        "Tecnología y resiliencia": 0,
        "Assurance y escalado": 0,
      },
    },
  );
}

export function getGrcScreenPostureSummary(screens: GrcScreenPosture[] = GRC_SCREEN_POSTURES) {
  return screens.reduce(
    (summary, screen) => {
      summary.total += 1;
      summary.byAccessMode[screen.accessMode] += 1;
      summary.bySourcePosture[screen.sourcePosture] += 1;
      if (screen.tables.length > 0) summary.withTables += 1;
      if (screen.handoffCandidateIds.length > 0) summary.withHandoffCandidates += 1;
      return summary;
    },
    {
      total: 0,
      withTables: 0,
      withHandoffCandidates: 0,
      byAccessMode: {
        "read-only": 0,
        "owner-write": 0,
        backlog: 0,
      },
      bySourcePosture: {
        legacy_read: 0,
        legacy_write: 0,
        tgms_handoff: 0,
        local_demo_read: 0,
        backlog_placeholder: 0,
      },
    },
  );
}

export function getGrcScreenPosturesByAccess(accessMode: GrcScreenAccessMode) {
  return GRC_SCREEN_POSTURES.filter((screen) => screen.accessMode === accessMode);
}

export function getGrcHandoffCandidate(id: string) {
  return GRC_HANDOFF_CANDIDATES.find((candidate) => candidate.id === id);
}
