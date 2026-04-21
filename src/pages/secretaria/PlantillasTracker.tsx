import { AlertTriangle, TrendingUp, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { usePlantillasMetrics } from "@/hooks/usePlantillasMetrics";

const STATUS_BADGE: Record<string, string> = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  REVISADA: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  APROBADA: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  ACTIVA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  DEPRECADA: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function AlertBanner({
  tipo,
  mensaje,
}: {
  tipo: "WARNING" | "ERROR";
  mensaje: string;
}) {
  const bgColor =
    tipo === "ERROR"
      ? "bg-[var(--status-error)]"
      : "bg-[var(--status-warning)]";
  const Icon = tipo === "ERROR" ? AlertTriangle : AlertCircle;

  return (
    <div className={`${bgColor} flex items-center gap-3 px-4 py-3 text-[var(--g-text-inverse)]`}>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium">{mensaje}</span>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "primary",
  sublabel,
}: {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "neutral";
  sublabel?: string;
}) {
  const iconColor =
    tone === "warning"
      ? "text-[var(--status-warning)]"
      : tone === "success"
        ? "text-[var(--status-success)]"
        : tone === "neutral"
          ? "text-[var(--g-text-secondary)]"
          : "text-[var(--g-brand-3308)]";

  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? AlertTriangle
        : TrendingUp;

  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{
        borderRadius: "var(--g-radius-lg)",
        boxShadow: "var(--g-shadow-card)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-widest text-[var(--g-text-secondary)]">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="text-3xl font-bold text-[var(--g-text-primary)] mb-1">
        {typeof value === "number" && value >= 1 ? value : typeof value === "number" ? `${(value * 100).toFixed(0)}%` : value}
      </div>
      {sublabel && (
        <div className="text-xs text-[var(--g-text-secondary)]">{sublabel}</div>
      )}
    </div>
  );
}

export default function PlantillasTracker() {
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
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Alerts */}
      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((alert, idx) => (
            <AlertBanner key={idx} tipo={alert.tipo} mensaje={alert.mensaje} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-4 w-4" />
          Secretaría · Métricas
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Seguimiento de plantillas
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--g-text-secondary)]">
          Indicadores leading y lagging de ciclo de vida de plantillas protegidas: velocidad de
          redacción, cobertura de modos de adopción, y disponibilidad.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <KpiCard
          label="Total activas"
          value={isLoading ? "…" : lagging.totalActivas ?? 0}
          tone={lagging.totalActivas > 0 ? "success" : "neutral"}
          sublabel="Plantillas en producción"
        />
        <KpiCard
          label="Cobertura modos"
          value={
            isLoading ? "…" : leading.coberturaModos ? `${(leading.coberturaModos * 100).toFixed(0)}%` : "0%"
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
          value={isLoading ? "…" : leading.velocidadRedaccion ?? 0}
          tone="primary"
          sublabel="Días promedio a aprobación"
        />
      </div>

      {/* Table */}
      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{
          borderRadius: "var(--g-radius-lg)",
          boxShadow: "var(--g-shadow-card)",
        }}
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
            ) : !plantillas || plantillas.length === 0 ? (
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
                        className={`inline-flex px-2.5 py-1 text-[11px] font-medium ${STATUS_BADGE[p.estado] || "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"}`}
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

      {/* Footer stats */}
      {!isLoading && plantillas.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
          <div className="rounded bg-[var(--g-surface-subtle)] p-4">
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">
              {lagging.totalBorradores}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              En borrador
            </div>
          </div>
          <div className="rounded bg-[var(--g-surface-subtle)] p-4">
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">
              {lagging.totalAprobadas}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              Aprobadas
            </div>
          </div>
          <div className="rounded bg-[var(--g-surface-subtle)] p-4">
            <div className="text-2xl font-bold text-[var(--g-brand-3308)]">
              {plantillas.length}
            </div>
            <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
              Totales
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
