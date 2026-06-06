import { useState } from "react";
import { 
  useThirdParties, 
  useCreateThirdParty, 
  useUpdateThirdParty, 
  type ThirdParty 
} from "@/hooks/useThirdParties";
import { useQTSPSign } from "@/hooks/useQTSPSign";
import { useCreateEvidenceBundle } from "@/hooks/useEvidenceBundles";
import { toast } from "sonner";
import { 
  Search, ShieldAlert, FileText, CheckCircle2, User, Mail, 
  Lock, Loader2, PenTool, ExternalLink, HelpCircle, Plus, ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const LABEL_CLASSES = "block text-xs font-semibold text-[var(--g-text-primary)] uppercase mb-1";

export default function TPRM() {
  const { data: providers = [], isLoading, refetch } = useThirdParties();
  const createMutation = useCreateThirdParty();
  const updateMutation = useUpdateThirdParty();
  const { signMutation } = useQTSPSign();
  const createEvidence = useCreateEvidenceBundle();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"general" | "cifa" | "exit">("general");

  // Sign fields
  const [signatoryName, setSignatoryName] = useState("Lucía Martín");
  const [signatoryEmail, setSignatoryEmail] = useState("lucia@arga-seguros.com");
  const [signingProgress, setSigningProgress] = useState<string | null>(null);

  // New Provider Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState({
    provider: "",
    service: "",
    criticality: "Pendiente",
    cloud_exposure: "",
    regulatory_basis: "DORA terceros ICT",
    due_diligence: "Pendiente",
    contract_clauses: "Pendiente",
    exit_plan: "Sin documentar",
    next_review: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    legal_hold: false,
    owner: "Operaciones GRC",
    payload: {},
  });

  const selected = providers.find((p) => p.id === selectedId);

  // Filtered providers
  const filtered = providers.filter((p) => {
    const matchesSearch = 
      p.provider.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    
    if (filterCriticality === "all") return matchesSearch;
    return matchesSearch && p.criticality === filterCriticality;
  });

  // Calculate CIFA Answers from provider's payload
  const cifaPayload = selected?.payload?.cifa || {
    q1_core: false,
    q2_subcontract: false,
    q3_alternatives: false,
    q4_dataloss: false,
    q5_concentration: false,
  };

  const isCifaApproved = 
    cifaPayload.q1_core || 
    cifaPayload.q2_subcontract || 
    cifaPayload.q3_alternatives || 
    cifaPayload.q4_dataloss || 
    cifaPayload.q5_concentration;

  // Save CIFA Questionnaire
  const handleSaveCifa = async (answers: typeof cifaPayload) => {
    if (!selected) return;
    try {
      const computedCriticality = (answers.q1_core || answers.q2_subcontract || answers.q3_alternatives || answers.q4_dataloss || answers.q5_concentration)
        ? "CIFA aprobado (Crítico)"
        : "Importante";

      await updateMutation.mutateAsync({
        id: selected.id,
        criticality: computedCriticality,
        payload: {
          ...selected.payload,
          cifa: answers
        }
      });
      toast.success("Evaluación CIFA actualizada correctamente.");
      refetch();
    } catch (e) {
      toast.error("Error al actualizar la evaluación CIFA.");
    }
  };

  // Sign Exit Plan with QES
  const handleSignExitPlan = async () => {
    if (!selected) return;
    try {
      setSigningProgress("Preparando documento del Plan de Contingencia y Salida…");
      
      const docName = `EXIT-PLAN-${selected.id}-${new Date().getFullYear()}.pdf`;
      const docData = new TextEncoder().encode(
        `PLAN DE CONTINGENCIA Y SALIDA (EXIT PLAN) - GRC COMPASS TPRM\n` +
        `Identificador Proveedor: ${selected.id}\n` +
        `Proveedor: ${selected.provider}\n` +
        `Servicio: ${selected.service}\n` +
        `Grado de Criticidad: ${selected.criticality}\n` +
        `Estrategia de Salida: ${selected.exit_plan || 'No informada'}\n` +
        `Firmante Apoderado: ${signatoryName} (${signatoryEmail})\n` +
        `Fecha de Validación: ${new Date().toLocaleDateString("es-ES")}`
      ).buffer;

      // Simulated QES Sign
      const signRes = await signMutation.mutateAsync({
        documentName: docName,
        documentData: docData,
        signatories: [{ name: signatoryName, email: signatoryEmail }],
        createdBy: signatoryName,
        onProgress: (step) => setSigningProgress(step),
      });

      if (!signRes.ok) {
        throw new Error(signRes.errors.join(", "));
      }

      setSigningProgress("Sellando evidencia en Ledger Forense WORM…");

      // Save Evidence Bundle
      await createEvidence.mutateAsync({
        sourceModule: "GRC",
        sourceObjectType: "THIRD_PARTY",
        sourceObjectId: selected.id,
        referenceCode: `EXIT-PLAN-${selected.id.slice(0, 8).toUpperCase()}`,
        manifest: {
          provider_id: selected.id,
          provider_name: selected.provider,
          qtsp_transaction_id: signRes.srId,
          document_hash: signRes.documentHash,
          signed_at: signRes.signed_at,
          signatory: signatoryName,
        },
        documentUrl: `https://hzqwefkwsxopwrmtksbg.supabase.co/storage/v1/object/public/evidence/exit_plans/${docName}`,
        legalHold: selected.legal_hold,
        status: "SEALED",
        sandbox: signRes.sandbox,
        signedBy: `${signatoryName} (${signatoryEmail})`
      });

      // Codex review #2-UI: el estado FINAL "firmado" del tercero solo se persiste si
      // la firma es real (no sandbox). En sandbox se guarda metadata no-final para no
      // falsear que el plan quedó sellado y para no ocultar la necesidad de firma real.
      await updateMutation.mutateAsync({
        id: selected.id,
        payload: signRes.sandbox
          ? {
              ...selected.payload,
              // Limpia cualquier flag final stale (Codex #2-UI): una firma sandbox no
              // debe dejar el plan marcado como firmado/sellado por datos previos.
              exit_plan_signed: false,
              exit_plan_hash: null,
              exit_plan_signed_by: null,
              exit_plan_signed_at: null,
              exit_plan_transaction: null,
              exit_plan_sandbox: true,
              exit_plan_sandbox_at: signRes.signed_at,
              exit_plan_sandbox_hash: signRes.documentHash,
            }
          : {
              ...selected.payload,
              exit_plan_signed: true,
              exit_plan_hash: signRes.documentHash,
              exit_plan_signed_by: signatoryName,
              exit_plan_signed_at: signRes.signed_at,
              exit_plan_transaction: signRes.srId,
            }
      });

      toast.success(
        signRes.sandbox
          ? "Plan de Salida firmado en modo SANDBOX (demo) — evidencia NO sellada como final."
          : "Plan de Salida firmado digitalmente y sellado en ledger WORM."
      );
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al firmar: ${err.message || "Error desconocido"}`);
    } finally {
      setSigningProgress(null);
    }
  };

  const handleAddProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        ...newProvider,
        payload: {},
      });
      toast.success("Tercero registrado correctamente.");
      setShowAddModal(false);
      refetch();
    } catch (err) {
      toast.error("Error al crear tercero.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)] flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            TPRM CIFA Workbench
          </h1>
          <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">
            Gestión de riesgos de proveedores terceros ICT bajo el Art. 28 del Reglamento DORA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-4 h-10 text-sm font-semibold transition-colors shrink-0"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Registrar Tercero
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left list pane */}
        <div className="lg:col-span-1 space-y-4">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex flex-col gap-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--g-text-secondary)]/60" />
              <input
                type="text"
                placeholder="Buscar proveedor o servicio…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(INPUT_CLASSES, "pl-9")}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            {/* Criticality Filter */}
            <select
              value={filterCriticality}
              onChange={(e) => setFilterCriticality(e.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="all">Todos los grados de criticidad</option>
              <option value="CIFA aprobado (Crítico)">CIFA aprobado (Crítico)</option>
              <option value="CIFA probable">CIFA probable</option>
              <option value="Importante">Importante</option>
              <option value="Pendiente">Pendiente de evaluación</option>
            </select>
          </div>

          {/* Suppliers List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-[var(--g-text-secondary)] animate-pulse">
                Cargando inventario de terceros…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] border border-[var(--g-border-default)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
                No se encontraron proveedores que coincidan con la búsqueda.
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === selectedId;
                const isCritical = p.criticality.includes("Crítico") || p.criticality.includes("cifa") || p.criticality.includes("probable");
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setActiveTab("general");
                    }}
                    className={cn(
                      "p-4 border transition-all cursor-pointer",
                      isSelected 
                        ? "bg-[var(--g-surface-subtle)] border-[var(--g-brand-3308)]"
                        : "bg-[var(--g-surface-card)] border-[var(--g-border-default)] hover:border-[var(--g-border-subtle)]"
                    )}
                    style={{ borderRadius: "var(--g-radius-lg)" }}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-[var(--g-text-primary)]">
                        {p.provider}
                      </h3>
                      <span className="font-mono text-[9px] text-[var(--g-text-secondary)]">
                        {p.id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1 mb-3">
                      {p.service}
                    </p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold",
                          isCritical
                            ? "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/20"
                            : "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20"
                        )}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {p.criticality}
                      </span>
                      {p.payload?.exit_plan_signed && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--status-success)] font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> WORM Sealed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Details and Assesment Pane */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div 
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-8 text-center flex flex-col items-center justify-center min-h-[400px]"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <HelpCircle className="h-10 w-10 text-[var(--g-text-secondary)]/50 mb-3" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Seleccione un proveedor
              </h2>
              <p className="text-xs text-[var(--g-text-secondary)] max-w-sm mt-1">
                Elija un proveedor de la lista de la izquierda para ver sus detalles, realizar la evaluación de criticidad de función regulada y validar su plan de contingencia corporativo.
              </p>
            </div>
          ) : (
            <div 
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              {/* Supplier Detail Header */}
              <div className="p-6 bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                <div className="flex justify-between items-start gap-4 flex-wrap mb-2">
                  <div>
                    <span className="font-mono text-xs font-semibold text-[var(--g-brand-3308)]">
                      {selected.id}
                    </span>
                    <h2 className="text-xl font-bold text-[var(--g-text-primary)] mt-0.5">
                      {selected.provider}
                    </h2>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 text-xs font-bold",
                      selected.criticality.includes("Crítico")
                        ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                        : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    )}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {selected.criticality}
                  </span>
                </div>
                <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed">
                  {selected.service}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
                {[
                  { id: "general", label: "Ficha General" },
                  { id: "cifa", label: "Evaluación CIFA DORA" },
                  { id: "exit", label: "Plan de Contingencia / QES" }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={cn(
                      "px-5 py-3 text-xs font-semibold border-b-2 transition-colors",
                      activeTab === t.id
                        ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]/40"
                        : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 space-y-6">
                
                {/* Tab: General */}
                {activeTab === "general" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Propietario Interno</span>
                      <span className="block text-sm font-medium text-[var(--g-text-primary)]">{selected.owner}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Sujeto a Legal Hold</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <input
                          type="checkbox"
                          checked={selected.legal_hold}
                          onChange={async (e) => {
                            try {
                              await updateMutation.mutateAsync({ id: selected.id, legal_hold: e.target.checked });
                              toast.success("Estado de Legal Hold actualizado.");
                              refetch();
                            } catch (err) {
                              toast.error("Error al actualizar Legal Hold.");
                            }
                          }}
                          className="h-4 w-4 accent-[var(--g-brand-3308)]"
                        />
                        <span className="text-xs text-[var(--g-text-secondary)]">Bloqueo legal activo (Evita purgas accidentales)</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Exposición Cloud / Alcance</span>
                      <span className="block text-sm font-medium text-[var(--g-text-primary)]">{selected.cloud_exposure}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Base Regulatoria</span>
                      <span className="block text-sm font-medium text-[var(--g-text-primary)]">{selected.regulatory_basis}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Próxima Revisión programada</span>
                      <span className="block text-sm font-medium text-[var(--g-text-primary)]">{selected.next_review ? new Date(selected.next_review).toLocaleDateString("es-ES") : "Sin programar"}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-[var(--g-text-secondary)] uppercase">Debida Diligencia</span>
                      <span className="block text-sm font-medium text-[var(--g-text-primary)]">{selected.due_diligence}</span>
                    </div>
                  </div>
                )}

                {/* Tab: CIFA Assessment */}
                {activeTab === "cifa" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)] text-xs text-[var(--g-text-secondary)] leading-relaxed" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <div className="font-bold text-[var(--g-brand-3308)] mb-1">
                        Criterios CIFA (Critical or Important Function Assessment)
                      </div>
                      De acuerdo con DORA Art. 28.2 y las directrices técnicas del supervisor, un proveedor es clasificado como crítico si su interrupción impacta gravemente en operaciones, o si la alternativa de migración es inviable o si procesa datos altamente confidenciales.
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          key: "q1_core",
                          label: "1. Gravedad de interrupción en operaciones clave",
                          desc: "¿Una caída o interrupción total de este servicio detiene operaciones aseguradoras o de facturación críticas de ARGA?",
                        },
                        {
                          key: "q2_subcontract",
                          label: "2. Cadena de suministro y subcontratación",
                          desc: "¿El servicio depende de subcontratación intensiva en cascada con visibilidad limitada?",
                        },
                        {
                          key: "q3_alternatives",
                          label: "3. Dificultad de migración y sustitución",
                          desc: "¿La migración o sustitución temporal de este servicio requiere más de 30 días o una inversión desproporcionada?",
                        },
                        {
                          key: "q4_dataloss",
                          label: "4. Acceso y almacenamiento de datos sensibles",
                          desc: "¿El proveedor manipula o almacena información bancaria, pólizas o información de carácter personal crítica?",
                        },
                        {
                          key: "q5_concentration",
                          label: "5. Concentración sistémica de contratos",
                          desc: "¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de ARGA centralizando el riesgo?",
                        }
                      ].map((q) => {
                        const val = (cifaPayload as any)[q.key] === true;
                        return (
                          <div
                            key={q.key}
                            className="p-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="text-xs font-bold text-[var(--g-text-primary)] block">
                                  {q.label}
                                </span>
                                <span className="text-xs text-[var(--g-text-secondary)] leading-relaxed block">
                                  {q.desc}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...cifaPayload, [q.key]: true };
                                    handleSaveCifa(next);
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 text-xs font-semibold border transition-all",
                                    val
                                      ? "bg-[var(--status-error)] text-[var(--g-text-inverse)] border-[var(--status-error)]"
                                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                                  )}
                                  style={{ borderRadius: "var(--g-radius-sm)" }}
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = { ...cifaPayload, [q.key]: false };
                                    handleSaveCifa(next);
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 text-xs font-semibold border transition-all",
                                    !val
                                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                                  )}
                                  style={{ borderRadius: "var(--g-radius-sm)" }}
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <span className="text-xs text-[var(--g-text-secondary)]">Resultado automático CIFA:</span>
                        <span className={cn(
                          "px-2.5 py-1 text-xs font-bold",
                          isCifaApproved
                            ? "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/20"
                            : "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20"
                        )} style={{ borderRadius: "var(--g-radius-sm)" }}>
                          {isCifaApproved ? "PROVEEDOR CRÍTICO DORA (CIFA Aprobado)" : "PROVEEDOR ESTÁNDAR"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Exit Plan */}
                {activeTab === "exit" && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="exit-strategy-text" className={LABEL_CLASSES}>
                        Estrategia y Plan de Contingencia de Salida (Exit Plan)
                      </label>
                      <textarea
                        id="exit-strategy-text"
                        rows={5}
                        placeholder="Documente la estrategia de migración alternativa de este proveedor en caso de fallo crítico en el servicio de suministro…"
                        value={selected.exit_plan}
                        onChange={async (e) => {
                          await updateMutation.mutateAsync({ id: selected.id, exit_plan: e.target.value });
                        }}
                        className={TEXTAREA_CLASSES}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                      <span className="text-[10px] text-[var(--g-text-secondary)]">Se guarda automáticamente al modificar el texto.</span>
                    </div>

                    {selected.payload?.exit_plan_signed ? (
                      <div 
                        className="p-4 border border-[var(--status-success)]/40 bg-[var(--status-success)]/10 space-y-3"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <div className="flex items-center gap-2 text-[var(--status-success)] font-bold text-xs">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>PLAN DE SALIDA SELLADO EN LEDGER WORM (QES FIRMADA)</span>
                        </div>
                        <div className="text-xs text-[var(--g-text-secondary)] space-y-1 font-mono">
                          <div><strong>Firmante:</strong> {selected.payload.exit_plan_signed_by}</div>
                          <div><strong>Fecha:</strong> {new Date(selected.payload.exit_plan_signed_at).toLocaleString("es-ES")}</div>
                          <div><strong>Hash SHA-512:</strong> <span className="break-all">{selected.payload.exit_plan_hash}</span></div>
                          <div><strong>EAD Trust Tx ID:</strong> {selected.payload.exit_plan_transaction}</div>
                        </div>
                        <div className="pt-2 border-t border-[var(--g-border-subtle)] flex items-center justify-between text-[10px]">
                          <span className="text-[var(--g-text-secondary)]">Certificado de sellado digital QSeal emitido</span>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              toast.info(`EAD Trust QSeal Transaction: ${selected.payload.exit_plan_transaction}`);
                            }}
                            className="text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-0.5"
                          >
                            Verificar Firma QES <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-[var(--g-border-default)] p-4 space-y-4" style={{ borderRadius: "var(--g-radius-md)" }}>
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-5 w-5 text-[var(--status-warning)] shrink-0" />
                          <div className="text-xs">
                            <span className="block font-bold text-[var(--g-text-primary)]">
                              Firma Obligatoria Requerida
                            </span>
                            <span className="block text-[var(--g-text-secondary)]">
                              Para proveedores catalogados como críticos bajo DORA (CIFA Aprobado), el plan de contingencia de salida debe estar firmado por el Apoderado de Riesgo.
                            </span>
                          </div>
                        </div>

                        {signingProgress ? (
                          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                            <Loader2 className="h-6 w-6 animate-spin text-[var(--g-brand-3308)]" />
                            <span className="text-xs font-semibold text-[var(--g-text-primary)] animate-pulse">{signingProgress}</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label htmlFor="tprm-sign-name" className={LABEL_CLASSES}>Nombre Firmante</label>
                              <input
                                id="tprm-sign-name"
                                type="text"
                                value={signatoryName}
                                onChange={(e) => setSignatoryName(e.target.value)}
                                className={INPUT_CLASSES}
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              />
                            </div>
                            <div className="space-y-1">
                              <label htmlFor="tprm-sign-email" className={LABEL_CLASSES}>Email Firmante</label>
                              <input
                                id="tprm-sign-email"
                                type="email"
                                value={signatoryEmail}
                                onChange={(e) => setSignatoryEmail(e.target.value)}
                                className={INPUT_CLASSES}
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              />
                            </div>
                            <div className="col-span-1 sm:col-span-2 pt-2">
                              <button
                                type="button"
                                onClick={handleSignExitPlan}
                                className="w-full flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] py-2 text-xs font-bold transition-colors"
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                <PenTool className="h-4 w-4" />
                                Firmar y Sellar Exit Plan (QES)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Modal: Registrar Tercero                                     */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between bg-[var(--g-surface-subtle)]">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Registrar Nuevo Tercero (TPRM)
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] text-lg"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddProviderSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label htmlFor="new-prov-name" className={LABEL_CLASSES}>Nombre del Proveedor *</label>
                <input
                  id="new-prov-name"
                  type="text"
                  required
                  value={newProvider.provider}
                  onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
                  placeholder="Ej. Microsoft Azure Services"
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-prov-service" className={LABEL_CLASSES}>Descripción del Servicio *</label>
                <input
                  id="new-prov-service"
                  type="text"
                  required
                  value={newProvider.service}
                  onChange={(e) => setNewProvider({ ...newProvider, service: e.target.value })}
                  placeholder="Ej. Hosting Cloud e infraestructura crítica"
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-prov-owner" className={LABEL_CLASSES}>Responsable Operativo *</label>
                <input
                  id="new-prov-owner"
                  type="text"
                  required
                  value={newProvider.owner}
                  onChange={(e) => setNewProvider({ ...newProvider, owner: e.target.value })}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="new-prov-exposure" className={LABEL_CLASSES}>Exposición / Dependencia Cloud</label>
                <textarea
                  id="new-prov-exposure"
                  rows={2}
                  value={newProvider.cloud_exposure}
                  onChange={(e) => setNewProvider({ ...newProvider, cloud_exposure: e.target.value })}
                  placeholder="Describa el grado de dependencia de este proveedor para el almacenamiento o infraestructura…"
                  className={TEXTAREA_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-10 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-semibold transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 h-10 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar Tercero"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
