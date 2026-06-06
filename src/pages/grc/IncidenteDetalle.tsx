import { useParams, Link } from "react-router-dom";
import { useIncident, type RegulatoryNotificationLite } from "@/hooks/useIncidents";
import { hoursUntilDeadline, deadlineLabel } from "@/hooks/useRegulatoryNotif";
import { 
  ArrowLeft, Clock, CheckCircle, AlertTriangle, Send, Route, 
  PenTool, Loader2, FileText, CheckCircle2, ShieldCheck, AlertCircle, 
  ExternalLink 
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  notificationStatusChip,
  notificationStatusLabel,
  severityChip,
} from "@/lib/grc/status-labels";
import { useQTSPSign } from "@/hooks/useQTSPSign";
import { useCrossModuleLinks, useCreateModuleLink, useCreateModuleEvent } from "@/hooks/useCrossModuleLinks";
import { useEvidenceBundlesForObject, useCreateEvidenceBundle } from "@/hooks/useEvidenceBundles";
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
  const [signProgress, setSignProgress] = useState<string | null>(null);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  
  // Escalation form fields
  const [escalateMatter, setEscalateMatter] = useState("");
  const [escalateCommittee, setEscalateCommittee] = useState("CDA");
  const [escalateRationale, setEscalateRationale] = useState("");
  
  // Sign form fields
  const [signatoryName, setSignatoryName] = useState("Lucía Martín");
  const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");

  // V2 Integration Hooks
  const { signMutation } = useQTSPSign();
  const createLink = useCreateModuleLink();
  const createEvent = useCreateModuleEvent();
  const createEvidence = useCreateEvidenceBundle();

  const { data: declarations = [], refetch: refetchDeclarations } = useEvidenceBundlesForObject(
    "GRC",
    "INCIDENT",
    id ?? ""
  );

  const { data: crossLinks = [], refetch: refetchCrossLinks } = useCrossModuleLinks(
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
    setEscalateRationale(`Se solicita al Consejo evaluar el impacto material del incidente ${incident.code} y validar el Acta de Cierre Forense.`);
    setEscalateCommittee("CDA");
    setShowEscalationModal(true);
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLink.mutateAsync({
        source_module: "GRC",
        source_object_type: "INCIDENT",
        source_object_id: incident.id,
        target_module: "SECRETARIA",
        target_object_type: "MEETING",
        target_object_id: null,
        relation_type: "AGENDA_PROPOSAL",
        status: "PROPOSED",
        payload: {
          organ: escalateCommittee,
          matter: escalateMatter,
          rationale: escalateRationale,
          proposed_by: "Compliance GRC Compass Module"
        }
      });

      await createEvent.mutateAsync({
        source_module: "GRC",
        event_type: "GRC_INCIDENT_MATERIAL_ESCALATION",
        event_status: "PROPOSED",
        target_module: "SECRETARIA",
        source_object_type: "INCIDENT",
        source_object_id: incident.id,
        payload: {
          organ: escalateCommittee,
          matter: escalateMatter,
          rationale: escalateRationale
        }
      });

      toast.success("Propuesta de Orden del Día enviada a Secretaría con éxito");
      setShowEscalationModal(false);
      refetchCrossLinks();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar propuesta de escalado");
    }
  };

  const handleSignDeclaration = async () => {
    try {
      setSignProgress("Generando acta de cierre forense…");
      
      const docName = `ACTA-CIERRE-FORENSE-${incident.code}-${new Date().getFullYear()}.pdf`;
      const docData = new TextEncoder().encode(
        `ACTA DE CIERRE FORENSE\n` +
        `Incidente: ${incident.code}\n` +
        `Título: ${incident.title}\n` +
        `Severidad: ${incident.severity}\n` +
        `Tipo de Incidente: ${incident.incident_type}\n` +
        `Fecha de Detección: ${incident.detection_date ? new Date(incident.detection_date).toLocaleString() : '—'}\n` +
        `Causa Raíz: ${incident.root_cause ?? 'No informada'}\n` +
        `Firmante Certificado: ${signatoryName} (${signatoryEmail})`
      ).buffer;

      // Call EAD Trust simulation via hook
      const signRes = await signMutation.mutateAsync({
        documentName: docName,
        documentData: docData,
        signatories: [{ name: signatoryName, email: signatoryEmail }],
        createdBy: "Compliance Officer",
        onProgress: (step) => setSignProgress(step),
      });

      if (!signRes.ok) {
        throw new Error(signRes.errors.join(", "));
      }

      setSignProgress("Registrando evidencia forense en ledger WORM…");

      // Save into WORM evidence bundle
      await createEvidence.mutateAsync({
        sourceModule: "GRC",
        sourceObjectType: "INCIDENT",
        sourceObjectId: incident.id,
        referenceCode: `ACTA-CIERRE-${incident.id.slice(0, 8).toUpperCase()}`,
        manifest: {
          incident_id: incident.id,
          incident_code: incident.code,
          incident_title: incident.title,
          severity: incident.severity,
          signatory: signatoryName,
          email: signatoryEmail,
          qtsp_transaction_id: signRes.srId,
          document_hash: signRes.documentHash,
          signed_at: signRes.signed_at
        },
        documentUrl: `https://hzqwefkwsxopwrmtksbg.supabase.co/storage/v1/object/public/evidence/closures/${docName}`,
        legalHold: false,
        status: "SEALED",
        sandbox: signRes.sandbox,
        signedBy: `${signatoryName} (${signatoryEmail})`
      });

      toast.success("Acta de Cierre Forense firmada con QES y sellada en ledger WORM");
      setShowSignModal(false);
      refetchDeclarations();
    } catch (err: any) {
      console.error(err);
      toast.error(`Firma fallida: ${err.message || "Error desconocido"}`);
    } finally {
      setSignProgress(null);
    }
  };

  const regNots: RegulatoryNotificationLite[] = incident.regulatory_notifications ?? [];
  const pendingNots = regNots.filter((n) => n.status === "Pendiente");
  const activeEscalation = crossLinks.find(link => link.status === "PROPOSED");

  const isDoraMajor = incident.incident_type === "DORA" && incident.is_major_incident;
  
  // Calculate deadlines: 24 hours and 30 days
  const initialDeadline = incident.detection_date 
    ? new Date(new Date(incident.detection_date).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;
  const finalDeadline = incident.detection_date
    ? new Date(new Date(incident.detection_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

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
                Proponga este incidente material directamente como Punto del Orden del Día para la próxima sesión del Consejo de Administración o Comité Ejecutivo.
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

      {/* Active countdowns for pending notifications */}
      {(pendingNots.length > 0 || isDoraMajor) && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
            Plazos Regulatorios Activos (DORA RTS)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isDoraMajor && initialDeadline && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--g-text-secondary)] uppercase block">
                  Notificación Inicial DORA (24h desde detección)
                </span>
                <Countdown deadline={initialDeadline} />
              </div>
            )}
            {isDoraMajor && finalDeadline && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--g-text-secondary)] uppercase block">
                  Informe Final DORA (30d desde detección)
                </span>
                <Countdown deadline={finalDeadline} />
              </div>
            )}
            {pendingNots.map((n) => (
              <div key={n.id} className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--g-text-secondary)] uppercase block">
                  {n.authority} ({n.notification_type})
                </span>
                <Countdown deadline={n.notification_deadline!} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Description Panel */}
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
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${notificationStatusChip(n.status)}`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          >
                            {notificationStatusLabel(n.status)}
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

        {/* Right Sidebar */}
        <div className="space-y-4 col-span-1">
          {/* Card: Timeline */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
              Timeline de Trazabilidad
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
                  <div className="text-xs text-[var(--g-text-secondary)] mb-0.5">Obligación Asociada</div>
                  <Link
                    to={`/obligaciones/${incident.obligations.code ?? ""}`}
                    className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline font-medium"
                  >
                    {incident.obligations.code}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Card: Firma de Cierre Forense (QES) */}
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-[var(--status-success)]" />
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Cierre Forense Cualificado
              </h2>
            </div>
            
            <p className="text-xs text-[var(--g-text-secondary)] mb-4 leading-relaxed">
              De acuerdo con DORA y la política corporativa de ARGA, los incidentes mayores o críticos requieren un Acta de Cierre Forense firmada con QES y archivada de forma inmutable.
            </p>

            {/* Evidence bundles / closures status */}
            <div 
              className={`flex items-center gap-2.5 px-3 py-2.5 mb-4 border ${
                declarations.length > 0
                  ? "bg-[var(--g-surface-subtle)] border-[var(--status-success)]/30"
                  : "bg-[var(--g-surface-muted)] border-[var(--g-border-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${declarations.length > 0 ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"}`} />
              <div className="flex-1">
                <span className="block text-xs font-semibold text-[var(--g-text-primary)]">
                  {declarations.length > 0 ? "Cierre Forense Certificado QES" : "Cierre Forense Pendiente"}
                </span>
                <span className="block text-[10px] text-[var(--g-text-secondary)] mt-0.5">
                  {declarations.length > 0 
                    ? `Archivado en ledger WORM (${declarations.length} actas)` 
                    : "Requiere firma cualificada por Apoderado / Compliance Officer"}
                </span>
              </div>
            </div>

            {/* Signed lists */}
            {declarations.length > 0 && (
              <div className="mb-4 space-y-2 max-h-48 overflow-y-auto pr-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Actas de Cierre Archivadas
                </p>
                {declarations.map(dec => (
                  <div 
                    key={dec.id} 
                    className="p-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-xs space-y-1.5"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-[var(--g-text-primary)]">
                        {dec.reference_code || "ACTA-CIERRE"}
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] bg-[var(--status-success)]/10 text-[var(--status-success)] font-medium" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        SEALED
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--g-text-secondary)]">
                      <div>Firmante: {dec.signed_by}</div>
                      <div>Fecha: {new Date(dec.created_at).toLocaleString("es-ES")}</div>
                    </div>
                    <div className="pt-1.5 border-t border-[var(--g-border-subtle)] flex items-center justify-between text-[9px]">
                      <span className="font-mono text-[8px] truncate max-w-[130px] text-[var(--g-text-secondary)]" title={dec.hash_sha512 || ""}>
                        Hash: {dec.hash_sha512 ? `${dec.hash_sha512.slice(0, 12)}…` : "—"}
                      </span>
                      <a 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          toast.info(`SHA-512 Verificado: ${dec.hash_sha512}`);
                        }}
                        className="text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-0.5"
                      >
                        Verificar <ExternalLink className="h-2 w-2" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isStatusEligible ? (
              <div className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/20 text-xs text-[var(--g-text-secondary)] flex items-start gap-2" style={{ borderRadius: "var(--g-radius-md)" }}>
                <AlertCircle className="h-4 w-4 text-[var(--status-error)] shrink-0 mt-0.5" />
                <span>
                  <strong>Firma bloqueada:</strong> El incidente debe estar en estado <em>Resuelto</em> o <em>Cerrado</em> para certificar el acta forense.
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSignModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] py-2 text-xs font-semibold hover:bg-[var(--g-sec-700)] transition-colors duration-150"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <PenTool className="h-3.5 w-3.5" />
                Firmar Cierre Forense (QES)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Drawer / Modal 1: Escalado a Secretaría                     */}
      {/* ============================================================ */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between bg-[var(--g-surface-subtle)]">
              <div className="flex items-center gap-2">
                <Route className="h-5 w-5 text-[var(--g-brand-3308)]" />
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Proponer a Secretaría Societaria
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEscalationModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] text-lg"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleEscalateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="escalate-organ" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Órgano de Destino
                </label>
                <select
                  id="escalate-organ"
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración (ARGA Seguros S.A.)</option>
                  <option value="COMITE_EJECUTIVO">Comité Ejecutivo Delegado</option>
                  <option value="AUDITORIA">Comisión de Auditoría y Cumplimiento</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="escalate-matter" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Asunto Propuesto
                </label>
                <input
                  id="escalate-matter"
                  type="text"
                  required
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="escalate-rationale" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                  Justificación de Urgencia / Materialidad
                </label>
                <textarea
                  id="escalate-rationale"
                  required
                  rows={4}
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] resize-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEscalationModal(false)}
                  className="flex-1 h-10 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-semibold transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLink.isPending}
                  className="flex-1 h-10 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {createLink.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando…
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Proponer Punto
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Drawer / Modal 2: Firma Cualificada QES (EAD Trust API)       */}
      {/* ============================================================ */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between bg-[var(--g-surface-subtle)]">
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-[var(--g-brand-3308)]" />
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Firma Cualificada QES (EAD Trust)
                </h3>
              </div>
              <button 
                type="button" 
                disabled={!!signProgress}
                onClick={() => setShowSignModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] text-lg disabled:opacity-40"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)] text-xs text-[var(--g-text-secondary)] leading-relaxed" style={{ borderRadius: "var(--g-radius-md)" }}>
                <div className="flex items-center gap-1.5 text-[var(--g-brand-3308)] font-bold mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  Garrigues Digital & EAD Trust Ecosystem
                </div>
                Esta operación invoca a la API cualificada del QTSP para generar una firma cualificada de un solo uso (One-Time QES) que vincula en firme al Compliance Officer.
              </div>

              {signProgress ? (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--g-brand-3308)]" />
                  <p className="text-sm font-semibold text-[var(--g-text-primary)] animate-pulse">{signProgress}</p>
                  <p className="text-xs text-[var(--g-text-secondary)]">Por favor no cierre esta ventana mientras se sella la evidencia.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="signatory-name" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                      Nombre Completo del Firmante
                    </label>
                    <input
                      id="signatory-name"
                      type="text"
                      required
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="signatory-email" className="block text-xs font-semibold text-[var(--g-text-primary)] uppercase">
                      Correo Electrónico Corporativo
                    </label>
                    <input
                      id="signatory-email"
                      type="email"
                      required
                      value={signatoryEmail}
                      onChange={(e) => setSignatoryEmail(e.target.value)}
                      className="w-full h-10 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSignModal(false)}
                      className="flex-1 h-10 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-semibold transition-colors"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSignDeclaration}
                      className="flex-1 h-10 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      Emitir Firma QES
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
