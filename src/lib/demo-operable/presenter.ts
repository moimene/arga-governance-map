import type { DemoRunStep, DemoScenarioRunResult } from "./runner";
import type { DemoScenarioId } from "./scenarios";

export type DemoPresenterStatus = "PREPARED" | "AUTO_RUNNING" | "PAUSED" | "RESULT" | "FAILED_SAFE";

export interface DemoPresenterStep extends DemoRunStep {
  index: number;
  presenterLabel: string;
  presenterNarrative: string;
  estimatedSeconds: number;
}

export interface DemoReadinessItem {
  id: string;
  label: string;
  ok: boolean;
}

export interface DemoPresenterPlan {
  status: DemoPresenterStatus;
  totalSeconds: number;
  resetTargetSeconds: number;
  steps: DemoPresenterStep[];
  readiness: DemoReadinessItem[];
}

export const demoPresenterScenarioOrder: DemoScenarioId[] = [
  "JUNTA_UNIVERSAL_OK",
  "JUNTA_UNIVERSAL_FAIL_99",
  "VETO_BLOCK",
  "DOBLE_UMBRAL_FAIL",
  "CONFLICTO_EXCLUSION_OK",
];

const presenterLabels: Record<string, { label: string; narrative: string }> = {
  CONVOCATORIA: {
    label: "Preparación del asunto",
    narrative: "Se presenta el caso y se fija el contexto societario de ARGA.",
  },
  SESION: {
    label: "Constitución de la sesión",
    narrative: "La consola comprueba asistencia, consentimiento y ámbito de decisión.",
  },
  GATE: {
    label: "Validación jurídica",
    narrative: "El motor explica quórum, mayorías, clases, consentimientos, conflictos y vetos.",
  },
  ACTA: {
    label: "Acta demostrativa",
    narrative: "Secretaría mantiene la formalización; la demo solo muestra el recorrido.",
  },
  CERTIFICACION: {
    label: "Certificación sandbox",
    narrative: "Se enseña la conexión QES/TSQ sandbox sin activar QTSP productivo.",
  },
  EVIDENCIA: {
    label: "Evidencia sandbox",
    narrative: "Se muestra hash, bundle stub y postura no productiva.",
  },
};

export function buildDemoPresenterPlan(run: DemoScenarioRunResult): DemoPresenterPlan {
  const steps: DemoPresenterStep[] = run.steps.map((step, index) => {
    const copy = presenterLabels[step.id];
    return {
      ...step,
      index,
      presenterLabel: copy.label,
      presenterNarrative: copy.narrative,
      estimatedSeconds: step.status === "SKIPPED" ? 20 : 45,
    };
  });

  return {
    status: "PREPARED",
    totalSeconds: steps.reduce((total, step) => total + step.estimatedSeconds, 0),
    resetTargetSeconds: 60,
    steps,
    readiness: [
      { id: "demo-mode", label: "Banner DEMO MODE visible", ok: run.demoMode },
      { id: "deterministic", label: "Resultado determinista", ok: run.outcome === run.expectedOutcome },
      { id: "sandbox", label: "QTSP productivo bloqueado", ok: !run.externalDependenciesEnabled },
      { id: "no-final-evidence", label: "Evidencia marcada como no productiva", ok: run.evidence.finalEvidence === false },
      { id: "owner-handoff", label: "Handoff a Secretaría disponible", ok: Boolean(run.scenario.route) },
    ],
  };
}

export function nextPresenterIndex(current: number, total: number) {
  return current >= total - 1 ? total - 1 : current + 1;
}

export function previousPresenterIndex(current: number) {
  return current <= 0 ? 0 : current - 1;
}

export function getPresenterScenarioIndex(scenarioId: DemoScenarioId) {
  return demoPresenterScenarioOrder.indexOf(scenarioId);
}

export function getNextPresenterScenario(scenarioId: DemoScenarioId): DemoScenarioId | null {
  const currentIndex = getPresenterScenarioIndex(scenarioId);
  if (currentIndex < 0 || currentIndex >= demoPresenterScenarioOrder.length - 1) return null;
  return demoPresenterScenarioOrder[currentIndex + 1];
}

export function getPreviousPresenterScenario(scenarioId: DemoScenarioId): DemoScenarioId | null {
  const currentIndex = getPresenterScenarioIndex(scenarioId);
  if (currentIndex <= 0) return null;
  return demoPresenterScenarioOrder[currentIndex - 1];
}

export function buildPresenterScenarioPath(scenarioId: DemoScenarioId, presenterMode = true) {
  return `/demo-operable/${scenarioId}${presenterMode ? "?presenter=1" : ""}`;
}
