/**
 * Ficha de un sistema de IA.
 *
 * ESTA PANTALLA SÓLO COMPONE. Los bloques viven en
 * `@/components/ai-governance/sistema` y ningún criterio se reimplementa aquí:
 * la conformidad, la severidad material, el chip de nivel, el estado de una
 * sección y si el art. 11 vincula salen de `@/lib/aims/*`.
 *
 * FRONTERA DEL BACKBONE (2026-09-08). Se han retirado las pestañas que leían
 * tablas sin ningún camino de escritura —la evaluación del art. 27 y el
 * registro de modelos y datasets, vacías en los dos tenants— y el cierre del
 * expediente, que la custodia deniega. El art. 27 vuelve a la ficha sólo como
 * marco derivado del cuestionario, cuando el cuestionario lo derive.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ClipboardCheck, Cpu, Layers } from "lucide-react";
import { useAiSystemById } from "@/hooks/useAiSystems";
import { useAssessmentsBySystem } from "@/hooks/useAiAssessments";
import { useAiIncidentsBySystem } from "@/hooks/useAiIncidents";
import {
  useAimsTechnicalFileSections,
  useAimsSystemVersions,
  useAimsMonitoringIndicators,
} from "@/hooks/useAimsTechnicalFile";
import DeclaracionConformidadModal from "@/components/ai-governance/DeclaracionConformidadModal";
import CabeceraSistema from "@/components/ai-governance/sistema/CabeceraSistema";
import ClasificacionVigentePanel from "@/components/ai-governance/sistema/ClasificacionVigentePanel";
import EditarSistemaModal from "@/components/ai-governance/sistema/EditarSistemaModal";
import EscaladoSecretariaModal from "@/components/ai-governance/sistema/EscaladoSecretariaModal";
import TabEvaluaciones from "@/components/ai-governance/sistema/TabEvaluaciones";
import TabExpedienteTecnico from "@/components/ai-governance/sistema/TabExpedienteTecnico";
import TabIncidentes from "@/components/ai-governance/sistema/TabIncidentes";
import TabVigilancia from "@/components/ai-governance/sistema/TabVigilancia";

type Pestana = "TECHNICAL_FILE" | "EVALUATIONS" | "INCIDENTS" | "POST_MARKET";
type Modal = null | "EDITAR" | "DECLARACION" | "ESCALADO";

export default function SistemaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: system, isLoading } = useAiSystemById(id);
  const { data: assessments = [] } = useAssessmentsBySystem(id);
  const { data: incidents = [] } = useAiIncidentsBySystem(id);
  const { data: technicalSections = [] } = useAimsTechnicalFileSections(id);
  const { data: versions = [] } = useAimsSystemVersions(id);
  const { data: indicators = [] } = useAimsMonitoringIndicators(id);

  const [activeTab, setActiveTab] = useState<Pestana>("TECHNICAL_FILE");
  const [modal, setModal] = useState<Modal>(null);

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse h-24 bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          />
        ))}
      </div>
    );
  }

  if (!system || !id) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Cpu className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
        <p className="text-sm font-medium text-[var(--g-text-primary)]">Sistema no encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/sistemas")}
          className="mt-4 text-sm text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
        >
          Volver al inventario
        </button>
      </div>
    );
  }

  const pestanas = [
    { id: "TECHNICAL_FILE", label: "Expediente Técnico Vivo (Art. 11)", icon: Layers },
    { id: "EVALUATIONS", label: `Autodiagnósticos (${assessments.length})`, icon: ClipboardCheck },
    { id: "INCIDENTS", label: `Incidentes (${incidents.length})`, icon: AlertTriangle },
    { id: "POST_MARKET", label: `Vigilancia Poscomercialización (${indicators.length})`, icon: Activity },
  ] as const;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <CabeceraSistema
        system={system}
        versionActual={versions[0]}
        onVolver={() => navigate("/ai-governance/sistemas")}
        onEditar={() => setModal("EDITAR")}
        onNuevoAutodiagnostico={() => navigate(`/ai-governance/evaluaciones/nuevo?system_id=${system.id}`)}
        onDeclaracion={() => setModal("DECLARACION")}
        onEscalar={() => setModal("ESCALADO")}
      />

      <ClasificacionVigentePanel systemId={id} tieneOwner={!!system.owner_id} />

      <div className="border-b border-[var(--g-border-subtle)] flex gap-2 overflow-x-auto text-xs font-semibold">
        {pestanas.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] font-bold bg-[var(--g-surface-subtle)]/30"
                  : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "TECHNICAL_FILE" && (
        <TabExpedienteTecnico
          systemId={id}
          rol={system.regulatory_role}
          nivel={system.risk_level}
          secciones={technicalSections}
          versiones={versions}
          onClasificar={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        />
      )}

      {activeTab === "EVALUATIONS" && (
        <TabEvaluaciones
          assessments={assessments}
          onNueva={() => navigate(`/ai-governance/evaluaciones/nuevo?system_id=${system.id}`)}
          onAbrir={(assessmentId) => navigate(`/ai-governance/evaluaciones/${assessmentId}`)}
        />
      )}

      {activeTab === "INCIDENTS" && (
        <TabIncidentes
          incidents={incidents}
          onNuevo={() => navigate(`/ai-governance/incidentes/nuevo?system_id=${system.id}`)}
          onAbrir={(incidentId) => navigate(`/ai-governance/incidentes/${incidentId}`)}
        />
      )}

      {activeTab === "POST_MARKET" && <TabVigilancia systemId={id} indicators={indicators} />}

      {modal === "EDITAR" && <EditarSistemaModal system={system} onClose={() => setModal(null)} />}

      <DeclaracionConformidadModal
        system={system}
        isOpen={modal === "DECLARACION"}
        onClose={() => setModal(null)}
      />

      {modal === "ESCALADO" && <EscaladoSecretariaModal system={system} onClose={() => setModal(null)} />}
    </div>
  );
}
