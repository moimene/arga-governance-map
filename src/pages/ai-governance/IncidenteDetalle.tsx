import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAiIncidentById, useUpdateAiIncident } from "@/hooks/useAiIncidents";
import { useIncidentRegimes } from "@/hooks/useAimsMultiregime";
import {
  evaluateMultiregimeIncident,
  altoRiesgoDeclarado,
  RiaIncidentSeverity,
} from "@/lib/aims/incident-clocks";
import { isMaterialSeverity } from "@/lib/aims/readiness";
import { normalizeAimsStatus } from "@/lib/aims/vocabulario";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { useTenantBranding } from "@/context/TenantBrandContext";
import CabeceraIncidente from "@/components/ai-governance/incidente/CabeceraIncidente";
import RelojesRegulatorios from "@/components/ai-governance/incidente/RelojesRegulatorios";
import SubexpedientesRegimen from "@/components/ai-governance/incidente/SubexpedientesRegimen";
import EdicionIncidente from "@/components/ai-governance/incidente/EdicionIncidente";

export default function AiIncidenteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: incident, isLoading, error } = useAiIncidentById(id);
  const updateMutation = useUpdateAiIncident();
  const { data: dbRegimes = [] } = useIncidentRegimes(id);
  const branding = useTenantBranding();

  const [status, setStatus] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [riaSeverity, setRiaSeverity] = useState<RiaIncidentSeverity>("ORDINARY_SERIOUS");
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
      const cerrado = normalizeAimsStatus(status) === "CERRADO";
      const closedAt = cerrado && !incident.closed_at ? new Date().toISOString() : incident.closed_at;
      await updateMutation.mutateAsync({
        id,
        updates: {
          status,
          severity,
          root_cause: rootCause,
          corrective_action: correctiveAction,
          closed_at: cerrado ? closedAt : null,
        },
      });
      toast.success("Incidente actualizado correctamente");
      setIsEditing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Error al actualizar incidente: ${msg}`);
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

  // Cálculo en vivo de los relojes multirrégimen.
  // HISTORIA: estos tres arrancaron en `true` —TODO incidente de TODO tenant
  // activaba los relojes del RGPD y de DORA— y el 2026-09-06 se dejaron en
  // `false` fijo, porque no había dónde declararlos y presumirlos era peor.
  // Desde `20260907220000` hay columnas: se LEEN, y `null` («no declarado») se
  // pasa como `undefined` para que el motor advierta en vez de ocultar un plazo
  // que puede aplicar. Una afirmación no se presume ni en un sentido ni en el
  // otro: se declara.
  const declarado = (v: boolean | null | undefined) => (v === null ? undefined : v);
  const clocks = evaluateMultiregimeIncident({
    // El plazo lo arranca el CONOCIMIENTO, no el registro. Sin él, el de
    // registro es la mejor aproximación disponible y es lo que se usaba.
    knowledgeDate: incident.knowledge_at ?? incident.reported_at,
    isAiRelated: true,
    // El art. 73 alcanza a sistemas de alto riesgo: se toma del sistema
    // asociado, no se presupone. `undefined` cuando no consta clasificación.
    isAiHighRisk: altoRiesgoDeclarado(incident.ai_systems?.risk_level),
    // La declarada en el alta manda; el desplegable de la ficha sólo la
    // sustituye mientras se recalifica sin haber guardado.
    riaSeverity: (incident.ria_severity as RiaIncidentSeverity | null) ?? riaSeverity,
    affectsPersonalData: declarado(incident.affects_personal_data) ?? false,
    isHighRiskToSubjects: declarado(incident.high_risk_to_subjects),
    isIctRelated: declarado(incident.ict_related) ?? false,
    affectsCriticalFunction: declarado(incident.affects_critical_function) ?? false,
  });

  // El alta escribe CRITICO/ALTO/MEDIO/BAJO; comparar con CRITICA/ALTA (que no
  // escribe nadie) dejaba este banner apagado para siempre.
  const isMaterial = isMaterialSeverity(currentSeverity);
  // Qué relojes se están contando DE VERDAD, para no anunciar de más.
  const regimenesEnCurso = [
    clocks.ria ? "RIA art. 73" : null,
    clocks.gdpr ? "RGPD art. 33" : null,
    clocks.dora ? "DORA art. 19" : null,
  ].filter(Boolean) as string[];
  // D-5: DORA no alcanza a todos los tenants y `branding.modules` lo oculta.
  const doraVisible = isModuleEnabled(branding, "dora");

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <CabeceraIncidente
        incident={incident}
        isEditing={isEditing}
        isSaving={updateMutation.isPending}
        currentStatus={currentStatus}
        currentSeverity={currentSeverity}
        isMaterial={isMaterial}
        regimenesEnCurso={regimenesEnCurso}
        onStartEdit={handleStartEdit}
        onCancelEdit={() => setIsEditing(false)}
        onSave={handleSave}
      />

      <RelojesRegulatorios clocks={clocks} doraVisible={doraVisible} />

      <SubexpedientesRegimen
        incidentId={incident.id}
        regimes={dbRegimes}
        doraVisible={doraVisible}
      />

      <EdicionIncidente
        incident={incident}
        isEditing={isEditing}
        currentStatus={currentStatus}
        currentSeverity={currentSeverity}
        currentRootCause={currentRootCause}
        currentCorrectiveAction={currentCorrectiveAction}
        status={status}
        setStatus={setStatus}
        rootCause={rootCause}
        setRootCause={setRootCause}
        correctiveAction={correctiveAction}
        setCorrectiveAction={setCorrectiveAction}
        riaSeverity={riaSeverity}
        setRiaSeverity={setRiaSeverity}
      />
    </div>
  );
}
