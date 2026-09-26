/**
 * Cálculo ÚNICO de los plazos DORA (art. 19 + Reglamento Delegado (UE)
 * 2025/301) y RGPD (art. 33) compartido por AIMS (`src/lib/aims/incident-clocks.ts`)
 * y GRC (`src/lib/grc/regulatory-clocks.ts`). MOI-215.
 *
 * Antes de esto había DOS cálculos independientes que ya no daban lo mismo:
 * AIMS resolvía la inicial sin clasificar a k+4h (trataba la fecha de
 * conocimiento como si fuera la de clasificación) y GRC la resolvía a k+24h.
 * Sólo hay un lugar que decide esta aritmética; quien la necesite lo importa.
 *
 * LECTURA PROVISIONAL (MOI-215 D-17, por delegación de Moisés al orquestador,
 * 2026-09-26) — PENDIENTE de confirmación del equipo legal en MOI-163:
 *   - Sin clasificación formal todavía: el tope es 24h desde el conocimiento.
 *   - Clasificado: 4h desde la clasificación, y nunca más tarde que el tope
 *     de 24h desde el conocimiento (lo primero que ocurra manda).
 * Es la lectura técnica "(b)" del análisis 2026-09-20. Si el Comité Legal
 * fija otra lectura en MOI-163, el cambio se hace aquí, en un solo sitio.
 */
export const DORA_INITIAL_DEADLINE_READING_PENDING_LEGAL_CONFIRMATION = true as const;

export type DoraInitialDeadlineRule = "4H_FROM_CLASSIFICATION" | "24H_CAP_FROM_KNOWLEDGE";

export interface DoraDeadlineMilestones {
  /** Qué regla ha determinado el vencimiento inicial. */
  initialRule: DoraInitialDeadlineRule;
  initialDeadline: Date;
  intermediateDeadline: Date;
  finalDeadline: Date;
}

/** Suma un mes natural en UTC, recortando al último día del mes destino. */
export function addOneMonthUtc(from: Date): Date {
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
 * Los tres hitos DORA (inicial, intermedio a +72h, final a +1 mes natural UTC).
 * `classificationDate` ausente = incidente aún no clasificado: manda el tope
 * de 24h desde el conocimiento (lectura provisional de arriba).
 */
export function computeDoraDeadlineMilestones(
  knowledgeDate: Date | string,
  classificationDate?: Date | string | null,
): DoraDeadlineMilestones {
  const kDate = new Date(knowledgeDate);
  const cap24hFromKnowledge = new Date(kDate.getTime() + 24 * 3_600_000);

  let initialDeadline: Date;
  let initialRule: DoraInitialDeadlineRule;
  if (classificationDate) {
    const deadline4hFromClassification = new Date(new Date(classificationDate).getTime() + 4 * 3_600_000);
    if (deadline4hFromClassification < cap24hFromKnowledge) {
      initialDeadline = deadline4hFromClassification;
      initialRule = "4H_FROM_CLASSIFICATION";
    } else {
      initialDeadline = cap24hFromKnowledge;
      initialRule = "24H_CAP_FROM_KNOWLEDGE";
    }
  } else {
    initialDeadline = cap24hFromKnowledge;
    initialRule = "24H_CAP_FROM_KNOWLEDGE";
  }

  const intermediateDeadline = new Date(initialDeadline.getTime() + 72 * 3_600_000);
  const finalDeadline = addOneMonthUtc(intermediateDeadline);

  return { initialRule, initialDeadline, intermediateDeadline, finalDeadline };
}

/** Reloj de 72h del art. 33 RGPD, desde el conocimiento. */
export function computeGdprAuthorityDeadline(knowledgeDate: Date | string): Date {
  return new Date(new Date(knowledgeDate).getTime() + 72 * 3_600_000);
}
