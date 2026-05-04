import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, PlusCircle, Route, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useAiIncidentsList } from "@/hooks/useAiIncidents";
import { isAimsMaterialIncidentCandidate } from "@/lib/aims/readiness";
import { cn } from "@/lib/utils";

const SEVERITY_CHIP: Record<string, string> = {
  CRITICO: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  ALTO:    "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  MEDIO:   "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BAJO:    "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
};

const STATUS_CHIP: Record<string, string> = {
  ABIERTO:          "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/30",
  EN_INVESTIGACION: "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)] border border-[var(--status-warning)]/30",
  CERRADO:          "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/30",
};

const SEVERITY_LABEL: Record<string, string> = {
  CRITICO: "Crítico",
  ALTO: "Alto",
  MEDIO: "Medio",
  BAJO: "Bajo",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_INVESTIGACION: "En investigación",
  CERRADO: "Cerrado",
};

const SEVERITY_OPTIONS = [
  { value: "Todos", label: "Todas" },
  { value: "CRITICO", label: "Crítica" },
  { value: "ALTO", label: "Alta" },
  { value: "MEDIO", label: "Media" },
  { value: "BAJO", label: "Baja" },
];

const STATUS_OPTIONS = [
  { value: "Todos", label: "Todos" },
  { value: "ABIERTO", label: "Abiertos" },
  { value: "EN_INVESTIGACION", label: "En investigación" },
  { value: "CERRADO", label: "Cerrados" },
];

const FILTER_BUTTON =
  "px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-page)]";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function severityLabel(severity: string | null | undefined) {
  if (!severity) return "Sin severidad";
  return SEVERITY_LABEL[severity] ?? severity;
}

function incidentStatusLabel(status: string | null | undefined) {
  if (!status) return "Sin estado";
  return INCIDENT_STATUS_LABEL[status] ?? status;
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-[var(--g-text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              FILTER_BUTTON,
              value === option.value
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]",
            )}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AiIncidentes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [severityFilter, setSeverityFilter] = useState("Todos");
  const { data: incidents = [], isLoading } = useAiIncidentsList();

  const abiertos = incidents.filter((i) => i.status === "ABIERTO" || i.status === "EN_INVESTIGACION").length;
  const cerrados = incidents.filter((i) => i.status === "CERRADO").length;
  const materialCount = incidents.filter(isAimsMaterialIncidentCandidate).length;
  const filtered = incidents.filter((incident) => {
    const q = search.toLowerCase();
    const matchesSearch = !search || (
      incident.title.toLowerCase().includes(q) ||
      (incident.description?.toLowerCase().includes(q) ?? false) ||
      (incident.ai_systems?.name?.toLowerCase().includes(q) ?? false)
    );
    const matchesStatus = statusFilter === "Todos" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "Todos" || incident.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--status-error)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Incidentes IA</h1>
          </div>
          <p className="max-w-[72ch] text-sm text-[var(--g-text-secondary)]">
            Seguimiento operativo de eventos relevantes en sistemas IA, con derivación clara cuando GRC o Secretaría deben decidir.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/incidentes/nuevo")}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-page)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo incidente
        </button>
      </div>

      {/* Stats rápidas */}
      {!isLoading && incidents.length > 0 && (
        <section
          className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr]"
          aria-label="Estado de incidentes AIMS"
        >
          <div
            className="flex min-w-0 gap-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <ShieldAlert className="h-5 w-5 text-[var(--g-brand-3308)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--g-text-primary)]">Demo AIMS conectada</p>
              <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                AIMS registra la señal IA. GRC y Secretaría reciben contexto de solo lectura si el incidente es material.
              </p>
            </div>
          </div>
          {[
            { label: "Total incidentes", value: incidents.length, tone: "info" },
            { label: "Abiertos / En investigación", value: abiertos, tone: abiertos > 0 ? "error" : "success" },
            { label: "Materiales", value: materialCount, tone: materialCount > 0 ? "error" : "success" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-5 py-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className={`text-2xl font-bold ${
                stat.tone === "error"
                  ? "text-[var(--status-error)]"
                  : stat.tone === "success"
                  ? "text-[var(--status-success)]"
                  : "text-[var(--g-brand-3308)]"
              }`}>
                {stat.value}
              </div>
              <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">{stat.label}</div>
            </div>
          ))}
          <div className="sr-only">{cerrados} incidentes cerrados</div>
        </section>
      )}

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Filtros de incidentes IA"
      >
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Filtros</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label htmlFor="aims-incident-search" className="mb-2 block text-xs font-medium text-[var(--g-text-secondary)]">
              Buscar
            </label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g-text-secondary)]" />
              <input
                id="aims-incident-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Incidente, sistema o descripción"
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] py-2 pl-9 pr-3 text-sm text-[var(--g-text-primary)] outline-none transition-colors placeholder:text-[var(--g-text-secondary)]/60 focus:border-[var(--g-brand-3308)] focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
          <FilterGroup label="Estado" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <FilterGroup label="Severidad" options={SEVERITY_OPTIONS} value={severityFilter} onChange={setSeverityFilter} />
        </div>
      </section>

      {/* Tabla */}
      <div
        className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16" style={{ borderRadius: "var(--g-radius-md)" }} />)}
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">Sin incidentes registrados</p>
            <p className="text-xs text-[var(--g-text-secondary)] mt-1">El sistema IA está operando sin incidencias</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">No hay incidentes con esos filtros</p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Ajusta búsqueda, estado o severidad.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="w-[31%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Incidente</th>
                    <th className="w-[17%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sistema</th>
                    <th className="w-[12%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Severidad</th>
                    <th className="w-[15%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
                    <th className="w-[11%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fecha</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Derivación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {filtered.map((inc) => {
                    const sevCls = SEVERITY_CHIP[inc.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                    const stCls = STATUS_CHIP[inc.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                    const isMaterial = isAimsMaterialIncidentCandidate(inc);
                    return (
                      <tr
                        key={inc.id}
                        className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                        onClick={() => inc.system_id && navigate(`/ai-governance/sistemas/${inc.system_id}`)}
                      >
                        <td className="min-w-0 px-6 py-4">
                          <p className="truncate text-sm font-medium text-[var(--g-text-primary)]">{inc.title}</p>
                          {inc.description && (
                            <p className="mt-0.5 truncate text-xs text-[var(--g-text-secondary)]">{inc.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          <span className="block truncate">{inc.ai_systems?.name ?? "Sin sistema asociado"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-bold ${sevCls}`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {severityLabel(inc.severity)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${stCls}`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {incidentStatusLabel(inc.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          {formatDate(inc.reported_at)}
                        </td>
                        <td className="px-6 py-4">
                          {isMaterial ? (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                to={`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                                GRC
                              </Link>
                              <Link
                                to={`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                                Secretaría
                              </Link>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--g-text-secondary)]">Seguimiento interno</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--g-border-subtle)] lg:hidden" role="list" aria-label="Lista móvil de incidentes IA">
              {filtered.map((inc) => {
                const sevCls = SEVERITY_CHIP[inc.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const stCls = STATUS_CHIP[inc.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const isMaterial = isAimsMaterialIncidentCandidate(inc);
                return (
                  <article key={inc.id} role="listitem" className="p-4">
                    {inc.system_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/ai-governance/sistemas/${inc.system_id}`)}
                        className="w-full min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <span className="block truncate text-sm font-semibold text-[var(--g-text-primary)]">{inc.title}</span>
                        <span className="mt-1 block text-xs text-[var(--g-text-secondary)]">{inc.ai_systems?.name ?? "Sin sistema asociado"}</span>
                      </button>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--g-text-primary)]">{inc.title}</p>
                        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Sin sistema asociado</p>
                      </div>
                    )}
                    {inc.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--g-text-secondary)]">{inc.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold ${sevCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {severityLabel(inc.severity)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${stCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {incidentStatusLabel(inc.status)}
                      </span>
                      <span
                        className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {formatDate(inc.reported_at)}
                      </span>
                    </div>
                    <div className="mt-3">
                      {isMaterial ? (
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                            className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                            Enviar a GRC
                          </Link>
                          <Link
                            to={`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${inc.id}`}
                            className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                            Preparar reunión
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--g-text-secondary)]">Seguimiento interno AIMS</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="text-xs text-[var(--g-text-secondary)]">
        {filtered.length} incidente{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
