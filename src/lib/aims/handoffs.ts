/**
 * Los cuatro handoffs de solo lectura de AI Governance.
 *
 * Son DATO DE NAVEGACIÓN —a qué ruta del módulo responsable lleva cada señal—,
 * no prosa sobre lo que hacen las pantallas. Por eso sobreviven al borrado del
 * catálogo de posturas de `readiness.ts` y viven en su propio módulo HOJA: no
 * importa nada, ni siquiera del resto de `lib/aims`, para que cualquiera pueda
 * leerlo sin arrastrar un ciclo.
 *
 * Ninguna de estas rutas escribe: no tocan `governance_module_events` ni
 * `governance_module_links`. AIMS enruta contexto; la decisión sigue siendo del
 * módulo destino.
 */
export type AimsEvidencePosture =
  | "REFERENCE"
  | "BUNDLE_STUB"
  | "AUDITED_BUNDLE"
  | "LEGAL_HOLD_READY"
  | "NOT_EVIDENCE";

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

export const AIMS_HANDOFFS: AimsHandoffAffordance[] = [
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
    targetRoute:
      "/secretaria/actas?source=aims&handoff=SECRETARIA_CERTIFICATION_REFERENCE&evidence=REFERENCE",
    contractEvent: "SECRETARIA_CERTIFICATION_ISSUED",
    evidencePosture: "REFERENCE",
    mutation: "read-only route handoff",
  },
];
