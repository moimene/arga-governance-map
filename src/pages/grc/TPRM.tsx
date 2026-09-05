import { useState } from "react";
import { 
  useThirdParties, 
  useCreateThirdParty, 
  useUpdateThirdParty, 
  type CifaAssessment,
  type ThirdParty,
  type CascadeSubcontractor,
  type ContractualDoraChecks
} from "@/hooks/useThirdParties";
import { useEvidenceBundlesList } from "@/hooks/useEvidenceBundles";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { evaluateTprmConcentration } from "@/lib/grc/regulatory-clocks";
import { toast } from "sonner";
import { 
  Search, ShieldAlert, FileText, CheckCircle2, User, Mail, 
  Lock, Loader2, PenTool, ExternalLink, HelpCircle, Plus, ClipboardCheck,
  Globe2, Layers, AlertTriangle, Scale, CheckSquare, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-xs font-semibold text-[var(--g-text-primary)] uppercase mb-1";

// Lo que se pinta cuando no hay dato. Un valor verosímil por defecto es peor
// que un hueco: es indistinguible de un dato real.
const SIN_DATO = "sin dato";

const EMPTY_CIFA_ASSESSMENT: CifaAssessment = {
  q1_core: false,
  q2_subcontract: false,
  q3_alternatives: false,
  q4_dataloss: false,
  q5_concentration: false,
};

type TprmTab = "general" | "cifa" | "subcontracting" | "exit";

export default function TPRM() {
  const branding = useTenantBranding();
  const { data: providers = [], isLoading, refetch } = useThirdParties();
  const createMutation = useCreateThirdParty();
  const updateMutation = useUpdateThirdParty();
  const { data: allEvidenceBundles = [] } = useEvidenceBundlesList();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCriticality, setFilterCriticality] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<TprmTab>("general");

  // New Provider Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProvider, setNewProvider] = useState({
    provider: "",
    service: "",
    criticality: "Pendiente",
    cloud_exposure: "",
    regulatory_basis: "DORA Arts. 28-30 · RTS Terceros",
    // Estos tres SE ESCRIBEN EN CLOUD aunque el modal no los exponga. Con
    // "Completada" / "Conforme DORA Art. 30" / "Documentado" por defecto, dar
    // de alta un proveedor declaraba una diligencia debida, una conformidad
    // contractual y un plan de salida que nadie ha declarado.
    due_diligence: "Pendiente",
    contract_clauses: "Pendiente",
    exit_plan: "Pendiente",
    next_review: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    legal_hold: false,
    owner: "",
    payload: {
      lei_euid: "",
      provider_type: "Externo" as "Externo" | "Intragrupo" | "Subcontratista",
      country_service: "",
      country_data_storage: "",
      is_ctpp: false,
    },
  });

  const selected = providers.find((p) => p.id === selectedId);

  // Se consulta de verdad en vez de afirmarlo: la caja del plan de salida
  // pintaba «SEALED» sin mirar `evidence_bundles`.
  const exitPlanArchived =
    !!selected &&
    allEvidenceBundles.some(
      (e) => e.source_object_id === selected.id && isFinalSealedEvidence(e.status),
    );

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
  const cifaPayload: CifaAssessment = {
    ...EMPTY_CIFA_ASSESSMENT,
    ...selected?.payload?.cifa,
  };

  const isCifaApproved = 
    cifaPayload.q1_core || 
    cifaPayload.q2_subcontract || 
    cifaPayload.q3_alternatives || 
    cifaPayload.q4_dataloss || 
    cifaPayload.q5_concentration;

  // Concentration and Substitutability Scoring
  const concentrationEval = evaluateTprmConcentration({
    isCriticalOrImportantFunction: isCifaApproved || selected?.criticality.includes("Crítico"),
    contractsCountWithProviderGroup: Number(selected?.payload?.concentration_score ?? 2),
    technicalLockInScore: (selected?.payload?.substitutability_score ?? 3) as 1|2|3|4|5,
    migrationTimeMonths: Number(selected?.payload?.exit_time_months ?? 6),
    subcontractorsInThirdCountries: selected?.payload?.country_data_storage?.includes("EE.UU.") || false,
    isDesignatedCtpp: selected?.payload?.is_ctpp ?? false,
  });

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
          ...(selected.payload ?? {}),
          cifa: answers
        }
      });
      toast.success("Evaluación CIFA actualizada correctamente.");
      refetch();
    } catch (e) {
      toast.error("Error al actualizar la evaluación CIFA.");
    }
  };

  const handleToggleContractCheck = async (checkKey: keyof ContractualDoraChecks) => {
    if (!selected) return;
    const currentChecks = selected.payload?.contract_checks ?? {
      audit_rights: true,
      supervisory_inspection: true,
      data_return_insolvency: true,
      exit_plan_tested: true,
      bcm_tested: true,
      incident_assistance: true,
    };
    const nextChecks = {
      ...currentChecks,
      [checkKey]: !currentChecks[checkKey],
    };

    try {
      await updateMutation.mutateAsync({
        id: selected.id,
        payload: {
          ...(selected.payload ?? {}),
          contract_checks: nextChecks,
        }
      });
      toast.success("Checklist contractual actualizado.");
      refetch();
    } catch (e) {
      toast.error("Error al actualizar checklist contractual.");
    }
  };

  const handleAddProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        ...newProvider,
        payload: newProvider.payload,
      });
      toast.success("Tercero registrado correctamente en el catálogo DORA.");
      setShowAddModal(false);
      refetch();
    } catch (err) {
      toast.error("Error al crear tercero.");
    }
  };

  // El registro DORA de terceros TIC no aplica a todo tenant. El item de menú
  // ya va gateado; esto cierra además la URL directa. `isModuleEnabled` falla
  // ABIERTO: un tenant sin `branding.modules` (ARGA) no ve ningún cambio.
  if (!isModuleEnabled(branding, "tprm")) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Terceros (TPRM)</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          El registro de terceros TIC del Reglamento DORA no está habilitado para este grupo.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)] flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            Registro DORA de Terceros TIC (TPRM Workbench)
          </h1>
          <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">
            Registro normalizado de contratos, funciones críticas (CIFA), subcontratación y CTPP conforme a DORA Arts. 28-31 y Reg. Ejecución (UE) 2024/2956.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-4 h-10 text-sm font-semibold transition-colors shrink-0"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Registrar Proveedor TIC
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
                placeholder="Buscar proveedor, LEI o servicio…"
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
                const isCtpp = p.payload?.is_ctpp === true;

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
                      <div>
                        <h3 className="font-semibold text-sm text-[var(--g-text-primary)]">
                          {p.provider}
                        </h3>
                        {p.payload?.lei_euid && (
                          <span className="font-mono text-[10px] text-[var(--g-text-secondary)]">
                            LEI: {p.payload.lei_euid}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[9px] text-[var(--g-text-secondary)]">
                        {p.id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1 mb-2">
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
                      {isCtpp && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--status-error)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                          CTPP Art. 31
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
                Seleccione un proveedor TIC
              </h2>
              <p className="text-xs text-[var(--g-text-secondary)] max-w-sm mt-1">
                Elija un proveedor para ver su ficha DORA, evaluación CIFA, subcontratistas en cascada y checklist contractual.
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
                      {selected.id} {selected.payload?.lei_euid && `· LEI: ${selected.payload.lei_euid}`}
                    </span>
                    <h2 className="text-xl font-bold text-[var(--g-text-primary)] mt-0.5">
                      {selected.provider}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
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
                    {selected.payload?.is_ctpp && (
                      <span className="px-2 py-1 text-xs font-bold bg-[var(--status-error)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        CTPP Regulado
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed">
                  {selected.service}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-x-auto">
                {([
                  { id: "general", label: "Ficha DORA (Reg. 2024/2956)" },
                  { id: "cifa", label: "Evaluación CIFA (Art. 28)" },
                  { id: "subcontracting", label: "Subcontratación en Cascada" },
                  { id: "exit", label: "Concentración & Checklist Contractual" }
                ] satisfies Array<{ id: TprmTab; label: string }>).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Identificador Legal (LEI / EUID):</span>
                      <span className="block font-mono font-medium text-[var(--g-text-primary)]">{selected.payload?.lei_euid || SIN_DATO}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Tipo de Proveedor:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.payload?.provider_type || SIN_DATO}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">País de Prestación del Servicio:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.payload?.country_service || SIN_DATO}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">País de Almacenamiento y Procesamiento de Datos:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.payload?.country_data_storage || SIN_DATO}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Modelo de Despliegue Cloud:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.payload?.cloud_deployment_model || SIN_DATO}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Base Regulatoria Aplicable:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.regulatory_basis}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Propietario / Unidad Responsable:</span>
                      <span className="block font-medium text-[var(--g-text-primary)]">{selected.owner}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Estado de Legal Hold:</span>
                      <div className="flex items-center gap-2">
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
                        <span className="text-[var(--g-text-secondary)]">{selected.legal_hold ? "Bloqueo activo" : "Inactivo"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: CIFA Assessment */}
                {activeTab === "cifa" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)] text-xs text-[var(--g-text-secondary)] leading-relaxed" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <div className="font-bold text-[var(--g-brand-3308)] mb-1">
                        Criterios CIFA (Critical or Important Function Assessment - DORA Art. 28.2)
                      </div>
                      Si el servicio sustenta una función cuya interrupción afectaría gravemente al rendimiento financiero o a la continuidad de la autorización, el tercero se cataloga como crítico con obligaciones reforzadas.
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          key: "q1_core",
                          label: "1. Gravedad de interrupción en operaciones clave",
                          desc: "¿Una caída o interrupción total de este servicio detiene operaciones de suscripción, siniestros o facturación críticas?",
                        },
                        {
                          key: "q2_subcontract",
                          label: "2. Cadena de suministro y subcontratación en cascada",
                          desc: "¿El servicio depende de subcontratación intensiva en cascada fuera de la UE?",
                        },
                        {
                          key: "q3_alternatives",
                          label: "3. Dificultad de migración y sustitución técnica",
                          desc: "¿La migración a otro proveedor requiere más de 6 meses o inversión desproporcionada?",
                        },
                        {
                          key: "q4_dataloss",
                          label: "4. Acceso a datos altamente confidenciales o de salud",
                          desc: "¿El proveedor manipula o almacena información bancaria, pólizas o categorías especiales de datos RGPD?",
                        },
                        {
                          key: "q5_concentration",
                          label: "5. Concentración sistémica de contratos en el grupo",
                          desc: "¿Este tercero proporciona múltiples herramientas y servicios a diferentes divisiones de la entidad?",
                        }
                      ].map((q) => {
                        const val = cifaPayload[q.key as keyof CifaAssessment] === true;
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
                  </div>
                )}

                {/* Tab: Subcontratación en Cascada */}
                {activeTab === "subcontracting" && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)] text-xs text-[var(--g-text-secondary)] leading-relaxed" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <div className="font-bold text-[var(--g-brand-3308)] mb-1">
                        Cadena de Subcontratistas TIC (RTS Subcontratación DORA Art. 30.2)
                      </div>
                      Obligación de identificar a todos los subcontratistas que sustentan efectivamente partes materiales de una función crítica, con derecho de oposición y control de transferencias internacionales.
                    </div>

                    <div className="border border-[var(--g-border-subtle)] rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                            <th className="px-4 py-2.5 text-left font-semibold text-[var(--g-text-primary)]">Subcontratista</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-[var(--g-text-primary)]">Servicio Subcontratado</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-[var(--g-text-primary)]">País</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-[var(--g-text-primary)]">Acceso a Datos</th>
                            <th className="px-4 py-2.5 text-left font-semibold text-[var(--g-text-primary)]">Aprobación Previa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--g-border-subtle)]">
                          {/* Sin la cascada AWS/Cloudflare de relleno: el payload de los
                              proveedores no trae `subcontractors`, así que los cinco
                              mostraban los mismos dos subcontratistas inventados, con
                              «Cláusula Aprobada» incluida. */}
                          {(selected.payload?.subcontractors ?? []).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-[var(--g-text-secondary)]">
                                No consta ninguna subcontratación registrada para este proveedor.
                              </td>
                            </tr>
                          )}
                          {(selected.payload?.subcontractors ?? []).map((sub) => (
                            <tr key={sub.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                              <td className="px-4 py-2.5 font-medium text-[var(--g-text-primary)]">{sub.name}</td>
                              <td className="px-4 py-2.5 text-[var(--g-text-secondary)]">{sub.service}</td>
                              <td className="px-4 py-2.5 font-mono text-[var(--g-text-secondary)]">{sub.country}</td>
                              <td className="px-4 py-2.5">
                                <span className={cn("px-1.5 py-0.5 rounded font-semibold text-[10px]", sub.dataAccess ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]" : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]")}>
                                  {sub.dataAccess ? "Acceso a Datos" : "Sin Acceso"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {sub.priorApproval === undefined ? (
                                  <span className="text-[var(--g-text-secondary)]">{SIN_DATO}</span>
                                ) : sub.priorApproval ? (
                                  <span className="text-[var(--status-success)] font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Aprobación previa registrada
                                  </span>
                                ) : (
                                  <span className="text-[var(--status-warning)] font-semibold">Sin aprobación previa</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab: Concentración & Checklist Contractual */}
                {activeTab === "exit" && (
                  <div className="space-y-6">
                    {/* Concentración & Sustituibilidad Box */}
                    <div className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] rounded-lg space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Scale className="h-4 w-4 text-[var(--g-brand-3308)]" />
                          <h3 className="text-xs font-bold uppercase text-[var(--g-text-primary)]">
                            Scoring de Concentración y Sustituibilidad (DORA Art. 29)
                          </h3>
                        </div>
                        <span className={cn(
                          "px-2.5 py-0.5 text-xs font-bold rounded-full",
                          concentrationEval.overallRiskLevel === "Crítico" ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]" : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                        )}>
                          Riesgo {concentrationEval.overallRiskLevel}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-[var(--g-border-subtle)] pt-3">
                        <div>
                          <span className="text-[10px] text-[var(--g-text-secondary)] block uppercase">Concentración Grupo:</span>
                          <span className="font-bold text-[var(--g-text-primary)]">{concentrationEval.concentrationScore} / 5</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--g-text-secondary)] block uppercase">Dificultad Sustitución:</span>
                          <span className="font-bold text-[var(--g-text-primary)]">{concentrationEval.substitutabilityScore} / 5</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--g-text-secondary)] block uppercase">Tiempo Salida Estimado:</span>
                          <span className="font-bold text-[var(--g-text-primary)]">{selected.payload?.exit_time_months ?? 6} meses</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--g-text-secondary)] block uppercase">Escalado al Consejo:</span>
                          <span className={cn("font-bold", concentrationEval.requiresBoardEscalation ? "text-[var(--status-error)]" : "text-[var(--status-success)]")}>
                            {concentrationEval.requiresBoardEscalation ? "PRECEPTIVO" : "Ordinario"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Checklist Contractual Bloqueante */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-[var(--g-brand-3308)]" />
                        <h3 className="text-xs font-bold uppercase text-[var(--g-text-primary)]">
                          Cláusulas Contractuales Obligatorias (DORA Art. 30 & Solvencia II Art. 274)
                        </h3>
                      </div>

                      <div className="space-y-2 text-xs">
                        {[
                          { key: "audit_rights", label: "Derechos irrestrictos de acceso, inspección y auditoría (incluyendo in situ)" },
                          { key: "supervisory_inspection", label: "Cooperación plena con la autoridad supervisora (preguntas directas y acceso)" },
                          { key: "data_return_insolvency", label: "Garantía de devolución de datos en formato accesible en caso de insolvencia o terminación" },
                          { key: "exit_plan_tested", label: "Estrategia de salida (Exit Plan) documentada y con período transitorio suficiente" },
                          { key: "bcm_tested", label: "Planes de contingencia y resiliencia del proveedor probados periódicamente" },
                          { key: "incident_assistance", label: "Asistencia y notificación inmediata de incidentes de seguridad sin coste adicional" },
                        ].map((chk) => {
                          // Sin objeto por defecto con las seis a `true`: ninguno de los
                          // proveedores tiene `contract_checks` en su payload, así que las
                          // seis cláusulas se pintaban «Conforme» sin que nadie las hubiera
                          // comprobado. Ausencia de dato = «sin dato», no conformidad.
                          const checks = selected.payload?.contract_checks;
                          const raw = checks?.[chk.key as keyof ContractualDoraChecks];
                          const isChecked = raw === true;
                          const sinDato = raw === undefined;

                          return (
                            <div
                              key={chk.key}
                              onClick={() => handleToggleContractCheck(chk.key as keyof ContractualDoraChecks)}
                              className="p-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] flex items-center justify-between cursor-pointer hover:bg-[var(--g-surface-subtle)]/40 rounded transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  readOnly
                                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                                />
                                <span className="font-medium text-[var(--g-text-primary)]">
                                  {chk.label}
                                </span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded",
                                sinDato
                                  ? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                                  : isChecked
                                  ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                                  : "bg-[var(--status-error)]/10 text-[var(--status-error)]"
                              )}>
                                {sinDato ? SIN_DATO : isChecked ? "Conforme" : "Pendiente"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Antes afirmaba, sin consultar nada, «PLAN DE SALIDA CUSTODIADO
                        EN LEDGER WORM … qualified timestamping · SEALED». Ahora mira
                        `evidence_bundles` y no atribuye sello ni timestamping
                        cualificado a ningún prestador. */}
                    <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)] rounded-lg flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-[var(--g-text-secondary)]" />
                        <div>
                          <span className="font-bold text-[var(--g-text-primary)] block">
                            Archivo del plan de salida
                          </span>
                          <span className="text-[10px] text-[var(--g-text-secondary)]">
                            {exitPlanArchived
                              ? "Registro archivado con hash SHA-512. Sin sello ni firma atribuidos."
                              : "No consta ningún registro archivado para este proveedor."}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)] rounded-full">
                        {exitPlanArchived ? "ARCHIVADO" : SIN_DATO.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Registrar Nuevo Tercero */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Registrar Proveedor TIC en Catálogo DORA
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddProviderSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className={LABEL_CLASSES}>Nombre del Proveedor</label>
                <input
                  type="text"
                  required
                  value={newProvider.provider}
                  onChange={(e) => setNewProvider({ ...newProvider, provider: e.target.value })}
                  placeholder="Ej. Microsoft Azure / Salesforce"
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className={LABEL_CLASSES}>Identificador Legal LEI / EUID</label>
                <input
                  type="text"
                  value={newProvider.payload.lei_euid}
                  onChange={(e) => setNewProvider({ 
                    ...newProvider, 
                    payload: { ...newProvider.payload, lei_euid: e.target.value } 
                  })}
                  placeholder="Ej. 5493006MHB84DD0ZWV18"
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label className={LABEL_CLASSES}>Servicio TIC Contratado</label>
                <input
                  type="text"
                  required
                  value={newProvider.service}
                  onChange={(e) => setNewProvider({ ...newProvider, service: e.target.value })}
                  placeholder="Ej. Infraestructura Cloud Cómputo y Almacenamiento"
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLASSES}>Criticidad Inicial</label>
                  <select
                    value={newProvider.criticality}
                    onChange={(e) => setNewProvider({ ...newProvider, criticality: e.target.value })}
                    className={SELECT_CLASSES}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="CIFA aprobado (Crítico)">CIFA Crítico</option>
                    <option value="Importante">Importante</option>
                    <option value="Pendiente">Pendiente de evaluación</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLASSES}>Tipo de Proveedor</label>
                  <select
                    value={newProvider.payload.provider_type}
                    onChange={(e) => setNewProvider({ 
                      ...newProvider, 
                      payload: { ...newProvider.payload, provider_type: e.target.value as "Externo" | "Intragrupo" | "Subcontratista" } 
                    })}
                    className={SELECT_CLASSES}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="Externo">Externo</option>
                    <option value="Intragrupo">Intragrupo</option>
                    <option value="Subcontratista">Subcontratista</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  checked={newProvider.payload.is_ctpp}
                  onChange={(e) => setNewProvider({ 
                    ...newProvider, 
                    payload: { ...newProvider.payload, is_ctpp: e.target.checked } 
                  })}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                <span className="text-xs text-[var(--g-text-primary)] font-medium">
                  Designado como CTPP (Proveedor Tercero Esencial bajo DORA Art. 31)
                </span>
              </div>

              <div className="px-0 py-3 border-t border-[var(--g-border-subtle)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Guardar en Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
