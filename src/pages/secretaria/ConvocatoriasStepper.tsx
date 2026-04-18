import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { checkNoticePeriodByType } from "@/hooks/useJurisdiccionRules";

const STEPS = [
  { n: 1, label: "Tipo y órgano",            hint: "Seleccionar tipo de reunión y órgano convocante" },
  { n: 2, label: "Fecha y plazo legal",       hint: "Calcular antelación según jurisdicción y forma jurídica" },
  { n: 3, label: "Orden del día",             hint: "Clasificar ítems en ordinaria / estatutaria / estructural" },
  { n: 4, label: "Destinatarios",             hint: "Seleccionar miembros del órgano o socios" },
  { n: 5, label: "Canales de publicación",    hint: "BORME / PSM / JORNAL / web corporativa" },
  { n: 6, label: "Adjuntos",                  hint: "Documentos de referencia y propuestas" },
  { n: 7, label: "Revisión y emisión",        hint: "Verificación de compliance y cierre" },
];

// Datos de formulario demo — en producción vendrían del estado del stepper
const DEMO_FORM = {
  meeting_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // +10 días desde hoy
  jurisdiction: "ES",
  meeting_type: "ORDINARIA" as "ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL",
};

export default function ConvocatoriasStepper() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcular si el plazo está cumplido (solo relevante en paso 7)
  const noticeOk = checkNoticePeriodByType({
    meetingDate: DEMO_FORM.meeting_date,
    jurisdiction: DEMO_FORM.jurisdiction,
    convocationType: DEMO_FORM.meeting_type,
  });

  function handleEmitir() {
    if (!noticeOk || isSubmitting) return;
    setIsSubmitting(true);
    // En producción: llamada a Supabase para crear/actualizar la convocatoria
    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/secretaria/convocatorias");
    }, 1000);
  }

  const isLastStep = current === STEPS.length;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/convocatorias")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Nueva convocatoria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de convocatoria
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Stepper rail */}
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setCurrent(s.n)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : active
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {current}. {STEPS[current - 1].label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {STEPS[current - 1].hint}
          </p>

          <div
            className="mt-6 border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <p className="text-sm text-[var(--g-text-primary)]">
              {isLastStep
                ? "Revisa los datos de la convocatoria antes de emitirla. El sistema validará el plazo mínimo según la jurisdicción seleccionada."
                : `Formulario del paso ${current} — implementación pendiente. En el demo se usan las convocatorias ya sembradas (CONV-001, CONV-002, CONV-003).`}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>

            {isLastStep ? (
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  disabled={!noticeOk || isSubmitting}
                  onClick={handleEmitir}
                  aria-busy={isSubmitting}
                  className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {isSubmitting ? "Emitiendo…" : "Emitir convocatoria"}
                </button>
                {!noticeOk && (
                  <p className="text-xs text-[var(--status-error)]">
                    El plazo mínimo de convocatoria no está cumplido para la jurisdicción seleccionada.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCurrent((n) => Math.min(STEPS.length, n + 1))}
                className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
