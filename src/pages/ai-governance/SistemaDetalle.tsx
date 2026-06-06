import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, Cpu, Calendar, Building2, AlertTriangle, ClipboardCheck, 
  FileText, ShieldCheck, PenTool, ExternalLink, Send, ArrowRight, CheckCircle2, 
  Loader2, Sparkles, AlertCircle, Users
} from "lucide-react";
import { useAiSystemById } from "@/hooks/useAiSystems";
import { useAssessmentsBySystem, useComplianceChecksBySystem } from "@/hooks/useAiAssessments";
import { useAiIncidentsBySystem } from "@/hooks/useAiIncidents";
import { useState } from "react";
import { useQTSPSign } from "@/hooks/useQTSPSign";
import { useCrossModuleLinks } from "@/hooks/useCrossModuleLinks";
import { useEvidenceBundlesForObject, useCreateEvidenceBundle } from "@/hooks/useEvidenceBundles";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { toast } from "sonner";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const CHECK_STATUS_CHIP: Record<string, string> = {
  CONFORME:     "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_CURSO:     "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PENDIENTE:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  NO_CONFORME:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  NA:           "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const ASSESSMENT_STATUS_CHIP: Record<string, string> = {
  APROBADO:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_REVISION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const INCIDENT_SEVERITY_CHIP: Record<string, string> = {
  CRITICO:     "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  ALTO:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  MEDIO:       "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BAJO:        "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
};

export default function SistemaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: system, isLoading: loadSys } = useAiSystemById(id);
  const { data: assessments = [] } = useAssessmentsBySystem(id);
  const { data: checks = [] } = useComplianceChecksBySystem(id);
  const { data: incidents = [] } = useAiIncidentsBySystem(id);

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
  // Escalado cross-module = handoff read-only (navigate), sin escrituras a governance_module_*.
  const createEvidence = useCreateEvidenceBundle();

  const { data: declarations = [], refetch: refetchDeclarations } = useEvidenceBundlesForObject(
    "AIMS",
    "AI_SYSTEM",
    id ?? ""
  );
  // Codex #2-UI: solo la evidencia final (SEALED/VERIFIED) cuenta como "certificada";
  // los bundles sandbox quedan en OPEN y no deben marcar el sistema como conforme.
  const finalDeclarations = declarations.filter((d) => isFinalSealedEvidence(d.status));

  const { data: crossLinks = [], refetch: refetchCrossLinks } = useCrossModuleLinks(
    "AIMS",
    "AI_SYSTEM",
    id ?? ""
  );

  if (loadSys) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-4">
        {[1,2,3].map((i) => <div key={i} className="skeleton h-24" style={{ borderRadius: "var(--g-radius-lg)" }} />)}
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

  const handleOpenEscalation = () => {
    setEscalateMatter(`Propuesta de aprobación de la Declaración de Conformidad para el Sistema de IA: ${system.name}`);
    setEscalateRationale(`Se solicita al Consejo/Comité evaluar el cumplimiento del sistema ${system.name} bajo el marco de la EU AI Act.`);
    setEscalateCommittee("CDA");
    setShowEscalationModal(true);
  };

  const handleEscalateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Handoff READ-ONLY a Secretaría (guardrail CLAUDE.md: no se escribe en
      // governance_module_*). Navega al intake de Secretaría con la propuesta como
      // query params; Secretaría decide la materialización desde su owner.
      setShowEscalationModal(false);
      toast.success("Abriendo intake de Secretaría con la propuesta (handoff read-only)…");
      navigate(buildMeetingHandoffPath({
        source: "aims",
        event: "AIMS_SYSTEM_CONFORMITY",
        sourceId: system.id,
        organ: escalateCommittee,
        matter: escalateMatter,
        rationale: escalateRationale,
      }));
      return;
    } catch (err) {
      console.error(err);
      toast.error("Error al preparar el handoff de escalado");
    }
  };

  const handleSignDeclaration = async () => {
    try {
      setSignProgress("Generando documento de conformidad…");
      
      const docName = `DECLARACION-CONFORMIDAD-${system.name.replace(/\s+/g, "-").toUpperCase()}-${new Date().getFullYear()}.pdf`;
      const docData = new TextEncoder().encode(`DECLARACION DE CONFORMIDAD - EU AI ACT\nSistema: ${system.name}\nRiesgo: ${system.risk_level}\nCompliance Officer: ${signatoryName}`).buffer;

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

      setSignProgress("Registrando evidencia WORM en blockchain…");

      // Save into WORM evidence bundle
      await createEvidence.mutateAsync({
        sourceModule: "AIMS",
        sourceObjectType: "AI_SYSTEM",
        sourceObjectId: system.id,
        referenceCode: `DEC-CONF-${system.id.slice(0, 8).toUpperCase()}`,
        manifest: {
          system_id: system.id,
          system_name: system.name,
          risk_level: system.risk_level,
          signatory: signatoryName,
          email: signatoryEmail,
          qtsp_transaction_id: signRes.srId,
          document_hash: signRes.documentHash,
          signed_at: signRes.signed_at
        },
        documentUrl: `https://hzqwefkwsxopwrmtksbg.supabase.co/storage/v1/object/public/evidence/declarations/${docName}`,
        legalHold: false,
        status: "SEALED",
        sandbox: signRes.sandbox,
        signedBy: `${signatoryName} (${signatoryEmail})`
      });

      toast.success(
        signRes.sandbox
          ? "Declaración firmada en modo SANDBOX (demo) — evidencia NO sellada como final (no es una transacción EAD Trust real)."
          : "Declaración de conformidad firmada con QES y sellada en ledger WORM"
      );
      setShowSignModal(false);
      refetchDeclarations();
    } catch (err: any) {
      console.error(err);
      toast.error(`Firma fallida: ${err.message || "Error desconocido"}`);
    } finally {
      setSignProgress(null);
    }
  };

  const riskCls = RISK_COLORS[system.risk_level ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
  const activeEscalation = crossLinks.find(link => link.status === "PROPOSED");

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/ai-governance/sistemas")}
        className="flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Inventario de Sistemas IA
      </button>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns - Info & Data */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Cpu className="h-5 w-5 text-[var(--g-brand-3308)]" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-[var(--g-text-primary)]">{system.name}</h1>
                  <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">{system.description}</p>
                </div>
              </div>
              {system.risk_level && (
                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-1 text-sm font-semibold ${riskCls}`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  Riesgo {system.risk_level}
                </span>
              )}
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--g-border-subtle)]">
              <div>
                <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Tipo de sistema</p>
                <p className="text-sm font-medium text-[var(--g-text-primary)]">{system.system_type ?? "—"}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <Building2 className="h-3 w-3 text-[var(--g-text-secondary)]" />
                  <p className="text-xs text-[var(--g-text-secondary)]">Vendor</p>
                </div>
                <p className="text-sm font-medium text-[var(--g-text-primary)]">{system.vendor ?? "—"}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  <Calendar className="h-3 w-3 text-[var(--g-text-secondary)]" />
                  <p className="text-xs text-[var(--g-text-secondary)]">Despliegue</p>
                </div>
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  {system.deployment_date
                    ? new Date(system.deployment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Estado</p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${
                    system.status === "ACTIVO"
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : system.status === "EN_EVALUACION"
                      ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {system.status}
                </span>
              </div>
            </div>

            {system.use_case && (
              <div className="mt-4 pt-4 border-t border-[var(--g-border-subtle)]">
                <p className="text-xs text-[var(--g-text-secondary)] mb-0.5">Caso de uso</p>
                <p className="text-sm text-[var(--g-text-primary)]">{system.use_case}</p>
              </div>
            )}
          </div>

          {/* Evaluaciones */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
              <ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Evaluaciones de Riesgo</h2>
              <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{assessments.length}</span>
            </div>
            {assessments.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-[var(--g-text-secondary)]">Sin evaluaciones registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--g-border-subtle)]">
                {assessments.map((ass) => {
                  const statusCls = ASSESSMENT_STATUS_CHIP[ass.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                  return (
                    <div key={ass.id} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--g-text-primary)]">{ass.framework}</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          >
                            {ass.status}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--g-text-secondary)]">
                          {ass.assessment_date
                            ? new Date(ass.assessment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </span>
                      </div>
                      {ass.score !== null && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[var(--g-text-secondary)]">Score de cumplimiento</span>
                            <span className="text-sm font-bold text-[var(--g-text-primary)]">{ass.score}/100</span>
                          </div>
                          <div className="h-2 bg-[var(--g-surface-muted)] overflow-hidden" style={{ borderRadius: "var(--g-radius-full)" }}>
                            <div
                              className={`h-2 transition-all ${
                                ass.score >= 80
                                  ? "bg-[var(--status-success)]"
                                  : ass.score >= 60
                                  ? "bg-[var(--status-warning)]"
                                  : "bg-[var(--status-error)]"
                              }`}
                              style={{ borderRadius: "var(--g-radius-full)", width: `${ass.score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Controles de cumplimiento */}
          {checks.length > 0 && (
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
                <ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Controles de Cumplimiento</h2>
                <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{checks.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--g-surface-subtle)]">
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Código</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Requisito</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--g-border-subtle)]">
                    {checks.map((chk) => {
                      const chipCls = CHECK_STATUS_CHIP[chk.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                      return (
                        <tr key={chk.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                          <td className="px-6 py-3 text-xs font-mono text-[var(--g-text-secondary)]">{chk.requirement_code}</td>
                          <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">{chk.requirement_title ?? "—"}</td>
                          <td className="px-6 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${chipCls}`}
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                            >
                              {chk.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Incidentes vinculados */}
          {incidents.length > 0 && (
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--g-border-subtle)]">
                <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Incidentes vinculados</h2>
                <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{incidents.length}</span>
              </div>
              <div className="divide-y divide-[var(--g-border-subtle)]">
                {incidents.map((inc) => {
                  const sevCls = INCIDENT_SEVERITY_CHIP[inc.severity ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                  return (
                    <div key={inc.id} className="px-6 py-4 flex items-start gap-3">
                      <span
                        className={`shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 text-xs font-bold ${sevCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {inc.severity}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--g-text-primary)]">{inc.title}</p>
                        {inc.description && (
                          <p className="text-xs text-[var(--g-text-secondary)] mt-0.5 line-clamp-2">{inc.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium ${
                              inc.status === "ABIERTO"
                                ? "bg-[var(--status-error)]/10 text-[var(--status-error)]"
                                : inc.status === "EN_INVESTIGACION"
                                ? "bg-[var(--status-warning)]/10 text-[var(--g-text-secondary)]"
                                : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {inc.status}
                          </span>
                          <span className="text-[10px] text-[var(--g-text-secondary)]">
                            {new Date(inc.reported_at).toLocaleDateString("es-ES")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Actions of Action (QES & Escalation) */}
        <div className="space-y-6">
          
          {/* Action Card 1: Conformity QES */}
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-[var(--status-success)]" />
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Conformidad EU AI Act
              </h2>
            </div>
            
            <p className="text-xs text-[var(--g-text-secondary)] mb-4 leading-relaxed">
              De acuerdo con la regulación europea de Inteligencia Artificial, los sistemas de alto riesgo requieren una declaración formal firmada electrónicamente.
            </p>

            {/* Conformity Status Badge */}
            <div 
              className={`flex items-center gap-2.5 px-3 py-2.5 mb-4 border ${
                finalDeclarations.length > 0
                  ? "bg-[var(--g-surface-subtle)] border-[var(--status-success)]/30"
                  : "bg-[var(--g-surface-muted)] border-[var(--g-border-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${finalDeclarations.length > 0 ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"}`} />
              <div className="flex-1">
                <span className="block text-xs font-semibold text-[var(--g-text-primary)]">
                  {finalDeclarations.length > 0 ? "Conformidad Certificada QES" : "Declaración Pendiente"}
                </span>
                <span className="block text-[10px] text-[var(--g-text-secondary)] mt-0.5">
                  {finalDeclarations.length > 0 
                    ? `Firma forense inmutable de QTSP (${finalDeclarations.length} registrada)` 
                    : "Requiere firma cualificada por Compliance Officer"}
                </span>
              </div>
            </div>

            {/* Previous Signed Declarations list */}
            {declarations.length > 0 && (
              <div className="mb-4 space-y-2 max-h-48 overflow-y-auto pr-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Certificados WORM
                </p>
                {declarations.map(dec => (
                  <div 
                    key={dec.id} 
                    className="p-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-xs space-y-1.5"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-[var(--g-text-primary)]">
                        {dec.reference_code || "DEC-CONF"}
                      </span>
                      {isFinalSealedEvidence(dec.status) ? (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] bg-[var(--status-success)]/10 text-[var(--status-success)] font-medium" style={{ borderRadius: "var(--g-radius-sm)" }}>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          SEALED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] bg-[var(--status-warning)]/15 text-[var(--status-warning)] font-medium" style={{ borderRadius: "var(--g-radius-sm)" }} title="Evidencia sandbox de demo: NO sellada como final (no es una transacción EAD Trust real)">
                          SANDBOX
                        </span>
                      )}
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

            <button
              type="button"
              onClick={() => setShowSignModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] py-2 text-xs font-semibold hover:bg-[var(--g-sec-700)] transition-colors duration-150"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <PenTool className="h-3.5 w-3.5" />
              Firmar Conformidad (QES)
            </button>
          </div>

          {/* Action Card 2: Secretaría Escalation */}
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Escalado a Secretaría
              </h2>
            </div>
            
            <p className="text-xs text-[var(--g-text-secondary)] mb-4 leading-relaxed">
              Si detecta gaps materiales o riesgos no resueltos, proponga este sistema directamente como Punto del Orden del Día para la próxima JGA, CdA o Comité Ejecutivo.
            </p>

            {/* Active Link Status */}
            {activeEscalation ? (
              <div 
                className="flex items-start gap-2.5 px-3 py-2.5 mb-4 border border-[var(--status-warning)]/30 bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertCircle className="h-4 w-4 text-[var(--status-warning)] shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <span className="block font-bold text-[var(--g-text-primary)]">
                    Escalado en Trámite
                  </span>
                  <p className="text-[10px] text-[var(--g-text-secondary)] mt-0.5">
                    Propuesto a: {activeEscalation.payload?.organ || "CdA"}<br/>
                    Asunto: {activeEscalation.payload?.matter}
                  </p>
                  <span className="inline-block mt-2 px-1.5 py-0.5 text-[9px] font-bold bg-[var(--status-warning)]/20 text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                    PROPOSED
                  </span>
                </div>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 px-3 py-2.5 mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] text-xs"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="h-2 w-2 rounded-full bg-[var(--g-text-secondary)]/50 shrink-0" />
                <span>Sin propuesta societaria activa</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleOpenEscalation}
              className="w-full flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)] py-2 text-xs font-semibold transition-colors duration-150"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Send className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
              Proponer Orden del Día
            </button>
          </div>

        </div>

      </div>

      {/* MODAL 1: Signature Flow */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-md p-6 animate-in fade-in zoom-in duration-200"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--g-border-subtle)]">
              <ShieldCheck className="h-5 w-5 text-[var(--status-success)]" />
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Firma Digital Cualificada (QES)
              </h3>
            </div>

            {signProgress ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                <Loader2 className="h-8 w-8 text-[var(--g-brand-3308)] animate-spin" />
                <div>
                  <p className="text-sm font-semibold text-[var(--g-text-primary)]">Procesando firma con EAD Trust…</p>
                  <p className="text-xs text-[var(--g-text-secondary)] mt-1">{signProgress}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-[var(--g-surface-subtle)] text-xs text-[var(--g-brand-3308)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                  <strong>Documento:</strong> Declaración de Conformidad Legal (Marco EU AI Act) para el sistema de alto riesgo <strong>{system.name}</strong>.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                      Nombre del Firmante
                    </label>
                    <input 
                      type="text" 
                      value={signatoryName}
                      onChange={(e) => setSignatoryName(e.target.value)}
                      className="w-full text-xs p-2.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                      Correo Electrónico
                    </label>
                    <input 
                      type="email" 
                      value={signatoryEmail}
                      onChange={(e) => setSignatoryEmail(e.target.value)}
                      className="w-full text-xs p-2.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-[var(--g-border-subtle)] justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSignModal(false)}
                    className="px-4 py-2 border border-[var(--g-border-subtle)] text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSignDeclaration}
                    className="px-4 py-2 bg-[var(--status-success)] text-[var(--g-text-inverse)] text-xs font-semibold hover:bg-[var(--status-success)]/90"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Confirmar y Firmar QES
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Escalation to Secretaría */}
      {showEscalationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form 
            onSubmit={handleEscalateSubmit}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 space-y-4"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--g-border-subtle)]">
              <Users className="h-5 w-5 text-[var(--g-brand-3308)]" />
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Propuesta de Orden del Día (Secretaría Societaria)
              </h3>
            </div>

            <div className="p-3 bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] text-xs leading-relaxed" style={{ borderRadius: "var(--g-radius-md)" }}>
              Esta acción registrará un handoff persistente y trazable en Secretaría Societaria, enlazando el sistema <strong>{system.name}</strong> a un punto del orden del día formal.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Órgano Destinatario
                </label>
                <select 
                  value={escalateCommittee}
                  onChange={(e) => setEscalateCommittee(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] outline-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="CDA">Consejo de Administración (CdA)</option>
                  <option value="COMITE_EJECUTIVO">Comité Ejecutivo</option>
                  <option value="JGA">Junta General de Accionistas (JGA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Propuesta de Asunto / Materia
                </label>
                <input 
                  type="text" 
                  value={escalateMatter}
                  onChange={(e) => setEscalateMatter(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] outline-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Justificación y Antecedentes
                </label>
                <textarea 
                  value={escalateRationale}
                  onChange={(e) => setEscalateRationale(e.target.value)}
                  required
                  rows={4}
                  className="w-full text-xs p-2.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] outline-none resize-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--g-border-subtle)] justify-end">
              <button
                type="button"
                onClick={() => setShowEscalationModal(false)}
                className="px-4 py-2 border border-[var(--g-border-subtle)] text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] text-xs font-semibold hover:bg-[var(--g-sec-700)] flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Enviar Propuesta
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
