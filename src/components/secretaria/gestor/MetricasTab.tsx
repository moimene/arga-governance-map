/**
 * MetricasTab — Indicadores leading/lagging del ciclo de vida de plantillas.
 *
 * Adaptado de `PlantillasTracker.tsx` (líneas 84–280) para vivir como tab
 * dentro de la consola unificada. Reutiliza `KpiCard` y `AlertBanner` de
 * `components/secretaria/gestor`.
 *
 * Sprint 1 — Task 5.4 (migrado).
 */
import { AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { usePlantillasMetrics } from "@/hooks/usePlantillasMetrics";
import {
  estadoLabel,
  adoptionModeLabel,
  SEMANTIC_TONE_CLASS,
  templateStateTone,
  tipoLabel,
} from "@/lib/secretaria/template-admin";
import { KpiCard } from "./KpiCard";
import { AlertBanner } from "./AlertBanner";

function MetricsIntro() {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
        <FileText className="h-4 w-4" aria-hidden="true" />
        Secretaría · Indicadores de ciclo de vida
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--g-text-primary)]">
        Evolución del catálogo documental
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--g-text-secondary)]">
        Indicadores de actividad y resultado del ciclo de vida: velocidad de redacción,
        cobertura de formas de adopción y disponibilidad. Los días en estado y la última
        actualización son estimaciones construidas con las fechas disponibles; ganarán
        precisión cuando exista changelog histórico completo.
      </p>
    </div>
  );
}

export function MetricasTab() {
  const {
    data: metrics,
    error,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = usePlantillasMetrics();

  if (isError) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return (
      <div className="space-y-6">
        <MetricsIntro />
        <div
          className={`${SEMANTIC_TONE_CLASS.error} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center`}
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">No se pudieron cargar las métricas de plantillas.</p>
            <p className="mt-1 break-words text-xs text-[var(--g-text-secondary)]">{message}</p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-busy={isFetching}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isFetching ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      </div>
    );
  }

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

      <MetricsIntro />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total activas"
          value={isLoading ? "…" : (lagging.totalActivas ?? 0)}
          tone={lagging.totalActivas > 0 ? "success" : "neutral"}
          sublabel="Vigentes para nuevos expedientes"
        />
        {/* tone success solo con los 5 modos core cubiertos: en 4/5 la alerta
            de cobertura dispara y un KPI verde sería contradictorio */}
        <KpiCard
          label="Cobertura de modos (mínimo core)"
          value={
            isLoading
              ? "…"
              : leading.coberturaModos
                ? `${(leading.coberturaModos * 100).toFixed(0)}%`
                : "0%"
          }
          tone={leading.coberturaModos >= 1 ? "success" : "warning"}
          sublabel="Sesión formal, junta universal, acuerdo sin sesión, decisión de socio único y de administrador único"
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
        className="max-h-[36rem] overflow-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
        role="region"
        aria-label="Detalle de indicadores por plantilla"
        tabIndex={0}
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[720px]">
          <thead className="sticky top-0 z-10">
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
                      {tipoLabel(p.tipo)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex px-2.5 py-1 text-[11px] font-medium ${SEMANTIC_TONE_CLASS[templateStateTone(p.estado)]}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {estadoLabel(p.estado)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {adoptionModeLabel(p.adoption_mode, { tipo: p.tipo })}
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
