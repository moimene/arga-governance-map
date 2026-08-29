import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ChevronLeft,
  Cpu,
  Calendar,
  Building2,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  ExternalLink,
  Send,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  AlertCircle,
  Users,
  Edit,
  Plus,
  Lock,
  Database,
  Layers,
  Activity,
  ShieldAlert,
  History,
  Check,
  X,
  FileCheck,
} from "lucide-react";
import { useAiSystemById, useUpdateAiSystem, AiSystem } from "@/hooks/useAiSystems";
import { useAssessmentsBySystem, useComplianceChecksBySystem } from "@/hooks/useAiAssessments";
import { useAiIncidentsBySystem } from "@/hooks/useAiIncidents";
import {
  useAimsTechnicalFileSections,
  useAimsSystemVersions,
  useCloseAimsTechnicalFile,
  useAimsModelRegistry,
  useAimsDatasetRegistry,
  useAimsMonitoringIndicators,
  useUpdateTechnicalFileSection,
} from "@/hooks/useAimsTechnicalFile";
import { useEvidenceBundlesForObject } from "@/hooks/useEvidenceBundles";
import { useFriaBySystem, useFriaDetails } from "@/hooks/useAimsFria";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import DeclaracionConformidadModal from "@/components/ai-governance/DeclaracionConformidadModal";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto: "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  HIGH: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  LIMITED: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  MINIMAL: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const CHECK_STATUS_CHIP: Record<string, string> = {
  CONFORME: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_CURSO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PENDIENTE: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  NO_CONFORME: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  NA: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const SECTION_STATUS_CHIP: Record<string, string> = {
  APPROVED: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  SEALED: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  IN_REVIEW: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  DRAFT: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  NON_CONFORMING: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

export default function SistemaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: system, isLoading: loadSys } = useAiSystemById(id);
  const { data: assessments = [] } = useAssessmentsBySystem(id);
  const { data: checks = [] } = useComplianceChecksBySystem(id);
  const { data: incidents = [] } = useAiIncidentsBySystem(id);

  // AIMS Technical File & Registries Hooks
  const { data: technicalSections = [], refetch: refetchSections } = useAimsTechnicalFileSections(id);
  const { data: versions = [], refetch: refetchVersions } = useAimsSystemVersions(id);
  const { data: models = [] } = useAimsModelRegistry(id);
  const { data: datasets = [] } = useAimsDatasetRegistry(id);
  const { data: indicators = [] } = useAimsMonitoringIndicators(id);
  const closeTechnicalFileMutation = useCloseAimsTechnicalFile();
  const updateSystemMutation = useUpdateAiSystem();
  const updateSectionMutation = useUpdateTechnicalFileSection();

  const { data: fria } = useFriaBySystem(id);
  const { data: friaDetails } = useFriaDetails(fria?.id);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<"TECHNICAL_FILE" | "EVALUATIONS" | "INCIDENTS" | "REGISTRIES" | "POST_MARKET" | "FRIA">("TECHNICAL_FILE");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [showEscalationModal, setShowEscalationModal] = useState(false);

  // Edit System Form State
  const [editName, setEditName] = useState("");
  const [editSystemType, setEditSystemType] = useState("");
  const [editRiskLevel, setEditRiskLevel] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editUseCase, setEditUseCase] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAimsCode, setEditAimsCode] = useState("");

  // Escalation Form State
  const [escalateMatter, setEscalateMatter] = useState("");
  const [escalateCommittee, setEscalateCommittee] = useState("CDA");
  const [escalateRationale, setEscalateRationale] = useState("");

  const { data: declarations = [] } = useEvidenceBundlesForObject(
    "AIMS",
    "AI_SYSTEM",
    id ?? ""
  );
  const finalDeclarations = declarations.filter((d) => isFinalSealedEvidence(d.status));

  if (loadSys) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-24 bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-lg)" }} />
        ))}
      </div>
    );
  }

  if (!system) {
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

  const handleOpenEdit = () => {
    setEditName(system.name || "");
    setEditSystemType(system.system_type || "");
    setEditRiskLevel(system.risk_level || "Alto");
    setEditVendor(system.vendor || "");
    setEditStatus(system.status || "ACTIVO");
    setEditUseCase(system.use_case || "");
    setEditDescription(system.description || "");
    setEditAimsCode(system.aims_reference_code || "");
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await updateSystemMutation.mutateAsync({
        id,
        updates: {
          name: editName,
          system_type: editSystemType,
          risk_level: editRiskLevel,
          vendor: editVendor,
          status: editStatus,
          use_case: editUseCase,
          description: editDescription,
          aims_reference_code: editAimsCode,
        },
      });
      toast.success("Ficha del sistema actualizada correctamente");
      setShowEditModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al actualizar sistema: ${msg}`);
    }
  };

  const handleOpenEscalation = () => {
    setEscalateMatter(`Propuesta de aprobación del Expediente Técnico para el Sistema de IA: ${system.name}`);
    setEscalateRationale(`Se solicita al Consejo evaluar la conformidad del sistema ${system.name} bajo el marco RIA / AESIA.`);
    setEscalateCommittee("CDA");
    setShowEscalationModal(true);
  };

  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setShowEscalationModal(false);
      toast.success("Abriendo intake de Secretaría con la propuesta...");
      navigate(
        buildMeetingHandoffPath({
          source: "aims",
          event: "AIMS_SYSTEM_CONFORMITY",
          sourceId: system.id,
          organ: escalateCommittee,
          matter: escalateMatter,
          rationale: escalateRationale,
        })
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al preparar el handoff de escalado");
    }
  };

  const handleSealTechnicalFile = async (versionId: string) => {
    try {
      await closeTechnicalFileMutation.mutateAsync({
        versionId,
        qsealToken: `QSEAL-EADTRUST-SHA512-${Date.now()}`,
        tsqToken: `TSQ-TSA-EU-${Date.now()}`,
        signedBy: user?.email || "ai.officer@empresa.com",
      });
      toast.success("Expediente Técnico precintado y sellado en el ledger WORM de evidencias");
      refetchVersions();
      refetchSections();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al precintar expediente técnico: ${msg}`);
    }
  };

  const riskCls =
    RISK_COLORS[system.risk_level ?? ""] ??
    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

  const currentVersion = versions[0];
  const isTechnicalFileSealed = currentVersion?.technical_file_status === "SEALED";

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Top Breadcrumb & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/ai-governance/sistemas")}
          className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Inventario de Sistemas IA</span>
        </button>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Editar Ficha</span>
          </button>
          <button
            onClick={() => navigate(`/ai-governance/evaluaciones/nueva?system_id=${system.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Autodiagnóstico</span>
          </button>
          <button
            onClick={() => setShowDeclarationModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-surface-subtle)] border border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] hover:bg-[var(--g-brand-3308)] hover:text-[var(--g-text-inverse)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Declaración de Conformidad UE</span>
          </button>
          <button
            onClick={handleOpenEscalation}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Escalar a Secretaría</span>
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6 space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Cpu className="h-6 w-6 text-[var(--g-brand-3308)]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {system.aims_reference_code || `SYS-${system.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span className="text-xs text-[var(--g-text-secondary)]">
                  Versión actual: {currentVersion?.version_tag || "v1.0-prod"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">{system.name}</h1>
              <p className="text-sm text-[var(--g-text-secondary)] max-w-2xl">{system.description}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`shrink-0 inline-flex items-center px-3 py-1 text-xs font-bold ${riskCls}`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              Riesgo {system.risk_level || "Alto"}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold ${
                system.status === "ACTIVO"
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {system.status}
            </span>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--g-border-subtle)] text-xs">
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Tipo de Sistema:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{system.system_type || "Machine Learning"}</span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Proveedor / Responsable:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{system.vendor || "Desarrollo Interno"}</span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Fecha Despliegue:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">
              {system.deployment_date
                ? new Date(system.deployment_date).toLocaleDateString("es-ES")
                : "En validación"}
            </span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Expediente Técnico:</span>
            <span className={`font-bold ${isTechnicalFileSealed ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"}`}>
              {isTechnicalFileSealed ? "Precintado WORM" : "Abierto en Edición"}
            </span>
          </div>
        </div>

        {system.use_case && (
          <div className="pt-3 border-t border-[var(--g-border-subtle)] text-xs">
            <span className="font-bold text-[var(--g-text-secondary)] block mb-0.5">Finalidad y Caso de Uso:</span>
            <p className="text-[var(--g-text-primary)]">{system.use_case}</p>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--g-border-subtle)] flex gap-2 overflow-x-auto text-xs font-semibold">
        {(
          [
            { id: "TECHNICAL_FILE", label: "Expediente Técnico Vivo (Art. 11)", icon: Layers },
            { id: "FRIA", label: "Derechos Fundamentales (FRIA Art. 27)", icon: ShieldCheck },
            { id: "EVALUATIONS", label: `Autodiagnósticos (${assessments.length})`, icon: ClipboardCheck },
            { id: "INCIDENTS", label: `Incidentes (${incidents.length})`, icon: AlertTriangle },
            { id: "REGISTRIES", label: `Modelos & Datasets (${models.length + datasets.length})`, icon: Database },
            { id: "POST_MARKET", label: `Vigilancia Poscomercialización (${indicators.length})`, icon: Activity },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
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

      {/* Tab 1: Expediente Técnico Vivo (Art. 11 + Anexo IV) */}
      {activeTab === "TECHNICAL_FILE" && (
        <div className="space-y-6">
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--g-text-primary)]">
                  Estructura del Expediente Técnico (Anexo IV Reglamento UE)
                </h2>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Control vivo de las secciones técnicas requeridas antes de la introducción en el mercado • Custodia documental (EAD Trust)
                </p>
              </div>

              {currentVersion && (
                <div className="flex items-center gap-2">
                  {!isTechnicalFileSealed ? (
                    <button
                      onClick={() => handleSealTechnicalFile(currentVersion.id)}
                      disabled={closeTechnicalFileMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-bold transition-colors disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {closeTechnicalFileMutation.isPending
                          ? "Precintando en Ledger..."
                          : "Precintar Expediente (WORM Sealing)"}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--status-success)] text-[var(--g-text-inverse)] text-xs font-bold" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Expediente Precintado ({currentVersion.qseal_token?.slice(0, 16)}...)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* List of Technical File Sections */}
            <div className="space-y-3">
              {technicalSections.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]/30 border border-dashed border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                  No se han generado secciones técnicas todavía para este sistema.
                </div>
              ) : (
                technicalSections.map((sec) => {
                  const statusCls = SECTION_STATUS_CHIP[sec.status] || SECTION_STATUS_CHIP.DRAFT;
                  return (
                    <div
                      key={sec.id}
                      className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4 transition-all hover:border-[var(--g-brand-3308)]/50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{sec.section_key}</span>
                          <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{sec.section_title}</h3>
                        </div>
                        <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">
                          {sec.content_summary || "Documentación técnica disponible en el repositorio de custodia."}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {sec.completeness_score !== null && (
                          <div className="text-right">
                            <span className="text-xs font-bold text-[var(--g-brand-3308)]">{sec.completeness_score}%</span>
                            <span className="text-[10px] text-[var(--g-text-secondary)] block">Completitud</span>
                          </div>
                        )}
                        <span className={`px-2.5 py-1 text-xs font-semibold ${statusCls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                          {sec.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Autodiagnósticos & Evaluaciones */}
      {activeTab === "EVALUATIONS" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">Historial de Autodiagnósticos de Conformidad</h2>
            <button
              onClick={() => navigate(`/ai-governance/evaluaciones/nueva?system_id=${system.id}`)}
              className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Nuevo Autodiagnóstico
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
              No hay autodiagnósticos registrados para este sistema.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assessments.map((ass) => (
                <div
                  key={ass.id}
                  onClick={() => navigate(`/ai-governance/evaluaciones/${ass.id}`)}
                  className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 cursor-pointer hover:border-[var(--g-brand-3308)] transition-all hover:shadow-md"
                  style={{ borderRadius: "var(--g-radius-lg)" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{ass.framework}</span>
                      <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-0.5">
                        Evaluación del {ass.assessment_date ? new Date(ass.assessment_date).toLocaleDateString("es-ES") : "N/D"}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-[var(--g-brand-3308)]">{ass.score ?? 0}%</span>
                      <span className="text-[10px] text-[var(--g-text-secondary)] block">Índice Madurez</span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--g-text-secondary)] line-clamp-2">{ass.notes || "Sin observaciones adicionales."}</p>

                  <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
                    <span className={`px-2 py-0.5 font-semibold text-[11px] ${ass.status === "CONFORME" ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]" : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                      {ass.status}
                    </span>
                    <span className="text-[var(--g-brand-3308)] font-semibold inline-flex items-center gap-1">
                      <span>Ver detalles</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Incidentes */}
      {activeTab === "INCIDENTS" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">Registro de Incidentes de IA (Art. 73 RIA)</h2>
            <button
              onClick={() => navigate(`/ai-governance/incidentes/nueva?system_id=${system.id}`)}
              className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Reportar Incidente
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
              No se han registrado incidentes operativos para este sistema.
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => navigate(`/ai-governance/incidentes/${inc.id}`)}
                  className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:border-[var(--g-brand-3308)] transition-all hover:shadow-sm"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--g-text-secondary)]">EXP-INC-{inc.id.slice(0, 6)}</span>
                      <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{inc.title}</h3>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">{inc.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold ${
                        inc.severity === "CRITICA" || inc.severity === "ALTA"
                          ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {inc.severity || "MEDIA"}
                    </span>
                    <span className="text-xs font-bold text-[var(--g-text-primary)]">{inc.status}</span>
                    <ExternalLink className="w-4 h-4 text-[var(--g-text-secondary)]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Model & Dataset Registry */}
      {activeTab === "REGISTRIES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Models */}
          <div
            className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
              <Cpu className="w-5 h-5 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-bold text-[var(--g-text-primary)]">Registro de Modelos Base</h3>
            </div>
            {models.length === 0 ? (
              <p className="text-xs text-[var(--g-text-secondary)] italic">No hay modelos registrados.</p>
            ) : (
              <div className="space-y-3">
                {models.map((m) => (
                  <div key={m.id} className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] space-y-1 text-xs" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <div className="font-bold text-[var(--g-text-primary)]">{m.model_name}</div>
                    <div className="text-[var(--g-text-secondary)]">Tipo: {m.model_type} • Arquitectura: {m.base_architecture || "N/D"}</div>
                    <div className="text-[10px] text-[var(--g-text-secondary)]">Parámetros: {m.parameters_count || "N/D"} • Proveedor: {m.provider || "Interno"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Datasets */}
          <div
            className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
              <Database className="w-5 h-5 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-bold text-[var(--g-text-primary)]">Conjuntos de Datos & Gobernanza (Art. 10)</h3>
            </div>
            {datasets.length === 0 ? (
              <p className="text-xs text-[var(--g-text-secondary)] italic">No hay datasets registrados.</p>
            ) : (
              <div className="space-y-3">
                {datasets.map((d) => (
                  <div key={d.id} className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] space-y-1 text-xs" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-[var(--g-text-primary)]">{d.dataset_name}</span>
                      <span className="font-mono text-[10px] bg-[var(--g-surface-card)] px-1.5 py-0.5 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        {d.dataset_type}
                      </span>
                    </div>
                    <div className="text-[var(--g-text-secondary)]">Registros: {d.records_count?.toLocaleString("es-ES") || "N/D"} • Procedencia: {d.provenance || "Corporativa"}</div>
                    <div className="flex gap-2 text-[10px] pt-1">
                      <span className={`px-1.5 py-0.5 ${d.contains_pii ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]" : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"}`} style={{ borderRadius: "var(--g-radius-sm)" }}>
                        {d.contains_pii ? "Datos Personales (RGPD)" : "Sin PII"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Vigilancia Poscomercialización */}
      {activeTab === "POST_MARKET" && (
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] pb-3">
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Vigilancia Poscomercialización & Indicadores de Rendimiento (Art. 72 RIA)
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Monitorización continua de deriva (drift), precisión, latencia y equidad algorítmica.
            </p>
          </div>

          {indicators.length === 0 ? (
            <p className="text-xs text-[var(--g-text-secondary)] italic py-4 text-center">
              No hay indicadores de monitorización configurados para este sistema.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {indicators.map((ind) => (
                <div key={ind.id} className="p-4 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] space-y-2 text-xs" style={{ borderRadius: "var(--g-radius-md)" }}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-[var(--g-text-primary)]">{ind.name}</span>
                    <span className={`px-2 py-0.5 font-semibold text-[10px] ${ind.status === "OPTIMAL" ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]" : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                      {ind.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[var(--g-text-secondary)] pt-1">
                    <div>Tipo: <span className="font-semibold text-[var(--g-text-primary)]">{ind.indicator_type}</span></div>
                    <div>Umbral: <span className="font-mono text-[var(--g-text-primary)]">{ind.threshold || "N/A"}</span></div>
                    <div>Valor actual: <span className="font-bold text-[var(--g-brand-3308)]">{ind.current_value || "Normal"}</span></div>
                    <div>Última eval: <span className="text-[var(--g-text-primary)]">{ind.last_evaluated_at ? new Date(ind.last_evaluated_at).toLocaleDateString("es-ES") : "Automática"}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Evaluación de Impacto en Derechos Fundamentales (FRIA - Art. 27 RIA) */}
      {activeTab === "FRIA" && (
        <div className="space-y-6">
          {/* FRIA Header */}
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                    ART. 27 REGLAMENTO IA (FRIA)
                  </span>
                  <span className="text-xs text-[var(--g-text-secondary)]">•</span>
                  <span className="text-xs text-[var(--g-text-secondary)] font-mono">
                    VERSIÓN {fria?.version_number || "1.0"}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-[var(--g-text-primary)]">
                  Evaluación de Impacto en Derechos Fundamentales
                </h2>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Obligación previa al despliegue para sistemas de alto riesgo • Notificación preceptiva a la Autoridad de Vigilancia del Mercado (AESIA)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {fria?.status || "APROBADA & NOTIFICADA"}
                </span>
                <span
                  className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  AESIA Notificada: SÍ
                </span>
              </div>
            </div>

            {/* DPO & AI Officer Signoffs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
              <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <span className="text-[var(--g-text-secondary)] block mb-1">Aprobación DPO (RGPD):</span>
                <span className="font-semibold text-[var(--g-text-primary)]">
                  {fria?.approved_by_dpo || "dpo@empresa.com"}
                </span>
              </div>
              <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <span className="text-[var(--g-text-secondary)] block mb-1">Aprobación AI Officer (RIA):</span>
                <span className="font-semibold text-[var(--g-text-primary)]">
                  {fria?.approved_by_ai_officer || "ai.officer@empresa.com"}
                </span>
              </div>
              <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <span className="text-[var(--g-text-secondary)] block mb-1">Custodia Probatoria:</span>
                <span className="font-mono font-bold text-[var(--g-brand-3308)]">
                  QSEAL-EADTRUST-SHA512
                </span>
              </div>
            </div>
          </div>

          {/* 6 Structured Obligation Blocks (Art. 27.1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Block 1: Procesos de Negocio (Art. 27.1.a) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <FileText className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">1. Procesos del Desplegador (Art. 27.1.a)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Proceso de Negocio:</strong>
                  Suscripción y fijación de primas en pólizas de salud y vida individual.
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Punto de Decisión Algorítmica:</strong>
                  Cálculo del recargo o exclusión actuarial antes de la emisión de la oferta contractual.
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Rol Humano:</strong>
                  Suscripción asistida con revisión humana preceptiva para cualquier recargo &gt; 15%.
                </div>
              </div>
            </div>

            {/* Block 2: Perfil y Frecuencia de Uso (Art. 27.1.b) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <Calendar className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">2. Frecuencia y Período de Uso (Art. 27.1.b)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Frecuencia de Inferencia:</strong>
                  On-demand (en tiempo real por cada cotización solicitada).
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Volumen Estimado:</strong>
                  Aprox. 45.000 evaluaciones anuales.
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Cadencia de Revisión FRIA:</strong>
                  Semestral o tras cualquier cambio sustancial en datos o modelos.
                </div>
              </div>
            </div>

            {/* Block 3: Colectivos y Grupos Afectados (Art. 27.1.c) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <Users className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">3. Colectivos y Grupos Afectados (Art. 27.1.c)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div className="p-2.5 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  <div className="flex justify-between font-bold text-[var(--g-text-primary)]">
                    <span>Tomadores y Asegurados (Personas Físicas)</span>
                    <span className="text-[var(--status-warning)] font-semibold">Impacto Directo</span>
                  </div>
                  <p className="mt-1">Determinación de acceso al aseguramiento y condiciones económicas.</p>
                </div>
                <div className="p-2.5 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  <div className="flex justify-between font-bold text-[var(--g-text-primary)]">
                    <span>Colectivos Vulnerables / Preexistencias</span>
                    <span className="text-[var(--status-error)] font-semibold">Especial Protección</span>
                  </div>
                  <p className="mt-1">Monitorización continua contra discriminación indirecta por motivos de salud o edad.</p>
                </div>
              </div>
            </div>

            {/* Block 4: Riesgos a Derechos Fundamentales (Art. 27.1.d) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <ShieldAlert className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">4. Riesgos a Derechos Fundamentales (Art. 27.1.d)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div className="flex justify-between items-center py-1 border-b border-[var(--g-border-subtle)]">
                  <span>No discriminación (Art. 21 CDFUE)</span>
                  <span className="font-bold text-[var(--status-success)]">Mitigado (Bajo)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--g-border-subtle)]">
                  <span>Protección de datos (Art. 8 CDFUE)</span>
                  <span className="font-bold text-[var(--status-success)]">Mitigado (Bajo)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--g-border-subtle)]">
                  <span>Transparencia y recurso efectivo</span>
                  <span className="font-bold text-[var(--status-success)]">Mitigado (Bajo)</span>
                </div>
              </div>
            </div>

            {/* Block 5: Supervisión Humana (Art. 27.1.e) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <ShieldCheck className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">5. Supervisión Humana Efectiva (Art. 27.1.e)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Derecho de Veto / Override:</strong>
                  El actuario y el suscriptor tienen potestad técnica para revocar o alterar la recomendación algorítmica.
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Botón de Parada de Emergencia:</strong>
                  Capacidad de suspender la inferencia automática en tiempo real ante anomalías detectadas.
                </div>
              </div>
            </div>

            {/* Block 6: Gobernanza de Remedios (Art. 27.1.f) */}
            <div className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
              <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-2">
                <Sparkles className="w-4 h-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">6. Gobernanza de Remedios & Quejas (Art. 27.1.f)</h3>
              </div>
              <div className="space-y-2 text-xs text-[var(--g-text-secondary)] leading-relaxed">
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Canal de Reclamaciones Específico:</strong>
                  Servicio de Atención al Cliente con formulario de revisión humana para decisiones algorítmicas.
                </div>
                <div>
                  <strong className="text-[var(--g-text-primary)] block">Escalado al Comité de Riesgos:</strong>
                  Umbral de escalado si las quejas sobre sesgo superan el 0.1% de las cotizaciones mensuales.
                </div>
              </div>
            </div>
          </div>

          {/* PUENTE DE REFERENCIAS CRUZADAS CON LA EIPD (Art. 27.4 RIA & Art. 35 RGPD) */}
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
                  Interoperabilidad FRIA ⟷ EIPD (Art. 27.4 RIA & Art. 35 RGPD)
                </h3>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Reutilización trazable de análisis de privacidad sin dilución documental • Preservación de la autonomía de ambas evaluaciones
                </p>
              </div>
              <span className="font-mono text-xs text-[var(--g-brand-3308)] font-bold bg-[var(--g-surface-subtle)] px-2.5 py-1" style={{ borderRadius: "var(--g-radius-sm)" }}>
                3 REFERENCIAS ACTIVAS (VALID)
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  riaPoint: "Art. 27.1(a) — Operaciones de tratamiento",
                  dpiaSec: "EIPD-SEC-02: Descripción sistemática de tratamientos y bases de legitimación",
                  hash: "SHA512: 8f9a2b1c4e6d7890...",
                  coverage: "COBERTURA TOTAL",
                  status: "VALID",
                },
                {
                  riaPoint: "Art. 27.1(c) — Categorías de interesados",
                  dpiaSec: "EIPD-SEC-04: Mapeo de interesados y datos de categorías especiales (Salud Art. 9)",
                  hash: "SHA512: 3d4e5f6a7b8c9012...",
                  coverage: "COBERTURA PARCIAL",
                  status: "VALID",
                },
                {
                  riaPoint: "Art. 27.1(d) — Medidas de seguridad y cifrado",
                  dpiaSec: "EIPD-SEC-07: Salvaguardas técnicas, cifrado en reposo y control de accesos",
                  hash: "SHA512: a1b2c3d4e5f67890...",
                  coverage: "COBERTURA TOTAL",
                  status: "VALID",
                },
              ].map((ref, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="font-bold text-[var(--g-text-primary)]">{ref.riaPoint}</div>
                    <div className="text-[var(--g-text-secondary)]">{ref.dpiaSec}</div>
                    <div className="font-mono text-[10px] text-[var(--g-text-secondary)]">{ref.hash}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[10px] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                      {ref.coverage}
                    </span>
                    <span className="font-bold text-[10px] bg-[var(--status-success)] text-[var(--g-text-inverse)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-full)" }}>
                      {ref.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edición de Sistema */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-xl p-6 space-y-4 shadow-2xl"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">Editar Ficha del Sistema IA</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Nombre del Sistema *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Tipo de Sistema</label>
                  <input
                    type="text"
                    value={editSystemType}
                    onChange={(e) => setEditSystemType(e.target.value)}
                    placeholder="e.g. LLM, Scoring ML, Computer Vision..."
                    className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Nivel de Riesgo</label>
                  <select
                    value={editRiskLevel}
                    onChange={(e) => setEditRiskLevel(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="Alto">Alto Riesgo (Anexo III)</option>
                    <option value="Limitado">Riesgo Limitado (Transparencia)</option>
                    <option value="Mínimo">Riesgo Mínimo</option>
                    <option value="Inaceptable">Riesgo Inaceptable (Prohibido)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Proveedor / Vendor</label>
                  <input
                    type="text"
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="ACTIVO">ACTIVO (En producción)</option>
                    <option value="EN_EVALUACION">EN EVALUACIÓN</option>
                    <option value="SUSPENDIDO">SUSPENDIDO</option>
                    <option value="RETIRADO">RETIRADO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Caso de Uso y Finalidad</label>
                <textarea
                  rows={2}
                  value={editUseCase}
                  onChange={(e) => setEditUseCase(e.target.value)}
                  className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--g-border-subtle)]">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateSystemMutation.isPending}
                className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {updateSystemMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Declaración de Conformidad UE */}
      <DeclaracionConformidadModal
        system={system}
        isOpen={showDeclarationModal}
        onClose={() => setShowDeclarationModal(false)}
      />

      {/* Modal de Escalado a Secretaría */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={handleEscalateSubmit}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg p-6 space-y-4 shadow-2xl"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[var(--g-brand-3308)]" />
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Escalar Asunto a Secretaría Societaria
                </h3>
              </div>
              <button type="button" onClick={() => setShowEscalationModal(false)} className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--g-text-secondary)]">
              Genera una propuesta formal para incorporar la aprobación del expediente técnico de este sistema de IA
              en el orden del día del Consejo de Administración o Comité Ejecutivo.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Órgano de Gobierno Destino</label>
                <select
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración</option>
                  <option value="COM_EJEC">Comisión Ejecutiva</option>
                  <option value="COM_AUDIT">Comisión de Auditoría y Control</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Materia / Título de la Propuesta</label>
                <input
                  type="text"
                  required
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--g-text-primary)] mb-1">Justificación y Rationale</label>
                <textarea
                  rows={3}
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--g-border-subtle)]">
              <button
                type="button"
                onClick={() => setShowEscalationModal(false)}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Crear Propuesta en Secretaría
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
