/**
 * regulatory-clocks.ts — Motor de cálculo de plazos y reglas regulatorias
 * 
 * Implementa las directrices de plazos perentorios y marcos normativos para:
 * 1. DORA Art. 19 & Reglamento Delegado (UE) 2025/301 (Notificación inicial 4h/24h, intermedio 72h, final 1m).
 * 2. RGPD Art. 33 (72h autoridad) y Art. 34 (comunicación interesados alto riesgo).
 * 3. RGPD Art. 12 (SLA 1 mes calendario + prórroga 2 meses).
 * 4. NIS2 Directiva (UE) 2022/2555 (Alerta 24h, notificación 72h, final 1m).
 * 5. Motor de Perímetro DORA vs NIS2 (desplazamiento sectorial / entidades no cubiertas).
 * 6. TPRM Matriz de Concentración y Sustituibilidad (Escala 1-5 & CTPP DORA Art. 31).
 * 7. Criterios de clasificación de incidentes mayores DORA Art. 19.
 */

/**
 * Suma meses calendario de forma segura sin overflow al siguiente mes
 * (e.g., 31 de agosto + 1 mes => 30 de septiembre, no 1 de octubre).
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + months);
  
  // Si el día cambió por desbordamiento (ej. 31 de sept no existe), ajustar al último día del mes objetivo
  if (result.getDate() !== originalDay) {
    result.setDate(0); // Último día del mes anterior (mes objetivo real)
  }
  return result;
}

// ============================================================================
// 1. DORA & NIS2 RELOJES DE INCIDENTES
// ============================================================================

export interface DoraClockMilestones {
  /** Fecha/hora de detección o conocimiento inicial */
  knowledgeDate: Date;
  /** Fecha/hora de clasificación formal como grave/mayor (si ya ocurrió) */
  classificationDate?: Date | null;
  /** Hito 1: Notificación inicial — Max 4h desde clasificación Y Max 24h desde conocimiento */
  initialNotificationDeadline: Date;
  /** Hito 2: Informe intermedio — Max 72h desde notificación inicial (o envío) */
  intermediateReportDeadline: Date;
  /** Hito 3: Informe final — Max 1 mes desde informe intermedio */
  finalReportDeadline: Date;
  /** Flag si aplica regla de extensión por fin de semana / festivo (hasta las 12:00 del siguiente día hábil) */
  isWeekendOrHolidayAdjusted?: boolean;
}

export function computeDoraDeadlines(
  knowledgeDateInput: string | Date,
  classificationDateInput?: string | Date | null
): DoraClockMilestones {
  const knowledgeDate = new Date(knowledgeDateInput);
  const classificationDate = classificationDateInput ? new Date(classificationDateInput) : null;

  // Límite 24h desde conocimiento
  const max24hFromKnowledge = new Date(knowledgeDate.getTime() + 24 * 3600 * 1000);

  // Límite 4h desde clasificación (si fue clasificado)
  let initialDeadline: Date;
  if (classificationDate) {
    const max4hFromClassification = new Date(classificationDate.getTime() + 4 * 3600 * 1000);
    // Debe presentarse lo antes posible: la fecha más restrictiva entre 4h tras clasificar o 24h tras conocer
    initialDeadline = max4hFromClassification < max24hFromKnowledge 
      ? max4hFromClassification 
      : max24hFromKnowledge;
  } else {
    // Si aún no se ha clasificado formalmente, el tope máximo absoluto son 24h desde el conocimiento
    initialDeadline = max24hFromKnowledge;
  }

  // Informe intermedio: 72h desde notificación inicial
  const intermediateDeadline = new Date(initialDeadline.getTime() + 72 * 3600 * 1000);

  // Informe final: 1 mes calendario exacto desde informe intermedio
  const finalDeadline = addCalendarMonths(intermediateDeadline, 1);

  return {
    knowledgeDate,
    classificationDate,
    initialNotificationDeadline: initialDeadline,
    intermediateReportDeadline: intermediateDeadline,
    finalReportDeadline: finalDeadline,
  };
}

export interface Nis2ClockMilestones {
  knowledgeDate: Date;
  /** Alerta temprana sin dilación indebida y dentro de 24h */
  earlyWarningDeadline: Date;
  /** Notificación de incidente en 72h */
  incidentNotificationDeadline: Date;
  /** Informe final a más tardar en 1 mes desde la notificación */
  finalReportDeadline: Date;
}

export function computeNis2Deadlines(knowledgeDateInput: string | Date): Nis2ClockMilestones {
  const knowledgeDate = new Date(knowledgeDateInput);
  const earlyWarning = new Date(knowledgeDate.getTime() + 24 * 3600 * 1000);
  const notification = new Date(knowledgeDate.getTime() + 72 * 3600 * 1000);
  const finalReport = addCalendarMonths(notification, 1);

  return {
    knowledgeDate,
    earlyWarningDeadline: earlyWarning,
    incidentNotificationDeadline: notification,
    finalReportDeadline: finalReport,
  };
}

// ============================================================================
// 2. RGPD RELOJES Y DECISIÓN DE COMUNICACIÓN A INTERESADOS
// ============================================================================

export interface GdprBreachDeadlines {
  knowledgeDate: Date;
  /** Notificación a AEPD / Autoridad de Control: Max 72 horas */
  authorityNotificationDeadline: Date;
  /** Requiere comunicación inmediata sin dilación a interesados si hay Alto Riesgo */
  requiresSubjectCommunication: boolean;
}

export function computeGdprBreachDeadlines(
  knowledgeDateInput: string | Date,
  isHighRiskToRights: boolean
): GdprBreachDeadlines {
  const knowledgeDate = new Date(knowledgeDateInput);
  const authorityDeadline = new Date(knowledgeDate.getTime() + 72 * 3600 * 1000);

  return {
    knowledgeDate,
    authorityNotificationDeadline: authorityDeadline,
    requiresSubjectCommunication: isHighRiskToRights,
  };
}

/**
 * Calcula el SLA de atención de Derechos de Interesados (DSARs - Art. 12 RGPD)
 * Base: 1 mes de calendario desde la recepción (NO 30 días fijos).
 * Prórroga excepcional: +2 meses adicionales motivados por complejidad o volumen.
 */
export interface DsarSlaCalculation {
  receiptDate: Date;
  initialSlaDate: Date;
  extendedSlaDate: Date;
  isExtended: boolean;
  effectiveDeadline: Date;
  daysRemaining: number;
  isOverdue: boolean;
  statusText: string;
}

export function computeDsarSla(
  receiptDateInput: string | Date,
  isExtended = false
): DsarSlaCalculation {
  const receiptDate = new Date(receiptDateInput);
  
  // 1 mes calendario exacto
  const initialSla = addCalendarMonths(receiptDate, 1);

  // Prórroga de 2 meses adicionales
  const extendedSla = addCalendarMonths(initialSla, 2);

  const effectiveDeadline = isExtended ? extendedSla : initialSla;
  const now = new Date();
  const diffMs = effectiveDeadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 3600 * 24));
  const isOverdue = diffMs < 0;

  let statusText = "En plazo";
  if (isOverdue) {
    statusText = "Plazo Vencido";
  } else if (daysRemaining <= 5) {
    statusText = "Vencimiento Inminente";
  }

  return {
    receiptDate,
    initialSlaDate: initialSla,
    extendedSlaDate: extendedSla,
    isExtended,
    effectiveDeadline,
    daysRemaining,
    isOverdue,
    statusText,
  };
}

// ============================================================================
// 3. MOTOR DE PERÍMETRO DORA VS NIS2
// ============================================================================

export type EntityRegulatoryRegime = "DORA" | "NIS2" | "DORA_AND_NIS2" | "NONE";

export interface PerimeterEvaluationInput {
  entityType: "aseguradora" | "reaseguradora" | "banco" | "mediador_seguros" | "servicios_tecnologicos" | "holding" | "sociedad_general";
  isFinancialEntityDoraCovered: boolean;
  isEssentialOrImportantNis2: boolean;
  hasPersonalDataProcessing: boolean;
}

export interface PerimeterDecision {
  regime: EntityRegulatoryRegime;
  routeTitle: string;
  financialAuthority?: string;
  cyberAuthority?: string;
  dataProtectionAuthority?: string;
  appliesDoraClocks: boolean;
  appliesNis2Clocks: boolean;
  appliesGdprClocks: boolean;
  rationale: string;
}

export function evaluateEntityPerimeter(input: PerimeterEvaluationInput): PerimeterDecision {
  const { isFinancialEntityDoraCovered, isEssentialOrImportantNis2, hasPersonalDataProcessing } = input;

  if (isFinancialEntityDoraCovered) {
    return {
      regime: "DORA",
      routeTitle: "Régimen Sectorial DORA (Desplaza NIS2)",
      financialAuthority: "DGSFP / Banco de España / BCE",
      cyberAuthority: "Opcional CSIRT según Estado Miembro",
      dataProtectionAuthority: hasPersonalDataProcessing ? "AEPD" : undefined,
      appliesDoraClocks: true,
      appliesNis2Clocks: false,
      appliesGdprClocks: hasPersonalDataProcessing,
      rationale: "DORA opera como acto sectorial específico según el principio de lex specialis para entidades financieras cubiertas.",
    };
  }

  if (isEssentialOrImportantNis2) {
    return {
      regime: "NIS2",
      routeTitle: "Régimen General de Ciberseguridad NIS2",
      cyberAuthority: "CCN-CERT / INCIBE-CERT / Autoridad Sectorial NIS2",
      dataProtectionAuthority: hasPersonalDataProcessing ? "AEPD" : undefined,
      appliesDoraClocks: false,
      appliesNis2Clocks: true,
      appliesGdprClocks: hasPersonalDataProcessing,
      rationale: "Sociedad no financiera o centro de servicios del grupo catalogada como entidad esencial/importante bajo Directiva NIS2.",
    };
  }

  return {
    regime: "NONE",
    routeTitle: "Régimen General Operativo",
    dataProtectionAuthority: hasPersonalDataProcessing ? "AEPD" : undefined,
    appliesDoraClocks: false,
    appliesNis2Clocks: false,
    appliesGdprClocks: hasPersonalDataProcessing,
    rationale: "Sociedad no catalogada como financiera bajo DORA ni como esencial/importante bajo NIS2.",
  };
}

// ============================================================================
// 4. MATRIZ DE CONCENTRACIÓN & SUSTITUIBILIDAD TPRM DORA
// ============================================================================

export interface TprmConcentrationInput {
  isCriticalOrImportantFunction: boolean;
  contractsCountWithProviderGroup: number;
  technicalLockInScore: 1 | 2 | 3 | 4 | 5; // 1: Fácil portabilidad, 5: Tecnología propietaria sin alternativa
  migrationTimeMonths: number;
  subcontractorsInThirdCountries: boolean;
  isDesignatedCtpp: boolean; // Proveedor Tercero Esencial bajo DORA Art. 31
}

export interface TprmConcentrationEvaluation {
  concentrationScore: number; // 1-5
  substitutabilityScore: number; // 1-5 (1: Muy fácil, 5: Prácticamente insustituible)
  overallRiskLevel: "Bajo" | "Medio" | "Alto" | "Crítico";
  requiresBoardEscalation: boolean;
  requiresTestedExitPlan: boolean;
  recommendations: string[];
}

export function evaluateTprmConcentration(input: TprmConcentrationInput): TprmConcentrationEvaluation {
  let conc = 1;
  if (input.contractsCountWithProviderGroup >= 4) conc += 2;
  else if (input.contractsCountWithProviderGroup >= 2) conc += 1;
  if (input.isDesignatedCtpp) conc += 2;
  if (input.subcontractorsInThirdCountries) conc += 1;
  conc = Math.min(5, Math.max(1, conc));

  let subst = input.technicalLockInScore;
  if (input.migrationTimeMonths > 12) subst = Math.min(5, subst + 1) as 1 | 2 | 3 | 4 | 5;

  const avg = (conc + subst) / 2;
  let overallRiskLevel: "Bajo" | "Medio" | "Alto" | "Crítico" = "Bajo";
  if (avg >= 4 || input.isDesignatedCtpp) overallRiskLevel = "Crítico";
  else if (avg >= 3 || input.isCriticalOrImportantFunction) overallRiskLevel = "Alto";
  else if (avg >= 2) overallRiskLevel = "Medio";

  const requiresBoardEscalation = overallRiskLevel === "Crítico" || (input.isCriticalOrImportantFunction && conc >= 4);
  const requiresTestedExitPlan = input.isCriticalOrImportantFunction || overallRiskLevel === "Alto" || overallRiskLevel === "Crítico";

  const recommendations: string[] = [];
  if (input.isDesignatedCtpp) {
    recommendations.push("Proveedor CTPP regulado: verificar designación de Lead Overseer y participación en foros supervisores.");
  }
  if (requiresTestedExitPlan) {
    recommendations.push("Obligatorio: Exit Plan formalmente documentado, probado anualmente y con plazo de transición garantizado.");
  }
  if (requiresBoardEscalation) {
    recommendations.push("Obligatorio: Escalado preceptivo y aprobación previa por el Comité de Riesgos / Consejo de Administración.");
  }
  if (input.subcontractorsInThirdCountries) {
    recommendations.push("Evaluar riesgo jurisdiccional y garantías de transferencia internacional de datos RGPD.");
  }

  return {
    concentrationScore: conc,
    substitutabilityScore: subst,
    overallRiskLevel,
    requiresBoardEscalation,
    requiresTestedExitPlan,
    recommendations,
  };
}

// ============================================================================
// 5. EVALUACIÓN DE CRITERIOS DE INCIDENTE GRAVE TIC (DORA ART. 19)
// ============================================================================

export interface DoraIncidentThresholdCriteria {
  clientsAffectedPct: number; // Porcentaje de clientes afectados
  durationHours: number; // Duración de la indisponibilidad
  economicImpactEuros: number; // Impacto financiero directo o indirecto
  affectsCriticalFunctions: boolean; // Afección a funciones críticas o importantes
  dataIntegrityLoss: boolean; // Pérdida de integridad o confidencialidad de datos
  thirdPartyImpact: boolean; // Afección en cadena a terceros o infraestructuras críticas
}

export interface DoraIncidentClassification {
  isMajorIncident: boolean;
  criteriaTriggered: string[];
  severityLevel: "Menor" | "Significativo" | "Grave TIC (Mayor DORA)";
  requiresSupervisoryNotification: boolean;
  requiresClientNotification: boolean;
  rationale: string;
}

export function classifyDoraIncident(criteria: DoraIncidentThresholdCriteria): DoraIncidentClassification {
  const triggers: string[] = [];

  if (criteria.clientsAffectedPct >= 10) {
    triggers.push(`Afección masiva a clientes (≥10%: actual ${criteria.clientsAffectedPct}%)`);
  }
  if (criteria.durationHours >= 2) {
    triggers.push(`Duración de indisponibilidad prolongada (≥2h: actual ${criteria.durationHours}h)`);
  }
  if (criteria.economicImpactEuros >= 100000) {
    triggers.push(`Impacto económico material (≥100.000 €: actual ${criteria.economicImpactEuros.toLocaleString("es-ES")} €)`);
  }
  if (criteria.affectsCriticalFunctions) {
    triggers.push("Afección directa a función esencial o importante (CIFA)");
  }
  if (criteria.dataIntegrityLoss) {
    triggers.push("Compromiso de integridad o pérdida de datos críticos");
  }
  if (criteria.thirdPartyImpact) {
    triggers.push("Impacto sistémico o en cadena hacia terceros regulados");
  }

  // Si cumple al menos 2 criterios o afecta funciones críticas con impacto económico/duración
  const isMajor = triggers.length >= 2 || (criteria.affectsCriticalFunctions && (criteria.durationHours >= 1 || criteria.economicImpactEuros >= 50000));
  
  const requiresClientNotification = isMajor && (criteria.clientsAffectedPct > 0 || criteria.economicImpactEuros > 0);

  return {
    isMajorIncident: isMajor,
    criteriaTriggered: triggers,
    severityLevel: isMajor ? "Grave TIC (Mayor DORA)" : (triggers.length === 1 ? "Significativo" : "Menor"),
    requiresSupervisoryNotification: isMajor,
    requiresClientNotification,
    rationale: isMajor 
      ? `Clasificado como Incidente Grave TIC bajo Art. 19 DORA por concurrencia de ${triggers.length} criterios de impacto.`
      : `Incidente no clasificado como mayor DORA (criterios activados: ${triggers.length}).`,
  };
}
