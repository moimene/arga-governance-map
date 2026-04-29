import { useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";

export interface StepDef {
  n: number;
  label: string;
  hint: string;
  /** Opcional: contenido custom del paso; si no, se renderiza placeholder. */
  body?: ReactNode;
  /** Cuando es false, bloquea el avance al siguiente paso. */
  canAdvance?: boolean;
}

interface StepperShellProps {
  eyebrow: string;
  title: string;
  backTo: string;
  steps: StepDef[];
  placeholderNote?: string;
}

export function StepperShell({
  eyebrow,
  title,
  backTo,
  steps,
  placeholderNote,
}: StepperShellProps) {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const [current, setCurrent] = useState(1);
  const firstBlockedStep = useMemo(
    () => [...steps].sort((a, b) => a.n - b.n).find((step) => step.canAdvance === false) ?? null,
    [steps],
  );

  useEffect(() => {
    if (firstBlockedStep && current > firstBlockedStep.n) {
      setCurrent(firstBlockedStep.n);
    }
  }, [current, firstBlockedStep]);

  const currentStep = steps.find((s) => s.n === current) ?? steps[0];
  const nextBlockedByGate = currentStep?.canAdvance === false;
  const nextDisabled = current === steps.length || nextBlockedByGate;
  const nextTitle = nextBlockedByGate
    ? "Resuelve el bloqueo antes de continuar"
    : undefined;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scope.createScopedTo(backTo))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {title}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {steps.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            const blockedByEarlierStep = Boolean(firstBlockedStep && s.n > firstBlockedStep.n);
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => {
                  if (!blockedByEarlierStep) setCurrent(s.n);
                }}
                disabled={blockedByEarlierStep}
                title={blockedByEarlierStep ? "Complete el paso bloqueante antes de continuar" : undefined}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : blockedByEarlierStep
                    ? "cursor-not-allowed text-[var(--g-text-secondary)] opacity-50"
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

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {currentStep.n}. {currentStep.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{currentStep.hint}</p>

          <div className="mt-6">
            {currentStep.body ?? (
              <div
                className="border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm text-[var(--g-text-primary)]">
                  {placeholderNote ??
                    `Formulario del paso ${currentStep.n} — implementación pendiente.`}
                </p>
              </div>
            )}
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
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.min(steps.length, n + 1))}
              disabled={nextDisabled}
              title={nextTitle}
              className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
