import type { ConsoleSourcePosture } from "./contracts";

export type PlatformLaneStatus = "operational" | "read_only" | "pending" | "hold";

export interface PlatformReadinessLane {
  id: string;
  label: string;
  owner: string;
  route: string;
  status: PlatformLaneStatus;
  sourcePosture: ConsoleSourcePosture;
  contractIds: string[];
  summary: string;
  nextAction: string;
  migrationRequired: boolean;
  finalEvidence: boolean;
}

export const platformReadinessLanes: PlatformReadinessLane[] = [
  {
    id: "secretaria",
    label: "Secretaría Societaria",
    owner: "Secretaría",
    route: "/secretaria",
    status: "operational",
    sourcePosture: "Cloud",
    contractIds: ["core-identity", "secretaria-agreements", "evidence-spine"],
    summary: "Golden path operativo para convocatorias, reuniones, actas, certificaciones y documentos demo.",
    nextAction: "Pulir narrativa de reunión y board pack sin ampliar schema.",
    migrationRequired: false,
    finalEvidence: false,
  },
  {
    id: "grc",
    label: "GRC Compass",
    owner: "GRC",
    route: "/grc",
    status: "read_only",
    sourcePosture: "legacy",
    contractIds: ["grc-incidents", "cross-module-contracts"],
    summary: "P0 navegable con postura pantalla por pantalla sobre tablas legacy; grc_* sigue candidato por workflow.",
    nextAction: "Validar handoffs read-only antes de cualquier write probe a contratos compartidos.",
    migrationRequired: false,
    finalEvidence: false,
  },
  {
    id: "aims",
    label: "AI Governance",
    owner: "AIMS",
    route: "/ai-governance",
    status: "read_only",
    sourcePosture: "legacy",
    contractIds: ["aims-systems", "cross-module-contracts"],
    summary: "Inventario, evaluaciones e incidentes navegables sobre ai_* hasta activar backbone aims_*.",
    nextAction: "Mejorar drilldowns ejecutivos y mantener standalone-ready.",
    migrationRequired: false,
    finalEvidence: false,
  },
  {
    id: "integration",
    label: "Contratos cross-module",
    owner: "TGMS Core",
    route: "/",
    status: "pending",
    sourcePosture: "none",
    contractIds: ["cross-module-contracts"],
    summary: "Eventos y links compartidos son contrato rector; writes quedan pendientes de paquete aprobado.",
    nextAction: "Probar read-only handoffs antes de cualquier write probe.",
    migrationRequired: false,
    finalEvidence: false,
  },
  {
    id: "evidence",
    label: "Bloque probatorio",
    owner: "Evidence / Legal Hold",
    route: "/documentacion",
    status: "hold",
    sourcePosture: "Cloud",
    contractIds: ["evidence-spine"],
    summary: "000049 en HOLD; evidence_bundles y audit_log no se presentan como evidencia final productiva.",
    nextAction: "Levantar contrato evidence/legal hold completo antes de schema.",
    migrationRequired: false,
    finalEvidence: false,
  },
];

export function getPlatformReadinessSummary(lanes: PlatformReadinessLane[] = platformReadinessLanes) {
  return lanes.reduce(
    (summary, lane) => {
      summary.total += 1;
      summary[lane.status] += 1;
      if (lane.migrationRequired) summary.migrationRequired += 1;
      if (lane.finalEvidence) summary.finalEvidence += 1;
      return summary;
    },
    {
      total: 0,
      operational: 0,
      read_only: 0,
      pending: 0,
      hold: 0,
      migrationRequired: 0,
      finalEvidence: 0,
    },
  );
}

export function getPlatformReadinessLane(id: string) {
  return platformReadinessLanes.find((lane) => lane.id === id);
}
