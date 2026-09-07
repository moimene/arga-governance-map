/**
 * Alta del autodiagnóstico de conformidad (Reglamento (UE) 2024/1689).
 *
 * QUÉ SE CITA EN PANTALLA. El artículo del Reglamento, que sí está cotejado y
 * lo pinta el catálogo. NADA MÁS.
 *
 * La atribución del método a una guía numerada de la Agencia se retiró el
 * 2026-09-06 de las siete superficies de texto de esta pantalla (título, nota
 * por defecto que se PERSISTE en `ai_risk_assessments.notes`, opción de marco,
 * cabecera y subtítulo del paso 2, rótulo de la justificación y subtítulo del
 * paso 3) por dos motivos distintos, ninguno de los cuales es que la guía no
 * exista:
 *
 *   1. La fuente de un requisito del Reglamento es el ARTÍCULO. Una guía de la
 *      Agencia es material de apoyo no vinculante, y presentarla como el origen
 *      del requisito invierte la jerarquía.
 *   2. Esa atribución concreta NUNCA se cotejó contra publicación oficial —el
 *      propio catálogo lo dejó escrito como deuda abierta—, mientras que la
 *      atribución hermana, la de guía POR REQUISITO, resultó equivocada en diez
 *      de doce cuando por fin se comprobó.
 *
 * El catálogo, los 12 requisitos y las 84 medidas siguen intactos: lo que se
 * retira es la afirmación de procedencia, no el contenido. Vuelve el día que
 * haya un cotejo documentado con su fecha.
 *
 * Fijado en `src/test/aims/no-fabricated-claims.test.ts` y en
 * `e2e/aims-evaluaciones.spec.ts`.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { useEvidenceBySystem, evidenciasPorMedida } from "@/hooks/useAimsEvidence";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { generarPlanDeAdaptacion, type AccionPDA } from "@/lib/aims/plan-adaptacion";
import EvidenciaDeMedida from "@/components/ai-governance/EvidenciaDeMedida";
import {
  useCreateComplianceChecks,
  useDraftAssessment,
  useSaveAssessment,
} from "@/hooks/useAiAssessments";
import {
  perfilAplicable,
  AVISO_COBERTURA_PROVISIONAL,
  procedenciaDe,
} from "@/lib/aims/perfil-aplicabilidad";
import {
  buildEvaluationPayload,
  restoreEvaluationState,
  NIVEL_NO_APLICABLE,
  MOTIVO_L8_SIN_JUSTIFICAR,
  MOTIVO_L5_SIN_EVIDENCIA,
  type MedidaAdicionalRef,
} from "@/lib/aims/evaluacion-payload";
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
  DIFICULTAD_SIN_EVALUAR,
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
  /** `''` = sin evaluar. Antes nacía en `'01'` (media) sin que nadie graduara. */
  difficulty: string;
  maturity: string; // 'L1' - 'L8'
  justification: string;
};

/**
 * Una Medida Adicional guarda aquí sólo su DEFINICIÓN. Su evaluación va al
 * mismo mapa `evaluations` que las del catálogo: mientras tuvo estado propio,
 * ni se graduaba, ni entraba en las estadísticas, ni llegaba al payload — se
 * añadía, se pintaba y se perdía al enviar.
 */
type AdditionalMeasure = MedidaAdicionalRef;

const ESTADO_VACIO: MeasureEvaluationState = {
  difficulty: DIFICULTAD_SIN_EVALUAR,
  maturity: "",
  justification: "",
};

/** Margen tras la última pulsación antes de guardar el borrador. */
const AUTOGUARDADO_MS = 1500;

/**
 * Nivel de madurez, dificultad y —cuando toca— justificación.
 *
 * Es un componente y no JSX repetido porque lo usan las Medidas Guía **y** las
 * Medidas Adicionales. Mientras las MA no tuvieron estos controles no eran
 * evaluables: se añadían, se pintaban y se descartaban al enviar.
 */
function ControlesDeMedida({
  state,
  onChange,
}: {
  state: MeasureEvaluationState;
  onChange: (key: keyof MeasureEvaluationState, value: string) => void;
}) {
  const matMeta = MATURITY_LEVELS[state.maturity];
  const l8SinMotivo = state.maturity === NIVEL_NO_APLICABLE && !state.justification.trim();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--g-border-subtle)]">
        <div>
          <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
            Nivel de madurez (escala L1–L8)
          </label>
          <select
            value={state.maturity}
            onChange={(e) => onChange("maturity", e.target.value)}
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
            Dificultad de implementación
          </label>
          <select
            value={state.difficulty}
            onChange={(e) => onChange("difficulty", e.target.value)}
            className={SELECT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {/* Sin preselección: venía en «media» y las 84 medidas nacían
                graduadas por nadie. Y sin el código numérico, que va al revés
                de la intuición (`00` = alta) y se leía como escala. */}
            <option value={DIFICULTAD_SIN_EVALUAR}>Sin evaluar</option>
            <option value="02">Baja</option>
            <option value="01">Media</option>
            <option value="00">Alta</option>
          </select>
        </div>
      </div>

      {state.maturity === NIVEL_NO_APLICABLE && (
        <div className="p-3 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--g-brand-3308)] space-y-1.5">
          <label className="block text-xs font-bold text-[var(--g-text-primary)]">
            Justificación técnica obligatoria *
          </label>
          <input
            type="text"
            value={state.justification}
            onChange={(e) => onChange("justification", e.target.value)}
            placeholder="Explicar por qué esta medida no resulta necesaria para este sistema..."
            className={INPUT_CLASSES}
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-invalid={l8SinMotivo}
          />
          {l8SinMotivo && (
            <p className="text-[11px] font-semibold text-[var(--status-error)]">
              {MOTIVO_L8_SIN_JUSTIFICAR}: sin el motivo, esta medida no acredita conformidad y no
              suma al porcentaje.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default function EvaluacionNueva() {
  const navigate = useNavigate();
  // `SistemaDetalle` enlaza aquí con `?system_id=…`. Ignorarlo obligaba a
  // reelegir a mano el sistema del que se venía.
  const [params] = useSearchParams();
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const saveAssessment = useSaveAssessment();
  const createChecks = useCreateComplianceChecks();

  const [step, setStep] = useState(1);
  const [systemId, setSystemId] = useState(params.get("system_id") ?? "");
  const { data: evidencias = [] } = useEvidenceBySystem(systemId || undefined);

  const [framework, setFramework] = useState<"EU_AI_ACT" | "ISO_42001">("EU_AI_ACT");
  const [activeReqCode, setActiveReqCode] = useState<string>("QUALITY_MGMT");
  const [overallStatus, setOverallStatus] = useState("COMPLETADA");
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  /** Fila `BORRADOR` sobre la que se autoguarda; se convierte en la definitiva. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoguardado, setAutoguardado] = useState<"limpio" | "guardando" | "guardado" | "error">("limpio");
  const [borradorCargado, setBorradorCargado] = useState<string | null>(null);
  /** Lo EDITADO a mano del plan. Lo generado se recalcula de los findings. */
  const [planEditado, setPlanEditado] = useState<AccionPDA[]>([]);
  const { data: personas = [] } = usePersonasCanonical({ person_type: "PF" });

  const selectedSystem = systems.find((s) => s.id === systemId);

  /**
   * Qué catálogo se evalúa.
   *
   * Las 84 medidas guía desarrollan los arts. 9 a 15, 17, 72 y 73: son las
   * obligaciones del PROVEEDOR de un sistema de alto riesgo. Medir con ellas a
   * un responsable del despliegue de riesgo limitado produce un porcentaje que
   * no dice si cumple, sino que se le ha medido contra deberes que no le
   * vinculan. El perfil lo acota por rol y nivel, y FALLA ABIERTO: sin rol
   * declarado se usa el catálogo completo.
   */
  const perfil = useMemo(
    () =>
      framework === "ISO_42001"
        ? {
            requirements: getRequirementsForFramework(framework),
            etiqueta: "ISO/IEC 42001",
            motivo: "Marco operativo de madurez y documentación, no obligación jurídica autónoma.",
            provisional: false,
            sinRolDeclarado: false,
          }
        : perfilAplicable(selectedSystem, getRequirementsForFramework(framework)),
    [framework, selectedSystem],
  );

  const requirements: RequirementDef[] = perfil.requirements;

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
    sucioRef.current = true;
    setEvaluations((prev) => ({
      ...prev,
      [measureId]: { ...(prev[measureId] || ESTADO_VACIO), [key]: value },
    }));
  };

  /**
   * Catálogo + Medidas Adicionales. Las estadísticas, el porcentaje y el PDA se
   * calculan sobre ESTA lista: si una MA no cuenta, añadirla no tiene ninguna
   * consecuencia y vuelve a ser decoración.
   */
  const medidasEvaluables = useMemo(
    () => [
      ...allMeasures.map((m) => ({ id: m.id, description: m.description, requirementCode: m.requirementCode })),
      ...additionalMeasures.map((ma) => ({ id: ma.id, description: ma.description, requirementCode: ma.requirementCode })),
    ],
    [allMeasures, additionalMeasures],
  );

  /** Evidencias VIGENTES atadas a cada medida. Las caducadas no cuentan. */
  const evidenciasDe = useMemo(() => evidenciasPorMedida(evidencias), [evidencias]);
  const cuentaEvidencias = useMemo(() => {
    const out: Record<string, number> = {};
    medidasEvaluables.forEach((m) => {
      out[m.id] = (evidenciasDe[m.id] ?? []).length;
    });
    return out;
  }, [medidasEvaluables, evidenciasDe]);

  // Estadísticas globales de madurez y cálculo de planes PDA. Con la cuenta de
  // evidencias dentro: una medida en `L5` sin nada detrás es una
  // autodeclaración y no suma al porcentaje.
  const stats = useMemo(() => {
    const conEvidencia: Record<string, { maturity?: string; difficulty?: string; justification?: string; evidenceCount?: number }> = {};
    Object.entries(evaluations).forEach(([id, e]) => {
      conEvidencia[id] = { ...(e ?? {}), evidenceCount: cuentaEvidencias[id] ?? 0 };
    });
    return computeAssessmentStats(medidasEvaluables, conEvidencia);
  }, [medidasEvaluables, evaluations, cuentaEvidencias]);

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
      // El sufijo por posición evita que dos MA creadas en el mismo
      // milisegundo compartan `id` y se pisen en el mapa de evaluaciones.
      id: `MA_${Date.now().toString().slice(-6)}_${additionalMeasures.length + 1}`,
      requirementCode: activeReqCode,
      subpartId: newMaSubpart || activeRequirement?.subparts[0]?.subpartId || "",
      description: newMaDescription.trim(),
    };
    sucioRef.current = true;
    setAdditionalMeasures((prev) => [...prev, newMa]);
    setNewMaDescription("");
    setShowAddMaModal(false);
    toast.success("Medida Adicional (MA) agregada al requisito");
  };

  const handleRemoveMa = (maId: string) => {
    sucioRef.current = true;
    setAdditionalMeasures((prev) => prev.filter((m) => m.id !== maId));
    // Se retira también su evaluación: si no, quedaría un finding huérfano
    // apuntando a una medida que ya no existe.
    setEvaluations((prev) => {
      const { [maId]: _fuera, ...resto } = prev;
      return resto;
    });
    toast.info("Medida Adicional eliminada");
  };

  // ---------------------------------------------------------------------
  // Borrador: guardado automático y reanudación
  //
  // El wizard tenía las 84 medidas en `useState` y nada más. Cerrar la pestaña
  // en el paso 2 —entre 30 y 60 minutos de trabajo— lo perdía todo. El estado
  // `BORRADOR` ya existía en la columna y en el filtro de la lista, pero
  // ningún camino del producto lo producía.
  // ---------------------------------------------------------------------
  const sucioRef = useRef(false);

  const { data: borrador } = useDraftAssessment(
    step >= 2 || Boolean(systemId) ? systemId || undefined : undefined,
    framework,
  );

  /**
   * El plan se DERIVA de los findings y conserva lo editado a mano: quien
   * asignó responsable y fecha no puede perderlos porque alguien vuelva a
   * tocar una medida.
   */
  const planDeAdaptacion = useMemo(() => {
    const payload = buildEvaluationPayload(
      evaluations,
      allMeasures,
      requirements,
      undefined,
      additionalMeasures,
      cuentaEvidencias,
    );
    return generarPlanDeAdaptacion(payload.findings, planEditado, new Date());
  }, [evaluations, allMeasures, requirements, additionalMeasures, cuentaEvidencias, planEditado]);

  const editarAccion = (measureCode: string, cambio: Partial<AccionPDA>) => {
    sucioRef.current = true;
    setPlanEditado((prev) => {
      const actual = planDeAdaptacion.find((a) => a.measureCode === measureCode);
      if (!actual) return prev;
      const resto = prev.filter((a) => a.measureCode !== measureCode);
      return [...resto, { ...actual, ...cambio }];
    });
  };

  const construirPayload = useCallback(
    (estadoFinal: boolean) => {
      const payload = buildEvaluationPayload(
        evaluations,
        allMeasures,
        requirements,
        undefined,
        additionalMeasures,
        cuentaEvidencias,
      );
      return {
        payload,
        fila: {
          system_id: systemId,
          framework,
          score: stats.maturityScore,
          assessment_date: new Date().toISOString().slice(0, 10),
          findings: payload.findings,
          action_plan: generarPlanDeAdaptacion(payload.findings, planEditado, new Date()),
          status: estadoFinal ? payload.status : "BORRADOR",
          notes:
            notes ||
            `Autodiagnóstico de conformidad. Medidas evaluadas: ${payload.evaluadas}/${payload.totales}.`,
        },
      };
    },
    [evaluations, allMeasures, requirements, additionalMeasures, cuentaEvidencias, planEditado, systemId, framework, stats.maturityScore, notes],
  );

  // Reanudar: el finding persistido es round-trippable a propósito (nivel,
  // dificultad, justificación, tipo y requisito), así que el borrador se
  // reconstruye entero, MA incluidas.
  useEffect(() => {
    if (!borrador?.id || borradorCargado === borrador.id || sucioRef.current) return;
    const { evaluations: recuperadas, additionalMeasures: maRecuperadas } =
      restoreEvaluationState(borrador.findings);
    setEvaluations(recuperadas);
    setAdditionalMeasures(maRecuperadas);
    if (borrador.notes) setNotes(borrador.notes);
    if (Array.isArray(borrador.action_plan)) setPlanEditado(borrador.action_plan as AccionPDA[]);
    setDraftId(borrador.id);
    setBorradorCargado(borrador.id);
    const n = Object.keys(recuperadas).length;
    if (n > 0) {
      toast.info(`Borrador recuperado: ${n} medida${n === 1 ? "" : "s"} ya evaluada${n === 1 ? "" : "s"}.`);
    }
  }, [borrador, borradorCargado]);

  // La función de guardado va por ref: si entrara en las dependencias del
  // efecto, cada cambio de estado de la mutación reprogramaría el temporizador
  // y el autoguardado se perseguiría a sí mismo.
  const guardarRef = useRef(saveAssessment.mutateAsync);
  useEffect(() => {
    guardarRef.current = saveAssessment.mutateAsync;
  });

  useEffect(() => {
    if (!systemId || createdId || !sucioRef.current) return;
    setAutoguardado("guardando");
    const t = setTimeout(async () => {
      try {
        const { fila } = construirPayload(false);
        const guardada = await guardarRef.current({ id: draftId, systemId, payload: fila });
        setDraftId(guardada.id);
        setBorradorCargado(guardada.id);
        setAutoguardado("guardado");
      } catch (err) {
        // Se dice en pantalla. Un autoguardado que falla en silencio es peor
        // que no tenerlo: da confianza para cerrar la pestaña.
        setAutoguardado("error");
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`No se pudo guardar el borrador: ${msg}`);
      }
    }, AUTOGUARDADO_MS);
    return () => clearTimeout(t);
    // `construirPayload` cambia con cada pulsación: es lo que reinicia el margen.
  }, [construirPayload, systemId, draftId, createdId]);

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
    const { payload, fila } = construirPayload(true);

    try {
      // Se CIERRA el borrador en vez de insertar otra fila: si no, cada
      // autodiagnóstico dejaría atrás un `BORRADOR` fantasma con el mismo
      // trabajo dentro.
      const createdAssessment = await saveAssessment.mutateAsync({ id: draftId, systemId, payload: fila });

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
            Nuevo Autodiagnóstico de Conformidad
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
                  Reglamento de IA (UE 2024/1689) — 12 requisitos
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
                Autoevaluación granular por medida
              </span>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Evalúa el nivel de madurez (L1 a L8) y la dificultad de cada medida del catálogo.
              </p>
            </div>

            {/* El estado del borrador se dice: un autoguardado silencioso da
                confianza para cerrar la pestaña sin saber si guardó. */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-live="polite"
            >
              {autoguardado === "error" ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-error)]" />
                  <span className="text-[var(--status-error)]">Borrador NO guardado</span>
                </>
              ) : autoguardado === "guardando" ? (
                <>
                  <Save className="w-3.5 h-3.5 text-[var(--g-text-secondary)]" />
                  <span className="text-[var(--g-text-secondary)]">Guardando borrador…</span>
                </>
              ) : autoguardado === "guardado" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[var(--status-success)]" />
                  <span className="text-[var(--g-text-primary)]">Borrador guardado</span>
                </>
              ) : (
                <>
                  <Info className="w-3.5 h-3.5 text-[var(--g-text-secondary)]" />
                  <span className="text-[var(--g-text-secondary)]">
                    El trabajo se guarda solo como borrador
                  </span>
                </>
              )}
            </div>
          </div>

          {/* El perfil se declara donde se evalúa: es lo que explica por qué
              hay 43 medidas y no 84, y de qué norma sale cada una. */}
          <div
            className={`p-4 border-l-4 space-y-1.5 ${
              perfil.sinRolDeclarado
                ? "bg-[var(--g-surface-subtle)] border-[var(--status-warning)]"
                : "bg-[var(--g-surface-subtle)] border-[var(--g-brand-3308)]"
            }`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--g-text-primary)]">
                Perfil de aplicabilidad: {perfil.etiqueta}
              </span>
              <span className="text-xs text-[var(--g-text-secondary)]">
                {requirements.reduce((n, r) => n + r.measures.length, 0)} medidas
              </span>
              {perfil.provisional && (
                <span
                  className="px-2 py-0.5 text-[10px] font-bold bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {AVISO_COBERTURA_PROVISIONAL}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">{perfil.motivo}</p>
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
                  // Las MA del requisito entran en el contador: si no, se leía
                  // «11/11» con una medida adicional sin contestar debajo.
                  const reqMeasures = [
                    ...r.measures.map((m) => m.id),
                    ...additionalMeasures.filter((ma) => ma.requirementCode === r.code).map((ma) => ma.id),
                  ];
                  const diagnosedInReq = reqMeasures.filter((id) => !!evaluations[id]?.maturity).length;

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
                  const state = evaluations[m.id] || ESTADO_VACIO;
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
                            {(() => {
                              const proc = procedenciaDe(m.id);
                              if (!proc) return null;
                              // «Obligación» y «marco operativo» no son lo
                              // mismo, y presentar un control de ISO 42001 como
                              // deber jurídico sería fabricar una obligación.
                              return (
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-semibold ${
                                    proc.caracter === "OBLIGACION"
                                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                                  }`}
                                  style={{ borderRadius: "var(--g-radius-sm)" }}
                                  title={
                                    proc.caracter === "OBLIGACION"
                                      ? `Obligación — ${proc.norma}`
                                      : `Marco operativo de madurez, no obligación jurídica autónoma — ${proc.norma}`
                                  }
                                >
                                  {proc.caracter === "OBLIGACION" ? "Obligación" : "Marco operativo"} ·{" "}
                                  {proc.norma}
                                </span>
                              );
                            })()}
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

                      <ControlesDeMedida
                        state={state}
                        onChange={(key, value) => updateEvaluation(m.id, key, value)}
                      />
                      {systemId && (
                        <EvidenciaDeMedida
                          systemId={systemId}
                          measureId={m.id}
                          vinculadas={evidenciasDe[m.id] ?? []}
                          delSistema={evidencias}
                        />
                      )}
                      {/* `L5` sin nada detrás es una autodeclaración: se dice en
                          la propia medida y no suma al porcentaje. */}
                      {state.maturity === "L5" && (evidenciasDe[m.id] ?? []).length === 0 && (
                        <p className="text-[11px] font-semibold text-[var(--status-warning)]">
                          {MOTIVO_L5_SIN_EVIDENCIA}: no computa como acreditada.
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Additional Measures in this requirement */}
                {additionalMeasures
                  .filter((ma) => ma.requirementCode === activeReqCode)
                  .map((ma) => {
                    const state = evaluations[ma.id] || ESTADO_VACIO;
                    const plan = calculateAdaptationPlan(state.maturity);
                    return (
                      <div
                        key={ma.id}
                        className="p-5 bg-[var(--g-surface-subtle)] border-2 border-dashed border-[var(--g-brand-3308)]/40 space-y-4"
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
                          <div className="flex items-start gap-2">
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
                            <button
                              type="button"
                              onClick={() => handleRemoveMa(ma.id)}
                              aria-label={`Eliminar la medida adicional ${ma.id}`}
                              className="p-1 text-[var(--status-error)] hover:bg-[var(--g-surface-card)] transition-colors"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {/* Los mismos controles que una MG: una MA sin nivel no
                            es evaluable y su requisito queda PENDIENTE. */}
                        <ControlesDeMedida
                          state={state}
                          onChange={(key, value) => updateEvaluation(ma.id, key, value)}
                        />
                      </div>
                    );
                  })}
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
                  Resumen de diagnóstico generado con las reglas de conversión del catálogo de medidas.
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

            {/* ---------------------------------------------------------
                Plan de Adaptación como ACCIONES.

                En el primer piloto vive entero dentro de `notes`: seis
                acciones con responsable, prioridad y fecha escritas a mano en
                un párrafo, que no se puede filtrar ni ordenar ni vencer.
                --------------------------------------------------------- */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className={LABEL_CLASSES}>
                  Plan de Adaptación ({planDeAdaptacion.length} acciones)
                </label>
                <span className="text-xs text-[var(--g-text-secondary)]">
                  Una acción por medida con brecha. La prioridad sale del plan y de la dificultad;
                  la fecha es una propuesta editable.
                </span>
              </div>
              {planDeAdaptacion.length === 0 ? (
                <p className="text-xs text-[var(--g-text-secondary)] italic">
                  Ninguna medida evaluada exige acción todavía.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
                        <th className="pb-2 pr-3 font-semibold">Medida</th>
                        <th className="pb-2 pr-3 font-semibold">Acción</th>
                        <th className="pb-2 pr-3 font-semibold">Prioridad</th>
                        <th className="pb-2 pr-3 font-semibold">Responsable</th>
                        <th className="pb-2 pr-3 font-semibold">Vence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--g-border-subtle)]">
                      {planDeAdaptacion.map((a) => (
                        <tr key={a.measureCode}>
                          <td className="py-2 pr-3 font-mono text-[var(--g-brand-3308)] font-semibold align-top">
                            {a.measureCode}
                          </td>
                          <td className="py-2 pr-3 text-[var(--g-text-primary)] align-top max-w-sm">
                            {a.titulo}
                          </td>
                          <td className="py-2 pr-3 align-top">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold ${
                                a.prioridad === "ALTA"
                                  ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                                  : a.prioridad === "MEDIA"
                                  ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                                  : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                              }`}
                              style={{ borderRadius: "var(--g-radius-full)" }}
                            >
                              {a.prioridad}
                            </span>
                          </td>
                          <td className="py-2 pr-3 align-top">
                            <select
                              value={a.owner_id ?? ""}
                              onChange={(e) => editarAccion(a.measureCode, { owner_id: e.target.value || null })}
                              className="h-8 w-40 px-2 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                              aria-label={`Responsable de ${a.measureCode}`}
                            >
                              <option value="">Sin asignar</option>
                              {personas.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-3 align-top">
                            <input
                              type="date"
                              value={a.vence_el ?? ""}
                              onChange={(e) => editarAccion(a.measureCode, { vence_el: e.target.value || null })}
                              className="h-8 px-2 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                              aria-label={`Vencimiento de ${a.measureCode}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Form Notes */}
            <div className="space-y-2">
              <label className={LABEL_CLASSES}>Notas y Observaciones de la Evaluación</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => { sucioRef.current = true; setNotes(e.target.value); }}
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
                disabled={saveAssessment.isPending || createChecks.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Save className="w-4 h-4" />
                <span>
                  {saveAssessment.isPending || createChecks.isPending
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
