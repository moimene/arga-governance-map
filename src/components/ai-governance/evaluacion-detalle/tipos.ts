/**
 * Forma de un finding tal y como lo PINTA el informe.
 *
 * Es la del hook (`AiRiskAssessment["findings"]`) más `evidenceCount`, que
 * `evaluacion-payload.ts` sí persiste y que `motivoNoAcredita` necesita para
 * distinguir una L5 acreditada de una sin nada detrás. Vive aquí porque la
 * comparten la página y sus tres componentes; ninguno de ellos decide con él.
 */
export type FindingPintable = {
  code: string;
  status: string;
  title?: string;
  planCode?: string;
  difficulty?: string | null;
  justification?: string | null;
  kind?: "MG" | "MA";
  requirementCode?: string;
  evidenceCount?: number;
};
