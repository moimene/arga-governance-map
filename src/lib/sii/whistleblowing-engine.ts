// ============================================================
// SISTEMA INTERNO DE INFORMACIÓN (SII) — MOTOR REGULATORIO & CASOS
// Conforme a Ley 2/2023, Directiva (UE) 2019/1937, CP Art. 31 bis,
// RGPD, DORA y AIMS 360. NO hay servicio cualificado de confianza detrás:
// el módulo no sella, no firma y no cifra. Ver docs/legal/2026-08-29-tsl-
// ead-trust-servicios-cualificados.md — EAD Trust no consta como prestador
// cualificado de entrega certificada ni de preservación en la Trusted List.
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

// RETENCION_3M_NO_INVESTIGACION (art. 32.4: supresión a los 3 meses de la
// recepción si no se iniciaron actuaciones) estaba DECLARADO aquí y no lo
// calculaba nadie. Un miembro de la unión que ningún reloj produce sugiere una
// capacidad que el módulo no tiene, así que se retira: cuando se calcule de
// verdad —hace falta saber si se abrieron actuaciones, y eso hoy no se
// registra— vuelve con su reloj.
export type WhistleblowingClockType =
  | "ACUSE_7D"
  | "RESOLUCION_3M"
  | "PRORROGA_3M"
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
  /**
   * Referencia interna del adjunto. NO es un hash criptográfico: se llamaba
   * `hashSha512` y se rellenaba con `Math.random()` bajo un prefijo que
   * afirmaba una integridad criptográfica que el módulo no calcula. Los campos
   * homónimos de Secretaría SÍ son reales (computeSha512); este no lo era, y
   * por eso cambia de NOMBRE en vez de cambiar de valor.
   */
  referenciaInterna: string;
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
  /** Referencia del asiento. Ver `referenciaInterna`: no es prueba criptográfica. */
  referenciaAsiento: string;
  /**
   * `false` = el asiento se ha CALCULADO al mostrarlo, no está incorporado al
   * libro. Solo se incorpora al cerrar el expediente, así que no hay número de
   * entrada ni fecha de registro conservados desde la recepción. La pantalla lo
   * dice; fingir lo contrario sería afirmar un libro-registro que no existe.
   */
  incorporadoAlCierre: boolean;
}

/**
 * Procedencia del expediente. `DEMO_PILOTO` = los hechos NO han ocurrido; es
 * un expediente sembrado para la demostración. Se pinta en pantalla: un
 * expediente simulado que no se anuncia como tal es indistinguible de uno real
 * en cuanto alguien hace una captura.
 */
export type WhistleblowingFirmeza = "DEMO_PILOTO";

/** Rótulo del expediente sembrado. Corto, porque va en un badge de tabla. */
export const SII_ETIQUETA_SIMULADO = "Simulado";

export const SII_AVISO_EXPEDIENTE_SIMULADO =
  "Expediente simulado: los hechos no han ocurrido. Está sembrado para la demostración del canal.";

/**
 * Lo que este módulo ES, dicho en la pantalla. Decisión de producto de
 * 2026-09-05: el canal NO se conecta a base de datos; se queda con persistencia
 * local y se dice.
 */
export const SII_AVISO_PERSISTENCIA_LOCAL =
  "Entorno de validación funcional. Los expedientes de este canal se guardan únicamente en el " +
  "navegador de este equipo: no hay base de datos, ni cifrado, ni custodia por un tercero, ni " +
  "eficacia jurídica. Se borran al limpiar los datos del navegador.";

export interface WhistleblowingReport {
  id: string;
  code: string; // ej: "SII-2026-08-001"
  trackingToken: string; // código de seguimiento del Safe Inbox
  /**
   * Referencia derivada del código de seguimiento. NO es un hash criptográfico
   * y no prueba integridad: llevaba delante un prefijo con el nombre de un
   * algoritmo de hash, seguido del propio token en claro. Peor que nada.
   */
  trackingTokenReference: string;
  /** Ausente = expediente registrado por el usuario en esta sesión. */
  firmeza?: WhistleblowingFirmeza;
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
 * - Plazo ordinario de respuesta: 3 meses de calendario (Art. 9.2.d).
 * - Prórroga motivada: Hasta 3 meses adicionales (máximo 6 meses) por especial complejidad.
 * - Retención límite en Libro-Registro: 10 años (Art. 26.2).
 *
 * DE DÓNDE ARRANCAN LOS 3 MESES. Literal del art. 9.2.d, cotejado contra el
 * consolidado del BOE (BOE-A-2023-4513) el 2026-09-05:
 *
 *   «…no podrá ser superior a tres meses a contar desde la recepción de la
 *   comunicación o, si no se remitió un acuse de recibo al informante, a tres
 *   meses a partir del vencimiento del plazo de siete días después de
 *   efectuarse la comunicación…»
 *
 * O sea: la regla general cuenta desde la RECEPCIÓN. El día 7 solo entra en
 * juego cuando NO se remitió acuse. Antes se hacía al revés —se contaba desde
 * la fecha del acuse cuando este se había enviado dentro de los 7 días— y el
 * vencimiento mostrado quedaba hasta SIETE DÍAS por encima del máximo legal.
 * Haber enviado el acuse no alarga el plazo de respuesta: lo fija.
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
  /**
   * Puntualidad del acuse YA emitido: `null` si no se ha emitido ninguno.
   * `ackIsOverdue` mide contra HOY y por eso vale `true` en todo expediente
   * antiguo, lo haya cumplido o no; para contar cumplimiento hace falta esto.
   */
  ackSentOnTime: boolean | null;
  ackDaysRemaining: number;
  resolutionDaysRemaining: number;
  clocks: WhistleblowingClock[];
} {
  const intakeDate = typeof intakeDateInput === "string" ? new Date(intakeDateInput) : new Date(intakeDateInput.getTime());
  const now = new Date();

  // 1. Acuse de recibo: 7 días naturales
  const ackDeadline7d = new Date(intakeDate.getTime());
  ackDeadline7d.setDate(ackDeadline7d.getDate() + 7);

  // 2. Base para los 3 meses (art. 9.2.d): la recepción. Solo cuando NO se
  //    remitió acuse se cuenta desde el vencimiento de los 7 días.
  const ackDate = acknowledgmentSentDateInput
    ? (typeof acknowledgmentSentDateInput === "string"
        ? new Date(acknowledgmentSentDateInput)
        : new Date(acknowledgmentSentDateInput.getTime()))
    : null;
  const resolutionBaseDate = ackDate ? intakeDate : ackDeadline7d;
  const ackSentOnTime = ackDate ? ackDate.getTime() <= ackDeadline7d.getTime() : null;

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
      completedAt: ackDate ? ackDate.toISOString() : null,
      // Un acuse emitido FUERA de los 7 días no es un plazo cumplido: se
      // marcaba "COMPLETADO" por el mero hecho de existir.
      status: ackDate
        ? (ackSentOnTime ? "COMPLETADO" : "VENCIDO")
        : ackDaysRemaining <= 2 ? (ackIsOverdue ? "VENCIDO" : "PROXIMO_VENCIMIENTO") : "EN_PLAZO",
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
    ackSentOnTime,
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
/**
 * Órganos que el motor nombra en los subexpedientes. Los valores por defecto
 * son EXACTAMENTE los que el motor tenía cableados, así que quien no los pase
 * ve lo mismo de siempre — ARGA incluida.
 *
 * Existen porque no son universales: «Comité de Cumplimiento» y «Comisión de
 * Auditoría y Control» son órganos de una aseguradora, y hay tenants donde no
 * existen. En un despacho, el Responsable del SII es un órgano UNIPERSONAL, y
 * llamarlo comisión cambia quién responde.
 */
export interface OrganosSii {
  /** Destinatario del subexpediente penal. */
  readonly comiteCumplimientoPenal: string;
  /** Destinatario del subexpediente de cumplimiento general. */
  readonly comiteCumplimiento: string;
  /** A quién se asigna la tramitación cuando afecta a la alta dirección. */
  readonly organoEscalado: string;
}

export const ORGANOS_SII_POR_DEFECTO: OrganosSii = {
  comiteCumplimientoPenal: "Comité de Cumplimiento / Posible Remisión Fiscalía",
  comiteCumplimiento: "Comité de Cumplimiento",
  organoEscalado: "la Presidencia de la Comisión de Auditoría y Control",
};

export function evaluateSubcasePerimeter(params: {
  category: string;
  summary: string;
  detailedDescription: string;
  affectsAI?: boolean;
  affectsICT?: boolean;
  affectsPersonalData?: boolean;
  isBoardOrExecutiveTarget?: boolean;
  organos?: OrganosSii;
}): SubcasePerimeterResult {
  const organos = params.organos ?? ORGANOS_SII_POR_DEFECTO;
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
      authorityTarget: organos.comiteCumplimientoPenal,
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
    // Mismo defecto que la sigla «ia», medido: `includes("dora")` marcaba
    // «trabaja-dora», «administra-dora» y «provee-dora»; `includes("tic")`
    // marcaba «prac-tic-a» y «estadis-tic-a». Cuatro de cada cinco denuncias
    // corrientes abrian un subexpediente DORA dirigido a DGSFP/CNMV/EBA.
    /\bdora\b/.test(text) || 
    /\btic\b/.test(text) || 
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
    // `\bia\b` y no `includes("ia")`: la sigla es una palabra, y «ia» es una
    // terminacion corrientisima en castellano —denunc-ia, famil-ia, mater-ia,
    // gerenc-ia, advertenc-ia, vigilanc-ia—. Con `includes`, casi cualquier
    // denuncia abria un subexpediente de EU AI Act dirigido a la AESIA.
    /\bia\b/.test(text) || 
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
      authorityTarget: organos.comiteCumplimiento,
      ownerRole: "Responsable del Sistema Interno de Información",
      reason: "Investigación ordinaria del Sistema Interno de Información.",
    });
  }

  // Escalado al Consejo si involucra Alta Dirección
  // «ceo» como palabra: `includes` lo encontraba dentro de «bu-ceo» y escalaba
  // la denuncia al Consejo de Administracion por una palabra que no nombra a
  // nadie. Escalar de mas no es conservador aqui: mete al organo de gobierno en
  // un expediente que no le corresponde.
  const escalationRequired = !!params.isBoardOrExecutiveTarget || text.includes("consejero") || text.includes("director general") || /\bceo\b/.test(text);

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
  /** Solo transformaciones del NOMBRE. Vacío si el nombre no requería ninguna. */
  removedMetadata: string[];
  /** El nombre ha sido sustituido. NO significa que el contenido se haya tratado. */
  sanitized: boolean;
}

/**
 * Sustituye el NOMBRE de archivo por una referencia neutra y describe lo que ha
 * descartado de ese nombre.
 *
 * LO QUE NO HACE, y se decía que hacía: no abre el fichero. No lee, no
 * inspecciona y no elimina los metadatos incrustados en el fichero (EXIF,
 * autor, huella de software creador) — el
 * contenido ni siquiera se sube. Las dos líneas que lo afirmaban estaban FUERA
 * de todo `if`, así que se devolvían siempre, incluso para una entrada vacía:
 * eran una constante disfrazada de resultado. `removedMetadata` describe ahora
 * únicamente transformaciones del nombre que han ocurrido de verdad.
 */
export function sanitizeMetadata(filename: string): SanitizedFileInfo {
  const extension = filename.includes(".") ? filename.split(".").pop() ?? "" : "";
  const baseName = filename.replace(/\.[^/.]+$/, "");

  const removed: string[] = [];

  const sinRuta = baseName.replace(/^.*[\\/]/, "");
  if (sinRuta !== baseName) {
    removed.push("Ruta del sistema local presente en el nombre del archivo");
  }

  const cleaned = sinRuta.replace(/[^\w\s-]/gi, "").trim();
  if (cleaned !== sinRuta.trim()) {
    removed.push("Caracteres especiales del nombre del archivo");
  }

  // El nombre original desaparece SIEMPRE: es la única protección real que
  // aporta esta función, y por eso sí se declara siempre.
  const sanitizedFilename = `EVIDENCIA_SII_${Date.now().toString(36).toUpperCase()}.${extension || "dat"}`;
  if (cleaned.length > 0) {
    removed.push("Nombre original del archivo, sustituido por una referencia neutra");
  }

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
  caseContext: { targetDepartment?: string; targetPersonName?: string; isBoardTarget?: boolean },
  // Por defecto, exactamente lo que decia antes: quien no lo pase no nota nada.
  organos: OrganosSii = ORGANOS_SII_POR_DEFECTO,
): ConflictEvaluationResult {
  // 1. Conflicto por Alta Dirección / Consejo -> Escalado a Comisión de Auditoría
  if (caseContext.isBoardTarget) {
    return {
      hasConflict: true,
      reason: "CONSEJO_ALTA_DIRECCION",
      description:
        "La comunicación afecta a miembros del Consejo de Administración o Alta Dirección. " +
        `La tramitación debe asignarse a ${organos.organoEscalado}.`,
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

// ─── Generador de Asiento en Libro-Registro Oficial (Art. 26 Ley 2/2023) ───────

export function generateLibroRegistroEntry(
  report: WhistleblowingReport,
  closureDetails?: { outcome: string; actionsTaken: string[] }
): WhistleblowingLibroRegistroEntry {
  const recordNumber = `REG-SII-${report.code.replace("SII-", "")}`;
  const now = new Date();
  
  const retentionLimitDate = new Date(report.intakeDate);
  retentionLimitDate.setFullYear(retentionLimitDate.getFullYear() + 10);

  // Referencia del asiento. Hash JS de 32 bits: sirve para identificar, NO para probar.
  const rawPayload = `${recordNumber}|${report.code}|${report.intakeDate}|${report.category}|${report.anonymityMode}|${report.assignedInvestigatorName}`;
  let hash = 0;
  for (let i = 0; i < rawPayload.length; i++) {
    hash = ((hash << 5) - hash) + rawPayload.charCodeAt(i);
    hash |= 0;
  }
  const referenciaAsiento = `REF-SII-${Math.abs(hash).toString(16).padStart(16, "0")}-${Date.now().toString(16)}`;

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
    referenciaAsiento,
    // Solo hay incorporación cuando el asiento se genera al CERRAR: es la
    // única llamada que aporta `closureDetails` y persiste el resultado.
    incorporadoAlCierre: !!closureDetails,
  };
}
