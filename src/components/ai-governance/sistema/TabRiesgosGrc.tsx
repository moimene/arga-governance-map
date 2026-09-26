import { AlertOctagon } from "lucide-react";
import { mensajeUsuario } from "@/lib/aims/errores-rpc";
import { COLOR_BANDA, ETIQUETA_BANDA } from "@/lib/grc/assessed-band";
import type { RiskRow } from "@/hooks/useRisks";

/**
 * Riesgos de GRC enlazados a este sistema (`risks.ai_system_id`, MOI-164).
 *
 * SOLO LECTURA. GRC sigue siendo el owner del riesgo: esta pestaña no
 * enlaza, no edita y no crea — pinta lo que `risks.ai_system_id` ya
 * declara. El enlace es manual y solo existe donde la descripción del
 * riesgo nombra un único sistema con certeza; la mayoría de los riesgos de
 * IA de ARGA no lo tienen (declarado en el issue: MOI-164).
 */
export interface TabRiesgosGrcProps {
  riesgos: RiskRow[];
  /** Error de la consulta: «no se pudo leer» no es «no hay». */
  error?: unknown;
}

export default function TabRiesgosGrc({ riesgos, error }: TabRiesgosGrcProps) {
  return (
    <div
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="border-b border-[var(--g-border-subtle)] pb-3">
        <h2 className="text-base font-bold text-[var(--g-text-primary)]">Riesgos de GRC enlazados</h2>
        <p className="text-xs text-[var(--g-text-secondary)]">
          Riesgo de GRC Compass sobre este sistema, en solo lectura. Se gestiona y evalúa desde
          GRC; esta ficha no lo crea ni lo edita.
        </p>
      </div>

      {error ? (
        <p className="text-xs font-semibold text-[var(--g-text-secondary)] py-4 text-center">
          No se pudo leer los riesgos enlazados ({mensajeUsuario(error)}).
        </p>
      ) : riesgos.length === 0 ? (
        <p className="text-xs text-[var(--g-text-secondary)] italic py-4 text-center">
          Ningún riesgo de GRC está enlazado a este sistema.
        </p>
      ) : (
        <div className="space-y-3">
          {riesgos.map((riesgo) => (
            <div
              key={riesgo.id}
              data-riesgo-enlazado={riesgo.code}
              className="p-4 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] space-y-2 text-xs"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-[var(--g-text-secondary)]" />
                  <span className="font-bold text-sm text-[var(--g-text-primary)]">
                    {riesgo.code} — {riesgo.title}
                  </span>
                </div>
                {riesgo.assessed_band && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 font-semibold text-[10px] bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 border border-[var(--g-border-subtle)]"
                      style={{ backgroundColor: COLOR_BANDA[riesgo.assessed_band], borderRadius: "var(--g-radius-sm)" }}
                    />
                    {ETIQUETA_BANDA[riesgo.assessed_band]}
                  </span>
                )}
              </div>
              {riesgo.description && (
                <p className="text-[var(--g-text-secondary)]">{riesgo.description}</p>
              )}
              <div className="text-[var(--g-text-secondary)]">
                Estado: <span className="font-semibold text-[var(--g-text-primary)]">{riesgo.status ?? "N/D"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
