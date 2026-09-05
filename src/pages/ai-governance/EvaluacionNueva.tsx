import { useState, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Save,
  ShieldCheck,
  Check,
  ClipboardCheck,
  AlertTriangle,
  Cpu,
  ListChecks,
  ArrowRight,
  ExternalLink,
  Plus,
  Trash2,
  Info,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useCreateAssessment, useCreateComplianceChecks } from "@/hooks/useAiAssessments";
import { buildEvaluationPayload } from "@/lib/aims/evaluacion-payload";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  getRequirementsForFramework,
  calculateAdaptationPlan,
  deriveDiagnosisStatus,
  computeAssessmentStats,
  subpartTitle,
  MATURITY_LEVELS,
  DIFFICULTY_LEVELS,
  ADAPTATION_PLANS,
  MeasureGuideDef,
  RequirementDef,
} from "@/lib/aims/catalog-aesia";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

type MeasureEvaluationState = {
  difficulty: string; // '00', '01', '02'
  maturity: string; // 'L1' - 'L8'
  justification: string;
  evidence_url: string;
  notes: string;
};

type AdditionalMeasure = {
  id: string;
  requirementCode: string;
  subpartId: string;
  description: string;
  difficulty: string;
  maturity: string;
  evidence_url: string;
};

export default function EvaluacionNueva() {
  const navigate = useNavigate();
  // `SistemaDetalle` enlaza aquí con `?system_id=…`. Ignorarlo obligaba a
  // reelegir a mano el sistema del que se venía.
  const [params] = useSearchParams();
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const createAssessment = useCreateAssessment();
  const createChecks = useCreateComplianceChecks();

  const [step, setStep] = useState(1);
  const [systemId, setSystemId] = useState(params.get("system_id") ?? "");
  const [framework, setFramework] = useState<"EU_AI_ACT" | "ISO_42001">("EU_AI_ACT");
  const [activeReqCode, setActiveReqCode] = useState<string>("QUALITY_MGMT");
  const [overallStatus, setOverallStatus] = useState("COMPLETADA");
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Requisitos del marco seleccionado
  const requirements: RequirementDef[] = useMemo(() => {
    return getRequirementsForFramework(framework);
  }, [framework]);

  // Lista plana de medidas guía (MG)
  const allMeasures = useMemo(() => {
    return requirements.flatMap((r) =>
      r.measures.map((m) => ({ ...m, requirementCode: r.code, requirementTitle: r.title }))
    );
  }, [requirements]);

  // Estado de autoevaluación por medida
  const [evaluations, setEvaluations] = useState<Record<string, MeasureEvaluationState>>({});

  // Medidas Adicionales (MA)
  const [additionalMeasures, setAdditionalMeasures] = useState<AdditionalMeasure[]>([]);
  const [showAddMaModal, setShowAddMaModal] = useState(false);
  const [newMaSubpart, setNewMaSubpart] = useState("");
  const [newMaDescription, setNewMaDescription] = useState("");

  // Asegurar que activeReqCode sea válido al cambiar marco
  useMemo(() => {
    if (requirements.length > 0 && !requirements.some((r) => r.code === activeReqCode)) {
      setActiveReqCode(requirements[0].code);
    }
  }, [requirements, activeReqCode]);

  const updateEvaluation = (measureId: string, key: keyof MeasureEvaluationState, value: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [measureId]: {
        ...(prev[measureId] || {
          difficulty: "01",
          maturity: "",
          justification: "",
          evidence_url: "",
          notes: "",
        }),
        [key]: value,
      },
    }));
  };

  // Estadísticas globales de madurez y cálculo de planes PDA
  const stats = useMemo(() => {
    return computeAssessmentStats(allMeasures, evaluations);
  }, [allMeasures, evaluations]);

  const activeRequirement = useMemo(() => {
    return requirements.find((r) => r.code === activeReqCode) || requirements[0];
  }, [requirements, activeReqCode]);

  // Manejo de Medidas Adicionales
  const handleAddMa = () => {
    if (!newMaDescription.trim()) {
      toast.error("Indica una descripción para la Medida Adicional.");
      return;
    }
    const newMa: AdditionalMeasure = {
      id: `MA_${Date.now().toString().slice(-4)}`,
      requirementCode: activeReqCode,
      subpartId: newMaSubpart || activeRequirement?.subparts[0]?.subpartId || "17.1.a",
      description: newMaDescription,
      difficulty: "01",
      maturity: "",
      evidence_url: "",
    };
    setAdditionalMeasures((prev) => [...prev, newMa]);
    setNewMaDescription("");
    setShowAddMaModal(false);
    toast.success("Medida Adicional (MA) agregada al requisito");
  };

  const handleRemoveMa = (maId: string) => {
    setAdditionalMeasures((prev) => prev.filter((m) => m.id !== maId));
    toast.info("Medida Adicional eliminada");
  };

  const handleNextStep = () => {
    if (step === 1 && !systemId) {
      toast.error("Selecciona el sistema de IA que vas a evaluar.");
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handlePrevStep = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!systemId) {
      toast.error("Selecciona un sistema de IA.");
      return;
    }

    // Lo no contestado NO se evalúa: ni genera finding ni da por conforme su
    // requisito. La construcción vive en `@/lib/aims/evaluacion-payload`.
    const payload = buildEvaluationPayload(evaluations, allMeasures, requirements);

    const assessmentPayload = {
      system_id: systemId,
      framework,
      score: stats.maturityScore,
      assessment_date: new Date().toISOString().slice(0, 10),
      findings: payload.findings,
      status: payload.status,
      notes:
        notes ||
        `Autodiagnóstico AESIA Guía 16. Medidas evaluadas: ${payload.evaluadas}/${payload.totales}.`,
    };

    try {
      const createdAssessment = await createAssessment.mutateAsync(assessmentPayload);

      // Un requisito con medidas sin contestar queda NO_EVALUADO, no CONFORME.
      const checkPayloads = payload.checks.map((c) => ({ ...c, system_id: systemId }));

      await createChecks.mutateAsync(checkPayloads);

      setCreatedId(createdAssessment.id);
      toast.success(`Autodiagnóstico registrado. Medidas evaluadas: ${payload.evaluadas}/${payload.totales}.`);
      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al registrar la evaluación: ${msg}`);
    }
  };

  const selectedSystem = systems.find((s) => s.id === systemId);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header & Stepper */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--g-border-subtle)]">
        <div>
          <button
            onClick={() => navigate("/ai-governance/evaluaciones")}
            className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver a Evaluaciones</span>
          </button>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
            Nuevo Autodiagnóstico de Conformidad (AESIA Guía 16)
          </h1>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { num: 1, label: "Sistema y Marco" },
            { num: 2, label: "Evaluación 84 MGs" },
            { num: 3, label: "Plan de Adaptación (PDA)" },
            { num: 4, label: "Resultado" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 flex items-center justify-center font-bold text-xs ${
                  step === s.num
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : step > s.num
                    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </span>
              <span
                className={`hidden sm:inline ${
                  step === s.num
                    ? "font-bold text-[var(--g-text-primary)]"
                    : "text-[var(--g-text-secondary)]"
                }`}
              >
                {s.label}
              </span>
              {s.num < 4 && <span className="text-[var(--g-border-subtle)]">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Selección de Sistema y Marco */}
      {step === 1 && (
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] pb-3">
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              1. Parámetros del Autodiagnóstico
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Selecciona el sistema de IA y el estándar de cumplimiento contra el que se verificará el expediente técnico.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={LABEL_CLASSES} htmlFor="eval-system">Sistema de IA Objetivo *</label>
              <select
                id="eval-system"
                value={systemId}
                onChange={(e) => setSystemId(e.target.value)}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">Seleccione un sistema de IA...</option>
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.risk_level || "Riesgo N/D"} • {s.system_type || "ML"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL_CLASSES} htmlFor="eval-framework">Marco Normativo *</label>
              <select
                id="eval-framework"
                value={framework}
                onChange={(e) => setFramework(e.target.value as "EU_AI_ACT" | "ISO_42001")}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="EU_AI_ACT">
                  Reglamento de IA (UE 2024/1689) + Guías Técnicas AESIA (12 Requisitos)
                </option>
                <option value="ISO_42001">UNE-EN ISO/IEC 42001:2023 (Gestión de IA)</option>
              </select>
            </div>
          </div>

          {selectedSystem && (
            <div
              className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] space-y-2 text-xs"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="font-bold text-[var(--g-brand-3308)]">Ficha Técnica Seleccionada:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[var(--g-text-primary)]">
                <div>
                  <span className="text-[var(--g-text-secondary)]">Tipo:</span> {selectedSystem.system_type}
                </div>
                <div>
                  <span className="text-[var(--g-text-secondary)]">Nivel de Riesgo:</span>{" "}
                  <span className="font-bold">{selectedSystem.risk_level}</span>
                </div>
                <div>
                  <span className="text-[var(--g-text-secondary)]">Proveedor:</span> {selectedSystem.vendor || "No declarado"}
                </div>
                <div>
                  <span className="text-[var(--g-text-secondary)]">Estado:</span> {selectedSystem.status}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleNextStep}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span>Continuar a Evaluación de Medidas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Evaluación de las 84 Medidas Guía (MG) */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Cabecera del paso de evaluación */}
          <div
            className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] flex flex-wrap items-center justify-between gap-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[var(--g-brand-3308)] uppercase tracking-wider">
                Autoevaluación Granular (Guía 16 AESIA)
              </span>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Evalúa el nivel de madurez (L1 a L8) y la dificultad para cada una de las Medidas Guía oficiales.
              </p>
            </div>

          </div>

          {/* Requirement Tabs Layout */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar list of Requirements */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-[var(--g-text-secondary)] px-2 uppercase tracking-wider">
                Requisitos RIA ({requirements.length})
              </span>
              <div className="space-y-1">
                {requirements.map((r, idx) => {
                  const isActive = r.code === activeReqCode;
                  const reqMeasures = r.measures;
                  const diagnosedInReq = reqMeasures.filter((m) => !!evaluations[m.id]?.maturity).length;

                  return (
                    <button
                      key={r.code}
                      onClick={() => setActiveReqCode(r.code)}
                      className={`w-full p-2.5 text-left text-xs transition-colors flex items-center justify-between ${
                        isActive
                          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] font-bold shadow-sm"
                          : "bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="truncate font-semibold">{r.title}</div>
                        <div className={`text-[10px] ${isActive ? "text-[var(--g-text-inverse)]/80" : "text-[var(--g-text-secondary)]"}`}>
                          {r.articleRef}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 font-mono ${
                          isActive
                            ? "bg-white/20 text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {diagnosedInReq}/{reqMeasures.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Area: Measures Evaluation for active requirement */}
            <div className="md:col-span-3 space-y-6">
              <div
                className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--g-border-subtle)] pb-3">
                  <div>
                    <span className="text-xs font-mono text-[var(--g-brand-3308)] font-bold bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                      {/* El marco depende del requisito: los del RIA citan un
                          artículo del Reglamento (UE) 2024/1689; los de ISO 42001
                          citan un anexo de la norma. Poner el Reglamento fijo
                          producía «ISO 42001 A.5 Reglamento (UE) 2024/1689», que
                          atribuye a la norma europea un anexo que no es suyo. */}
                      {activeRequirement.articleRef}
                      {activeRequirement.articleRef.startsWith("Art.") ? " Reglamento (UE) 2024/1689" : ""}
                    </span>
                    <h2 className="text-lg font-bold text-[var(--g-text-primary)] mt-1">
                      {activeRequirement.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddMaModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
                    <span>Añadir Medida Adicional (MA)</span>
                  </button>
                </div>
                <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                  {activeRequirement.description}
                </p>
              </div>

              {/* List of Medidas Guía (MG) */}
              <div className="space-y-4">
                {activeRequirement.measures.map((m) => {
                  const state = evaluations[m.id] || {
                    difficulty: "01",
                    maturity: "",
                    justification: "",
                    evidence_url: "",
                    notes: "",
                  };
                  const plan = calculateAdaptationPlan(state.maturity);
                  const matMeta = MATURITY_LEVELS[state.maturity];

                  return (
                    <div
                      key={m.id}
                      className="p-5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4 transition-all hover:border-[var(--g-brand-3308)]/50"
                      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
                    >
                      {/* Measure Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                              {m.id}
                            </span>
                            <span className="text-xs text-[var(--g-text-secondary)]">
                              {subpartTitle(activeRequirement, m.subpartId)}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{m.description}</h3>
                        </div>

                        {/* Resulting Adaptation Plan Badge */}
                        <div className="text-right">
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-bold ${
                              plan.code === "03" || plan.code === "05"
                                ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                                : plan.code === "01"
                                ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                                : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          >
                            {plan.label}
                          </span>
                        </div>
                      </div>

                      {/* Selectors: Dificultad + Madurez (L1-L8) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--g-border-subtle)]">
                        <div>
                          <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                            Nivel de Madurez (Escala Oficial L1–L8)
                          </label>
                          <select
                            value={state.maturity}
                            onChange={(e) => updateEvaluation(m.id, "maturity", e.target.value)}
                            className={SELECT_CLASSES}
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <option value="">Sin evaluar</option>
                            {Object.values(MATURITY_LEVELS).map((lvl) => (
                              <option key={lvl.level} value={lvl.level}>
                                {lvl.level}: {lvl.title} → {lvl.planLabel}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-[var(--g-text-secondary)] mt-1 italic">
                            {matMeta?.description}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                            Dificultad Percibida
                          </label>
                          <select
                            value={state.difficulty}
                            onChange={(e) => updateEvaluation(m.id, "difficulty", e.target.value)}
                            className={SELECT_CLASSES}
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          >
                            <option value="02">02: Baja dificultad de implementación</option>
                            <option value="01">01: Media dificultad de implementación</option>
                            <option value="00">00: Alta dificultad de implementación</option>
                          </select>
                        </div>
                      </div>

                      {/* Justificación obligatoria para L8 */}
                      {state.maturity === "L8" && (
                        <div className="p-3 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--g-brand-3308)] space-y-1.5">
                          <label className="block text-xs font-bold text-[var(--g-text-primary)]">
                            Justificación Técnica Obligatoria (Regla Guía 16) *
                          </label>
                          <input
                            type="text"
                            value={state.justification}
                            onChange={(e) => updateEvaluation(m.id, "justification", e.target.value)}
                            placeholder="Explicar por qué esta medida no resulta necesaria para este sistema..."
                            className={INPUT_CLASSES}
                            style={{ borderRadius: "var(--g-radius-md)" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Additional Measures in this requirement */}
                {additionalMeasures
                  .filter((ma) => ma.requirementCode === activeReqCode)
                  .map((ma) => (
                    <div
                      key={ma.id}
                      className="p-5 bg-[var(--g-surface-subtle)] border-2 border-dashed border-[var(--g-brand-3308)]/40 space-y-3"
                      style={{ borderRadius: "var(--g-radius-lg)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-2 py-0.5 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                            MEDIDA ADICIONAL • {ma.id}
                          </span>
                          <h4 className="text-sm font-bold text-[var(--g-text-primary)] mt-1">{ma.description}</h4>
                          <span className="text-xs text-[var(--g-text-secondary)]">Bloque: {subpartTitle(activeRequirement, ma.subpartId)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMa(ma.id)}
                          className="p-1 text-[var(--status-error)] hover:bg-[var(--g-surface-card)] transition-colors"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--g-border-subtle)]">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <span>Revisar Plan de Adaptación (PDA)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Resumen Consolidado & Plan de Adaptación (PDA) */}
      {step === 3 && (
        <div className="space-y-6">
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-6"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--g-text-primary)]">
                  3. Consolidación y Plan de Adaptación (PDA)
                </h2>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Resumen de diagnóstico generado según las reglas de negocio de la Guía 16 AESIA.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[var(--g-brand-3308)]">{stats.maturityScore}%</div>
                <div className="text-xs text-[var(--g-text-secondary)] font-semibold">Índice de Madurez RIA</div>
              </div>
            </div>

            {/* Grid of Plan Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(ADAPTATION_PLANS).map(([code, plan]) => {
                const count = stats.planCounts[code] || 0;
                return (
                  <div
                    key={code}
                    className="p-4 bg-[var(--g-surface-subtle)]/50 border border-[var(--g-border-subtle)] text-center space-y-1"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div
                      className={`text-2xl font-bold ${
                        code === "03" || code === "05"
                          ? "text-[var(--status-success)]"
                          : code === "01"
                          ? "text-[var(--status-error)]"
                          : "text-[var(--status-warning)]"
                      }`}
                    >
                      {count}
                    </div>
                    <div className="text-xs font-bold text-[var(--g-text-primary)]">Plan {code}</div>
                    <div className="text-[10px] text-[var(--g-text-secondary)]">{plan.action}</div>
                  </div>
                );
              })}
            </div>

            {/* Gap Alert / Handoff info */}
            {stats.gapMeasures.length > 0 && (
              <div
                className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] space-y-2 text-xs"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-center gap-2 font-bold text-[var(--g-text-primary)]">
                  <AlertTriangle className="w-4 h-4 text-[var(--status-warning)]" />
                  <span>Detección Automática de Brechas (GAPs)</span>
                </div>
                <p className="text-[var(--g-text-secondary)] leading-relaxed">
                  Se han detectado {stats.gapMeasures.length} medidas con necesidad de adaptación (Plan 01 o Plan 04).
                  Al registrar la evaluación, se habilitará la derivación del expediente técnico hacia GRC Compass para
                  la formulación de planes de remediación.
                </p>
              </div>
            )}

            {/* Form Notes */}
            <div className="space-y-2">
              <label className={LABEL_CLASSES}>Notas y Observaciones de la Evaluación</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones técnicas o conclusiones del equipo evaluador..."
                className={TEXTAREA_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--g-border-subtle)]">
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createAssessment.isPending || createChecks.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Save className="w-4 h-4" />
                <span>
                  {createAssessment.isPending || createChecks.isPending
                    ? "Registrando..."
                    : "Guardar autodiagnóstico"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Resultado y Handoffs */}
      {step === 4 && (
        <div
          className="p-8 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-6 max-w-2xl mx-auto"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="w-16 h-16 bg-[var(--status-success)] text-[var(--g-text-inverse)] flex items-center justify-center mx-auto" style={{ borderRadius: "var(--g-radius-full)" }}>
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Autodiagnóstico Registrado con Éxito
            </h2>
            {/* No hay precinto: es un INSERT en `ai_risk_assessments` y otro en
                `ai_compliance_checks`. Sin hash, sin sello y sin bundle de
                evidencia. El rótulo anterior prometía un precinto, es decir una
                integridad que el producto no calcula ni guarda. */}
            <p className="text-sm text-[var(--g-text-secondary)]">
              La evaluación queda registrada y es editable: no lleva hash de integridad,
              sello ni bundle de evidencia, y su registro no acredita conformidad por sí solo.
            </p>
          </div>

          <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] text-xs grid grid-cols-3 gap-2" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div>
              <span className="text-[var(--g-text-secondary)] block">Índice Madurez:</span>
              <span className="font-bold text-lg text-[var(--g-brand-3308)]">{stats.maturityScore}%</span>
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)] block">Medidas Evaluadas:</span>
              <span className="font-bold text-lg text-[var(--g-text-primary)]">{stats.diagnosedCount}</span>
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)] block">Planes Activos:</span>
              <span className="font-bold text-lg text-[var(--status-warning)]">{stats.planCounts["01"] + stats.planCounts["02"]}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {createdId && (
              <Link
                to={`/ai-governance/evaluaciones/${createdId}`}
                className="px-5 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span>Inspeccionar Informe Completo</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <Link
              to="/ai-governance/evaluaciones"
              className="px-5 py-2.5 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Volver al Listado
            </Link>
          </div>
        </div>
      )}

      {/* Modal para añadir Medida Adicional (MA) */}
      {showAddMaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg space-y-4 shadow-xl"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="text-base font-bold text-[var(--g-text-primary)]">
              Nueva Medida Adicional (MA)
            </h3>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Define una salvaguarda propia de la organización para complementar el cumplimiento de este requisito.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Bloque del requisito
                </label>
                <select
                  value={newMaSubpart}
                  onChange={(e) => setNewMaSubpart(e.target.value)}
                  className={SELECT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {activeRequirement.subparts.map((sub) => (
                    <option key={sub.subpartId} value={sub.subpartId}>
                      {sub.titleShort}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Descripción de la Medida *
                </label>
                <textarea
                  rows={3}
                  value={newMaDescription}
                  onChange={(e) => setNewMaDescription(e.target.value)}
                  placeholder="Descripción de la salvaguarda, control o procedimiento técnico..."
                  className={TEXTAREA_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--g-border-subtle)]">
              <button
                type="button"
                onClick={() => setShowAddMaModal(false)}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddMa}
                className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Añadir Medida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircle2(props: { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
