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
    // Ambas tablas EXISTEN en Cloud con RLS *_tenant_isolation y filas. La postura
    // correcta es Cloud en solo lectura; "none" afirmaba que no eran visibles.
    // El status sigue "pending" porque lo pendiente son las escrituras, no la fuente.
    sourcePosture: "Cloud",
    contractIds: ["cross-module-contracts"],
    summary: "Eventos y links compartidos son contrato rector; lectura Cloud, writes pendientes de paquete aprobado.",
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


/**
 * Recuento medido de un carril, o `null` si no se pudo medir.
 * `null` NUNCA se presenta como 0: un 0 afirma que se midió y no había nada.
 */
export interface LaneMeasurement {
  label: string;
  value: number | null;
  /** Procedencia del número, para pintarla junto al valor. */
  source: string;
  /**
   * Motivo por el que un carril no puede tener el número aunque la consulta
   * funcione (p. ej. el owner no emite eventos porque no tiene trigger).
   * Cuando está presente, no se pinta 0: se pinta este motivo.
   */
  absentReason?: string;
}

export interface ComposedLane extends PlatformReadinessLane {
  measured: LaneMeasurement[];
}

/**
 * Une el readiness DECLARADO (humano) con lo MEDIDO (filas de Cloud).
 *
 * Invariantes:
 *  - No promociona ni degrada `status`: la declaración del owner manda. Medir
 *    114 bundles no convierte un carril en HOLD en otra cosa.
 *  - Una medición ausente (`null`) se conserva como `null`; nunca se rellena a 0.
 *  - Un carril sin mediciones queda con `measured: []`, no con ceros inventados.
 */
export function composePlatformReadiness(
  lanes: PlatformReadinessLane[],
  measured: Record<string, LaneMeasurement[]> = {},
): ComposedLane[] {
  return lanes.map((lane) => ({
    ...lane,
    measured: (measured[lane.id] ?? []).map((m) => ({ ...m })),
  }));
}
