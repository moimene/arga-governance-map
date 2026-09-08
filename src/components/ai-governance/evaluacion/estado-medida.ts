/**
 * Estado de evaluación de una medida y clases de formulario compartidas por los
 * cuatro pasos del wizard. Fichero sin componentes a propósito: Fast Refresh
 * sólo funciona cuando un fichero exporta únicamente componentes.
 */
import { DIFICULTAD_SIN_EVALUAR } from "@/lib/aims/catalog-aesia";

export const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

export const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

export const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

export const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

export type MeasureEvaluationState = {
  /** `''` = sin evaluar. Antes nacía en `'01'` (media) sin que nadie graduara. */
  difficulty: string;
  maturity: string; // 'L1' - 'L8'
  justification: string;
};

export const ESTADO_VACIO: MeasureEvaluationState = {
  difficulty: DIFICULTAD_SIN_EVALUAR,
  maturity: "",
  justification: "",
};

