export type ConsoleSourcePosture =
  | "Cloud"
  | "legacy"
  | "local pending"
  | "generated types only"
  | "none";

export type ConsoleEvidencePosture =
  | "reference"
  | "derived"
  | "verifiable"
  | "not evidence"
  | "pending";

export interface ConsoleDataContract {
  id: string;
  label: string;
  owner: string;
  sourceTable: string;
  stableId: string;
  consumers: string;
  mutation: string;
  evidence: ConsoleEvidencePosture;
  sourcePosture: ConsoleSourcePosture;
  parityRisk: string;
}

export interface ConsoleJourney {
  id: string;
  title: string;
  summary: string;
  sourceOwner: string;
  targetOwner: string;
  sourceTable: string;
  contract: string;
  targetRoute: string;
  mutationHandoff: string;
  evidencePosture: ConsoleEvidencePosture;
}

export const consoleDataContracts: ConsoleDataContract[] = [
  {
    id: "core-identity",
    label: "Scope sociedad / órgano",
    owner: "TGMS Core",
    sourceTable: "entities, governing_bodies, persons",
    stableId: "tenant_id / entity_id / body_id / person_id",
    consumers: "Secretaría, GRC, AIMS, consola",
    mutation: "La consola filtra y navega; altas y cambios viven en el owner.",
    evidence: "reference",
    sourcePosture: "Cloud",
    parityRisk: "El scope textual actual debe converger a entity_id canónico.",
  },
  {
    id: "core-notifications",
    label: "Alertas globales",
    owner: "TGMS Core",
    sourceTable: "notifications",
    stableId: "notification.id + route",
    consumers: "Consola y módulos propietarios",
    mutation: "Solo Core puede marcar leída o resolver la alerta.",
    evidence: "not evidence",
    sourcePosture: "Cloud",
    parityRisk: "Falta payload normalizado con source IDs en todas las alertas.",
  },
  {
    id: "secretaria-agreements",
    label: "Expedientes y acuerdos",
    owner: "Secretaría Societaria",
    sourceTable: "agreements, convocatorias, meetings, minutes, certifications",
    stableId: "UUID owner",
    consumers: "Consola, Board Pack, GRC, AIMS",
    mutation: "La consola abre el flujo propietario; no escribe estado legal.",
    evidence: "derived",
    sourcePosture: "Cloud",
    parityRisk: "Algunas columnas recientes aún dependen de cierre de paridad.",
  },
  {
    id: "grc-incidents",
    label: "Incidentes y notificaciones GRC",
    owner: "GRC Compass",
    sourceTable: "incidents, regulatory_notifications",
    stableId: "incident.id",
    consumers: "Consola, GRC, Secretaría",
    mutation: "La consola enruta a GRC; escaladas requieren evento/link compartido.",
    evidence: "derived",
    sourcePosture: "legacy",
    parityRisk: "Track D debe decidir adopción grc_* vs tablas legacy.",
  },
  {
    id: "aims-systems",
    label: "Sistemas IA y evaluaciones",
    owner: "AIMS / AI Governance",
    sourceTable: "ai_systems, ai_risk_assessments, ai_compliance_checks, ai_incidents",
    stableId: "system_id / assessment_id / incident_id",
    consumers: "Consola, AIMS, GRC, Secretaría",
    mutation: "La consola enruta a AIMS; no crea inventario paralelo.",
    evidence: "derived",
    sourcePosture: "legacy",
    parityRisk: "Track E debe resolver compatibilidad ai_* vs aims_*.",
  },
  {
    id: "evidence-spine",
    label: "Evidencia y auditoría",
    owner: "Backbone evidencia / TGMS Core",
    sourceTable: "evidence_bundles, audit_log",
    stableId: "evidence_bundle.id / audit_log.id",
    consumers: "Todos los módulos",
    mutation: "Solo flujos owner/QTSP crean evidencia; consola consume referencias.",
    evidence: "pending",
    sourcePosture: "Cloud",
    parityRisk: "000049 en HOLD; no declarar verificable hasta cerrar bundle, hash, storage, audit chain, retention y legal hold.",
  },
  {
    id: "cross-module-contracts",
    label: "Links y eventos cross-module",
    owner: "Core integration backbone",
    sourceTable: "governance_module_links, governance_module_events",
    stableId: "link.id / event.id",
    consumers: "Secretaría, GRC, AIMS, consola",
    mutation: "Pendiente de paridad Cloud/local/types antes de escribir.",
    evidence: "pending",
    sourcePosture: "none",
    parityRisk: "Contrato requerido, no visible aún en migraciones/tipos locales.",
  },
];

export const consoleJourneys: ConsoleJourney[] = [
  {
    id: "grc-incident-secretaria-agenda",
    title: "Incidente GRC a agenda Secretaría",
    summary: "Un incidente material se eleva como propuesta de punto de agenda sin duplicar el incidente.",
    sourceOwner: "GRC Compass",
    targetOwner: "Secretaría",
    sourceTable: "incidents",
    contract: "governance_module_events + governance_module_links",
    targetRoute: "/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL",
    mutationHandoff: "Read-only route handoff now; future event/link write requires approved probe.",
    evidencePosture: "pending",
  },
  {
    id: "aims-finding-grc-control",
    title: "Hallazgo AIMS a control GRC",
    summary: "Un gap AI Act / ISO 42001 abre workflow o control GRC con system_id canónico.",
    sourceOwner: "AIMS",
    targetOwner: "GRC Compass",
    sourceTable: "ai_risk_assessments",
    contract: "governance_module_events + governance_module_links",
    targetRoute: "/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP",
    mutationHandoff: "Read-only route handoff now; GRC decides owner risk/control/plan without AIMS write-through.",
    evidencePosture: "pending",
  },
  {
    id: "aims-incident-secretaria-escalation",
    title: "Incidente AIMS material a Secretaría",
    summary: "Un incidente IA material se propone como contexto de escalado sin crear reunión, acuerdo ni acta desde AIMS.",
    sourceOwner: "AIMS",
    targetOwner: "Secretaría Societaria",
    sourceTable: "ai_incidents",
    contract: "governance_module_events + governance_module_links",
    targetRoute: "/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL",
    mutationHandoff: "Read-only route handoff now; Secretaría decide si abre agenda, convocatoria o expediente formal.",
    evidencePosture: "pending",
  },
  {
    id: "secretaria-certification-evidence",
    title: "Certificación Secretaría como evidencia",
    summary: "Un acta o certificación emitida se referencia desde GRC/AIMS solo si la postura probatoria está etiquetada.",
    sourceOwner: "Secretaría",
    targetOwner: "GRC/AIMS",
    sourceTable: "certifications",
    contract: "evidence_bundles + audit_log",
    targetRoute: "/secretaria/actas?source=aims&handoff=SECRETARIA_CERTIFICATION_REFERENCE&evidence=REFERENCE",
    mutationHandoff: "Secretaría/QTSP emite; AIMS consume referencia etiquetada y no recalcula validez societaria.",
    evidencePosture: "reference",
  },
  {
    id: "entity-scope-fanout",
    title: "Sociedad seleccionada filtra todo el ERP",
    summary: "Una sociedad seleccionada se propaga a órganos, riesgos, acuerdos, IA, evidencias y obligaciones.",
    sourceOwner: "TGMS Core",
    targetOwner: "Todos",
    sourceTable: "entities",
    contract: "tenant_id + entity_id en queries owner",
    targetRoute: "/entidades",
    mutationHandoff: "Sin mutación; solo filtros por ID canónico.",
    evidencePosture: "reference",
  },
];

export const consoleSourceNotes = {
  readModel:
    "Vista derivada de owners. No es evidencia verificable salvo cuando el registro enlaza evidence_bundles y audit_log.",
  handoff:
    "Las acciones de consola deben abrir el módulo propietario o usar contratos compartidos cuando exista paridad.",
};
