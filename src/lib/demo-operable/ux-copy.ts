import type { DemoScenarioRunResult } from "./runner";

export interface DemoRolePerspective {
  role: string;
  focus: string;
  insight: string;
}

export const gateCopyLabels = [
  {
    key: "quorum_ok",
    label: "Quórum",
    ok: "Constitución suficiente",
    fail: "Constitución insuficiente",
  },
  {
    key: "mayoria_global_ok",
    label: "Mayoría global",
    ok: "Mayoría alcanzada",
    fail: "Mayoría no alcanzada",
  },
  {
    key: "clases_ok",
    label: "Clases",
    ok: "Sin bloqueo de clase",
    fail: "Clase afectada no aprueba",
  },
  {
    key: "doble_umbral_ok",
    label: "Doble umbral",
    ok: "Umbral reforzado superado",
    fail: "Umbral reforzado fallido",
  },
  {
    key: "consents_ok",
    label: "Consentimientos",
    ok: "Consentimientos suficientes",
    fail: "Falta consentimiento necesario",
  },
  {
    key: "veto_ok",
    label: "Veto",
    ok: "Sin veto aplicable",
    fail: "Veto aplicable",
  },
] as const;

export function getBoardDecisionCopy(run: DemoScenarioRunResult) {
  if (run.outcome === "ADOPTADO") {
    return {
      headline: "El consejo puede avanzar con una decisión trazable",
      summary:
        "La consola muestra que el acuerdo supera los gates relevantes y deja preparado el rastro de explicación para revisión del consejero.",
      nextAction: "Revisar explicación legal y abrir el flujo propietario en Secretaría si se quiere inspeccionar el expediente.",
    };
  }

  return {
    headline: "La consola bloquea el avance y explica el motivo",
    summary:
      "El resultado no se presenta como error técnico: se detiene por una regla visible y se conserva la narrativa para decidir el siguiente paso de gobierno.",
    nextAction: "Revisar el gate bloqueante y decidir si procede reformular, elevar o documentar la incidencia.",
  };
}

export function getRolePerspectives(run: DemoScenarioRunResult): DemoRolePerspective[] {
  const blocked = run.outcome === "BLOQUEADO";

  return [
    {
      role: "Presidente",
      focus: blocked ? "Decisión de agenda" : "Seguimiento de decisión",
      insight: blocked
        ? "Ve de inmediato por qué el asunto no debe avanzar como acuerdo adoptado."
        : "Puede confirmar que la decisión es explicable antes de elevarla al circuito documental.",
    },
    {
      role: "Consejero independiente",
      focus: "Control de razonabilidad",
      insight: "Comprueba reglas, mayorías y posibles conflictos sin entrar en pantallas operativas.",
    },
    {
      role: "Secretario",
      focus: blocked ? "Subsanación y trazabilidad" : "Formalización societaria",
      insight: blocked
        ? "Tiene identificados los puntos a corregir antes de generar acta o certificación."
        : "Mantiene el ownership formal del expediente, acta, certificación y evidencias.",
    },
    {
      role: "Compliance / Auditor",
      focus: "Evidencia y controles",
      insight: "Distingue claramente sandbox demo de evidencia productiva y valida que no hay dependencia externa real.",
    },
  ];
}

export function getEvidenceTrustCopy() {
  return {
    headline: "Evidencia sandbox, no productiva",
    body:
      "La demo enseña hashes, firma y timestamp simulados para explicar la cadena probatoria sin activar QTSP productivo ni filing real.",
  };
}

export function getStepOwnerLabel(owner: string) {
  const labels: Record<string, string> = {
    SECRETARIA: "Secretaría Societaria",
    MOTOR_LSC: "Motor societario",
    TRUST_SANDBOX: "Trust sandbox",
    EVIDENCE_SANDBOX: "Evidencia sandbox",
  };

  return labels[owner] ?? owner;
}
