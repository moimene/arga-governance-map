/**
 * Alta del autodiagnóstico de conformidad (Reglamento (UE) 2024/1689).
 *
 * QUÉ SE CITA EN PANTALLA: el artículo del Reglamento, que está cotejado y lo
 * pinta el catálogo. NADA MÁS. La atribución del método a una guía numerada de
 * la Agencia se retiró el 2026-09-06 de las siete superficies de texto —la nota
 * por defecto incluida, que se PERSISTE en `ai_risk_assessments.notes`— porque
 * la fuente de un requisito del Reglamento es el ARTÍCULO y porque esa
 * atribución nunca se cotejó contra publicación oficial. Se retiró la
 * afirmación de procedencia, no el contenido.
 *
 * ESTA PANTALLA SÓLO COMPONE: todo criterio vive en `@/lib/aims/*`, los pasos
 * en `@/components/ai-governance/evaluacion` sólo pintan, y qué catálogo se
 * mide lo decide aquí `perfilAplicable`.
 *
 * Fijado en `src/test/aims/no-fabricated-claims.test.ts`,
 * `src/test/aims/evaluacion-nueva-perfil.test.ts` y `e2e/aims-evaluaciones.spec.ts`.
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useEvidenceBySystem, evidenciasPorMedida } from "@/hooks/useAimsEvidence";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useCreateComplianceChecks, useDraftAssessment, useSaveAssessment } from "@/hooks/useAiAssessments";
import { generarPlanDeAdaptacion, type AccionPDA } from "@/lib/aims/plan-adaptacion";
import { perfilAplicable } from "@/lib/aims/perfil-aplicabilidad";
import { buildEvaluationPayload, restoreEvaluationState, type MedidaAdicionalRef } from "@/lib/aims/evaluacion-payload";
import { getRequirementsForFramework, computeAssessmentStats, type RequirementDef } from "@/lib/aims/catalog-aesia";
import PasoParametros, { type MarcoEvaluacion } from "@/components/ai-governance/evaluacion/PasoParametros";
import PasoMedidas from "@/components/ai-governance/evaluacion/PasoMedidas";
import PasoRevision from "@/components/ai-governance/evaluacion/PasoRevision";
import PasoResultado from "@/components/ai-governance/evaluacion/PasoResultado";
import PerfilAplicabilidadBanner from "@/components/ai-governance/evaluacion/PerfilAplicabilidadBanner";
import { ESTADO_VACIO, type MeasureEvaluationState } from "@/components/ai-governance/evaluacion/estado-medida";

/**
 * Los dos marcos evaluables. Se declaran junto a la decisión de catálogo y no
 * en el paso que los pinta: quien elige contra qué se mide es esta pantalla.
 * `AESIA_RIA_REQUIREMENTS` es lo que `getRequirementsForFramework` resuelve
 * para el primero.
 */
const MARCOS: { value: MarcoEvaluacion; label: string }[] = [
  { value: "EU_AI_ACT", label: "Reglamento de IA (UE 2024/1689) — 12 requisitos" },
  { value: "ISO_42001", label: "UNE-EN ISO/IEC 42001:2023 (Gestión de IA)" },
];

/** Margen tras la última pulsación antes de guardar el borrador. */
const AUTOGUARDADO_MS = 1500;

const PASOS = ["Sistema y Marco", "Evaluación 84 MGs", "Plan de Adaptación (PDA)", "Resultado"];

const chipPaso = (step: number, num: number) =>
  step === num
    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
    : step > num
    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

export default function EvaluacionNueva() {
  const navigate = useNavigate();
  // `SistemaDetalle` enlaza aquí con `?system_id=…`. Ignorarlo obligaba a
  // reelegir a mano el sistema del que se venía.
  const [params] = useSearchParams();
  const { data: systems = [] } = useAiSystemsList();
  const saveAssessment = useSaveAssessment();
  const createChecks = useCreateComplianceChecks();

  const [step, setStep] = useState(1);
  const [systemId, setSystemId] = useState(params.get("system_id") ?? "");
  const [framework, setFramework] = useState<MarcoEvaluacion>("EU_AI_ACT");
  const [activeReqCode, setActiveReqCode] = useState<string>("QUALITY_MGMT");
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  /** Fila `BORRADOR` sobre la que se autoguarda; se convierte en la definitiva. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const [autoguardado, setAutoguardado] = useState<"limpio" | "guardando" | "guardado" | "error">("limpio");
  const [borradorCargado, setBorradorCargado] = useState<string | null>(null);
  /** Lo EDITADO a mano del plan. Lo generado se recalcula de los findings. */
  const [planEditado, setPlanEditado] = useState<AccionPDA[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, MeasureEvaluationState>>({});
  const [additionalMeasures, setAdditionalMeasures] = useState<MedidaAdicionalRef[]>([]);
  const { data: evidencias = [] } = useEvidenceBySystem(systemId || undefined);
  const { data: personas = [] } = usePersonasCanonical({ person_type: "PF" });
  const sucioRef = useRef(false);

  const selectedSystem = systems.find((s) => s.id === systemId);

  /**
   * Qué catálogo se evalúa. Las 84 medidas desarrollan los arts. 9 a 15, 17, 72
   * y 73: las obligaciones del PROVEEDOR de alto riesgo. Medirlas a un
   * responsable del despliegue de riesgo limitado da un porcentaje que no dice
   * si cumple, sino que se le midió contra deberes que no le vinculan. El
   * perfil lo acota por rol y nivel, y FALLA ABIERTO.
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
            catalogProfile: null,
          }
        : perfilAplicable(selectedSystem, getRequirementsForFramework(framework)),
    [framework, selectedSystem],
  );

  const requirements: RequirementDef[] = perfil.requirements;
  const allMeasures = useMemo(
    () => requirements.flatMap((r) => r.measures.map((m) => ({ ...m, requirementCode: r.code, requirementTitle: r.title }))),
    [requirements],
  );
  // Que `activeReqCode` siga siendo válido al cambiar de marco o de perfil.
  useMemo(() => {
    if (requirements.length > 0 && !requirements.some((r) => r.code === activeReqCode)) {
      setActiveReqCode(requirements[0].code);
    }
  }, [requirements, activeReqCode]);
  const activeRequirement = useMemo(
    () => requirements.find((r) => r.code === activeReqCode) || requirements[0],
    [requirements, activeReqCode],
  );

  const updateEvaluation = (measureId: string, key: keyof MeasureEvaluationState, value: string) => {
    sucioRef.current = true;
    setEvaluations((prev) => ({ ...prev, [measureId]: { ...(prev[measureId] || ESTADO_VACIO), [key]: value } }));
  };

  const handleAddMa = (descripcion: string, subpartId: string) => {
    sucioRef.current = true;
    setAdditionalMeasures((prev) => [
      ...prev,
      {
        // El sufijo por posición evita que dos MA creadas en el mismo
        // milisegundo compartan `id` y se pisen en el mapa de evaluaciones.
        id: `MA_${Date.now().toString().slice(-6)}_${prev.length + 1}`,
        requirementCode: activeReqCode,
        subpartId,
        description: descripcion,
      },
    ]);
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

  /**
   * Catálogo + Medidas Adicionales. Las estadísticas, el porcentaje y el PDA
   * salen de ESTA lista: si una MA no cuenta, añadirla es decoración.
   */
  const medidasEvaluables = useMemo(
    () => [...allMeasures, ...additionalMeasures].map((m) => ({ id: m.id, description: m.description, requirementCode: m.requirementCode })),
    [allMeasures, additionalMeasures],
  );

  /** Evidencias VIGENTES atadas a cada medida. Las caducadas no cuentan. */
  const evidenciasDe = useMemo(() => evidenciasPorMedida(evidencias), [evidencias]);
  /** Cuántas evidencias vigentes sostienen cada medida. */
  const cuentaEvidencias = useMemo(
    () => Object.fromEntries(medidasEvaluables.map((m) => [m.id, (evidenciasDe[m.id] ?? []).length])) as Record<string, number>,
    [medidasEvaluables, evidenciasDe],
  );

  // Estadísticas de madurez y planes PDA, con la cuenta de evidencias dentro:
  // una medida en `L5` sin nada detrás es una autodeclaración y no suma.
  const stats = useMemo(() => {
    const conEvidencia = Object.fromEntries(
      Object.entries(evaluations).map(([id, e]) => [id, { ...(e ?? {}), evidenceCount: cuentaEvidencias[id] ?? 0 }]),
    );
    return computeAssessmentStats(medidasEvaluables, conEvidencia);
  }, [medidasEvaluables, evaluations, cuentaEvidencias]);

  // Borrador. El wizard tenía las 84 medidas en `useState` y nada más: cerrar
  // la pestaña en el paso 2 —entre 30 y 60 minutos— lo perdía todo. El estado
  // `BORRADOR` ya existía en la columna y en el filtro, pero ningún camino del
  // producto lo producía.
  const { data: borrador } = useDraftAssessment(step >= 2 || Boolean(systemId) ? systemId || undefined : undefined, framework);

  const payloadActual = useMemo(
    () => buildEvaluationPayload(evaluations, allMeasures, requirements, undefined, additionalMeasures, cuentaEvidencias),
    [evaluations, allMeasures, requirements, additionalMeasures, cuentaEvidencias],
  );

  /**
   * El plan se DERIVA de los findings y conserva lo editado a mano: quien
   * asignó responsable y fecha no los pierde porque alguien toque una medida.
   */
  const planDeAdaptacion = useMemo(
    () => generarPlanDeAdaptacion(payloadActual.findings, planEditado, new Date()),
    [payloadActual, planEditado],
  );

  const editarAccion = (measureCode: string, cambio: Partial<AccionPDA>) => {
    sucioRef.current = true;
    const actual = planDeAdaptacion.find((a) => a.measureCode === measureCode);
    if (!actual) return;
    setPlanEditado((prev) => [...prev.filter((a) => a.measureCode !== measureCode), { ...actual, ...cambio }]);
  };

  const construirPayload = useCallback(
    (estadoFinal: boolean) => ({
      payload: payloadActual,
      fila: {
        system_id: systemId,
        framework,
        score: stats.maturityScore,
        assessment_date: new Date().toISOString().slice(0, 10),
        findings: payloadActual.findings,
        action_plan: generarPlanDeAdaptacion(payloadActual.findings, planEditado, new Date()),
        status: estadoFinal ? payloadActual.status : "BORRADOR",
        notes: notes || `Autodiagnóstico de conformidad. Medidas evaluadas: ${payloadActual.evaluadas}/${payloadActual.totales}.`,
      },
    }),
    [payloadActual, planEditado, systemId, framework, stats.maturityScore, notes],
  );

  // El finding persistido es round-trippable a propósito (nivel, dificultad,
  // justificación, tipo y requisito): el borrador se reconstruye entero.
  useEffect(() => {
    if (!borrador?.id || borradorCargado === borrador.id || sucioRef.current) return;
    const { evaluations: recuperadas, additionalMeasures: maRecuperadas } = restoreEvaluationState(borrador.findings);
    setEvaluations(recuperadas);
    setAdditionalMeasures(maRecuperadas);
    if (borrador.notes) setNotes(borrador.notes);
    if (Array.isArray(borrador.action_plan)) setPlanEditado(borrador.action_plan as AccionPDA[]);
    setDraftId(borrador.id);
    setBorradorCargado(borrador.id);
    const n = Object.keys(recuperadas).length;
    if (n > 0) toast.info(`Borrador recuperado: ${n} medida${n === 1 ? "" : "s"} ya evaluada${n === 1 ? "" : "s"}.`);
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
        toast.error(`No se pudo guardar el borrador: ${err instanceof Error ? err.message : String(err)}`);
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
      await createChecks.mutateAsync(payload.checks.map((c) => ({ ...c, system_id: systemId })));
      setCreatedId(createdAssessment.id);
      toast.success(`Autodiagnóstico registrado. Medidas evaluadas: ${payload.evaluadas}/${payload.totales}.`);
      setStep(4);
    } catch (err) {
      toast.error(`Error al registrar la evaluación: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--g-border-subtle)]">
        <div>
          <button
            onClick={() => navigate("/ai-governance/evaluaciones")}
            className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver a Evaluaciones</span>
          </button>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Nuevo Autodiagnóstico de Conformidad</h1>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {PASOS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 flex items-center justify-center font-bold text-xs ${chipPaso(step, i + 1)}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {step > i + 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`hidden sm:inline ${step === i + 1 ? "font-bold text-[var(--g-text-primary)]" : "text-[var(--g-text-secondary)]"}`}>
                {label}
              </span>
              {i < PASOS.length - 1 && <span className="text-[var(--g-border-subtle)]">›</span>}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <PasoParametros
          systems={systems}
          systemId={systemId}
          onSystemIdChange={setSystemId}
          framework={framework}
          onFrameworkChange={setFramework}
          marcos={MARCOS}
          selectedSystem={selectedSystem}
          onNext={handleNextStep}
        />
      )}

      {step === 2 && (
        <PasoMedidas
          requirements={requirements}
          activeRequirement={activeRequirement}
          activeReqCode={activeReqCode}
          onActiveReqCode={setActiveReqCode}
          additionalMeasures={additionalMeasures}
          evaluations={evaluations}
          onEvaluationChange={updateEvaluation}
          onAddMa={handleAddMa}
          onRemoveMa={handleRemoveMa}
          systemId={systemId}
          evidencias={evidencias}
          evidenciasDe={evidenciasDe}
          autoguardado={autoguardado}
          bannerPerfil={
            <PerfilAplicabilidadBanner
              perfil={perfil}
              totalMedidas={requirements.reduce((n, r) => n + r.measures.length, 0)}
              sistema={selectedSystem}
            />
          }
          onPrev={() => setStep((prev) => prev - 1)}
          onNext={handleNextStep}
        />
      )}

      {step === 3 && (
        <PasoRevision
          stats={stats}
          plan={planDeAdaptacion}
          personas={personas}
          notes={notes}
          onNotesChange={(v) => { sucioRef.current = true; setNotes(v); }}
          onEditarAccion={editarAccion}
          guardando={saveAssessment.isPending || createChecks.isPending}
          onPrev={() => setStep((prev) => prev - 1)}
          onSubmit={handleSubmit}
        />
      )}

      {step === 4 && <PasoResultado stats={stats} createdId={createdId} />}
    </div>
  );
}
