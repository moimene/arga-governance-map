import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAiIncidentById, useUpdateAiIncident } from "@/hooks/useAiIncidents";
import { useIncidentRegimes, useUpdateIncidentRegime, useCreateIncidentReport } from "@/hooks/useAimsMultiregime";
import {
  evaluateMultiregimeIncident,
  formatDeadline,
  formatIncidentDate,
  formatRemainingTime,
  RiaIncidentSeverity,
} from "@/lib/aims/incident-clocks";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Layers,
  Lock,
  FileCheck,
  ShieldCheck,
  Info,
} from "lucide-react";
import { toast } from "sonner";

export default function AiIncidenteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: incident, isLoading, error } = useAiIncidentById(id);
  const updateMutation = useUpdateAiIncident();
  const { data: dbRegimes = [] } = useIncidentRegimes(id);
  const updateRegimeMutation = useUpdateIncidentRegime();
  const createReportMutation = useCreateIncidentReport();

  const [status, setStatus] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [riaSeverity, setRiaSeverity] = useState<RiaIncidentSeverity>("ORDINARY_SERIOUS");
  // Arrancaban en `true`, sin ningún control en la UI para cambiarlos: TODO
  // incidente de TODO tenant activaba el reloj del RGPD y el de DORA. Que un
  // incidente afecte a datos personales, y que la entidad esté sujeta a DORA,
  // son afirmaciones — y una afirmación no se presume: se declara.
  const [affectsPii, setAffectsPii] = useState<boolean>(false);
  const [highRiskPii, setHighRiskPii] = useState<boolean>(false);
  const [isIctCritical, setIsIctCritical] = useState<boolean>(false);
  const [rootCause, setRootCause] = useState<string>("");
  const [correctiveAction, setCorrectiveAction] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Sincronizar estado inicial al cargar
  const currentStatus = isEditing ? status : incident?.status || "ABIERTO";
  const currentSeverity = isEditing ? severity : incident?.severity || "";
  const currentRootCause = isEditing ? rootCause : incident?.root_cause || "";
  const currentCorrectiveAction = isEditing ? correctiveAction : incident?.corrective_action || "";

  const handleStartEdit = () => {
    if (!incident) return;
    setStatus(incident.status);
    setSeverity(incident.severity || "");
    setRootCause(incident.root_cause || "");
    setCorrectiveAction(incident.corrective_action || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!id || !incident) return;
    try {
      const closedAt = status === "CERRADO" && !incident.closed_at ? new Date().toISOString() : incident.closed_at;
      await updateMutation.mutateAsync({
        id,
        updates: {
          status,
          severity,
          root_cause: rootCause,
          corrective_action: correctiveAction,
          closed_at: status === "CERRADO" ? closedAt : null,
        },
      });
      toast.success("Incidente actualizado correctamente");
      setIsEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Error al actualizar incidente: ${msg}`);
    }
  };

  const handleCloseRegimeSubcase = async (regimeCode: "RIA" | "GDPR" | "DORA") => {
    const fila = dbRegimes.find((r) => r.regime_code === regimeCode);
    if (!fila) {
      // No se puede cerrar lo que no existe. Antes se lanzaba el toast igual.
      toast.error(`No hay subexpediente ${regimeCode} registrado que cerrar`);
      return;
    }
    try {
      await updateRegimeMutation.mutateAsync({
        id: fila.id,
        updates: { status: "CLOSED", closed_at: new Date().toISOString() },
      });
      toast.success(`Subexpediente ${regimeCode} cerrado`, {
        description:
          "El cierre no arrastra a los demás regímenes. No constituye notificación " +
          "a la autoridad ni acuse de recibo: sólo cierra el subexpediente interno.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo cerrar el subexpediente ${regimeCode}: ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="animate-pulse h-8 bg-[var(--g-surface-subtle)] rounded w-1/3" />
        <div className="animate-pulse h-32 bg-[var(--g-surface-subtle)] rounded" />
        <div className="animate-pulse h-64 bg-[var(--g-surface-subtle)] rounded" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--status-error)]/30 text-center"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <AlertTriangle className="w-12 h-12 text-[var(--status-error)] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[var(--g-text-primary)] mb-2">Incidente no encontrado</h2>
          <button
            onClick={() => navigate("/ai-governance/incidentes")}
            className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Volver a incidentes
          </button>
        </div>
      </div>
    );
  }

  // Cálculo en vivo de los relojes multirrégimen
  const clocks = evaluateMultiregimeIncident({
    knowledgeDate: incident.reported_at,
    isAiRelated: true,
    // El art. 73 alcanza a sistemas de alto riesgo: se toma del sistema
    // asociado, no se presupone. Antes todo incidente activaba el plazo.
    isAiHighRisk: /^(alto|high|inaceptable|unacceptable)$/i.test(
      incident.ai_systems?.risk_level ?? "",
    ),
    riaSeverity: riaSeverity,
    affectsPersonalData: affectsPii,
    isHighRiskToSubjects: highRiskPii,
    isIctRelated: isIctCritical,
    affectsCriticalFunction: isIctCritical,
  });

  const riaRemaining = clocks.ria ? formatRemainingTime(clocks.ria.deadlineDate) : null;
  const gdprRemaining = clocks.gdpr ? formatRemainingTime(clocks.gdpr.deadlineDate) : null;
  const doraRemaining = clocks.dora ? formatRemainingTime(clocks.dora.initialDeadlineDate) : null;

  const isMaterial = currentSeverity === "CRITICA" || currentSeverity === "ALTA";

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb / Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate("/ai-governance/incidentes")}
          className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Registro de Incidentes</span>
        </button>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Gestionar / Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Save className="w-4 h-4" />
                <span>{updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              <span className="font-mono">EXP-INC-{incident.id.slice(0, 8).toUpperCase()}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Reportado: {formatIncidentDate(incident.reported_at)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">{incident.title}</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Sistema afectado:{" "}
              {incident.system_id ? (
                <Link
                  to={`/ai-governance/sistemas/${incident.system_id}`}
                  className="font-semibold text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-1"
                >
                  {incident.ai_systems?.name || "Ver sistema IA"}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <span className="italic">No asignado</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                currentStatus === "CERRADO"
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : currentStatus === "EN_INVESTIGACION"
                  ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {currentStatus.replace("_", " ")}
            </span>

            <span
              className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                currentSeverity === "CRITICA"
                  ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                  : currentSeverity === "ALTA"
                  ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              Severidad: {currentSeverity}
            </span>
          </div>
        </div>

        {/* Handoff Buttons */}
        {isMaterial && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-error)] flex flex-wrap items-center justify-between gap-3"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-[var(--status-error)] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[var(--g-text-primary)]">
                  Incidente Material Multirrégimen (RIA Art. 73 / RGPD Art. 33 / DORA Art. 19)
                </p>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Relojes regulatorios independientes activados. Escalado recomendado a Secretaría y comités de control.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${incident.id}`}
                className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span>Handoff GRC</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <Link
                to={`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${incident.id}`}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span>Punto Orden del Día</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* PANEL DE RELOJES REGULATORIOS PARALELOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Relojes Regulatorios Paralelos
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Reloj 1: RIA Art. 73 */}
          <div
            className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  EU AI ACT (Art. 73)
                </span>
                <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Vigilancia de Mercado (AESIA)</h3>
              </div>
              {riaRemaining && (
                <span className={`px-2 py-0.5 text-[10px] ${riaRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                  {riaRemaining.label}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              {clocks.ria?.ruleDescription ??
                "El sistema asociado consta clasificado fuera del alto riesgo, así que el art. 73 no le alcanza: no hay plazo que contar."}
            </p>
            {clocks.ria?.highRiskUnconfirmed && (
              <p className="text-[11px] text-[var(--status-warning)] leading-relaxed">
                El sistema asociado no tiene clasificación de riesgo registrada: no consta que el
                art. 73 le alcance. El plazo se muestra por prudencia, no como obligación acreditada.
              </p>
            )}
            <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
              <span className="text-[var(--g-text-secondary)]">Vencimiento:</span>
              <span className="font-mono font-bold text-[var(--g-text-primary)]">
                {formatDeadline(clocks.ria?.deadlineDate)}
              </span>
            </div>
          </div>

          {/* Reloj 2: RGPD Art. 33/34 */}
          <div
            className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  RGPD (Art. 33 / 34)
                </span>
                <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Protección de Datos (AEPD)</h3>
              </div>
              {gdprRemaining && (
                <span className={`px-2 py-0.5 text-[10px] ${gdprRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                  {gdprRemaining.label}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              {clocks.gdpr?.ruleDescription ??
                "No consta declarado que el incidente afecte a datos personales, así que no se cuenta plazo del art. 33 RGPD."}
            </p>
            {clocks.gdpr?.dataSubjectNoticeArticleRef && (
              <p className="text-[11px] text-[var(--g-text-secondary)] leading-relaxed">
                Además, comunicación al interesado ({clocks.gdpr.dataSubjectNoticeArticleRef}) sin
                dilación indebida: no tiene plazo de 72 h.
              </p>
            )}
            <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
              <span className="text-[var(--g-text-secondary)]">Vencimiento 72h:</span>
              <span className="font-mono font-bold text-[var(--g-text-primary)]">
                {formatDeadline(clocks.gdpr?.deadlineDate)}
              </span>
            </div>
          </div>

          {/* Reloj 3: DORA Art. 19 */}
          <div
            className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  DORA (Art. 19 · Rgto. Delegado 2025/301)
                </span>
                <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Supervisor Financiero (DGSFP)</h3>
              </div>
              {doraRemaining && (
                <span className={`px-2 py-0.5 text-[10px] ${doraRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                  {doraRemaining.label}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              {clocks.dora?.ruleDescription ??
                "No consta que la entidad esté sujeta a DORA ni que el incidente afecte a funciones críticas TIC: no se cuenta plazo."}
            </p>
            {clocks.dora?.assumesPriorReportsAtDeadline && (
              <p className="text-[11px] text-[var(--g-text-secondary)] leading-relaxed">
                Los hitos intermedio y final se calculan sobre el vencimiento del anterior, no sobre
                su envío real: son los últimos permisibles si cada informe se presenta justo en plazo.
              </p>
            )}
            <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
              <span className="text-[var(--g-text-secondary)]">
                {clocks.dora?.initialRule === "24H_CAP_FROM_KNOWLEDGE"
                  ? "Informe inicial (tope 24 h desde conocimiento):"
                  : "Informe inicial (4 h desde clasificación):"}
              </span>
              <span className="font-mono font-bold text-[var(--g-text-primary)]">
                {formatDeadline(clocks.dora?.initialDeadlineDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SUBEXPEDIENTES POR RÉGIMEN & AISLAMIENTO DE CIERRES */}
      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
              Subexpedientes Regulatorios & Aislamiento de Cierres
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Info className="w-4 h-4 text-[var(--g-brand-3308)]" />
            <span>El cierre de un subexpediente no arrastra ni altera el estado de los demás regímenes.</span>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              code: "RIA",
              title: "Subexpediente RIA — AESIA (Vigilancia de Mercado)",
              desc: "Notificación de incidente grave de IA y análisis de causalidad algorítmica.",
              authority: "AESIA",
              role: "AI Officer",
            },
            {
              code: "GDPR",
              title: "Subexpediente RGPD — AEPD (Protección de Datos)",
              desc: "Documentación verificable de brecha, medidas de cifrado y comunicación a interesados.",
              authority: "AEPD",
              role: "DPO",
            },
            {
              code: "DORA",
              title: "Subexpediente DORA — DGSFP / BdE (Resiliencia Operativa TIC)",
              desc: "Plantilla normalizada TIC, informe intermedio a 72h e informe final de causa raíz.",
              authority: "DGSFP",
              role: "CISO",
            },
          ].map((reg) => (
            <div
              key={reg.code}
              className="p-4 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{reg.code}</span>
                  <h4 className="text-sm font-bold text-[var(--g-text-primary)]">{reg.title}</h4>
                </div>
                <p className="text-xs text-[var(--g-text-secondary)]">{reg.desc}</p>
                <div className="flex gap-3 text-[11px] text-[var(--g-text-secondary)] pt-1">
                  <span>Autoridad: <strong className="text-[var(--g-text-primary)]">{reg.authority}</strong></span>
                  <span>•</span>
                  <span>Responsable: <strong className="text-[var(--g-text-primary)]">{reg.role}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {dbRegimes.some((r) => r.regime_code === reg.code) ? (
                  <button
                    onClick={() => handleCloseRegimeSubcase(reg.code as "RIA" | "GDPR" | "DORA")}
                    disabled={updateRegimeMutation.isPending}
                    className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Cerrar subexpediente</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-[var(--g-text-secondary)]">
                    Sin subexpediente registrado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Description, Root Cause & Remediation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Descripción */}
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--g-brand-3308)]" />
              <h2 className="text-base font-bold text-[var(--g-text-primary)]">Descripción del Incidente</h2>
            </div>
            <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {incident.description || "Sin descripción registrada."}
            </p>
          </div>

          {/* Causa Raíz */}
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--g-brand-3308)]" />
              <h2 className="text-base font-bold text-[var(--g-text-primary)]">Análisis de Causa Raíz (RCA)</h2>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--g-text-primary)]">
                  Causa Raíz Identificada
                </label>
                <textarea
                  rows={4}
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Detallar la causa técnica o metodológica (drift no detectado, dataset sesgado, fallo de pipeline, etc.)..."
                  className="w-full p-3 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {currentRootCause || "Pendiente de determinación por el equipo de investigación técnica."}
              </p>
            )}
          </div>

          {/* Remedios */}
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--status-success)]" />
              <h2 className="text-base font-bold text-[var(--g-text-primary)]">
                Medidas Correctoras y Plan de Remediación
              </h2>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--g-text-primary)]">
                  Acciones Correctivas Implementadas o Previstas
                </label>
                <textarea
                  rows={4}
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  placeholder="Detallar acciones inmediatas y preventivas (reentrenamiento, threshold tuning, actualización de guardrails, auditoría)..."
                  className="w-full p-3 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {currentCorrectiveAction || "No se han documentado medidas correctoras definitivas todavía."}
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Configuración */}
        <div className="space-y-6">
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h3 className="text-sm font-bold text-[var(--g-text-primary)] uppercase tracking-wider">
              Control de Ciclo de Vida
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                    Estado del Incidente
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2.5 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="ABIERTO">ABIERTO (En recepción)</option>
                    <option value="EN_INVESTIGACION">EN INVESTIGACIÓN</option>
                    <option value="CERRADO">CERRADO (Resuelto)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                    Tipología RIA Art. 73
                  </label>
                  <select
                    value={riaSeverity}
                    onChange={(e) => setRiaSeverity(e.target.value as RiaIncidentSeverity)}
                    className="w-full p-2.5 text-sm border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="ORDINARY_SERIOUS">Grave Ordinario (15 días naturales)</option>
                    <option value="WIDESPREAD_INFRINGEMENT">Infracción Generalizada / Urgente (2 días)</option>
                    <option value="DEATH_INCIDENT">Fallecimiento de persona (10 días)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-[var(--g-text-secondary)]">
                <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                  <span>Estado:</span>
                  <span className="font-semibold text-[var(--g-text-primary)]">{currentStatus}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                  <span>Severidad:</span>
                  <span className="font-semibold text-[var(--g-text-primary)]">{currentSeverity}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--g-border-subtle)]">
                  <span>Fecha Notificación:</span>
                  <span className="font-semibold text-[var(--g-text-primary)]">
                    {formatIncidentDate(incident.reported_at)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Fecha Cierre:</span>
                  <span className="font-semibold text-[var(--g-text-primary)]">
                    {incident.closed_at ? formatIncidentDate(incident.closed_at) : "Abierto"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
