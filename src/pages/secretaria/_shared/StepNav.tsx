import { Check } from "lucide-react";

/**
 * ITEM-125 — Navegación de stepper compartida.
 *
 * Antes coexistían tres copias del esqueleto de navegación:
 *  - el rail lateral de StepperShell (F1: Reunión, DecisiónUnipersonal, Tramitador),
 *  - un rail casi idéntico copiado a mano en F2 (AcuerdoSinSesión, CoAprobación, Solidario),
 *  - píldoras horizontales <ol> copiadas en F3 (AnadirSocio, Transmisión, DesignarAdmin…).
 *
 * Se consolidan en dos presentaciones — `StepRail` (vertical) y `StepPills`
 * (horizontal) — que comparten el mismo contrato de política de navegación: el
 * caller decide con `canNavigateTo(n)` a qué pasos se puede saltar. Así la política
 * (atrás libre / adelante bloqueado por gate / congelado tras una acción) vive en
 * cada flujo sin duplicar el marcado.
 */

export interface StepNavStep {
  /** Identificador ordinal del paso (1-based en F1/F2, 0-based en las píldoras F3). */
  n: number;
  label: string;
}

interface StepNavProps {
  steps: StepNavStep[];
  /** `n` del paso activo. */
  current: number;
  /** Política inyectada: ¿se puede navegar pulsando este paso? El paso activo siempre es navegable. */
  canNavigateTo: (n: number) => boolean;
  onNavigate: (n: number) => void;
  /** Texto del tooltip cuando un paso no es navegable. */
  lockedTitle?: string;
}

/** Rail vertical (F1/F2). Preserva el marcado exacto del StepperShell original. */
export function StepRail({
  steps,
  current,
  canNavigateTo,
  onNavigate,
  lockedTitle = "Complete el paso bloqueante antes de continuar",
}: StepNavProps) {
  return (
    <nav
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      aria-label="Pasos"
    >
      {steps.map((s) => {
        const done = s.n < current;
        const active = s.n === current;
        const navigable = active || canNavigateTo(s.n);
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => {
              if (navigable && !active) onNavigate(s.n);
            }}
            disabled={!navigable}
            title={!navigable ? lockedTitle : undefined}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                : !navigable
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
  );
}

interface StepPillsProps {
  steps: StepNavStep[];
  current: number;
  /**
   * Modo clicable-guardado (opcional). Si se omite, las píldoras son solo
   * indicador visual (no navegables), como las copias display-only de F3.
   * Si se pasa, las píldoras se vuelven botones gateados por `canNavigateTo`.
   */
  canNavigateTo?: (n: number) => boolean;
  onNavigate?: (n: number) => void;
  /** Layout del contenedor <ol>. `flex` (por defecto) o `scroll` (overflow-x para wizards largos). */
  layout?: "flex" | "scroll";
}

/** Píldoras horizontales (F3). Display-only por defecto; clicable-guardado si se pasa onNavigate+canNavigateTo. */
export function StepPills({
  steps,
  current,
  canNavigateTo,
  onNavigate,
  layout = "flex",
}: StepPillsProps) {
  const interactive = Boolean(onNavigate && canNavigateTo);
  return (
    <ol
      className={
        layout === "scroll"
          ? "mb-6 flex gap-2 overflow-x-auto pb-1 text-xs"
          : "mb-6 flex items-center gap-2 text-xs"
      }
    >
      {steps.map((s) => {
        const active = s.n === current;
        const done = s.n < current;
        const navigable = interactive && !active && canNavigateTo!(s.n);
        const pillClass = `flex items-center gap-2 rounded-full px-3 py-1 ${
          active
            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
            : done
            ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
        }`;
        const content = (
          <span>
            {done ? <Check className="inline h-3 w-3" /> : s.n + 1}. {s.label}
          </span>
        );
        return (
          <li key={s.label} className={layout === "scroll" ? "shrink-0" : undefined}>
            {interactive ? (
              <button
                type="button"
                disabled={!navigable}
                onClick={() => {
                  if (navigable) onNavigate!(s.n);
                }}
                className={`${pillClass} ${navigable ? "cursor-pointer" : "cursor-default"}`}
              >
                {content}
              </button>
            ) : (
              <span className={pillClass}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
