import { Link } from "react-router-dom";
import { Route } from "lucide-react";
import { AIMS_HANDOFFS } from "@/lib/aims/handoffs";

/**
 * Rutas de entrada a los módulos responsables. El dato viene de la hoja
 * `@/lib/aims/handoffs`: aquí sólo se pinta.
 */
export function HandoffAffordances() {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h3 className="text-xs font-semibold uppercase text-[var(--g-text-primary)]">
          Handoffs de solo lectura
        </h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--g-text-secondary)]">
        Rutas de entrada a módulos responsables. AIMS enruta contexto, no toma decisiones de GRC ni de Secretaría.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {AIMS_HANDOFFS.map((handoff) => (
          <Link
            key={handoff.id}
            to={handoff.targetRoute}
            className="block border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 transition-colors hover:border-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{handoff.label}</h3>
                  <span
                    className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {handoff.evidencePosture}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--g-text-secondary)]">
                  {handoff.trigger}. {handoff.targetOwner} conserva la decisión; AIMS solo enruta.
                </p>
                <p className="mt-2 font-mono text-[11px] text-[var(--g-text-secondary)]">{handoff.contractEvent}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
