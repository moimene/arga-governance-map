import { useMemo, useState } from "react";
import { useIncidents, type IncidentWithJoins } from "@/hooks/useIncidents";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertOctagon, ArrowRight, Clock, Plus, Route } from "lucide-react";
import { deadlineLabel } from "@/hooks/useRegulatoryNotif";

const FILTER_ALL = "Todas";

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const STATUS_CHIP: Record<string, string> = {
  Abierto: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En contención": "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  "En investigación": "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  Resuelto: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Cerrado: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const INCIDENT_TYPE_LABEL: Record<string, string> = {
  DORA: "Resiliencia digital",
  CYBER: "Ciberseguridad",
  GDPR: "Protección de datos",
  AUDIT: "Auditoría",
  PENAL: "Cumplimiento penal",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : DATE_FORMATTER.format(date);
}

function humanizeValue(value?: string | null) {
  if (!value) return "Sin clasificar";
  if (INCIDENT_TYPE_LABEL[value]) return INCIDENT_TYPE_LABEL[value];
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getNotification(incident: IncidentWithJoins) {
  const notifications = incident.regulatory_notifications ?? [];
  return notifications.find((n) => n.status === "Pendiente") ?? notifications[0] ?? null;
}

function notificationText(incident: IncidentWithJoins) {
  const notification = getNotification(incident);
  if (!notification) return "Sin notificación pendiente";
  if (notification.status === "Enviada") return "Notificación enviada";
  const label = deadlineLabel(notification.notification_deadline);
  if (label === "—") return "Sin plazo informado";
  return label === "VENCIDA" ? "Plazo vencido" : label;
}

function notificationTone(incident: IncidentWithJoins) {
  const notification = getNotification(incident);
  const label = notificationText(incident);
  if (label === "Plazo vencido") return "text-[var(--status-error)]";
  if (notification?.status === "Enviada") return "text-[var(--status-success)]";
  if (!notification || label === "Sin plazo informado") return "text-[var(--g-text-secondary)]";
  return "text-[var(--status-warning)]";
}

function isPriorityIncident(incident: IncidentWithJoins) {
  const notification = getNotification(incident);
  return (
    incident.is_major_incident ||
    incident.severity === "Crítico" ||
    incident.severity === "Alto" ||
    (notification?.status === "Pendiente" &&
      deadlineLabel(notification.notification_deadline) === "VENCIDA")
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="space-y-1 text-sm font-medium text-[var(--g-text-primary)]">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {children}
      </select>
    </label>
  );
}

function IncidentCard({ incident }: { incident: IncidentWithJoins }) {
  const notificationLabel = notificationText(incident);
  const notificationIsOverdue = notificationLabel === "Plazo vencido";

  return (
    <article
      className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[var(--g-text-secondary)]">{incident.code}</span>
            {incident.is_major_incident && (
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                Incidente significativo
              </span>
            )}
          </div>
          <h2 className="mt-2 break-words text-sm font-semibold leading-5 text-[var(--g-text-primary)]">
            {incident.title}
          </h2>
        </div>
        <Link
          to={`/grc/incidentes/${incident.id}`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-link)] transition-colors hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label={`Abrir incidente ${incident.code}`}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[incident.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {incident.severity ?? "Sin severidad"}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[incident.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {incident.status ?? "Sin estado"}
        </span>
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {humanizeValue(incident.incident_type)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-xs text-[var(--g-text-secondary)] sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Detectado</dt>
          <dd>{formatDate(incident.detection_date)}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--g-text-primary)]">Notificación</dt>
          <dd className={notificationIsOverdue ? "font-semibold text-[var(--status-error)]" : "text-[var(--g-text-secondary)]"}>
            {notificationLabel}
          </dd>
        </div>
        {incident.obligations?.code && (
          <div className="sm:col-span-2">
            <dt className="font-medium text-[var(--g-text-primary)]">Obligación vinculada</dt>
            <dd className="break-words">
              {incident.obligations.code} · {incident.obligations.title}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

export default function IncidentesList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: incidents = [], isLoading } = useIncidents();
  const handoff = params.get("handoff");
  const handoffSource = params.get("source");
  const [severityFilter, setSeverityFilter] = useState(FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [typeFilter, setTypeFilter] = useState(FILTER_ALL);

  const incidentTypes = useMemo(
    () =>
      Array.from(new Set(incidents.map((incident) => incident.incident_type).filter(Boolean)))
        .sort(),
    [incidents],
  );

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        const severityMatches = severityFilter === FILTER_ALL || incident.severity === severityFilter;
        const statusMatches = statusFilter === FILTER_ALL || incident.status === statusFilter;
        const typeMatches = typeFilter === FILTER_ALL || incident.incident_type === typeFilter;
        return severityMatches && statusMatches && typeMatches;
      }),
    [incidents, severityFilter, statusFilter, typeFilter],
  );

  const priorityCount = incidents.filter(isPriorityIncident).length;
  const activeCount = incidents.filter(
    (incident) => incident.status !== "Cerrado" && incident.status !== "Resuelto",
  ).length;
  const majorCount = incidents.filter((incident) => incident.is_major_incident).length;
  const hasFilters =
    severityFilter !== FILTER_ALL || statusFilter !== FILTER_ALL || typeFilter !== FILTER_ALL;

  return (
    <div className="min-w-0 space-y-5 p-4 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <AlertOctagon className="mt-1 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
              Incidentes
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Cola operativa para clasificar impacto, contener el evento y controlar plazos de notificación.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/grc/incidentes/nuevo")}
          className="inline-flex h-10 w-full items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Crear nuevo incidente"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo incidente
        </button>
      </header>

      {handoffSource === "aims" && handoff && (
        <div
          className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Entrada desde AIMS
              </h2>
              <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
                La señal se recibe como contexto de preparación. GRC decide si registra un incidente y conserva la trazabilidad de la decisión.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/grc/incidentes/nuevo")}
            className="inline-flex w-full items-center justify-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Registrar en GRC
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Prioridad de incidentes">
        {[
          { label: "Requieren atención", value: priorityCount, helper: "Críticos, altos, significativos o vencidos" },
          { label: "Activos", value: activeCount, helper: "Pendientes de cierre operativo" },
          { label: "Significativos", value: majorCount, helper: "Con tratamiento reforzado" },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">{item.value}</div>
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{item.helper}</p>
          </div>
        ))}
      </section>

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-labelledby="grc-incident-filters"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="grc-incident-filters" className="text-sm font-semibold text-[var(--g-text-primary)]">
              Filtros
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              {filteredIncidents.length} de {incidents.length} incidentes visibles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSeverityFilter(FILTER_ALL);
              setStatusFilter(FILTER_ALL);
              setTypeFilter(FILTER_ALL);
            }}
            disabled={!hasFilters}
            className="inline-flex h-9 w-full items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SelectField id="incident-severity-filter" label="Severidad" value={severityFilter} onChange={setSeverityFilter}>
            {[FILTER_ALL, "Crítico", "Alto", "Medio", "Bajo"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
          <SelectField id="incident-status-filter" label="Estado operativo" value={statusFilter} onChange={setStatusFilter}>
            {[FILTER_ALL, "Abierto", "En contención", "En investigación", "Resuelto", "Cerrado"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectField>
          <SelectField id="incident-type-filter" label="Área" value={typeFilter} onChange={setTypeFilter}>
            <option value={FILTER_ALL}>{FILTER_ALL}</option>
            {incidentTypes.map((type) => (
              <option key={type} value={type}>{humanizeValue(type)}</option>
            ))}
          </SelectField>
        </div>
      </section>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando incidentes...</div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay incidentes registrados.
        </div>
      )}

      {!isLoading && incidents.length > 0 && filteredIncidents.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--g-text-secondary)]">
          No hay incidentes para los filtros seleccionados.
        </div>
      )}

      <section
        data-testid="grc-incidents-mobile-list"
        className="space-y-3 lg:hidden"
        aria-label="Lista operativa de incidentes"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          <Clock className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
          Lista operativa
        </div>
        {filteredIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </section>

      <div
        data-testid="grc-incidents-desktop-table"
        className="hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)] lg:block"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Código", "Incidente", "Área", "Severidad", "Estado", "Notificación", ""].map((heading) => (
                  <th
                    key={heading || "actions"}
                    className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filteredIncidents.map((incident) => {
                const notificationLabel = notificationText(incident);

                return (
                  <tr
                    key={incident.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                    onClick={() => navigate(`/grc/incidentes/${incident.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                      {incident.code}
                    </td>
                    <td className="px-5 py-3">
                      <div className="max-w-[360px] text-sm font-medium text-[var(--g-text-primary)]">
                        {incident.title}
                      </div>
                      {incident.is_major_incident && (
                        <span
                          className="mt-1 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Incidente significativo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {humanizeValue(incident.incident_type)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[incident.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {incident.severity ?? "Sin severidad"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[incident.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {incident.status ?? "Sin estado"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <span
                        className={`font-medium ${notificationTone(incident)}`}
                      >
                        {notificationLabel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/grc/incidentes/${incident.id}`}
                        className="text-xs text-[var(--g-link)] underline hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
