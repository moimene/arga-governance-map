import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRegistrarIndicador, type AimsMonitoringIndicator } from "@/hooks/useAimsTechnicalFile";
import { normalizeAimsStatus } from "@/lib/aims/vocabulario";

/**
 * Vigilancia poscomercialización (art. 72 RIA).
 *
 * El chip salía de una igualdad estricta con `OPTIMAL`, un literal que NADIE
 * escribe: la columna tiene `DEFAULT 'OK'`, así que un indicador que dice que
 * todo va bien se pintaba en ámbar, como problema. Sólo se enumera el
 * vocabulario que consta; lo desconocido cae a NEUTRO y nunca a ámbar, porque
 * un estado que no se sabe leer no es una alerta.
 */

export interface TabVigilanciaProps {
  systemId: string;
  indicators: AimsMonitoringIndicator[];
}

const CHIP_INDICADOR: Record<string, string> = {
  OK: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  OPTIMAL: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};
const CHIP_NEUTRO =
  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

const CAMPO =
  "w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]";
const ETIQUETA_CAMPO = "block font-semibold text-[var(--g-text-primary)] mb-1";

export default function TabVigilancia({ systemId, indicators }: TabVigilanciaProps) {
  const registrar = useRegistrarIndicador();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [metrica, setMetrica] = useState("");
  const [observado, setObservado] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrar.mutateAsync({
        systemId,
        indicatorName: nombre.trim(),
        metricKey: metrica.trim() || null,
        lastObservedAt: observado ? new Date(observado).toISOString() : null,
      });
      toast.success("Indicador registrado.");
      setAbierto(false);
      setNombre("");
      setMetrica("");
      setObservado("");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`No se pudo registrar el indicador: ${msg}`);
    }
  };

  return (
    <div
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
        <div>
          <h2 className="text-base font-bold text-[var(--g-text-primary)]">
            Vigilancia Poscomercialización & Indicadores de Rendimiento (Art. 72 RIA)
          </h2>
          <p className="text-xs text-[var(--g-text-secondary)]">
            Monitorización continua de deriva (drift), precisión, latencia y equidad algorítmica.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Registrar indicador</span>
        </button>
      </div>

      {abierto && (
        <form
          onSubmit={guardar}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div>
            <label htmlFor="ind-nombre" className={ETIQUETA_CAMPO}>Nombre del indicador *</label>
            <input
              id="ind-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div>
            <label htmlFor="ind-metrica" className={ETIQUETA_CAMPO}>Clave de métrica</label>
            <input
              id="ind-metrica"
              value={metrica}
              onChange={(e) => setMetrica(e.target.value)}
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div>
            <label htmlFor="ind-observado" className={ETIQUETA_CAMPO}>Última observación</label>
            <input
              id="ind-observado"
              type="date"
              value={observado}
              onChange={(e) => setObservado(e.target.value)}
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <span className="mr-auto text-[var(--g-text-secondary)]">
              Se registra en estado OK, el único que la tabla escribe. Sin medición y sin umbral: se
              declaran después.
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] font-medium"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={registrar.isPending}
              aria-busy={registrar.isPending}
              className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] font-medium disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {registrar.isPending ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </form>
      )}

      {indicators.length === 0 ? (
        <p className="text-xs text-[var(--g-text-secondary)] italic py-4 text-center">
          No hay indicadores de monitorización configurados para este sistema.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {indicators.map((ind) => (
            <div
              key={ind.id}
              className="p-4 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] space-y-2 text-xs"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex justify-between items-start">
                <span className="font-bold text-sm text-[var(--g-text-primary)]">{ind.indicator_name}</span>
                <span
                  className={`px-2 py-0.5 font-semibold text-[10px] ${CHIP_INDICADOR[normalizeAimsStatus(ind.status)] ?? CHIP_NEUTRO}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {ind.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[var(--g-text-secondary)] pt-1">
                <div>
                  Métrica: <span className="font-semibold text-[var(--g-text-primary)]">{ind.metric_key || "N/D"}</span>
                </div>
                <div>
                  Umbral:{" "}
                  <span className="font-mono text-[var(--g-text-primary)]">
                    {ind.threshold_config ? JSON.stringify(ind.threshold_config) : "No definido"}
                  </span>
                </div>
                <div>
                  Valor actual:{" "}
                  <span className="font-bold text-[var(--g-brand-3308)]">
                    {ind.current_value == null
                      ? "Sin medición"
                      : typeof ind.current_value === "object"
                      ? JSON.stringify(ind.current_value)
                      : String(ind.current_value)}
                  </span>
                </div>
                <div>
                  Última observación:{" "}
                  <span className="text-[var(--g-text-primary)]">
                    {ind.last_observed_at
                      ? new Date(ind.last_observed_at).toLocaleDateString("es-ES")
                      : "Sin observaciones"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
