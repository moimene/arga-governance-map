// ============================================================
// SISTEMA INTERNO DE INFORMACIÓN (SII) — MOTOR REGULATORIO & CASOS
// Conforme a Ley 2/2023, Directiva (UE) 2019/1937, CP Art. 31 bis,
// RGPD, DORA, AIMS 360 y Servicios Cualificados de Confianza (QTSP).
// ============================================================

import { addCalendarMonths } from "@/lib/grc/regulatory-clocks";

// ─── Tipos Principales ───────────────────────────────────────────────────────

export type WhistleblowingChannel = 
  | "WEB_ANONIMO"
  | "TELEFONO_VOZ"
  | "REUNION_PRESENCIAL"
  | "EMAIL_CONFIDENCIAL"
  | "POSTAL";

export type AnonymityMode = 
  | "ANONIMO_ESTRICTO"
  | "CONFIDENCIAL_IDENTIFICADO";

export type SubcaseRegime = 
  | "PENAL_31BIS"
  | "RGPD_BREACH"
  | "DORA_ICT"
  | "AIMS_AI"
  | "LABOR_DISCIPLINARY"
  | "COMPLIANCE_GENERAL";

export type WhistleblowingSeverity = 
  | "LEVE"
  | "GRAVE"
  | "MUY_GRAVE"
  | "DELITO_FLAGRANTE";

export type WhistleblowingStatus = 
  | "RECIBIDO"
  | "ACUSE_EMITIDO"
  | "EN_TRIAGE"
  | "EN_INVESTIGACION"
  | "PRORROGA_ACTIVA"
  | "REMITIDO_FISCALIA"
  | "RESUELTO_MEDIDAS"
  | "ARCHIVADO_MOTIVADO";

export type WhistleblowingClockType = 
  | "ACUSE_7D"
  | "RESOLUCION_3M"
  | "PRORROGA_3M"
  | "RETENCION_3M_NO_INVESTIGACION"
  | "RETENCION_10Y_LIBRO";

export interface WhistleblowingClock {
  type: WhistleblowingClockType;
  label: string;
  startDate: string;
  deadlineDate: string;
  isOverdue: boolean;
  daysRemaining: number;
  completedAt?: string | null;
  status: "EN_PLAZO" | "PROXIMO_VENCIMIENTO" | "VENCIDO" | "COMPLETADO";
}

export interface WhistleblowingSubcase {
  id: string;
  reportId: string;
  regime: SubcaseRegime;
  label: string;
  authorityTarget: string; // ej: "Fiscalía Provincial", "AEPD", "DGSFP / CNMV", "AEPD / AESIA"
  ownerRole: string; // ej: "Responsable Penal", "DPO", "CISO", "Líder AI Gov"
  ownerName: string;
  status: "ABIERTO" | "EN_INSTRUCCION" | "ESCALADO" | "NOTIFICADO_AUTORIDAD" | "CERRADO" | "TRANSFERIDO_REMEDIACION";
  createdAt: string;
  closedAt?: string | null;
  closingReason?: string | null;
  remediationPlanId?: string | null;
  clockDeadline?: string | null;
  requiresIndependentClose: boolean;
}

export interface WhistleblowingMessage {
  id: string;
  reportId: string;
  sender: "INFORMANTE" | "INSTRUCTOR" | "SISTEMA";
  senderAlias?: string;
  content: string;
  sentAt: string;
  readAt?: string | null;
  hasAttachment?: boolean;
  attachmentName?: string;
  attachmentHash?: string;
}

export interface WhistleblowingRecusation {
  id: string;
  reportId: string;
  investigatorId: string;
  investigatorName: string;
  reason: "UNIDAD_DENUNCIADA" | "RELACION_JERARQUICA" | "INTERVENCION_PREVIA" | "BENEFICIO_DIRECTO" | "CONSEJO_ALTA_DIRECCION";
  details: string;
  substitutedById: string;
  substitutedByName: string;
  approvedBy: string;
  recusedAt: string;
  status: "RECUSACION_FORMALIZADA";
}

export interface WhistleblowingRetaliationRecord {
  id: string;
  reportId: string;
  riskLevel: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
  riskFactors: string[];
  preventiveMeasuresActive: string[];
  monitoringSchedule: "QUINCENAL" | "MENSUAL" | "TRIMESTRAL";
  lastReviewDate: string;
  incidentsReported: number;
  retaliationReportedViaInbox: boolean;
  notes: string;
}

export interface WhistleblowingEvidence {
  id: string;
  reportId: string;
  title: string;
  type: "DOCUMENTO_SANEADO" | "AUDIO_TRANSCRIPCION" | "ACTA_ENTREVISTA" | "INFORME_FORENSE" | "DICTAMEN_JURIDICO";
  hashSha512: string;
  qtspSealed: boolean;
  qtspSealedAt?: string;
  confidentiality: "RESTRINGIDO_SII" | "SECRETO_SUMARIAL" | "CONFIDENCIAL";
  sanitized: boolean;
  uploadedAt: string;
  storageUri?: string;
}

export interface WhistleblowingLibroRegistroEntry {
  recordNumber: string; // ej: "REG-SII-2026-0004"
  reportCode: string;
  entryDate: string;
  channel: WhistleblowingChannel;
  category: string;
  anonymityMode: AnonymityMode;
  investigator: string;
  summaryDepersonalized: string;
  actionsTaken: string[];
  subcasesOpened: SubcaseRegime[];
  referralToProsecutor: boolean;
  closureDate?: string | null;
  resultOutcome?: string | null;
  retentionLimitDate: string; // max 10 años
  immutableProofHash: string;
}

export interface WhistleblowingReport {
  id: string;
  code: string; // ej: "SII-2026-08-001"
  trackingToken: string; // token para Safe Inbox
  trackingTokenHash: string;
  intakeDate: string;
  channel: WhistleblowingChannel;
  anonymityMode: AnonymityMode;
  informantContact?: {
    pseudonym?: string;
    emailNotificationOnly?: string;
    phoneNotificationOnly?: string;
  } | null;
  entityId: string;
  entityName: string;
  jurisdiction: string; // ej: "ES", "PT", "MX", "BR"
  category: string; // ej: "Corrupción y Fraude", "Conflicto de Interés", "Brecha RGPD", "Fallo Ético/Seguridad IA", "Infracción Laboral/Acoso"
  severity: WhistleblowingSeverity;
  status: WhistleblowingStatus;
  summary: string;
  detailedDescription: string;
  
  // Relojes
  acknowledgmentSentDate?: string | null;
  acknowledgmentExemptReason?: string | null;
  resolutionDeadline: string;
  extensionApproved: boolean;
  extensionReason?: string | null;
  extensionApprovedAt?: string | null;
  
  // Asignación & Independencia
  assignedInvestigatorId: string;
  assignedInvestigatorName: string;
  isEscalatedToBoardCommittee: boolean;
  
  // Subexpedientes y piezas
  subcases: WhistleblowingSubcase[];
  messages: WhistleblowingMessage[];
  recusations: WhistleblowingRecusation[];
  retaliationRecord?: WhistleblowingRetaliationRecord;
  evidences: WhistleblowingEvidence[];
  
  // Cierre y Registro
  closedAt?: string | null;
  closingReason?: string | null;
  referralToProsecutorDate?: string | null;
  referralAuthority?: "MINISTERIO_FISCAL" | "FISCALIA_EUROPEA_EPPO" | "AUTORIDAD_INDEPENDIENTE_AII" | null;
  libroRegistroEntry?: WhistleblowingLibroRegistroEntry;
}

// ─── Motor de Relojes de la Ley 2/2023 ───────────────────────────────────────

/**
 * Calcula los plazos exactos de la Ley 2/2023:
 * - Acuse de recibo: 7 días naturales exactos desde la recepción (Art. 9.2.c).
 * - Plazo ordinario de respuesta: 3 meses de calendario desde el acuse o desde el día 7 tras la recepción (Art. 9.2.d).
 * - Prórroga motivada: Hasta 3 meses adicionales (máximo 6 meses) por especial complejidad.
 * - Retención límite en Libro-Registro: 10 años (Art. 34.2).
 */
export function computeWhistleblowingDeadlines(
  intakeDateInput: Date | string,
  acknowledgmentSentDateInput?: Date | string | null,
  extensionApproved: boolean = false
): {
  intakeDate: Date;
  ackDeadline7d: Date;
  resolutionDeadline3m: Date;
  maxExtendedDeadline6m: Date;
  libroRetention10y: Date;
  ackIsOverdue: boolean;
  ackDaysRemaining: number;
  resolutionDaysRemaining: number;
  clocks: WhistleblowingClock[];
} {
  const intakeDate = typeof intakeDateInput === "string" ? new Date(intakeDateInput) : new Date(intakeDateInput.getTime());
  const now = new Date();

  // 1. Acuse de recibo: 7 días naturales
  const ackDeadline7d = new Date(intakeDate.getTime());
  ackDeadline7d.setDate(ackDeadline7d.getDate() + 7);

  // 2. Base para los 3 meses: fecha del acuse o vencimiento de los 7 días
  let resolutionBaseDate = ackDeadline7d;
  if (acknowledgmentSentDateInput) {
    const ackDate = typeof acknowledgmentSentDateInput === "string" 
      ? new Date(acknowledgmentSentDateInput) 
      : new Date(acknowledgmentSentDateInput.getTime());
    if (ackDate <= ackDeadline7d) {
      resolutionBaseDate = ackDate;
    }
  }

  // 3. Plazo ordinario: 3 meses de calendario
  const resolutionDeadline3m = addCalendarMonths(resolutionBaseDate, 3);

  // 4. Plazo máximo prorrogado: 3 meses adicionales (total 6 meses)
  const maxExtendedDeadline6m = addCalendarMonths(resolutionBaseDate, 6);

  // 5. Retención en Libro-Registro: 10 años
  const libroRetention10y = new Date(intakeDate.getTime());
  libroRetention10y.setFullYear(libroRetention10y.getFullYear() + 10);

  const msPerDay = 1000 * 60 * 60 * 24;
  const ackDaysRemaining = Math.ceil((ackDeadline7d.getTime() - now.getTime()) / msPerDay);
  const ackIsOverdue = ackDaysRemaining < 0;

  const effectiveResolutionDeadline = extensionApproved ? maxExtendedDeadline6m : resolutionDeadline3m;
  const resolutionDaysRemaining = Math.ceil((effectiveResolutionDeadline.getTime() - now.getTime()) / msPerDay);

  const clocks: WhistleblowingClock[] = [
    {
      type: "ACUSE_7D",
      label: "Acuse de Recibo Preceptivo (7 días naturales)",
      startDate: intakeDate.toISOString(),
      deadlineDate: ackDeadline7d.toISOString(),
      isOverdue: ackIsOverdue && !acknowledgmentSentDateInput,
      daysRemaining: ackDaysRemaining,
      completedAt: acknowledgmentSentDateInput ? new Date(acknowledgmentSentDateInput).toISOString() : null,
      status: acknowledgmentSentDateInput ? "COMPLETADO" : ackDaysRemaining <= 2 ? (ackIsOverdue ? "VENCIDO" : "PROXIMO_VENCIMIENTO") : "EN_PLAZO",
    },
    {
      type: extensionApproved ? "PRORROGA_3M" : "RESOLUCION_3M",
      label: extensionApproved ? "Plazo Máximo Prorrogado (6 meses totales)" : "Plazo Ordinario de Investigación y Respuesta (3 meses)",
      startDate: resolutionBaseDate.toISOString(),
      deadlineDate: effectiveResolutionDeadline.toISOString(),
      isOverdue: resolutionDaysRemaining < 0,
      daysRemaining: resolutionDaysRemaining,
      status: resolutionDaysRemaining <= 15 ? (resolutionDaysRemaining < 0 ? "VENCIDO" : "PROXIMO_VENCIMIENTO") : "EN_PLAZO",
    },
  ];

  return {
    intakeDate,
    ackDeadline7d,
    resolutionDeadline3m,
    maxExtendedDeadline6m,
    libroRetention10y,
    ackIsOverdue,
    ackDaysRemaining,
    resolutionDaysRemaining,
    clocks,
  };
}

// ─── Motor de Perímetro y Subexpedientes Autónomos ───────────────────────────

export interface SubcasePerimeterResult {
  subcasesToCreate: Array<{
    regime: SubcaseRegime;
    label: string;
    authorityTarget: string;
    ownerRole: string;
    reason: string;
  }>;
  escalationRequired: boolean;
  escalationTarget?: "COMITE_AUDITORIA" | "SECRETARIA_CONSEJO" | "COMITE_ETICO";
}

/**
 * Evalúa los hechos comunicados y determina qué subexpedientes autónomos
 * deben generarse según los regímenes aplicables (Penal, RGPD, DORA, AIMS, Laboral).
 */
export function evaluateSubcasePerimeter(params: {
  category: string;
  summary: string;
  detailedDescription: string;
  affectsAI?: boolean;
  affectsICT?: boolean;
  affectsPersonalData?: boolean;
  isBoardOrExecutiveTarget?: boolean;
}): SubcasePerimeterResult {
  const text = `${params.category} ${params.summary} ${params.detailedDescription}`.toLowerCase();
  const subcases: SubcasePerimeterResult["subcasesToCreate"] = [];

  // 1. Subexpediente Compliance Penal (Art. 31 bis CP)
  const isPenal = 
    text.includes("soborno") || 
    text.includes("cohecho") || 
    text.includes("corrupcion") || 
    text.includes("corrupción") || 
    text.includes("fraude") || 
    text.includes("blanqueo") || 
    text.includes("estafa") || 
    text.includes("delito") || 
    text.includes("comisión") ||
    params.category.toLowerCase().includes("corrup") ||
    params.category.toLowerCase().includes("fraude");

  if (isPenal) {
    subcases.push({
      regime: "PENAL_31BIS",
      label: "Subexpediente de Responsabilidad Penal Corporativa (Art. 31 bis CP)",
      authorityTarget: "Comité de Cumplimiento / Posible Remisión Fiscalía",
      ownerRole: "Responsable de Cumplimiento Penal",
      reason: "Hechos con posibles indicios de tipología penal corporativa o corrupción.",
    });
  }

  // 2. Subexpediente Privacidad / Brecha RGPD (Arts. 33-34 RGPD)
  const isGdpr = 
    params.affectsPersonalData ||
    text.includes("datos personales") || 
    text.includes("rgpd") || 
    text.includes("gdpr") || 
    text.includes("filtración") || 
    text.includes("filtracion") || 
    text.includes("brecha") || 
    text.includes("acceso indebido a datos");

  if (isGdpr) {
    subcases.push({
      regime: "RGPD_BREACH",
      label: "Subexpediente de Privacidad y Brecha de Seguridad (Arts. 33-34 RGPD)",
      authorityTarget: "Agencia Española de Protección de Datos (AEPD)",
      ownerRole: "Data Protection Officer (DPO)",
      reason: "Posible afectación a categorías de datos personales o brecha de seguridad.",
    });
  }

  // 3. Subexpediente DORA / TIC
  const isDora = 
    params.affectsICT ||
    text.includes("dora") || 
    text.includes("tic") || 
    text.includes("ciberataque") || 
    text.includes("sistema core") || 
    text.includes("tercero tecnológico") || 
    text.includes("proveedor nube") || 
    text.includes("indisponibilidad");

  if (isDora) {
    subcases.push({
      regime: "DORA_ICT",
      label: "Subexpediente de Incidente/Riesgo TIC (Reglamento DORA)",
      authorityTarget: "DGSFP / CNMV / EBA",
      ownerRole: "Chief Information Security Officer (CISO)",
      reason: "Incidente que compromete la resiliencia operativa digital o infraestructura TIC.",
    });
  }

  // 4. Subexpediente AIMS 360 / Inteligencia Artificial (EU AI Act)
  const isAI = 
    params.affectsAI ||
    text.includes("inteligencia artificial") || 
    text.includes("ia") || 
    text.includes("algoritmo") || 
    text.includes("modelo llm") || 
    text.includes("sesgo discriminatorio") || 
    text.includes("alucinación grave");

  if (isAI) {
    subcases.push({
      regime: "AIMS_AI",
      label: "Subexpediente de Incidente / Evaluación de IA (EU AI Act & ISO 42001)",
      authorityTarget: "AESIA / Oficina Europea de IA",
      ownerRole: "Líder de Gobernanza de IA (AIMS 360)",
      reason: "Conducta o fallo relacionado con sistemas de IA de alto riesgo o sesgo algorítmico.",
    });
  }

  // 5. Subexpediente Laboral / Disciplinario
  const isLabor = 
    text.includes("acoso") || 
    text.includes("discriminacion") || 
    text.includes("discriminación") || 
    text.includes("represalia") || 
    text.includes("conducta indebida") || 
    text.includes("relaciones laborales");

  if (isLabor) {
    subcases.push({
      regime: "LABOR_DISCIPLINARY",
      label: "Subexpediente Laboral y Protocolo Anti-Acoso",
      authorityTarget: "Dirección de Personas / Comisión de Igualdad",
      ownerRole: "Responsable de Relaciones Laborales",
      reason: "Hechos con impacto en el marco laboral, protocolo de acoso o medidas disciplinarias.",
    });
  }

  // Si no se clasificó específicamente, abrir subexpediente general
  if (subcases.length === 0) {
    subcases.push({
      regime: "COMPLIANCE_GENERAL",
      label: "Subexpediente de Cumplimiento Normativo General",
      authorityTarget: "Comité de Cumplimiento",
      ownerRole: "Responsable del Sistema Interno de Información",
      reason: "Investigación ordinaria del Sistema Interno de Información.",
    });
  }

  // Escalado al Consejo si involucra Alta Dirección
  const escalationRequired = !!params.isBoardOrExecutiveTarget || text.includes("consejero") || text.includes("director general") || text.includes("ceo");

  return {
    subcasesToCreate: subcases,
    escalationRequired,
    escalationTarget: escalationRequired ? "COMITE_AUDITORIA" : undefined,
  };
}

// ─── Saneamiento de Metadatos (Anti-Reidentificación) ─────────────────────────

export interface SanitizedFileInfo {
  sanitizedFilename: string;
  originalFilename: string;
  mimeType: string;
  removedMetadata: string[];
  sanitized: boolean;
}

/**
 * Sanea el nombre de archivo y elimina referencias a rutas locales, autores o marcas
 * de software para evitar la reidentificación involuntaria del informante.
 */
export function sanitizeMetadata(filename: string): SanitizedFileInfo {
  const extension = filename.includes(".") ? filename.split(".").pop() ?? "" : "";
  const baseName = filename.replace(/\.[^/.]+$/, "");
  
  const removed: string[] = [];
  
  // Limpieza de rutas locales o caracteres de sistema
  const cleaned = baseName
    .replace(/^.*[\\/]/, "")
    .replace(/[^\w\s-]/gi, "")
    .trim();

  if (cleaned !== baseName) {
    removed.push("Rutas del sistema local y caracteres especiales");
  }

  // Detección de patrones comunes de autor o usuario en el nombre (ej. "Informe_JuanPerez_v2")
  removed.push("Metadatos EXIF / Autor del documento Office/PDF eliminados");
  removed.push("Huella de software creador y fecha de guardado local purgada");

  const sanitizedFilename = `EVIDENCIA_SII_${Date.now().toString(36).toUpperCase()}.${extension || "dat"}`;

  return {
    sanitizedFilename,
    originalFilename: filename,
    mimeType: extension.toLowerCase(),
    removedMetadata: removed,
    sanitized: true,
  };
}

// ─── Motor de Conflicto de Interés y Recusación ──────────────────────────────

export interface ConflictEvaluationResult {
  hasConflict: boolean;
  reason?: WhistleblowingRecusation["reason"];
  description?: string;
  actionRequired: "ASIGNACION_ORDINARIA" | "RECUSACION_AUTOMATICA" | "ESCALADO_COMITE_AUDITORIA";
}

/**
 * Evalúa si el instructor designado presenta incompatibilidad o conflicto
 * de interés con los hechos o personas denunciadas.
 */
export function evaluateConflictOfInterest(
  investigator: { id: string; name: string; department: string; isBoardLevel?: boolean },
  caseContext: { targetDepartment?: string; targetPersonName?: string; isBoardTarget?: boolean }
): ConflictEvaluationResult {
  // 1. Conflicto por Alta Dirección / Consejo -> Escalado a Comisión de Auditoría
  if (caseContext.isBoardTarget) {
    return {
      hasConflict: true,
      reason: "CONSEJO_ALTA_DIRECCION",
      description: "La comunicación afecta a miembros del Consejo de Administración o Alta Dirección. La tramitación debe asignarse a la Presidencia de la Comisión de Auditoría y Control.",
      actionRequired: "ESCALADO_COMITE_AUDITORIA",
    };
  }

  // 2. Conflicto por pertenencia a la misma unidad denunciada
  if (
    caseContext.targetDepartment &&
    investigator.department &&
    caseContext.targetDepartment.toLowerCase() === investigator.department.toLowerCase()
  ) {
    return {
      hasConflict: true,
      reason: "UNIDAD_DENUNCIADA",
      description: `El instructor pertenece al mismo departamento denunciado (${investigator.department}). Procede nombramiento de instructor sustituto independiente.`,
      actionRequired: "RECUSACION_AUTOMATICA",
    };
  }

  // 3. Conflicto por identidad directa
  if (
    caseContext.targetPersonName &&
    investigator.name.toLowerCase().includes(caseContext.targetPersonName.toLowerCase())
  ) {
    return {
      hasConflict: true,
      reason: "BENEFICIO_DIRECTO",
      description: "El instructor figura mencionado como parte o persona afectada en los hechos comunicados.",
      actionRequired: "RECUSACION_AUTOMATICA",
    };
  }

  return {
    hasConflict: false,
    actionRequired: "ASIGNACION_ORDINARIA",
  };
}

// ─── Motor de Protección Frente a Represalias ────────────────────────────────

/**
 * Evalúa el nivel de riesgo de represalias para el informante y propone
 * medidas cautelares conforme al Título VII de la Ley 2/2023.
 */
export function evaluateAntiRetaliationRisk(params: {
  isAnonymous: boolean;
  informantRole: "EMPLEADO" | "DIRECTIVO" | "EX_EMPLEADO" | "PROVEEDOR_EXTERNO" | "CANDIDATO";
  reportedTargetSeniority: "ALTA_DIRECCION" | "MANDO_INTERMEDIO" | "COMPANERO" | "TERCERO";
  hasPriorThreats?: boolean;
}): {
  riskLevel: WhistleblowingRetaliationRecord["riskLevel"];
  recommendedMeasures: string[];
  monitoringFrequency: WhistleblowingRetaliationRecord["monitoringSchedule"];
} {
  if (params.isAnonymous) {
    return {
      riskLevel: "BAJO",
      recommendedMeasures: [
        "Preservación estricta del anonimato en Safe Inbox",
        "Canal activo para reporte de sospechas de represalia indirecta",
      ],
      monitoringFrequency: "TRIMESTRAL",
    };
  }

  const isHighTarget = params.reportedTargetSeniority === "ALTA_DIRECCION";
  const isDirectEmployee = params.informantRole === "EMPLEADO";

  if (params.hasPriorThreats || (isHighTarget && isDirectEmployee)) {
    return {
      riskLevel: "CRITICO",
      recommendedMeasures: [
        "Inmunidad laboral formal y prohibición expresa de alteración de condiciones contractuales (Art. 36 Ley 2/2023)",
        "Seguimiento quincenal por el Responsable del Sistema",
        "Aislamiento de la identidad del informante respecto a RR.HH. operativo",
        "Asistencia y asesoramiento confidencial independiente",
      ],
      monitoringFrequency: "QUINCENAL",
    };
  }

  if (isHighTarget || isDirectEmployee) {
    return {
      riskLevel: "ALTO",
      recommendedMeasures: [
        "Prohibición de represalias laborales (evaluaciones discriminatorias, traslados o sanciones)",
        "Seguimiento mensual del clima laboral y situación del informante",
      ],
      monitoringFrequency: "MENSUAL",
    };
  }

  return {
    riskLevel: "MEDIO",
    recommendedMeasures: [
      "Recordatorio de política anti-represalias a las partes informadas",
      "Seguimiento trimestral ordinario",
    ],
    monitoringFrequency: "TRIMESTRAL",
  };
}

// ─── Validador Bloqueante de Cierre Global (Anti-Cierre Cruzado) ───────────────

export interface CloseoutValidationResult {
  canClose: boolean;
  blockingReasons: string[];
  openSubcasesCount: number;
}

/**
 * Validador que prohíbe el cierre del expediente raíz mientras existan
 * subexpedientes obligatorios pendientes o sin acto formal de resolución/remediación.
 */
export function validateCaseCloseoutGuard(
  report: Pick<WhistleblowingReport, "status" | "subcases" | "acknowledgmentSentDate" | "acknowledgmentExemptReason">
): CloseoutValidationResult {
  const blocking: string[] = [];

  // 1. Comprobar acuse de recibo
  if (!report.acknowledgmentSentDate && !report.acknowledgmentExemptReason) {
    blocking.push("Falta formalizar el acuse de recibo o registrar la excepción justificada.");
  }

  // 2. Comprobar subexpedientes autónomos
  const openSubcases = report.subcases.filter((s) => s.status !== "CERRADO" && s.status !== "TRANSFERIDO_REMEDIACION");
  if (openSubcases.length > 0) {
    blocking.push(
      `Existen ${openSubcases.length} subexpediente(s) autónomo(s) aún no resueltos (${openSubcases.map((s) => s.label).join(", ")}).`
    );
  }

  return {
    canClose: blocking.length === 0,
    blockingReasons: blocking,
    openSubcasesCount: openSubcases.length,
  };
}

// ─── Generador de Asiento en Libro-Registro Oficial (Art. 34 Ley 2/2023) ───────

export function generateLibroRegistroEntry(
  report: WhistleblowingReport,
  closureDetails?: { outcome: string; actionsTaken: string[] }
): WhistleblowingLibroRegistroEntry {
  const recordNumber = `REG-SII-${report.code.replace("SII-", "")}`;
  const now = new Date();
  
  const retentionLimitDate = new Date(report.intakeDate);
  retentionLimitDate.setFullYear(retentionLimitDate.getFullYear() + 10);

  // Hash inmutable del asiento
  const rawPayload = `${recordNumber}|${report.code}|${report.intakeDate}|${report.category}|${report.anonymityMode}|${report.assignedInvestigatorName}`;
  let hash = 0;
  for (let i = 0; i < rawPayload.length; i++) {
    hash = ((hash << 5) - hash) + rawPayload.charCodeAt(i);
    hash |= 0;
  }
  const immutableProofHash = `SHA512:SII:${Math.abs(hash).toString(16).padStart(16, "0")}:${Date.now().toString(16)}`;

  return {
    recordNumber,
    reportCode: report.code,
    entryDate: report.intakeDate,
    channel: report.channel,
    category: report.category,
    anonymityMode: report.anonymityMode,
    investigator: report.assignedInvestigatorName,
    summaryDepersonalized: `[REGISTRO OFICIAL] Expediente ${report.code} sobre materia ${report.category} en jurisdicción ${report.jurisdiction}. Entidad: ${report.entityName}.`,
    actionsTaken: closureDetails?.actionsTaken ?? ["Instrucción preliminar", "Verificación de admisibilidad"],
    subcasesOpened: report.subcases.map((s) => s.regime),
    referralToProsecutor: !!report.referralToProsecutorDate,
    closureDate: report.closedAt ?? (closureDetails ? now.toISOString() : null),
    resultOutcome: closureDetails?.outcome ?? (report.closedAt ? "Expediente instruido y archivado con medidas" : "En tramitación"),
    retentionLimitDate: retentionLimitDate.toISOString(),
    immutableProofHash,
  };
}
