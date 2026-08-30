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

/** Vocabularios de la FRIA en castellano: la superficie es jurídica y en español. */
const FRECUENCIA_USO: Record<string, string> = {
  CONTINUOUS: "continua",
  BATCH_DAILY: "por lotes, diaria",
  ON_DEMAND: "a demanda",
  SEASONAL: "estacional",
};
const NIVEL: Record<string, string> = {
  LOW: "baja", MEDIUM: "media", HIGH: "alta", CRITICAL: "crítica",
};
const DERECHO: Record<string, string> = {
  NON_DISCRIMINATION: "no discriminación",
  HUMAN_DIGNITY: "dignidad humana",
  PRIVACY: "vida privada y datos personales",
  FAIR_TRIAL: "tutela judicial efectiva",
  FREEDOM_EXPRESSION: "libertad de expresión",
  CONSUMER_PROTECTION: "protección de los consumidores",
};
const PUNTO_RIA: Record<string, string> = {
  ART_27_1_A: "art. 27.1 (a)", ART_27_1_C: "art. 27.1 (c)",
  ART_27_1_D: "art. 27.1 (d)", ART_27_1_F: "art. 27.1 (f)",
};
const COBERTURA: Record<string, string> = { FULL: "completa", PARTIAL: "parcial" };
const VALIDEZ: Record<string, string> = {
  VALID: "vigente", IN_REVIEW: "en revisión", REVOKED: "revocada",
};

/** Estado de la FRIA en castellano. Sin valor no se inventa ninguno. */
function statusLabelFria(estado: string | null | undefined): string {
  switch (estado) {
    case "DRAFT": return "Borrador";
    case "IN_REVIEW": return "En revisión";
    case "APPROVED": return "Aprobada";
    case "SUPERSEDED": return "Sustituida";
    default: return "Estado no registrado";
  }
}

/**
 * Bloque del art. 27.1. Cuando no hay dato lo dice: antes esta pestaña
 * presentaba prosa fija de una aseguradora como si fuera la evaluación
 * del sistema que se estuviera mirando.
 */
function FriaBlock({
  titulo,
  vacio,
  nota,
  children,
}: {
  titulo: string;
  vacio: boolean;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{titulo}</h3>
      <div className="space-y-3 text-xs text-[var(--g-text-secondary)]">
        {vacio ? <p>{nota ?? "Sin datos registrados para este apartado."}</p> : children}
      </div>
    </div>
  );
}

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

  const { data: fria, isLoading: friaLoading, isError: friaError } = useFriaBySystem(id);
  const { data: friaDetailsRaw } = useFriaDetails(fria?.id);
  // `friaDetails` es undefined en el render en que `fria` pasa a truthy: la clave
  // de la consulta de detalle es nueva y aún no ha resuelto. Sin este valor por
  // defecto, el primer render del único camino con dato lanza un TypeError que
  // el ErrorBoundary global convierte en caída de la página entera.
  const friaDetails = friaDetailsRaw ?? {
    processes: [],
    useProfile: null,
    affectedGroups: [],
    rightsRisks: [],
    remediation: null,
    crossReferences: [],
  };

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
    setEditRiskLevel(system.risk_level || "");
    setEditVendor(system.vendor || "");
    setEditStatus(system.status || "");
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
        // Sin token: no interviene ningún prestador de confianza. El registro
        // es interno y su integridad la da el hash SHA-512 del manifiesto.
        qsealToken: undefined,
        tsqToken: undefined,
        signedBy: user?.email ?? undefined,
      });
      toast.success("Expediente técnico cerrado y registrado con hash SHA-512");
      refetchVersions();
      refetchSections();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al cerrar el expediente técnico: ${msg}`);
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
                  Versión actual: {currentVersion?.version_label || "sin versión registrada"}
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
              Riesgo {system.risk_level || "sin clasificar"}
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
            <span className="font-semibold text-[var(--g-text-primary)]">{system.system_type || "No declarado"}</span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Proveedor / Responsable:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{system.vendor || "No declarado"}</span>
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
              {isTechnicalFileSealed ? "Cerrado" : "Abierto en edición"}
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
                  Control vivo de las secciones técnicas requeridas antes de la introducción en el mercado • Registro interno con hash SHA-512. El cierre registrado no está disponible: la custodia de evidencia sólo admite registros abiertos y sin firmar desde la consola.
                </p>
              </div>

              {currentVersion && (
                <div className="flex items-center gap-2">
                  {!isTechnicalFileSealed ? (
                    <button
                      onClick={() => handleSealTechnicalFile(currentVersion.id)}
                      disabled
                      title="El cierre registrado del expediente no está disponible: la custodia de evidencia sólo admite registros abiertos y sin firmar desde la consola."
                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-bold transition-colors disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {closeTechnicalFileMutation.isPending
                          ? "Cerrando expediente..."
                          : "Cerrar expediente técnico (no disponible)"}
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--status-success)] text-[var(--g-text-inverse)] text-xs font-bold" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Expediente cerrado</span>
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
                          <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{sec.section_code}</span>
                          <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{sec.title}</h3>
                        </div>
                        <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">
                          {(sec.evidence_refs?.length ?? 0) > 0
                            ? `${sec.evidence_refs!.length} referencia(s) de evidencia`
                            : "Sin evidencia registrada en esta sección."}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {sec.reviewed_at && (
                          <div className="text-right">
                            <span className="text-xs font-bold text-[var(--g-brand-3308)]">
                              {new Date(sec.reviewed_at).toLocaleDateString("es-ES")}
                            </span>
                            <span className="text-[10px] text-[var(--g-text-secondary)] block">Revisada</span>
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

                  <p className="text-xs text-[var(--g-text-secondary)] line-clamp-2">{ass.notes || "Sin notas registradas."}</p>

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
                      {inc.severity || "Sin severidad"}
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
                    <div className="text-[var(--g-text-secondary)]">Tipo: {m.model_type || "N/D"} • Versión: {m.model_version || "N/D"}</div>
                    <div className="text-[10px] text-[var(--g-text-secondary)]">Uso previsto: {m.intended_use || "No declarado"} • Proveedor: {m.provider || "No declarado"}</div>
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
                    <div className="text-[var(--g-text-secondary)]">Origen: {d.source_system || "No declarado"} • Base de licitud: {d.lawful_basis || "No declarada"}</div>
                    <div className="flex gap-2 text-[10px] pt-1">
                      {/* Sin dato no se afirma nada: la ausencia de categorías
                          declaradas no acredita que no haya datos personales. */}
                      <span className="px-1.5 py-0.5 bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        {(d.data_categories?.length ?? 0) > 0
                          ? `Categorías declaradas: ${d.data_categories!.length}`
                          : "Categorías de datos no declaradas"}
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
                    <span className="font-bold text-sm text-[var(--g-text-primary)]">{ind.indicator_name}</span>
                    <span className={`px-2 py-0.5 font-semibold text-[10px] ${ind.status === "OPTIMAL" ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]" : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                      {ind.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[var(--g-text-secondary)] pt-1">
                    <div>Métrica: <span className="font-semibold text-[var(--g-text-primary)]">{ind.metric_key || "N/D"}</span></div>
                    <div>Umbral: <span className="font-mono text-[var(--g-text-primary)]">{ind.threshold_config ? JSON.stringify(ind.threshold_config) : "No definido"}</span></div>
                    <div>Valor actual: <span className="font-bold text-[var(--g-brand-3308)]">{ind.current_value == null ? "Sin medición" : typeof ind.current_value === "object" ? JSON.stringify(ind.current_value) : String(ind.current_value)}</span></div>
                    <div>Última observación: <span className="text-[var(--g-text-primary)]">{ind.last_observed_at ? new Date(ind.last_observed_at).toLocaleDateString("es-ES") : "Sin observaciones"}</span></div>
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
          {friaLoading || friaError || !fria ? (
            <div
              className="p-8 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] text-center space-y-2"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <ShieldCheck className="w-8 h-8 mx-auto text-[var(--g-text-secondary)]" />
              {friaLoading ? (
                <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                  Consultando la evaluación de impacto…
                </h2>
              ) : friaError ? (
                <>
                  <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                    No se ha podido consultar la evaluación de impacto
                  </h2>
                  <p className="text-xs text-[var(--g-text-secondary)] max-w-xl mx-auto">
                    La lectura ha fallado, así que no se sabe si existe. No se muestra como
                    ausencia: un error de consulta no acredita que la evaluación no exista.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                    No consta acreditado que el artículo 27 alcance a este sistema
                  </h2>
                  <p className="text-xs text-[var(--g-text-secondary)] max-w-2xl mx-auto">
                    La evaluación de impacto en derechos fundamentales del Reglamento (UE) 2024/1689
                    no obliga a todo desplegador. Exige <strong>dos condiciones a la vez</strong>, y
                    de ninguna de las dos consta acreditación:
                  </p>
                  <div className="max-w-2xl mx-auto space-y-3 pt-2 text-left">
                    <div
                      className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] text-xs space-y-1"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <span className="font-bold text-[var(--g-text-primary)] block">
                        1 · Que el sistema sea de alto riesgo del anexo III
                      </span>
                      <span className="block text-[var(--g-text-secondary)]">
                        El propio artículo excluye los de su punto 2. No se ha realizado la
                        clasificación del art. 6 sobre este inventario, así que no consta ni que lo
                        sea ni que no lo sea.
                      </span>
                    </div>
                    <div
                      className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] text-xs space-y-1"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <span className="font-bold text-[var(--g-text-primary)] block">
                        2 · Que el desplegador sea de una de las tres categorías del artículo
                      </span>
                      <span className="block text-[var(--g-text-secondary)]">
                        Organismo de Derecho público, entidad privada que preste servicios públicos,
                        o desplegador de los sistemas del anexo III, punto 5, letras b) y c)
                        —solvencia crediticia y evaluación de riesgos en seguros de vida y salud—.
                      </span>
                      <span className="block text-[var(--g-text-secondary)]">
                        No hay en el corpus documental de este tenant ningún elemento que acredite
                        ninguna de las tres. Su ausencia no prueba lo contrario: el corpus no cubre
                        la contratación pública.
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)] max-w-2xl mx-auto pt-1">
                    Determinar si el artículo alcanza al sujeto es cuestión jurídica, no de
                    configuración. Si se resuelve que sí, la evaluación se registra aquí y esta
                    pantalla pasa a mostrarla.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
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
                        VERSIÓN {fria.version_number}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--g-text-primary)]">{fria.title}</h2>
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      Obligación previa al despliegue para sistemas de alto riesgo · Notificación a la
                      Autoridad de Vigilancia del Mercado
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {statusLabelFria(fria.status)}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        fria.market_surveillance_notified
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {fria.market_surveillance_notified
                        ? `Notificada${fria.notification_date ? ` el ${new Date(fria.notification_date).toLocaleDateString("es-ES")}` : ""}`
                        : "No notificada"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                  <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <span className="text-[var(--g-text-secondary)] block mb-1">Aprobación DPO (RGPD):</span>
                    <span className="font-semibold text-[var(--g-text-primary)]">
                      {fria.approved_by_dpo || "Sin aprobación registrada"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <span className="text-[var(--g-text-secondary)] block mb-1">Aprobación AI Officer (RIA):</span>
                    <span className="font-semibold text-[var(--g-text-primary)]">
                      {fria.approved_by_ai_officer || "Sin aprobación registrada"}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                    <span className="text-[var(--g-text-secondary)] block mb-1">Evaluada por:</span>
                    <span className="font-semibold text-[var(--g-text-primary)]">
                      {fria.assessed_by || "Sin evaluador registrado"}
                    </span>
                  </div>
                </div>

                {fria.fria_summary && (
                  <p className="text-xs text-[var(--g-text-secondary)] pt-2">{fria.fria_summary}</p>
                )}
              </div>

              {/* Bloques del art. 27.1, servidos desde aims_fria_* */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FriaBlock titulo="27.1 (a) · Procesos y punto de decisión" vacio={friaDetails.processes.length === 0}>
                  {friaDetails.processes.map((p) => (
                    <div key={p.id} className="space-y-0.5">
                      <span className="font-semibold text-[var(--g-text-primary)] block">{p.business_process}</span>
                      <span className="block">Finalidad: {p.intended_purpose}</span>
                      <span className="block">Decisión: {p.decision_point}</span>
                      <span className="block">Papel humano: {p.human_role || "No declarado"}</span>
                    </div>
                  ))}
                </FriaBlock>

                <FriaBlock titulo="27.1 (b) · Periodo y frecuencia de uso" vacio={!friaDetails.useProfile}>
                  {friaDetails.useProfile && (
                    <div className="space-y-0.5">
                      <span className="block">Frecuencia: {FRECUENCIA_USO[friaDetails.useProfile.usage_frequency] ?? friaDetails.useProfile.usage_frequency}</span>
                      <span className="block">Volumen estimado: {friaDetails.useProfile.estimated_volume || "No declarado"}</span>
                      <span className="block">Revisión: {friaDetails.useProfile.review_periodicity || "No declarada"}</span>
                    </div>
                  )}
                </FriaBlock>

                <FriaBlock titulo="27.1 (c) · Personas y grupos afectados" vacio={friaDetails.affectedGroups.length === 0}>
                  {friaDetails.affectedGroups.map((g) => (
                    <div key={g.id} className="space-y-0.5">
                      <span className="font-semibold text-[var(--g-text-primary)] block">
                        {g.group_name}
                        {g.is_vulnerable_group ? " · grupo vulnerable" : ""}
                      </span>
                      <span className="block">Impacto: {g.impact_type === "DIRECT" ? "directo" : "indirecto"}</span>
                      {g.group_description && <span className="block">{g.group_description}</span>}
                    </div>
                  ))}
                </FriaBlock>

                <FriaBlock titulo="27.1 (d) · Riesgos para los derechos fundamentales" vacio={friaDetails.rightsRisks.length === 0}>
                  {friaDetails.rightsRisks.map((r) => (
                    <div key={r.id} className="space-y-0.5">
                      <span className="font-semibold text-[var(--g-text-primary)] block">{DERECHO[r.fundamental_right] ?? r.fundamental_right}</span>
                      <span className="block">{r.harm_scenario}</span>
                      <span className="block">
                        Probabilidad {NIVEL[r.likelihood] ?? r.likelihood} · Severidad {NIVEL[r.severity] ?? r.severity} · Riesgo residual {NIVEL[r.residual_risk] ?? r.residual_risk}
                      </span>
                      {r.mitigation_measures && <span className="block">Mitigación: {r.mitigation_measures}</span>}
                    </div>
                  ))}
                </FriaBlock>

                <FriaBlock
                  titulo="27.1 (e) · Medidas de supervisión humana"
                  vacio
                  nota="El modelo de datos todavía no recoge este apartado del artículo 27.1; no hay nada que mostrar y no se sustituye por texto genérico."
                >
                  {null}
                </FriaBlock>

                <FriaBlock titulo="27.1 (f) · Gobernanza, reclamación y reparación" vacio={!friaDetails.remediation}>
                  {friaDetails.remediation && (
                    <div className="space-y-0.5">
                      <span className="block">Desencadenante: {friaDetails.remediation.trigger_event}</span>
                      <span className="block">Órgano: {friaDetails.remediation.governance_body}</span>
                      <span className="block">Canal de reclamación: {friaDetails.remediation.complaint_channel}</span>
                      <span className="block">Reparación: {friaDetails.remediation.redress_procedure}</span>
                    </div>
                  )}
                </FriaBlock>
              </div>

              {/* Puente FRIA ⟷ EIPD (art. 27.4 RIA y art. 35 RGPD) */}
              <div
                className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-3"
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
                    Referencias cruzadas con la EIPD (art. 27.4 RIA · art. 35 RGPD)
                  </h3>
                  <span className="text-xs text-[var(--g-text-secondary)]">
                    {friaDetails.crossReferences.length} registrada(s)
                  </span>
                </div>
                {friaDetails.crossReferences.length === 0 ? (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    Sin referencias cruzadas registradas.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {friaDetails.crossReferences.map((x) => (
                      <div
                        key={x.id}
                        className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] space-y-0.5"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <span className="font-semibold text-[var(--g-text-primary)] block">
                          {PUNTO_RIA[x.ria_obligation_point] ?? x.ria_obligation_point} → {x.dpia_section}
                        </span>
                        <span className="block text-[var(--g-text-secondary)]">
                          Cobertura {COBERTURA[x.coverage_type] ?? x.coverage_type} · estado {VALIDEZ[x.validation_status] ?? x.validation_status}
                        </span>
                        <span className="block font-mono text-[10px] text-[var(--g-text-secondary)]">
                          {x.source_hash ? `hash ${x.source_hash}` : "sin hash de origen registrado"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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
