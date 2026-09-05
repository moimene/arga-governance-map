import { useParams, Link, useNavigate } from "react-router-dom";
import { useIncident, type RegulatoryNotificationLite } from "@/hooks/useIncidents";
import { hoursUntilDeadline, deadlineLabel } from "@/hooks/useRegulatoryNotif";
import { 
  ArrowLeft, Clock, CheckCircle, AlertTriangle, Send, Route, 
  PenTool, Loader2, FileText, CheckCircle2, ShieldCheck, AlertCircle, 
  ExternalLink, Users, MessageSquareText, ShieldAlert 
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  notificationStatusChip,
  notificationStatusLabel,
  severityChip,
} from "@/lib/grc/status-labels";
import { useCrossModuleLinks } from "@/hooks/useCrossModuleLinks";
import { useEvidenceBundlesForObject } from "@/hooks/useEvidenceBundles";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { computeDoraDeadlines } from "@/lib/grc/regulatory-clocks";
import { toast } from "sonner";

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
  const { id } = useParams<{ id: string }>();
  const { data: incident, isLoading } = useIncident(id);

  // V2 Integration States
  const { user } = useCurrentUser();
  const [signatoryName, setSignatoryName] = useState("Responsable de Cumplimiento");
  const [signatoryEmail, setSignatoryEmail] = useState(() => user?.email || "compliance@empresa.com");
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState("");
  const [clientCommSent, setClientCommSent] = useState(false);
  
  // Escalation form fields
  const [escalateMatter, setEscalateMatter] = useState("");
  const [escalateCommittee, setEscalateCommittee] = useState("CDA");
  const [escalateRationale, setEscalateRationale] = useState("");

  const navigate = useNavigate();

  const { data: declarations = [] } = useEvidenceBundlesForObject(
    "GRC",
    "INCIDENT",
    id ?? ""
  );
  const finalDeclarations = declarations.filter((d) => isFinalSealedEvidence(d.status));

  const { data: crossLinks = [] } = useCrossModuleLinks(
    "GRC",
    "INCIDENT",
    id ?? ""
  );

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

  const handleOpenEscalation = () => {
    setEscalateMatter(`Revisión del incidente de cumplimiento: ${incident.code} - ${incident.title}`);
    setEscalateRationale(`Se solicita al Consejo evaluar el impacto material del incidente ${incident.code} y validar el plan de remediación.`);
    setEscalateCommittee("CDA");
    setShowEscalationModal(true);
  };

  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEscalationModal(false);
    toast.success("Abriendo intake de Secretaría con la propuesta (handoff read-only)…");
    navigate(buildMeetingHandoffPath({
      source: "grc",
      event: "GRC_INCIDENT_MATERIAL",
      sourceId: incident.id,
      organ: escalateCommittee,
      matter: escalateMatter,
      rationale: escalateRationale,
    }));
  };

  const handleSendDelayedNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayReason.trim()) {
      toast.error("Debe indicar la justificación técnica del retraso.");
      return;
    }
    setShowDelayModal(false);
    // Este handler NO escribe en `regulatory_notifications` ni contacta con
    // ninguna autoridad: no existe write path hacia esa tabla en todo el repo.
    // Decir "transmitida formalmente a la autoridad" era afirmar un acto que no
    // ocurre.
    toast.info("Justificación anotada solo en esta pantalla. No se ha transmitido nada a la autoridad supervisora.");
  };

  const handleSendClientCommunication = () => {
    setClientCommSent(true);
    // Igual que el retraso motivado: solo cambia estado local. No hay envío.
    toast.info("Marcado solo en esta pantalla. No se ha remitido ninguna comunicación a clientes.");
  };

  const regNots: RegulatoryNotificationLite[] = incident.regulatory_notifications ?? [];
  const pendingNots = regNots.filter((n) => n.status === "Pendiente");
  const activeEscalation = crossLinks.find(link => link.status === "PROPOSED");

  const isDora = incident.incident_type === "DORA";
  const isNis2 = incident.incident_type === "NIS2";
  const isGdpr = incident.incident_type === "GDPR";
  const isMajor = incident.is_major_incident;

  // Calculo de hitos exactos
  // Los tres countdowns se calculaban SIEMPRE con `computeDoraDeadlines`
  // aunque la cabecera rotulase «NIS2 Art. 23» o «RGPD Art. 33»: `nis2Clocks` y
  // `gdprClocks` se calculaban y no se usaban, así que un incidente NIS2 mostraba
  // plazos DORA bajo un rótulo NIS2. El bloque solo se pinta para DORA, que es
  // el único régimen cuyos tres hitos sabe calcular esta pantalla.
  const doraClocks = computeDoraDeadlines(
    incident.detection_date || new Date(),
    incident.containment_date || incident.detection_date || new Date()
  );

  const initialDeadline = doraClocks.initialNotificationDeadline.toISOString();
  const intermediateDeadline = doraClocks.intermediateReportDeadline.toISOString();
  const finalDeadline = doraClocks.finalReportDeadline.toISOString();

  // Forense eligible check
  const isStatusEligible = ["Resuelto", "Cerrado", "RESUELTO", "CERRADO"].includes(incident.status ?? "");

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
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${severityChip(incident.severity)}`}
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

      {/* Persistent Handoff Banner */}
      {activeEscalation ? (
        <div
          className="flex flex-col gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--status-warning)] shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Escalado en Trámite (Orden del Día)
              </h2>
              <div className="text-xs text-[var(--g-text-secondary)] mt-1 space-y-1">
                <div><strong>Órgano Destinatario:</strong> {activeEscalation.payload?.organ || "CdA"}</div>
                <div><strong>Asunto:</strong> {activeEscalation.payload?.matter}</div>
                <div><strong>Justificación:</strong> {activeEscalation.payload?.rationale}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="px-2 py-0.5 text-xs font-bold bg-[var(--status-warning)]/20 text-[var(--status-warning)] border border-[var(--status-warning)]/30" style={{ borderRadius: "var(--g-radius-sm)" }}>
              PROPOSED
            </span>
            <span className="text-[10px] text-[var(--g-text-secondary)]">Propuesto por GRC Compass</span>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 text-[var(--g-brand-3308)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Escalado a Secretaría Societaria
              </h2>
              <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
                Proponga este incidente material directamente como Punto del Orden del Día para la próxima sesión del Consejo de Administración o Comisión Delegada de Riesgos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenEscalation}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] shrink-0"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Proponer a Secretaría
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}

      {/* Relojes regulatorios DORA. NIS2 y RGPD tienen otros hitos y esta
          pantalla no los calcula: en vez de pintar los de DORA bajo su rótulo,
          se dice que no están. */}
      {isMajor && !isDora && (
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 text-xs leading-relaxed text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <strong>Plazos regulatorios no calculados para este incidente.</strong>{" "}
          El cómputo multi-fase disponible es el de DORA (art. 19 y Reglamento Delegado 2025/301).
          {isNis2
            ? " Los hitos de NIS2 (art. 23) no se calculan en esta pantalla."
            : isGdpr
            ? " Los hitos del RGPD (art. 33) no se calculan en esta pantalla."
            : ""}
        </div>
      )}
      {isMajor && isDora && (
        <div
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 space-y-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--g-text-primary)] uppercase flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--status-error)]" />
                Reloj Regulatorio Multi-Fase (DORA Art. 19 / Delegado 2025/301)
              </h2>
              <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                Plazos perentorios de comunicación con la autoridad supervisora competente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDelayModal(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-[var(--g-surface-subtle)] text-[var(--status-error)] border border-[var(--status-error)]/30 hover:bg-[var(--status-error)] hover:text-[var(--g-text-inverse)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Notificar Retraso Motivado
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--status-error)] uppercase block">
                1. Notificación Inicial (Max 4h/24h)
              </span>
              <Countdown deadline={initialDeadline} />
              <div className="text-[10px] text-[var(--g-text-secondary)]">Tope: {fmtDate(initialDeadline)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--g-brand-3308)] uppercase block">
                2. Informe Intermedio (Max 72h)
              </span>
              <Countdown deadline={intermediateDeadline} />
              <div className="text-[10px] text-[var(--g-text-secondary)]">Tope: {fmtDate(intermediateDeadline)}</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--g-brand-3308)] uppercase block">
                3. Informe Final (Max 1 mes)
              </span>
              <Countdown deadline={finalDeadline} />
              <div className="text-[10px] text-[var(--g-text-secondary)]">Tope: {fmtDate(finalDeadline)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
              Descripción del Incidente
            </h2>
            <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed">
              {incident.description ?? "Sin descripción registrada."}
            </p>

            {(incident.root_cause || incident.lessons_learned) && (
              <div className="mt-4 pt-4 border-t border-[var(--g-border-subtle)] space-y-2 text-xs">
                {incident.root_cause && (
                  <div>
                    <span className="font-semibold text-[var(--g-text-secondary)] uppercase">
                      Causa raíz:
                    </span>{" "}
                    <span className="text-[var(--g-text-primary)]">{incident.root_cause}</span>
                  </div>
                )}
                {incident.lessons_learned && (
                  <div>
                    <span className="font-semibold text-[var(--g-text-secondary)] uppercase">
                      Lecciones aprendidas:
                    </span>{" "}
                    <span className="text-[var(--g-text-primary)]">{incident.lessons_learned}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel de Comunicación Obligatoria a Clientes / Interesados */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--g-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                  Comunicación Preceptiva a Clientes e Interesados (DORA Art. 19 / RGPD Art. 34)
                </h2>
              </div>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${clientCommSent ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]" : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"}`}>
                {clientCommSent ? "Marcada en pantalla (sin envío)" : "Pendiente"}
              </span>
            </div>

            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              Si el incidente afecta a los intereses financieros de los clientes o entraña un alto riesgo para los datos personales, la entidad debe informar sin dilación a los afectados sobre las medidas de mitigación y pautas de protección recomendadas.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSendClientCommunication}
                disabled={clientCommSent}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {clientCommSent ? "Comunicación a Clientes Enviada" : "Emitir Comunicación Oficial a Clientes"}
              </button>
            </div>
          </div>

          {/* Regulatory notifications table */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center gap-2">
              <Send className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Registro de Notificaciones Regulatorias
              </h2>
            </div>

            {regNots.length === 0 ? (
              <div className="px-5 py-6 text-sm text-[var(--g-text-secondary)]">
                No se han generado notificaciones formales adicionales para este incidente.
              </div>
            ) : (
              <div className="divide-y divide-[var(--g-border-subtle)]">
                {regNots.map((n) => (
                  <div key={n.id} className="px-5 py-4 flex items-start gap-4 text-xs">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--g-text-primary)]">{n.authority}</span>
                        <span className="text-[var(--g-text-secondary)]">{n.notification_type}</span>
                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${notificationStatusChip(n.status)}`}>
                          {n.status}
                        </span>
                      </div>
                      <div className="text-[var(--g-text-secondary)]">Deadline: <strong>{fmtDate(n.notification_deadline)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4 col-span-1">
          {/* Timeline */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
              Timeline de Trazabilidad Forense
            </h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Detección:</div>
                <div className="font-medium text-[var(--g-text-primary)]">{fmtDate(incident.detection_date)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Contención:</div>
                <div className="font-medium text-[var(--g-text-primary)]">{fmtDate(incident.containment_date)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Resolución:</div>
                <div className="font-medium text-[var(--g-text-primary)]">{fmtDate(incident.resolution_date)}</div>
              </div>
            </div>
          </div>

          {/* Evidence Sealing status */}
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {/* Se pintaba sin condición y con 0 evidencias: «Custodia documental
                (EAD Trust) — Cadena de custodia WORM preservada · Expedientes
                probatorios con hash SHA-512 inmutable». EAD Trust no es
                prestador de firma ni de sello en el alcance vigente, y no había
                nada archivado que custodiar. */}
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-[var(--g-text-secondary)]" />
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Archivo documental del incidente
              </h2>
            </div>

            <div className="p-2.5 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] rounded text-xs">
              {finalDeclarations.length > 0 ? (
                <>
                  <span className="font-semibold text-[var(--g-text-primary)] block">
                    Declaraciones archivadas ({finalDeclarations.length})
                  </span>
                  <span className="text-[10px] text-[var(--g-text-secondary)]">
                    Registro con hash. Sin sello ni firma atribuidos a ningún prestador.
                  </span>
                </>
              ) : (
                <span className="text-[var(--g-text-secondary)]">
                  No consta ninguna declaración archivada para este incidente.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Notificar Retraso Motivado */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Notificación de Retraso Motivado al Supervisor
              </h3>
              <button
                type="button"
                onClick={() => setShowDelayModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSendDelayedNotification} className="p-6 space-y-4 text-xs">
              <p className="text-[var(--g-text-secondary)]">
                Conforme al Reglamento Delegado (UE) 2025/301, si la entidad no puede remitir el informe intermedio o final en plazo, debe presentar una notificación motivada antes del vencimiento explicando las razones operativas y la fecha estimada de remisión.
              </p>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Justificación Técnica / Operativa del Retraso:
                </label>
                <textarea
                  required
                  rows={4}
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="Detallar las dificultades en el peritaje forense, dispersión de logs o dependencia de terceros proveedores para completar la investigación..."
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="px-0 py-3 border-t border-[var(--g-border-subtle)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDelayModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Transmitir Notificación de Retraso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Escalado Secretaría */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Proponer Incidente en Secretaría Societaria
              </h3>
              <button
                type="button"
                onClick={() => setShowEscalationModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEscalateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Órgano Destinatario:
                </label>
                <select
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full h-9 px-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración</option>
                  <option value="COMITE_EJECUTIVO">Comité Ejecutivo Delegado</option>
                  <option value="RIESGOS">Comisión Delegada de Riesgos</option>
                  <option value="AUDITORIA">Comisión de Auditoría y Control</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Punto del Orden del Día:
                </label>
                <input
                  type="text"
                  required
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  className="w-full h-9 px-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Justificación y Hechos Relevantes:
                </label>
                <textarea
                  required
                  rows={4}
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="px-0 py-3 border-t border-[var(--g-border-subtle)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] flex items-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Transmitir Propuesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
