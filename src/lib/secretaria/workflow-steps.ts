/**
 * Steps canónicos del workflow formal de adopción de acuerdos.
 *
 * El orden es parte del contrato del MatterExecutionProfile: cualquier cambio
 * requiere revisar los prerequisitos con severidad dinámica.
 */
export const ADOPTION_WORKFLOW_STEPS = [
  "INICIO",
  "PRE_CONVOCATORIA",
  "CONVOCATORIA",
  "CONSTITUCION",
  "DELIBERACION",
  "VOTACION",
  "PROCLAMACION",
  "DOCUMENTACION",
  "POST_ACUERDO",
] as const;

export type AdoptionWorkflowStep = typeof ADOPTION_WORKFLOW_STEPS[number];

export const WORKFLOW_STEPS_VERSION = "1.0.0";

export function isAtOrBeyondStep(
  currentStep: AdoptionWorkflowStep,
  referenceStep: AdoptionWorkflowStep,
) {
  const currentIdx = ADOPTION_WORKFLOW_STEPS.indexOf(currentStep);
  const refIdx = ADOPTION_WORKFLOW_STEPS.indexOf(referenceStep);
  if (currentIdx === -1 || refIdx === -1) return false;
  return currentIdx >= refIdx;
}
