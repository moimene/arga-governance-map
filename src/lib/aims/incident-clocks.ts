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
  articleRef: "Art. 73.2" | "Art. 73.3" | "Art. 73.4";
  /**
   * El sistema asociado no tiene clasificación de riesgo registrada, así que no
   * consta que el art. 73 le alcance. El plazo se muestra con esa cautela en vez
   * de ocultarse.
   */
  highRiskUnconfirmed?: boolean;
}

export interface GdprClockResult {
  regime: "GDPR";
  authority: "AEPD / Autoridad de Control de Protección de Datos";
  deadlineHours: 72;
  deadlineDate: string;
  requiresDataSubjectNotice: boolean;
  /** Artículo de la comunicación al interesado, distinto del del plazo de 72 h. */
  dataSubjectNoticeArticleRef?: string;
  ruleDescription: string;
  articleRef: "Art. 33" | "Art. 34";
}

export interface DoraClockResult {
  regime: "DORA";
  authority: "DGSFP / Banco de España / BCE";
  /** Horas EFECTIVAS desde el conocimiento hasta el vencimiento, no el plazo legal. */
  initialDeadlineHours: number;
  /** Qué regla ha determinado el vencimiento inicial. */
  initialRule: "4H_FROM_CLASSIFICATION" | "24H_CAP_FROM_KNOWLEDGE";
  initialDeadlineDate: string;
  intermediateDeadlineHours: 72;
  intermediateDeadlineDate: string;
  /**
   * Los hitos intermedio y final se encadenan sobre el vencimiento del anterior,
   * no sobre su envío real: son los últimos permisibles asumiendo presentación
   * justo en plazo.
   */
  assumesPriorReportsAtDeadline: boolean;
  finalDeadlineDate: string;
  ruleDescription: string;
  articleRef: "Art. 19 DORA + Rgto. Delegado (UE) 2025/301";
}

export interface MultiregimeClocks {
  ria?: RiaClockResult;
  gdpr?: GdprClockResult;
  dora?: DoraClockResult;
}

/**
 * Calcula el plazo estricto del Art. 73 RIA:
 * - Ordinario: vínculo causal O probabilidad razonable de él, y máx. 15 días naturales (360h)
 * - Infracción generalizada o alteración de infraestructuras críticas (art. 3.49.b): máx. 2 días (48h)
 * - Fallecimiento: Inmediatamente y máx. 10 días (240h)
 */
export function calculateRiaDeadline(
  knowledgeDate: Date | string,
  incidentType: RiaIncidentSeverity = "ORDINARY_SERIOUS"
): RiaClockResult {
  const base = new Date(knowledgeDate);
  let hours = 360; // 15 días * 24h
  // El 73.1 es el deber de notificar; los quince días están en el 73.2.
  let articleRef: "Art. 73.2" | "Art. 73.3" | "Art. 73.4" = "Art. 73.2";
  let ruleDescription =
    "Notificación inmediata después de establecer un vínculo causal entre el sistema de IA y el " +
    "incidente grave, o la probabilidad razonable de que exista dicho vínculo, y a más tardar 15 días " +
    "naturales desde que se tenga conocimiento. El plazo tiene en cuenta la magnitud del incidente.";

  if (incidentType === "WIDESPREAD_INFRINGEMENT") {
    hours = 48; // 2 días
    articleRef = "Art. 73.3";
    ruleDescription = "Notificación inmediata y a más tardar 2 días naturales (infracción generalizada o alteración grave e irreversible de infraestructuras críticas, art. 3.49.b).";
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
    // El reloj de 72 h es del art. 33 en todo caso. El art. 34 (comunicación al
    // interesado) es «sin dilación indebida» y NO tiene plazo de 72 h: etiquetar
    // con él este reloj atribuía a un artículo un plazo que no contiene.
    articleRef: "Art. 33",
    dataSubjectNoticeArticleRef: highRiskToIndividuals ? "Art. 34" : undefined,
  };
}

/** Suma un mes natural en UTC, recortando al último día del mes destino. */
function addOneMonthUtc(from: Date): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const ultimoDiaDestino = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m + 1, Math.min(d, ultimoDiaDestino),
      from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()),
  );
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
  // Un mes natural, no 30 días. `setMonth(+1)` a secas NO sirve: desborda hacia
  // adelante (31 ene → 3 mar, tres días DESPUÉS del mes natural) y opera en hora
  // local, de modo que dos usuarios en husos distintos verían vencimientos
  // distintos del mismo incidente. Se hace en UTC y se recorta al último día
  // del mes destino.
  const finalDeadline = addOneMonthUtc(intermediateDeadline);

  // Horas EFECTIVAS desde el conocimiento hasta el vencimiento elegido. No es
  // el plazo legal (4 h desde clasificación / tope 24 h): con una clasificación
  // a k+30 min el vencimiento cae a k+4,5 h. Antes era el literal 4 aunque la
  // fecha fuera k+24 h, y los dos campos se contradecían.
  const initialHoursFromKnowledge =
    (initialDeadline.getTime() - kDate.getTime()) / 3_600_000;
  // Qué regla ha mandado, que es lo que el usuario necesita saber.
  const initialRule: "4H_FROM_CLASSIFICATION" | "24H_CAP_FROM_KNOWLEDGE" =
    deadline4h < deadline24h ? "4H_FROM_CLASSIFICATION" : "24H_CAP_FROM_KNOWLEDGE";

  return {
    regime: "DORA",
    authority: "DGSFP / Banco de España / BCE",
    initialDeadlineHours: initialHoursFromKnowledge,
    initialRule,
    initialDeadlineDate: initialDeadline.toISOString(),
    intermediateDeadlineHours: 72,
    intermediateDeadlineDate: intermediateDeadline.toISOString(),
    finalDeadlineDate: finalDeadline.toISOString(),
    // Los hitos intermedio y final se encadenan sobre el VENCIMIENTO del
    // anterior, no sobre su envío real, que esta función no conoce. Son por
    // tanto los últimos permisibles asumiendo que cada informe se presenta
    // justo en plazo; con envíos anteriores, los reales son antes.
    assumesPriorReportsAtDeadline: true,
    ruleDescription:
      "Notificación inicial en 4 h desde la clasificación (tope 24 h desde el conocimiento), " +
      "informe intermedio en 72 h e informe final en un mes.",
    articleRef: "Art. 19 DORA + Rgto. Delegado (UE) 2025/301",
  };
}

/**
 * Coordina y deriva los regímenes que deben activarse para un incidente de IA.
 */
export function evaluateMultiregimeIncident(params: {
  knowledgeDate: Date | string;
  classificationDate?: Date | string;
  isAiRelated: boolean;
  isAiHighRisk?: boolean;
  riaSeverity?: RiaIncidentSeverity;
  affectsPersonalData?: boolean;
  isHighRiskToSubjects?: boolean;
  isIctRelated?: boolean;
  affectsCriticalFunction?: boolean;
}): MultiregimeClocks {
  const result: MultiregimeClocks = {};

  // 1. Régimen RIA — el art. 73 alcanza a sistemas de ALTO RIESGO. Antes
  //    `isAiHighRisk` se declaraba y no se usaba: todo incidente activaba el
  //    plazo. Ahora se omite SÓLO si consta que no es de alto riesgo; con la
  //    clasificación sin registrar se muestra ADVERTIDO, porque ocultar un
  //    plazo que puede aplicar es peor que mostrarlo con la cautela.
  if (params.isAiRelated && params.isAiHighRisk !== false) {
    result.ria = {
      ...calculateRiaDeadline(params.knowledgeDate, params.riaSeverity || "ORDINARY_SERIOUS"),
      highRiskUnconfirmed: params.isAiHighRisk === undefined,
    };
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
    result.dora = calculateDoraDeadlines(params.knowledgeDate, params.classificationDate);
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

/**
 * Zona horaria en la que se PINTAN los plazos.
 *
 * El cálculo de esta librería es absoluto: aritmética sobre `getTime()` y
 * `Date.UTC`, salida en `toISOString()`. No depende de la zona del proceso.
 * El renderizado sí dependía: `toLocaleString("es-ES")` sin `timeZone` usa la
 * zona de quien mira, y `toLocaleDateString` —solo fecha— desplaza el DÍA
 * cuando el vencimiento cae cerca de medianoche UTC. Un plazo del art. 33 RGPD
 * mostrado un día tarde no es un detalle cosmético.
 *
 * Se fija a Europe/Madrid porque los plazos que cuenta esta pantalla son de
 * norma española y europea, y su hora civil de referencia es ésa. Fijarla tiene
 * un segundo efecto: elimina la dimensión del entorno, así que el resultado ya
 * se puede asertar en un test — `bun test` corre en UTC y la aplicación en
 * Europe/Madrid, y sin `timeZone` explícito ninguna aserción sobre la salida
 * podría cubrir ese eje.
 */
export const DEADLINE_TIME_ZONE = "Europe/Madrid";

/** Vencimiento con fecha y hora, siempre en la misma zona y rotulada. */
export function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("es-ES", {
    timeZone: DEADLINE_TIME_ZONE,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })} (hora peninsular)`;
}

/**
 * Fecha (sin hora) en la misma zona que los vencimientos.
 *
 * `reported_at` es la fecha de conocimiento DE LA QUE se calculan los plazos:
 * pintarla en la zona del navegador mientras el vencimiento va en hora
 * peninsular dejaría las dos fechas en marcos distintos, y la incoherencia
 * saltaría justo en los casos de medianoche, que son los que importan.
 */
export function formatIncidentDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    timeZone: DEADLINE_TIME_ZONE,
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}
