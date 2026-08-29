/**
 * Motor de Relojes Regulatorios Paralelos y Coordinación Multirrégimen
 * AIMS 360: EU AI Act (Art. 73) + RGPD (Arts. 33-34) + DORA (Art. 19 / RD 2025/301)
 * Conforme al dictamen de auditoría regulatoria de Harvey AI.
 */

export type RiaIncidentSeverity = "ORDINARY_SERIOUS" | "WIDESPREAD_INFRINGEMENT" | "DEATH_INCIDENT";

export interface RiaClockResult {
  regime: "RIA";
  authority: "AESIA / Autoridad de Vigilancia de Mercado";
  deadlineHours: number;
  deadlineDate: string;
  isUrgent: boolean;
  ruleDescription: string;
  articleRef: "Art. 73.1" | "Art. 73.3" | "Art. 73.4";
}

export interface GdprClockResult {
  regime: "GDPR";
  authority: "AEPD / Autoridad de Control de Protección de Datos";
  deadlineHours: 72;
  deadlineDate: string;
  requiresDataSubjectNotice: boolean;
  ruleDescription: string;
  articleRef: "Art. 33" | "Art. 34";
}

export interface DoraClockResult {
  regime: "DORA";
  authority: "DGSFP / Banco de España / BCE";
  initialDeadlineHours: number; // 4h desde clasificación / 24h desde conocimiento
  initialDeadlineDate: string;
  intermediateDeadlineHours: 72;
  intermediateDeadlineDate: string;
  finalDeadlineDays: 30;
  finalDeadlineDate: string;
  ruleDescription: string;
  articleRef: "Art. 19 DORA + RD (UE) 2025/301";
}

export interface MultiregimeClocks {
  ria?: RiaClockResult;
  gdpr?: GdprClockResult;
  dora?: DoraClockResult;
}

/**
 * Calcula el plazo estricto del Art. 73 RIA:
 * - Ordinario: Inmediatamente tras vínculo causal y máx. 15 días naturales (360h)
 * - Infracción generalizada / riesgo inminente: Inmediatamente y máx. 2 días (48h)
 * - Fallecimiento: Inmediatamente y máx. 10 días (240h)
 */
export function calculateRiaDeadline(
  knowledgeDate: Date | string,
  incidentType: RiaIncidentSeverity = "ORDINARY_SERIOUS"
): RiaClockResult {
  const base = new Date(knowledgeDate);
  let hours = 360; // 15 días * 24h
  let articleRef: "Art. 73.1" | "Art. 73.3" | "Art. 73.4" = "Art. 73.1";
  let ruleDescription = "Notificación inmediata tras establecerse vínculo causal y máx. 15 días naturales desde conocimiento.";

  if (incidentType === "WIDESPREAD_INFRINGEMENT") {
    hours = 48; // 2 días
    articleRef = "Art. 73.3";
    ruleDescription = "Notificación inmediata y a más tardar 2 días naturales (infracción generalizada / riesgo inminente).";
  } else if (incidentType === "DEATH_INCIDENT") {
    hours = 240; // 10 días
    articleRef = "Art. 73.4";
    ruleDescription = "Notificación inmediata tras sospecha causal y a más tardar 10 días naturales (fallecimiento de persona).";
  }

  const deadline = new Date(base.getTime() + hours * 60 * 60 * 1000);

  return {
    regime: "RIA",
    authority: "AESIA / Autoridad de Vigilancia de Mercado",
    deadlineHours: hours,
    deadlineDate: deadline.toISOString(),
    isUrgent: incidentType === "WIDESPREAD_INFRINGEMENT",
    ruleDescription,
    articleRef,
  };
}

/**
 * Calcula el reloj de 72 horas del Art. 33 RGPD.
 */
export function calculateGdprDeadline(
  knowledgeDate: Date | string,
  highRiskToIndividuals: boolean = false
): GdprClockResult {
  const base = new Date(knowledgeDate);
  const deadline = new Date(base.getTime() + 72 * 60 * 60 * 1000);

  return {
    regime: "GDPR",
    authority: "AEPD / Autoridad de Control de Protección de Datos",
    deadlineHours: 72,
    deadlineDate: deadline.toISOString(),
    requiresDataSubjectNotice: highRiskToIndividuals,
    ruleDescription: highRiskToIndividuals
      ? "Notificación a la AEPD en máx. 72 horas y comunicación sin dilación indebida a los interesados afectados (Art. 34)."
      : "Notificación a la AEPD en máx. 72 horas desde que se tenga constancia de la brecha (Art. 33).",
    articleRef: highRiskToIndividuals ? "Art. 34" : "Art. 33",
  };
}

/**
 * Calcula los tres hitos DORA según el Reglamento Delegado (UE) 2025/301:
 * 1. Inicial: 4h desde clasificación grave (máx. 24h desde conocimiento)
 * 2. Intermedio: 72h desde notificación inicial
 * 3. Final: 1 mes tras informe intermedio
 */
export function calculateDoraDeadlines(
  knowledgeDate: Date | string,
  classificationDate?: Date | string
): DoraClockResult {
  const kDate = new Date(knowledgeDate);
  const cDate = classificationDate ? new Date(classificationDate) : kDate;

  // 4h desde clasificación o máx 24h desde conocimiento (lo que ocurra antes)
  const deadline4h = new Date(cDate.getTime() + 4 * 60 * 60 * 1000);
  const deadline24h = new Date(kDate.getTime() + 24 * 60 * 60 * 1000);
  const initialDeadline = deadline4h < deadline24h ? deadline4h : deadline24h;

  const intermediateDeadline = new Date(initialDeadline.getTime() + 72 * 60 * 60 * 1000);
  const finalDeadline = new Date(intermediateDeadline.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    regime: "DORA",
    authority: "DGSFP / Banco de España / BCE",
    initialDeadlineHours: 4,
    initialDeadlineDate: initialDeadline.toISOString(),
    intermediateDeadlineHours: 72,
    intermediateDeadlineDate: intermediateDeadline.toISOString(),
    finalDeadlineDays: 30,
    finalDeadlineDate: finalDeadline.toISOString(),
    ruleDescription: "Notificación inicial en 4h/24h, informe intermedio en 72h e informe final en 1 mes.",
    articleRef: "Art. 19 DORA + RD (UE) 2025/301",
  };
}

/**
 * Coordina y deriva los regímenes que deben activarse para un incidente de IA.
 */
export function evaluateMultiregimeIncident(params: {
  knowledgeDate: Date | string;
  isAiRelated: boolean;
  isAiHighRisk?: boolean;
  riaSeverity?: RiaIncidentSeverity;
  affectsPersonalData?: boolean;
  isHighRiskToSubjects?: boolean;
  isIctRelated?: boolean;
  affectsCriticalFunction?: boolean;
}): MultiregimeClocks {
  const result: MultiregimeClocks = {};

  // 1. Régimen RIA
  if (params.isAiRelated) {
    result.ria = calculateRiaDeadline(
      params.knowledgeDate,
      params.riaSeverity || "ORDINARY_SERIOUS"
    );
  }

  // 2. Régimen RGPD
  if (params.affectsPersonalData) {
    result.gdpr = calculateGdprDeadline(
      params.knowledgeDate,
      params.isHighRiskToSubjects ?? false
    );
  }

  // 3. Régimen DORA
  if (params.isIctRelated || params.affectsCriticalFunction) {
    result.dora = calculateDoraDeadlines(params.knowledgeDate);
  }

  return result;
}

/**
 * Calcula el tiempo restante y formato legible para un vencimiento.
 */
export function formatRemainingTime(targetDateIso: string): {
  isExpired: boolean;
  hoursRemaining: number;
  label: string;
  badgeClass: string;
} {
  const diffMs = new Date(targetDateIso).getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const hoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  let label = "";
  if (isExpired) {
    label = "Vencido";
  } else if (daysRemaining > 1) {
    label = `${daysRemaining} días restantes`;
  } else {
    label = `${hoursRemaining}h restantes`;
  }

  let badgeClass = "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (isExpired) {
    badgeClass = "bg-[var(--status-error)] text-[var(--g-text-inverse)] font-bold";
  } else if (hoursRemaining <= 24) {
    badgeClass = "bg-[var(--status-error)] text-[var(--g-text-inverse)] animate-pulse";
  } else if (hoursRemaining <= 72) {
    badgeClass = "bg-[var(--status-warning)] text-[var(--g-text-inverse)] font-semibold";
  }

  return {
    isExpired,
    hoursRemaining,
    label,
    badgeClass,
  };
}
