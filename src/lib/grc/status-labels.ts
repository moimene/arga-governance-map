/**
 * Centralización de chips y labels de estado/severidad para GRC.
 *
 * Carril INC-10 — sustituye 11 mapas locales duplicados en `src/pages/grc/`
 * y `src/pages/grc/modules/`. Mantiene la convención Garrigues (`var(--g-*)`,
 * `var(--status-*)`) y añade fallback `NEUTRAL` cuando el valor recibido no
 * está en el mapa.
 *
 * Diseño:
 *  - Cada dominio expone su mapa (ej. `INCIDENT_STATUS_CHIP`) y un helper
 *    (`incidentStatusChip(value)`). Los mapas se mantienen exportados para
 *    callers que prefieran resolver el fallback localmente.
 *  - `SEVERITY_CHIP` y `RISK_LEVEL_CHIP` son escalas distintas (severidad
 *    incluye "Crítico"; risk-level no), por eso viven separadas aunque
 *    visualmente solapen los tres últimos niveles.
 *  - `notificationStatusLabel` preserva el patrón uppercase que ya estaba en
 *    `IncidenteDetalle.tsx` ("Pendiente" → "PENDIENTE").
 */

const CHIP_BASE = {
  ERROR:   "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  WARNING: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  SUCCESS: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  INFO:    "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  BRAND:   "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  NEUTRAL: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
} as const;

export const NEUTRAL_CHIP = CHIP_BASE.NEUTRAL;

// ─── Severity (incidentes, findings, vulnerabilidades) ──────────────────────

export const SEVERITY_CHIP: Record<string, string> = {
  Crítico: CHIP_BASE.ERROR,
  Alto:    CHIP_BASE.WARNING,
  Medio:   CHIP_BASE.NEUTRAL,
  Bajo:    CHIP_BASE.NEUTRAL,
};

/**
 * Orden canónico de severidades para selects/filtros.
 * Mantenerlo sincronizado con `SEVERITY_CHIP` para evitar drift entre
 * dropdown y chip rendering.
 */
export const SEVERITY_OPTIONS = ["Crítico", "Alto", "Medio", "Bajo"] as const;

export type SeverityOption = (typeof SEVERITY_OPTIONS)[number];

export function severityChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return SEVERITY_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Estado incidente ────────────────────────────────────────────────────────

export const INCIDENT_STATUS_CHIP: Record<string, string> = {
  Abierto:            CHIP_BASE.ERROR,
  "En contención":    CHIP_BASE.WARNING,
  "En investigación": CHIP_BASE.INFO,
  Resuelto:           CHIP_BASE.SUCCESS,
  Cerrado:            CHIP_BASE.NEUTRAL,
};

export function incidentStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return INCIDENT_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Notificaciones regulatorias (DORA/GDPR) ────────────────────────────────

export const NOTIFICATION_STATUS_CHIP: Record<string, string> = {
  Pendiente: CHIP_BASE.ERROR,
  Enviada:   CHIP_BASE.SUCCESS,
  Aceptada:  CHIP_BASE.BRAND,
  Rechazada: CHIP_BASE.WARNING,
};

export const NOTIFICATION_STATUS_LABEL: Record<string, string> = {
  Pendiente: "PENDIENTE",
  Enviada:   "ENVIADA",
  Aceptada:  "ACEPTADA",
  Rechazada: "RECHAZADA",
};

export function notificationStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return NOTIFICATION_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

export function notificationStatusLabel(value: string | null | undefined): string {
  if (!value) return "";
  return NOTIFICATION_STATUS_LABEL[value] ?? value;
}

// ─── Excepciones ─────────────────────────────────────────────────────────────

export const EXCEPTION_STATUS_CHIP: Record<string, string> = {
  Pendiente: CHIP_BASE.WARNING,
  Aprobada:  CHIP_BASE.SUCCESS,
  Rechazada: CHIP_BASE.ERROR,
  Expirada:  CHIP_BASE.NEUTRAL,
};

export function exceptionStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return EXCEPTION_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Vulnerabilidades ────────────────────────────────────────────────────────

export const VULNERABILITY_STATUS_CHIP: Record<string, string> = {
  Abierta:         CHIP_BASE.ERROR,
  "En mitigación": CHIP_BASE.WARNING,
  Parcheada:       CHIP_BASE.SUCCESS,
  Aceptada:        CHIP_BASE.NEUTRAL,
};

export function vulnerabilityStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return VULNERABILITY_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Action plans (auditoría) ────────────────────────────────────────────────

export const ACTION_PLAN_STATUS_CHIP: Record<string, string> = {
  Abierto:    CHIP_BASE.ERROR,
  "En curso": CHIP_BASE.WARNING,
  Cerrado:    CHIP_BASE.SUCCESS,
};

export function actionPlanStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return ACTION_PLAN_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── DSARs (GDPR) ────────────────────────────────────────────────────────────

export const DSAR_STATUS_CHIP: Record<string, string> = {
  "En curso": CHIP_BASE.WARNING,
  Resuelto:   CHIP_BASE.SUCCESS,
  Pendiente:  CHIP_BASE.ERROR,
};

export function dsarStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return DSAR_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── DPIAs (GDPR) ────────────────────────────────────────────────────────────

export const DPIA_STATUS_CHIP: Record<string, string> = {
  Aprobada:      CHIP_BASE.SUCCESS,
  "En revisión": CHIP_BASE.WARNING,
  Rechazada:     CHIP_BASE.ERROR,
};

export function dpiaStatusChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return DPIA_STATUS_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Risk level (ROPA + DPIAs — escala Alto/Medio/Bajo, sin "Crítico") ──────

export const RISK_LEVEL_CHIP: Record<string, string> = {
  Alto:  CHIP_BASE.ERROR,
  Medio: CHIP_BASE.WARNING,
  Bajo:  CHIP_BASE.NEUTRAL,
};

export function riskLevelChip(value: string | null | undefined): string {
  if (!value) return CHIP_BASE.NEUTRAL;
  return RISK_LEVEL_CHIP[value] ?? CHIP_BASE.NEUTRAL;
}

// ─── Risk status options (RiskEditor) ───────────────────────────────────────

export const RISK_STATUS_OPTIONS = ["Abierto", "En tratamiento"] as const;

export type RiskStatusOption = (typeof RISK_STATUS_OPTIONS)[number];
