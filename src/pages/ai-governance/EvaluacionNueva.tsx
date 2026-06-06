import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, ShieldCheck, Check, ClipboardCheck, AlertTriangle, Cpu, ListChecks, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useCreateAssessment, useCreateComplianceChecks } from "@/hooks/useAiAssessments";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

type RequirementDef = {
  code: string;
  title: string;
  description: string;
};

const EU_AI_ACT_REQUIREMENTS: RequirementDef[] = [
  {
    code: "VAL-01",
    title: "Sistema de gestión de riesgos (Art. 9)",
    description: "Establecer, implementar, documentar y mantener un sistema de gestión de riesgos continuo y sistemático en relación con los sistemas de IA de alto riesgo."
  },
  {
    code: "VAL-02",
    title: "Datos y gobernanza de datos (Art. 10)",
    description: "Los datos de entrenamiento, validación y prueba deberán estar sujetos a prácticas adecuadas de gobernanza de datos (diseño, recogida, formulación de hipótesis, etc.)."
  },
  {
    code: "VAL-03",
    title: "Documentación técnica (Art. 11)",
    description: "Extraer y mantener documentación técnica detallada antes de la comercialización o puesta en servicio para demostrar la conformidad."
  },
  {
    code: "VAL-04",
    title: "Conservación de registros / Logging (Art. 12)",
    description: "Habilitar el registro automático de eventos (logs) a lo largo del ciclo de vida para garantizar la trazabilidad del funcionamiento."
  },
  {
    code: "VAL-05",
    title: "Transparencia e información (Art. 13)",
    description: "Diseñar el sistema para garantizar que el funcionamiento sea suficientemente transparente y permita a los usuarios interpretar y utilizar los resultados."
  },
  {
    code: "VAL-06",
    title: "Supervisión humana (Art. 14)",
    description: "Garantizar que el sistema pueda ser supervisado eficazmente por personas físicas durante el periodo de utilización para prevenir o minimizar riesgos."
  },
  {
    code: "VAL-07",
    title: "Precisión, robustez y ciberseguridad (Art. 15)",
    description: "Garantizar un nivel adecuado de precisión, robustez y ciberseguridad, con resistencia frente a errores, fallos o intentos de manipulación."
  }
];

const ISO_42001_REQUIREMENTS: RequirementDef[] = [
  {
    code: "ISO-05",
    title: "Política de IA (A.5)",
    description: "Definir directrices y compromisos alineados con la gobernanza corporativa y los valores éticos de la organización en relación con el desarrollo y uso de la IA."
  },
  {
    code: "ISO-06",
    title: "Organización interna (A.6)",
    description: "Asignar roles y responsabilidades claras, establecer comités de supervisión y coordinar recursos para garantizar la gestión efectiva del sistema."
  },
  {
    code: "ISO-07",
    title: "Recursos de IA (A.7)",
    description: "Identificar y proporcionar los recursos necesarios (infraestructura, personas, datos) para dar soporte al sistema de gestión de IA."
  },
  {
    code: "ISO-08",
    title: "Evaluación de impacto de sistemas de IA (A.8)",
    description: "Evaluar el impacto ético, social y legal de los sistemas de IA, documentando los posibles impactos negativos y las medidas de mitigación."
  },
  {
    code: "ISO-09",
    title: "Salvaguardas del ciclo de vida de IA (A.9)",
    description: "Implementar salvaguardas operativas en todas las fases del ciclo de vida del sistema, desde el diseño y desarrollo hasta el despliegue y retirada."
  },
  {
    code: "ISO-10",
    title: "Gestión de datos para IA (A.10)",
    description: "Garantizar la calidad, procedencia, privacidad y seguridad de los datos utilizados por los sistemas de IA de acuerdo con las normativas vigentes."
  }
];

type CheckState = {
  status: string;
  evidence_url: string;
  notes: string;
};

export default function EvaluacionNueva() {
  const navigate = useNavigate();
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const createAssessment = useCreateAssessment();
  const createChecks = useCreateComplianceChecks();

  const [step, setStep] = useState(1);
  const [systemId, setSystemId] = useState("");
  const [framework, setFramework] = useState("EU_AI_ACT");
  const [overallStatus, setOverallStatus] = useState("BORRADOR");
  const [notes, setNotes] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Requirements configuration based on framework
  const activeRequirements = useMemo(() => {
    return framework === "EU_AI_ACT" ? EU_AI_ACT_REQUIREMENTS : ISO_42001_REQUIREMENTS;
  }, [framework]);

  // Checklist state management
  const [checks, setChecks] = useState<Record<string, CheckState>>({});

  // Initialize checks if empty or changed framework
  const currentChecks = useMemo(() => {
    const nextChecks: Record<string, CheckState> = { ...checks };
    let changed = false;
    activeRequirements.forEach((req) => {
      if (!nextChecks[req.code]) {
        nextChecks[req.code] = {
          status: "CONFORME",
          evidence_url: "",
          notes: "",
        };
        changed = true;
      }
    });
    if (changed) {
      setChecks(nextChecks);
    }
    return nextChecks;
  }, [activeRequirements, checks]);

  const updateCheck = (code: string, key: keyof CheckState, value: string) => {
    setChecks((prev) => ({
      ...prev,
      [code]: {
        ...(prev[code] || { status: "CONFORME", evidence_url: "", notes: "" }),
        [key]: value,
      },
    }));
  };

  // Mark all requirements as conforming helper
  const markAllConforming = () => {
    const nextChecks: Record<string, CheckState> = {};
    activeRequirements.forEach((req) => {
      nextChecks[req.code] = {
        status: "CONFORME",
        evidence_url: "https://eadtrust.g-digital.net/evidences/seals/sha512-compliance-verified",
        notes: "Verificación documental de controles y auditoría interna superada.",
      };
    });
    setChecks(nextChecks);
    toast.success("Todos los requisitos marcados como CONFORME");
  };

  // Dynamic Score Calculation
  const score = useMemo(() => {
    let conformeCount = 0;
    let applicableCount = 0;
    activeRequirements.forEach((req) => {
      const state = checks[req.code] || { status: "CONFORME" };
      if (state.status === "CONFORME") {
        conformeCount++;
        applicableCount++;
      } else if (state.status === "NO_CONFORME" || state.status === "PENDIENTE") {
        applicableCount++;
      }
    });
    return applicableCount > 0 ? Math.round((conformeCount / applicableCount) * 100) : 100;
  }, [activeRequirements, checks]);

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

    // Convert checklist state into finding summary objects
    const findingsList = activeRequirements.map((req) => {
      const state = checks[req.code] || { status: "CONFORME" };
      return {
        code: req.code,
        status: state.status,
      };
    });

    const assessmentPayload = {
      system_id: systemId,
      framework,
      score,
      assessment_date: new Date().toISOString().slice(0, 10),
      findings: findingsList,
      status: overallStatus,
      notes: notes || `Evaluación de riesgo bajo el marco ${framework === "EU_AI_ACT" ? "EU AI Act" : "ISO 42001"}.`,
    };

    try {
      const createdAssessment = await createAssessment.mutateAsync(assessmentPayload);

      // Create individual compliance checks records
      const checkPayloads = activeRequirements.map((req) => {
        const state = checks[req.code] || { status: "CONFORME", evidence_url: "", notes: "" };
        return {
          system_id: systemId,
          requirement_code: req.code,
          requirement_title: req.title,
          description: req.description,
          status: state.status,
          evidence_url: state.evidence_url || null,
          checked_at: new Date().toISOString().slice(0, 10),
        };
      });

      await createChecks.mutateAsync(checkPayloads);

      setCreatedId(createdAssessment.id);
      toast.success("Evaluación de riesgo IA registrada correctamente.");
      setStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error al registrar la evaluación: ${msg}`);
    }
  };

  const selectedSystemName = useMemo(() => {
    const sys = systems.find((s) => s.id === systemId);
    return sys ? sys.name : "Sistema no especificado";
  }, [systems, systemId]);

  const hasGap = score < 80 || activeRequirements.some((req) => checks[req.code]?.status === "NO_CONFORME");

  return (
    <div className="p-4 sm:p-6 max-w-[920px] mx-auto space-y-6">
      {/* Back Link */}
      <button
        type="button"
        onClick={() => navigate("/ai-governance/evaluaciones")}
        className="flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Evaluaciones de riesgo IA
      </button>

      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              Nueva evaluación AIMS
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Asistente interactivo de intake de cumplimiento bajo EU AI Act y el estándar internacional ISO 42001.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Intake Transaccional · AIMS
        </div>
      </header>

      {/* Stepper Progress Indicator */}
      <nav aria-label="Progreso" className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4" style={{ borderRadius: "var(--g-radius-lg)" }}>
        <ul className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 text-xs font-semibold">
          {[
            { stepNum: 1, label: "Sistema & Marco" },
            { stepNum: 2, label: "Checklist Operativo" },
            { stepNum: 3, label: "Score & Notas" },
            { stepNum: 4, label: "Confirmación & Handoff" },
          ].map((s) => (
            <li
              key={s.stepNum}
              className={`flex items-center gap-2 flex-1 ${
                step === s.stepNum
                  ? "text-[var(--g-brand-3308)]"
                  : step > s.stepNum
                  ? "text-[var(--status-success)]"
                  : "text-[var(--g-text-secondary)]/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center text-[10px] font-bold ${
                  step === s.stepNum
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : step > s.stepNum
                    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {step > s.stepNum ? <Check className="h-3.5 w-3.5" /> : s.stepNum}
              </span>
              <span>{s.label}</span>
              {s.stepNum < 4 && <ArrowRight className="hidden sm:block h-3.5 w-3.5 ml-auto text-[var(--g-border-subtle)]" />}
            </li>
          ))}
        </ul>
      </nav>

      {/* Form Wizard Panels */}
      <main className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]" style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}>
        {/* Step 1: System & Framework Identification */}
        {step === 1 && (
          <div>
            <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Paso 1: Identificación del sistema e indicador normativo
              </h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label htmlFor="eval-system" className={LABEL_CLASSES}>
                  Sistema de IA a evaluar *
                </label>
                <select
                  id="eval-system"
                  value={systemId}
                  onChange={(e) => setSystemId(e.target.value)}
                  className={SELECT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  disabled={loadingSystems}
                >
                  <option value="">{loadingSystems ? "Cargando sistemas..." : "Selecciona un sistema de IA"}</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.aims_reference_code || "Sin código"}) — Riesgo {s.risk_level ?? "No clasificado"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="eval-framework" className={LABEL_CLASSES}>
                  Marco de cumplimiento
                </label>
                <select
                  id="eval-framework"
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  className={SELECT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="EU_AI_ACT">EU AI Act (Reglamento Europeo de IA)</option>
                  <option value="ISO_42001">ISO/IEC 42001 (Sistema de Gestión de IA)</option>
                </select>
              </div>

              <div className="bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] p-4 flex gap-3 text-xs leading-relaxed text-[var(--g-text-primary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <Cpu className="h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
                <div>
                  <p className="font-semibold">Contexto regulatorio de la demo</p>
                  <p className="mt-1 text-[var(--g-text-secondary)]">
                    La selección del marco cargará automáticamente los requisitos específicos del Reglamento de la UE (requisitos del expediente técnico de alto riesgo) o del estándar ISO 42001 (estructura del sistema de gestión).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Checklist */}
        {step === 2 && (
          <div>
            <div className="border-b border-[var(--g-border-subtle)] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Paso 2: Checklist Operativo de Requisitos
                </h2>
                <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                  Evaluando sistema: <span className="font-semibold">{selectedSystemName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={markAllConforming}
                className="self-start text-xs font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)] flex items-center gap-1 transition-colors"
              >
                <Check className="h-4 w-4" />
                Marcar todo como Conforme (Demo Quick-Pass)
              </button>
            </div>
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {activeRequirements.map((req) => {
                const reqState = currentChecks[req.code] || { status: "CONFORME", evidence_url: "", notes: "" };
                return (
                  <article key={req.code} className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span className="inline-flex bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] text-[10px] font-bold px-2 py-0.5 mb-1.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                          {req.code}
                        </span>
                        <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                          {req.title}
                        </h3>
                        <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed mt-1">
                          {req.description}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <label htmlFor={`status-${req.code}`} className="sr-only">Estado {req.code}</label>
                        <select
                          id={`status-${req.code}`}
                          value={reqState.status}
                          onChange={(e) => updateCheck(req.code, "status", e.target.value)}
                          className={`${SELECT_CLASSES} min-w-[140px]`}
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <option value="CONFORME">Conforme</option>
                          <option value="NO_CONFORME">No conforme</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="NA">No aplica</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`evidence-${req.code}`} className="block text-[11px] font-medium text-[var(--g-text-secondary)] mb-1">
                          URL de Evidencia / Sello EAD Trust
                        </label>
                        <input
                          id={`evidence-${req.code}`}
                          type="text"
                          value={reqState.evidence_url}
                          onChange={(e) => updateCheck(req.code, "evidence_url", e.target.value)}
                          placeholder="Ej. https://eadtrust.g-digital.net/evidences/..."
                          className={INPUT_CLASSES}
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        />
                      </div>
                      <div>
                        <label htmlFor={`notes-${req.code}`} className="block text-[11px] font-medium text-[var(--g-text-secondary)] mb-1">
                          Notas de revisión de cumplimiento
                        </label>
                        <input
                          id={`notes-${req.code}`}
                          type="text"
                          value={reqState.notes}
                          onChange={(e) => updateCheck(req.code, "notes", e.target.value)}
                          placeholder="Añadir justificación o comentarios adicionales..."
                          className={INPUT_CLASSES}
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Analysis, Score & Submission */}
        {step === 3 && (
          <div>
            <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Paso 3: Análisis de readiness y dictamen general
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Compliance Score Summary Card */}
              <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-5 grid sm:grid-cols-[auto_1fr] items-center gap-6" style={{ borderRadius: "var(--g-radius-lg)" }}>
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center font-bold text-2xl text-[var(--g-text-inverse)] ${
                    score >= 80 ? "bg-[var(--status-success)]" : score >= 60 ? "bg-[var(--status-warning)]" : "bg-[var(--status-error)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {score}%
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
                    Indice de readiness calculado en AIMS
                  </h3>
                  <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed mt-1">
                    Este índice evalúa la proporción de requisitos marcados como CONFORME en el checklist operativo. Si el índice es inferior al 80% o se detectan no conformidades específicas, se activará un handoff al final para derivar el gap a GRC Compass.
                  </p>
                </div>
              </div>

              {/* General Dictamen Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="overall-status" className={LABEL_CLASSES}>
                    Estado de la evaluación
                  </label>
                  <select
                    id="overall-status"
                    value={overallStatus}
                    onChange={(e) => setOverallStatus(e.target.value)}
                    className={SELECT_CLASSES}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="BORRADOR">Borrador</option>
                    <option value="EN_REVISION">En revisión y emisión</option>
                    <option value="APROBADO">Aprobado formalmente</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="assessment-notes" className={LABEL_CLASSES}>
                    Notas y conclusiones del dictamen
                  </label>
                  <textarea
                    id="assessment-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escribe aquí un resumen del análisis de cumplimiento para este sistema de IA..."
                    rows={4}
                    className={TEXTAREA_CLASSES}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation & GRC Handoff */}
        {step === 4 && (
          <div>
            <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Paso 4: Evaluación consolidada en el ledger WORM
              </h2>
            </div>
            <div className="p-6 space-y-6 text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center bg-[var(--status-success)]/10 text-[var(--status-success)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                  <Check className="h-6 w-6" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Evaluación de riesgo IA finalizada con éxito
                </h3>
                <p className="text-xs text-[var(--g-text-secondary)] mt-2 max-w-lg mx-auto leading-relaxed">
                  Los registros de cumplimiento y la evaluación para <span className="font-semibold">{selectedSystemName}</span> han sido consolidados en base de datos.
                </p>
              </div>

              {/* Dynamic Handoff Box if non-compliant/low score */}
              {hasGap ? (
                <div className="border border-[var(--status-error)]/30 bg-[var(--status-error)]/5 p-5 text-left space-y-4 max-w-xl mx-auto" style={{ borderRadius: "var(--g-radius-lg)" }}>
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--status-error)]" />
                    <div>
                      <h4 className="text-xs font-bold text-[var(--g-text-primary)] uppercase tracking-wider">
                        Brecha técnica material detectada (AIMS_TECHNICAL_FILE_GAP)
                      </h4>
                      <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed mt-1">
                        Dado que el índice de preparación es del {score}% (o existen controles de no conformidad), existe un contrato de handoff de datos para escalar este expediente técnico al módulo **GRC Compass** para que el oficial de cumplimiento global pueda evaluarlo.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => navigate(`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${createdId}`)}
                      className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Derivar Gap a GRC Compass (Handoff)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-[var(--status-success)]/30 bg-[var(--status-success)]/5 p-5 text-left max-w-xl mx-auto flex gap-3" style={{ borderRadius: "var(--g-radius-lg)" }}>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
                  <div>
                    <h4 className="text-xs font-bold text-[var(--g-text-primary)] uppercase tracking-wider">
                      Sistema IA en postura de conformidad nominal
                    </h4>
                    <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed mt-1">
                      El score de cumplimiento es del {score}% y no existen gaps de conformidad. No se requiere derivación automática al backlog de riesgos de GRC Compass.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stepper Footer Action Buttons */}
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          {step < 4 && (
            <button
              type="button"
              onClick={() => step === 1 ? navigate("/ai-governance/evaluaciones") : handlePrevStep()}
              className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {step === 1 ? "Cancelar" : "Anterior"}
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleSubmit}
              aria-busy={createAssessment.isPending || createChecks.isPending}
              disabled={createAssessment.isPending || createChecks.isPending}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Save className="h-4 w-4" />
              {createAssessment.isPending || createChecks.isPending ? "Guardando..." : "Guardar evaluación"}
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={() => navigate("/ai-governance/evaluaciones")}
              className="inline-flex items-center justify-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Volver a evaluaciones
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
