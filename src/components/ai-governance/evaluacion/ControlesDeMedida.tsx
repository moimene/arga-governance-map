/**
 * Nivel de madurez, dificultad y —cuando toca— justificación de una medida.
 *
 * Es un componente y no JSX repetido porque lo usan las Medidas Guía **y** las
 * Medidas Adicionales. Mientras las MA no tuvieron estos controles no eran
 * evaluables: se añadían, se pintaban y se descartaban al enviar.
 *
 * Aquí viven además las clases de formulario compartidas por los cuatro pasos
 * del wizard: son una sola definición, no cuatro copias que divergen.
 */
import { MATURITY_LEVELS, DIFICULTAD_SIN_EVALUAR } from "@/lib/aims/catalog-aesia";
import { NIVEL_NO_APLICABLE, MOTIVO_L8_SIN_JUSTIFICAR } from "@/lib/aims/evaluacion-payload";

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

/**
 * Plan de adaptación resultante del nivel de madurez. Lo pintan la medida guía
 * y la medida adicional: una sola definición, porque son el mismo semáforo.
 */
export function BadgePlan({ code, label }: { code: string; label: string }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 text-xs font-bold ${
        code === "03" || code === "05"
          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
          : code === "01"
          ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
          : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
      }`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {label}
    </span>
  );
}

export type ControlesDeMedidaProps = {
  state: MeasureEvaluationState;
  onChange: (key: keyof MeasureEvaluationState, value: string) => void;
};

export default function ControlesDeMedida({ state, onChange }: ControlesDeMedidaProps) {
  const matMeta = MATURITY_LEVELS[state.maturity];
  const l8SinMotivo = state.maturity === NIVEL_NO_APLICABLE && !state.justification.trim();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--g-border-subtle)]">
        <div>
          <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
            Nivel de madurez (escala L1–L8)
          </label>
          <select
            value={state.maturity}
            onChange={(e) => onChange("maturity", e.target.value)}
            className={SELECT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Sin evaluar</option>
            {Object.values(MATURITY_LEVELS).map((lvl) => (
              <option key={lvl.level} value={lvl.level}>
                {lvl.level}: {lvl.title} → {lvl.planLabel}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[var(--g-text-secondary)] mt-1 italic">
            {matMeta?.description}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
            Dificultad de implementación
          </label>
          <select
            value={state.difficulty}
            onChange={(e) => onChange("difficulty", e.target.value)}
            className={SELECT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {/* Sin preselección: venía en «media» y las 84 medidas nacían
                graduadas por nadie. Y sin el código numérico, que va al revés
                de la intuición (`00` = alta) y se leía como escala. */}
            <option value={DIFICULTAD_SIN_EVALUAR}>Sin evaluar</option>
            <option value="02">Baja</option>
            <option value="01">Media</option>
            <option value="00">Alta</option>
          </select>
        </div>
      </div>

      {state.maturity === NIVEL_NO_APLICABLE && (
        <div className="p-3 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--g-brand-3308)] space-y-1.5">
          <label className="block text-xs font-bold text-[var(--g-text-primary)]">
            Justificación técnica obligatoria *
          </label>
          <input
            type="text"
            value={state.justification}
            onChange={(e) => onChange("justification", e.target.value)}
            placeholder="Explicar por qué esta medida no resulta necesaria para este sistema..."
            className={INPUT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-invalid={l8SinMotivo}
          />
          {l8SinMotivo && (
            <p className="text-[11px] font-semibold text-[var(--status-error)]">
              {MOTIVO_L8_SIN_JUSTIFICAR}: sin el motivo, esta medida no acredita conformidad y no
              suma al porcentaje.
            </p>
          )}
        </div>
      )}
    </>
  );
}
