/**
 * Motor de Relojes Regulatorios Paralelos y Coordinación Multirrégimen
 * AIMS 360: EU AI Act (Art. 73) + RGPD (Arts. 33-34) + DORA (Art. 19 y Reglamento
 * Delegado (UE) 2025/301 — NO es un Real Decreto español, como decía esta
 * cabecera hasta 2026-09-05 contradiciendo al propio `DoraClockResult`.)
 * Conforme al dictamen de auditoría regulatoria de Harvey AI.
 *
 * MOI-215: la aritmética de los plazos DORA y RGPD (art. 33) ya NO se calcula
 * aquí — vive en `src/lib/regulatory-deadlines.ts`, único cálculo compartido
 * con GRC (`src/lib/grc/regulatory-clocks.ts`). Antes de esto, sin fecha de
 * clasificación esta función devolvía la inicial a k+4h (trataba el
 * conocimiento como si fuera la clasificación); GRC la devolvía a k+24h. Ver
 * la lectura PROVISIONAL documentada en ese módulo, pendiente de MOI-163.
 */
import {
  computeDoraDeadlineMilestones,
  computeGdprAuthorityDeadline,
} from "@/lib/regulatory-deadlines";

export type RiaIncidentSeverity = "ORDINARY_SERIOUS" | "WIDESPREAD_INFRINGEMENT" | "DEATH_INCIDENT";

/** Opciones de la tipología del art. 73 para alta y edición. `""` = no declarado (NULL). */
export const GRAVEDAD_RIA: { code: RiaIncidentSeverity | ""; label: string }[] = [
  { code: "", label: "No declarado" },
  { code: "ORDINARY_SERIOUS", label: "Incidente grave ordinario — 15 días (art. 73)" },
  { code: "WIDESPREAD_INFRINGEMENT", label: "Infracción generalizada — 2 días (art. 73)" },
  { code: "DEATH_INCIDENT", label: "Con resultado de fallecimiento — 10 días (art. 73)" },
];

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
  /**
   * No se declaró tipología del art. 73: el plazo se calcula como incidente
   * grave ordinario (15 días), que es el más largo de los tres. Se dice, porque
   * si fuera infracción generalizada o con fallecimiento el real es más corto.
   */
  severityPresumed?: boolean;
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
 * ¿Consta el sistema asociado clasificado de alto riesgo? TRES estados.
 *
 * `undefined` NO es `false`: `evaluateMultiregimeIncident` los distingue —con
 * `false` omite el reloj del art. 73, con `undefined` lo muestra marcado
 * `highRiskUnconfirmed`— y la pantalla dice cosas distintas en cada caso.
 *
 * La ficha de incidente calculaba esto con `/…/.test(risk_level ?? "")`, y
 * `RegExp.test` sólo devuelve booleanos: un sistema SIN clasificar producía
 * `false`, el reloj desaparecía y la ficha afirmaba que el sistema «consta
 * clasificado fuera del alto riesgo». Es la afirmación contraria a la verdad:
 * lo que consta es que no consta.
 */
export function altoRiesgoDeclarado(riskLevel: string | null | undefined): boolean | undefined {
  const v = (riskLevel ?? "").trim();
  if (v === "") return undefined;
  return /^(alto|high|inaceptable|unacceptable)$/i.test(v);
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
  const deadline = computeGdprAuthorityDeadline(knowledgeDate);

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

/**
 * Calcula los tres hitos DORA (art. 19 + Reglamento Delegado (UE) 2025/301)
 * delegando la aritmética en `computeDoraDeadlineMilestones` (MOI-215): un
 * solo cálculo, compartido con GRC. Lectura del vencimiento inicial sin
 * clasificar PROVISIONAL, pendiente de MOI-163 (ver ese módulo).
 */
export function calculateDoraDeadlines(
  knowledgeDate: Date | string,
  classificationDate?: Date | string
): DoraClockResult {
  const kDate = new Date(knowledgeDate);
  const { initialRule, initialDeadline, intermediateDeadline, finalDeadline } =
    computeDoraDeadlineMilestones(knowledgeDate, classificationDate);

  // Horas EFECTIVAS desde el conocimiento hasta el vencimiento elegido. No es
  // el plazo legal (4 h desde clasificación / tope 24 h): con una clasificación
  // a k+30 min el vencimiento cae a k+4,5 h.
  const initialHoursFromKnowledge =
    (initialDeadline.getTime() - kDate.getTime()) / 3_600_000;

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
      "Notificación inicial en 4 h desde la clasificación (tope 24 h desde el conocimiento; " +
      "lectura provisional pendiente de confirmación del equipo legal — MOI-163), " +
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
      severityPresumed: !params.riaSeverity,
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
