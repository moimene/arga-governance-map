export type DemoScenarioId =
  | "JUNTA_UNIVERSAL_OK"
  | "JUNTA_UNIVERSAL_FAIL_99"
  | "VETO_BLOCK"
  | "DOBLE_UMBRAL_FAIL"
  | "CONFLICTO_EXCLUSION_OK";

export type DemoOutcome = "ADOPTADO" | "BLOQUEADO";

export type DemoGateStatus = "OK" | "WARN" | "BLOCK";

export type DemoStepId =
  | "CONVOCATORIA"
  | "SESION"
  | "GATE"
  | "ACTA"
  | "CERTIFICACION"
  | "EVIDENCIA";

export type DemoStepOwner = "SECRETARIA" | "MOTOR_LSC" | "TRUST_SANDBOX" | "EVIDENCE_SANDBOX";

export interface DemoScenarioFacts {
  attendancePct: number;
  globalMajorityPct: number;
  requiredMajorityPct: number;
  classThresholdPct?: number;
  classApprovalPct?: number;
  vetoActive: boolean;
  conflictExcluded: boolean;
  universalConsent: boolean;
  matter: string;
}

export interface DemoScenarioDefinition {
  id: DemoScenarioId;
  label: string;
  outcome: DemoOutcome;
  narrative: string;
  route: string;
  owner: "Secretaría Societaria";
  sourcePosture: "none";
  evidencePosture: "sandbox-verifiable";
  facts: DemoScenarioFacts;
  why: string[];
  legalBasis: string[];
}

export const demoScenarioDefinitions: DemoScenarioDefinition[] = [
  {
    id: "JUNTA_UNIVERSAL_OK",
    label: "Junta universal correcta",
    outcome: "ADOPTADO",
    narrative: "100% del capital presente, unanimidad para celebrar y mayorias superadas.",
    route: "/secretaria/reuniones/nueva?demoMode=1&scenario=JUNTA_UNIVERSAL_OK",
    owner: "Secretaría Societaria",
    sourcePosture: "none",
    evidencePosture: "sandbox-verifiable",
    facts: {
      attendancePct: 100,
      globalMajorityPct: 100,
      requiredMajorityPct: 50,
      vetoActive: false,
      conflictExcluded: false,
      universalConsent: true,
      matter: "Junta universal ordinaria",
    },
    why: [
      "Capital presente 100% >= 100%",
      "Consentimiento universal para celebrar",
      "Mayoría 100% >= 50%",
      "Sin vetos pactados activos",
    ],
    legalBasis: ["LSC art. 178", "Estatutos ARGA art. 12"],
  },
  {
    id: "VETO_BLOCK",
    label: "Veto pactado",
    outcome: "BLOQUEADO",
    narrative: "Operacion estructural bloqueada por derecho de veto de Fundacion ARGA.",
    route: "/secretaria/acuerdos-sin-sesion/nuevo?demoMode=1&scenario=VETO_BLOCK",
    owner: "Secretaría Societaria",
    sourcePosture: "none",
    evidencePosture: "sandbox-verifiable",
    facts: {
      attendancePct: 92,
      globalMajorityPct: 82,
      requiredMajorityPct: 66,
      vetoActive: true,
      conflictExcluded: false,
      universalConsent: false,
      matter: "Operacion estructural",
    },
    why: [
      "Quórum 92% >= 50%",
      "Mayoría 82% >= 66%",
      "Derecho de veto activo para operación estructural",
      "El veto prevalece sobre el resultado numérico",
    ],
    legalBasis: ["Pacto Fundación ARGA 2024", "Estatutos ARGA art. 24"],
  },
  {
    id: "JUNTA_UNIVERSAL_FAIL_99",
    label: "Universal incompleta",
    outcome: "BLOQUEADO",
    narrative: "El 99% del capital no permite junta universal: falta unanimidad para celebrar.",
    route: "/secretaria/reuniones/nueva?demoMode=1&scenario=JUNTA_UNIVERSAL_FAIL_99",
    owner: "Secretaría Societaria",
    sourcePosture: "none",
    evidencePosture: "sandbox-verifiable",
    facts: {
      attendancePct: 99,
      globalMajorityPct: 99,
      requiredMajorityPct: 50,
      vetoActive: false,
      conflictExcluded: false,
      universalConsent: false,
      matter: "Junta universal",
    },
    why: [
      "Capital presente 99% < 100%",
      "Falta consentimiento universal para celebrar",
      "La mayoría posterior no subsana la constitución",
    ],
    legalBasis: ["LSC art. 178", "Estatutos ARGA art. 12"],
  },
  {
    id: "DOBLE_UMBRAL_FAIL",
    label: "Doble umbral fallido",
    outcome: "BLOQUEADO",
    narrative: "La mayoria global supera el gate, pero falla el umbral reforzado de clase.",
    route: "/secretaria/reuniones/nueva?demoMode=1&scenario=DOBLE_UMBRAL_FAIL",
    owner: "Secretaría Societaria",
    sourcePosture: "none",
    evidencePosture: "sandbox-verifiable",
    facts: {
      attendancePct: 86,
      globalMajorityPct: 72,
      requiredMajorityPct: 66,
      classThresholdPct: 75,
      classApprovalPct: 60,
      vetoActive: false,
      conflictExcluded: false,
      universalConsent: false,
      matter: "Modificación estatutaria con clase afectada",
    },
    why: [
      "Quórum 86% >= 50%",
      "Mayoría global 72% >= 66%",
      "Clase afectada 60% < 75%",
      "El doble umbral bloquea la adopción",
    ],
    legalBasis: ["LSC art. 293", "Estatutos ARGA art. 18"],
  },
  {
    id: "CONFLICTO_EXCLUSION_OK",
    label: "Conflicto con exclusion",
    outcome: "ADOPTADO",
    narrative: "El voto conflictuado se excluye y el denominador se recalcula.",
    route: "/secretaria/reuniones/nueva?demoMode=1&scenario=CONFLICTO_EXCLUSION_OK",
    owner: "Secretaría Societaria",
    sourcePosture: "none",
    evidencePosture: "sandbox-verifiable",
    facts: {
      attendancePct: 88,
      globalMajorityPct: 70,
      requiredMajorityPct: 66,
      vetoActive: false,
      conflictExcluded: true,
      universalConsent: false,
      matter: "Operacion vinculada",
    },
    why: [
      "Consejero conflictuado excluido del cómputo",
      "Denominador recalculado tras exclusión",
      "Mayoría ajustada 70% >= 66%",
      "Sin vetos pactados activos",
    ],
    legalBasis: ["LSC art. 190", "Política ARGA de conflictos"],
  },
];

export const demoRunSteps: Array<{ id: DemoStepId; label: string; owner: DemoStepOwner }> = [
  { id: "CONVOCATORIA", label: "Convocatoria", owner: "SECRETARIA" },
  { id: "SESION", label: "Sesion", owner: "SECRETARIA" },
  { id: "GATE", label: "Gate", owner: "MOTOR_LSC" },
  { id: "ACTA", label: "Acta", owner: "SECRETARIA" },
  { id: "CERTIFICACION", label: "Certificacion", owner: "TRUST_SANDBOX" },
  { id: "EVIDENCIA", label: "Evidencia", owner: "EVIDENCE_SANDBOX" },
];

export function getDemoScenarioDefinition(id: DemoScenarioId) {
  return demoScenarioDefinitions.find((scenario) => scenario.id === id);
}
