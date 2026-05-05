export interface CapitalTransmissionSourceHolding {
  id: string;
  tenant_id: string;
  entity_id: string;
  holder_person_id: string;
  share_class_id?: string | null;
  numero_titulos: number | null;
  porcentaje_capital?: number | null;
  voting_rights?: boolean | null;
  is_treasury?: boolean | null;
}

export interface CapitalTransmissionInput {
  sourceHolding: CapitalTransmissionSourceHolding;
  destinationPersonId: string;
  titlesToTransfer: number;
  effectiveFrom: string;
  motivo?: string | null;
}

export interface CapitalHoldingInsertContract {
  tenant_id: string;
  entity_id: string;
  holder_person_id: string;
  share_class_id: string | null;
  numero_titulos: number;
  porcentaje_capital: number;
  voting_rights: boolean;
  is_treasury: boolean;
  effective_from: string;
  effective_to: null;
  metadata?: Record<string, unknown>;
}

export interface CapitalTransmissionPlan {
  ok: boolean;
  blockers: string[];
  closeSource?: { id: string; effective_to: string };
  remnantInsert?: CapitalHoldingInsertContract;
  destinationInsert?: CapitalHoldingInsertContract;
  conservation?: {
    sourceTitlesBefore: number;
    remnantTitles: number;
    transferredTitles: number;
    sourcePercentageBefore: number;
    remnantPercentage: number;
    transferredPercentage: number;
  };
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function buildCapitalTransmissionPlan(input: CapitalTransmissionInput): CapitalTransmissionPlan {
  const source = input.sourceHolding;
  const sourceTitles = finiteNumber(source.numero_titulos);
  const transferredTitles = finiteNumber(input.titlesToTransfer);
  const sourcePercentage = finiteNumber(source.porcentaje_capital);
  const effectiveFrom = input.effectiveFrom?.trim();
  const blockers = [
    source.is_treasury === true ? "source_holding_is_treasury" : null,
    input.destinationPersonId?.trim() ? null : "destination_person_required",
    input.destinationPersonId === source.holder_person_id ? "destination_must_differ_from_source_holder" : null,
    transferredTitles > 0 ? null : "titles_to_transfer_must_be_positive",
    transferredTitles <= sourceTitles ? null : "titles_to_transfer_exceed_source",
    effectiveFrom ? null : "effective_from_required",
  ].filter((blocker): blocker is string => Boolean(blocker));

  if (blockers.length > 0) {
    return { ok: false, blockers };
  }

  const transferredPercentage = sourceTitles > 0 ? round6((sourcePercentage * transferredTitles) / sourceTitles) : 0;
  const remnantTitles = round6(sourceTitles - transferredTitles);
  const remnantPercentage = round6(sourcePercentage - transferredPercentage);
  const baseInsert = {
    tenant_id: source.tenant_id,
    entity_id: source.entity_id,
    share_class_id: source.share_class_id ?? null,
    voting_rights: source.voting_rights !== false,
    effective_from: effectiveFrom,
    effective_to: null,
  };

  return {
    ok: true,
    blockers: [],
    closeSource: { id: source.id, effective_to: effectiveFrom },
    remnantInsert: remnantTitles > 0
      ? {
          ...baseInsert,
          holder_person_id: source.holder_person_id,
          numero_titulos: remnantTitles,
          porcentaje_capital: remnantPercentage,
          is_treasury: source.is_treasury === true,
        }
      : undefined,
    destinationInsert: {
      ...baseInsert,
      holder_person_id: input.destinationPersonId,
      numero_titulos: transferredTitles,
      porcentaje_capital: transferredPercentage,
      is_treasury: false,
      metadata: {
        motivo: input.motivo?.trim() || "transmision_inter_vivos",
        origen_holding_id: source.id,
      },
    },
    conservation: {
      sourceTitlesBefore: sourceTitles,
      remnantTitles,
      transferredTitles,
      sourcePercentageBefore: sourcePercentage,
      remnantPercentage,
      transferredPercentage,
    },
  };
}
