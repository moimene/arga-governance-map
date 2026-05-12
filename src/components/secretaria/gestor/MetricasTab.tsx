/**
 * MetricasTab — Indicadores leading/lagging del ciclo de vida de plantillas.
 *
 * Adaptado de `PlantillasTracker.tsx` (líneas 84–280) para vivir como tab
 * dentro de la consola unificada. Reutiliza `KpiCard` y `AlertBanner` de
 * `components/secretaria/gestor`.
 *
 * Sprint 1 — Task 5.4 (migrado).
 */
import { FileText } from "lucide-react";
import { usePlantillasMetrics } from "@/hooks/usePlantillasMetrics";
import { KpiCard } from "./KpiCard";
import { AlertBanner } from "./AlertBanner";

const STATUS_BADGE: Record<string, string> = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  REVISADA: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  APROBADA: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  ACTIVA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  DEPRECADA: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

export function MetricasTab() {
  const { data: metrics, isLoading } = usePlantillasMetrics();

  const plantillas = metrics?.plantillas ?? [];
  const alertas = metrics?.alertas ?? [];
  const leading = metrics?.leading ?? {
    velocidadRedaccion: 0,
    ratioRetroceso: 0,
    brechaDisponibilidad: 0,
    tiempoEnEstado: {} as Record<string, number>,
    coberturaModos: 0,
  };
  const lagging = metrics?.lagging ?? {
    totalActivas: 0,
    totalBorradores: 0,
    totalAprobadas: 0,
  };

  return (
    <div className="space-y-6">
      {alertas.length > 0 ? (
        <div className="space-y-2" aria-label="Alertas de métricas">
          {alertas.map((alert, idx) => (
            <AlertBanner
              key={`metric-alert-${idx}`}
              tipo={alert.tipo}
              mensaje={alert.mensaje}
            />
          ))}
        </div>
      ) : null}

      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-4 w-4" aria-hidden="true" />
          Secretaría · Métricas
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Seguimiento de plantillas
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--g-text-secondary)]">
          Indicadores leading y lagging del ciclo de vida de plantillas protegidas: velocidad
          de redacción, cobertura de modos de adopción y disponibilidad.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total activas"
          value={isLoading ? "…" : (lagging.totalActivas ?? 0)}
          tone={lagging.totalActivas > 0 ? "success" : "neutral"}
          sublabel="Plantillas en producción"
        />
        <KpiCard
          label="Cobertura modos"
          value={
            isLoading
              ? "…"
              : leading.coberturaModos
                ? `${(leading.coberturaModos * 100).toFixed(0)}%`
                : "0%"
          }
          tone={leading.coberturaModos >= 0.8 ? "success" : "warning"}
          sublabel="MEETING, UNIVERSAL, NO_SESSION…"
        />
        <KpiCard
          label="Brecha disponibilidad"
          value={
            isLoading
              ? "…"
              : leading.brechaDisponibilidad
                ? `${(leading.brechaDisponibilidad * 100).toFixed(0)}%`
                : "0%"
          }
          tone={leading.brechaDisponibilidad > 0.5 ? "warning" : "success"}
          sublabel="% no activas"
        />
        <KpiCard
          label="Velocidad redacción"
          value={isLoading ? "…" : (leading.velocidadRedaccion ?? 0)}
          tone="primary"
          sublabel="Días promedio a aprobación"
        />
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Modo adopción
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Días en estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Última actualización
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]"
                >
                  Cargando…
                </td>
              </tr>
            ) : plantillas.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]"
                >
                  Sin plantillas.
                </td>
              </tr>
            ) : (
              plantillas.map((p) => {
                const tiempoEnEstado = leading.tiempoEnEstado?.[p.id] ?? 0;
                const lastUpdate = p.fecha_aprobacion || p.created_at;
                const lastUpdateDate = new Date(lastUpdate);

                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                      {p.tipo}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex px-2.5 py-1 text-[11px] font-medium ${
                          STATUS_BADGE[p.estado] ||
                          "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {p.adoption_mode ? p.adoption_mode : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {tiempoEnEstado} días
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {lastUpdateDate.toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && plantillas.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
          <div className="bg-[var(--g-surface-subtle)] p-4" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">
              {lagging.totalBorradores}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              En borrador
            </div>
          </div>
          <div className="bg-[var(--g-surface-subtle)] p-4" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">
              {lagging.totalAprobadas}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              Aprobadas
            </div>
          </div>
          <div className="bg-[var(--g-surface-subtle)] p-4" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="text-2xl font-bold text-[var(--g-brand-3308)]">
              {plantillas.length}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              Totales
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
