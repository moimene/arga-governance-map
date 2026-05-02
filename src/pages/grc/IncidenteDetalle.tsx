import { useParams, Link } from "react-router-dom";
import { useIncident, type RegulatoryNotificationLite } from "@/hooks/useIncidents";
import { hoursUntilDeadline, deadlineLabel } from "@/hooks/useRegulatoryNotif";
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, Send, Route } from "lucide-react";
import { useEffect, useState } from "react";

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const NOTIF_STATUS_LABEL: Record<string, string> = {
  Pendiente: "PENDIENTE",
  Enviada: "ENVIADA",
  Aceptada: "ACEPTADA",
  Rechazada: "RECHAZADA",
};

const NOTIF_STATUS_CHIP: Record<string, string> = {
  Pendiente: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Enviada: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Aceptada: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  Rechazada: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
};

/** Countdown component that re-renders every minute */
function Countdown({ deadline }: { deadline: string }) {
  const [h, setH] = useState(hoursUntilDeadline(deadline));

  useEffect(() => {
    const id = setInterval(() => setH(hoursUntilDeadline(deadline)), 60_000);
    return () => clearInterval(id);
  }, [deadline]);

  const label = deadlineLabel(deadline);
  const isVencida = h === 0;
  const isUrgent = h !== null && h <= 4;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        isVencida
          ? "bg-[var(--status-error)]/10 border border-[var(--status-error)]/40"
          : isUrgent
          ? "bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/40"
          : "bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)]"
      }`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Clock
        className={`h-5 w-5 shrink-0 ${
          isVencida ? "text-[var(--status-error)]" : isUrgent ? "text-[var(--status-warning)]" : "text-[var(--g-brand-3308)]"
        }`}
      />
      <div>
        <div className="text-xs text-[var(--g-text-secondary)]">Tiempo restante</div>
        <div
          className={`text-xl font-bold ${
            isVencida
              ? "text-[var(--status-error)]"
              : isUrgent
              ? "text-[var(--status-warning)]"
              : "text-[var(--g-brand-3308)]"
          }`}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export default function IncidenteDetalle() {
  const { id } = useParams();
  const { data: incident, isLoading } = useIncident(id);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[var(--g-text-secondary)] animate-pulse">
        Cargando incidente…
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--g-text-secondary)]">Incidente no encontrado.</p>
        <Link
          to="/grc/incidentes"
          className="text-sm text-[var(--g-link)] underline mt-2 inline-block"
        >
          ← Volver a incidentes
        </Link>
      </div>
    );
  }

  const regNots: RegulatoryNotificationLite[] = incident.regulatory_notifications ?? [];
  const pendingNots = regNots.filter((n) => n.status === "Pendiente");
  const secretariaEscalationTo = `/secretaria/reuniones/nueva?source=grc&source_table=incidents&source_id=${incident.id}&event=GRC_INCIDENT_MATERIAL`;

  return (
    <div className="p-6 space-y-5">
      {/* Back */}
      <Link
        to="/grc/incidentes"
        className="inline-flex items-center gap-1 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Incidentes
      </Link>

      {/* Header */}
      <header>
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-[var(--g-text-secondary)]">
                {incident.code}
              </span>
              {incident.is_major_incident && (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  MAJOR · {incident.incident_type}
                </span>
              )}
              {incident.severity && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[incident.severity] ?? ""}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {incident.severity}
                </span>
              )}
              <span
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {incident.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              {incident.title}
            </h1>
          </div>
        </div>
      </header>

      <div
        className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex items-start gap-3">
          <Route className="mt-0.5 h-5 w-5 text-[var(--g-brand-3308)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Escalado societario propuesto
            </h2>
            <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
              Handoff read-only a Secretaría para valorar agenda o reunión. GRC no crea
              acuerdos, actas ni certificaciones desde esta pantalla.
            </p>
          </div>
        </div>
        <Link
          to={secretariaEscalationTo}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Proponer a Secretaría
          <ArrowLeft className="h-4 w-4 rotate-180" />
        </Link>
      </div>

      {/* Active countdowns for pending notifications */}
      {pendingNots.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
            Deadlines activos
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingNots.map((n) => (
              <Countdown key={n.id} deadline={n.notification_deadline} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Description */}
        <div
          className="lg:col-span-2 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
            Descripción
          </h2>
          <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed">
            {incident.description ?? "Sin descripción registrada."}
          </p>

          {(incident.root_cause || incident.lessons_learned) && (
            <div className="mt-4 pt-4 border-t border-[var(--g-border-subtle)] space-y-2">
              {incident.root_cause && (
                <div>
                  <span className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">
                    Causa raíz:
                  </span>{" "}
                  <span className="text-sm text-[var(--g-text-primary)]">{incident.root_cause}</span>
                </div>
              )}
              {incident.lessons_learned && (
                <div>
                  <span className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">
                    Lecciones aprendidas:
                  </span>{" "}
                  <span className="text-sm text-[var(--g-text-primary)]">{incident.lessons_learned}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
            Timeline
          </h2>
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-[var(--g-text-secondary)] mb-0.5">Detección</div>
              <div className="font-medium text-[var(--g-text-primary)]">
                {fmtDate(incident.detection_date)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--g-text-secondary)] mb-0.5">Contención</div>
              <div className="font-medium text-[var(--g-text-primary)]">
                {fmtDate(incident.containment_date)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--g-text-secondary)] mb-0.5">Resolución</div>
              <div className="font-medium text-[var(--g-text-primary)]">
                {fmtDate(incident.resolution_date)}
              </div>
            </div>
            {incident.obligations && (
              <div className="pt-2 border-t border-[var(--g-border-subtle)]">
                <div className="text-xs text-[var(--g-text-secondary)] mb-0.5">Obligación</div>
                <Link
                  to={`/obligaciones/${incident.obligations.code ?? ""}`}
                  className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
                >
                  {incident.obligations.code}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regulatory notifications */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center gap-2">
          <Send className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Notificaciones regulatorias
          </h2>
        </div>

        {regNots.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--g-text-secondary)]">
            No se han generado notificaciones para este incidente.
          </div>
        ) : (
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {regNots.map((n) => {
              const hLeft = hoursUntilDeadline(n.notification_deadline);
              const isOverdue = hLeft === 0 && n.status === "Pendiente";
              const isSent = n.status === "Enviada" || n.status === "Aceptada";

              return (
                <div key={n.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="mt-0.5">
                    {isSent ? (
                      <CheckCircle className="h-5 w-5 text-[var(--status-success)]" />
                    ) : isOverdue ? (
                      <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
                    ) : (
                      <Clock className="h-5 w-5 text-[var(--status-warning)]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-[var(--g-text-primary)]">
                        {n.authority}
                      </span>
                      <span className="text-xs text-[var(--g-text-secondary)]">
                        {n.notification_type}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${NOTIF_STATUS_CHIP[n.status] ?? ""}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {NOTIF_STATUS_LABEL[n.status] ?? n.status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--g-text-secondary)] space-y-0.5">
                      <div>
                        Deadline:{" "}
                        <strong
                          className={
                            isOverdue ? "text-[var(--status-error)]" : "text-[var(--g-text-primary)]"
                          }
                        >
                          {fmtDate(n.notification_deadline)}
                        </strong>
                        {n.status === "Pendiente" && hLeft !== null && (
                          <span
                            className={`ml-2 font-medium ${
                              hLeft === 0
                                ? "text-[var(--status-error)]"
                                : hLeft <= 4
                                ? "text-[var(--status-warning)]"
                                : "text-[var(--g-text-secondary)]"
                            }`}
                          >
                            ({deadlineLabel(n.notification_deadline)})
                          </span>
                        )}
                      </div>
                      {n.submitted_at && (
                        <div>Enviada: {fmtDate(n.submitted_at)}</div>
                      )}
                      {n.reference_number && (
                        <div>Referencia: {n.reference_number}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
