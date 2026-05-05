import type { EvalSeverity, ExplainNode } from "./types";

export interface RelatedPartyEvaluation {
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

export function evaluateRelatedPartyOperation(input: {
  listedCompany: boolean;
  assetPct: number;
  ordinaryCourse?: boolean;
  marketTerms?: boolean;
  auditCommitteeReport?: boolean;
  accumulatedPct12m?: number;
}): RelatedPartyEvaluation & { material: boolean; exempt: boolean } {
  const exempt = input.ordinaryCourse === true && input.marketTerms === true;
  const material = input.listedCompany && !exempt && Math.max(input.assetPct, input.accumulatedPct12m ?? 0) > 10;
  const missingReport = material && input.auditCommitteeReport !== true;
  return {
    ok: !missingReport,
    severity: missingReport ? "BLOCKING" : material ? "WARNING" : "OK",
    explain: [{
      regla: "Operacion vinculada material",
      fuente: "LEY",
      referencia: "art. 529 duovicies LSC",
      resultado: missingReport ? "BLOCKING" : material ? "WARNING" : "OK",
      mensaje: exempt
        ? "Operacion en giro ordinario y condiciones de mercado: exencion del procedimiento reforzado."
        : material
        ? "Operacion vinculada material: requiere informe previo de la Comision de Auditoria."
        : "Operacion vinculada no supera umbral reforzado.",
    }],
    blocking_issues: missingReport ? ["related_party_audit_committee_report_missing"] : [],
    warnings: [
      ...(material ? ["related_party_material_threshold"] : []),
      ...((input.accumulatedPct12m ?? 0) > 10 ? ["related_party_accumulated_12m_threshold"] : []),
    ],
    material,
    exempt,
  };
}

export function computeRelatedPartyCouncilExclusion(input: {
  totalMembers: number;
  presentMembers: number;
  conflictedMembers: number;
}): RelatedPartyEvaluation & { deliberationMembers: number; quorumReached: boolean } {
  const deliberationMembers = Math.max(0, input.presentMembers - input.conflictedMembers);
  const quorumReached = deliberationMembers >= Math.floor(input.totalMembers / 2) + 1;
  return {
    ok: quorumReached,
    severity: quorumReached ? "OK" : "BLOCKING",
    explain: [{
      regla: "Exclusion deliberacion consejo",
      fuente: "LEY",
      resultado: quorumReached ? "OK" : "BLOCKING",
      mensaje: "El consejero vinculado se excluye de deliberacion y voto; se recalcula quorum.",
    }],
    blocking_issues: quorumReached ? [] : ["related_party_council_quorum_not_met_after_exclusion"],
    warnings: input.conflictedMembers > 0 ? ["related_party_director_excluded_from_deliberation"] : [],
    deliberationMembers,
    quorumReached,
  };
}

export function computeRelatedPartyShareholderVote(input: {
  capitalPresent: number;
  linkedShareholderCapital: number;
  votesFavor: number;
}): RelatedPartyEvaluation & { adjustedCapital: number; majorityReached: boolean } {
  const adjustedCapital = Math.max(0, input.capitalPresent - input.linkedShareholderCapital);
  const majorityReached = adjustedCapital > 0 && input.votesFavor > adjustedCapital / 2;
  return {
    ok: majorityReached,
    severity: majorityReached ? "OK" : "BLOCKING",
    explain: [{
      regla: "Socio vinculado en junta",
      fuente: "LEY",
      referencia: "art. 190 LSC",
      resultado: majorityReached ? "OK" : "BLOCKING",
      mensaje: "El capital del socio vinculado no computa en la mayoria del punto.",
    }],
    blocking_issues: majorityReached ? [] : ["related_party_shareholder_majority_not_met"],
    warnings: input.linkedShareholderCapital > 0 ? ["related_party_shareholder_capital_excluded"] : [],
    adjustedCapital,
    majorityReached,
  };
}
