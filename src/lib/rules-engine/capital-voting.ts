export interface CapitalVotingHolding {
  holder_id: string;
  numero_titulos: number;
  voting_rights?: boolean | null;
  is_treasury?: boolean | null;
  votes_per_title?: number | null;
  denominator_weight?: number | null;
}

export interface CapitalVotingRow {
  holder_id: string;
  social_titles: number;
  denominator_weight: number;
  voting_weight: number;
  excluded_from_vote: boolean;
  treasury: boolean;
}

export interface CapitalVotingWeights {
  socialCapitalTitles: number;
  quorumDenominator: number;
  votingWeight: number;
  byHolder: CapitalVotingRow[];
}

export type AttendanceChannel = "PRESENCIAL" | "TELEMATICO" | "DISTANCIA" | "DELEGADO";

export interface MeetingAttendanceHolder {
  holder_id: string;
  capital: number;
  present?: boolean;
  channel?: AttendanceChannel;
}

export interface MeetingDelegation {
  from_holder_id: string;
  to_representative_id: string;
  capital: number;
  delegacion_tipo: "PODER_ESCRITO" | "ELECTRONICA";
  revoked?: boolean;
  conflictAgendaItemIds?: string[];
}

export interface AttendanceWithDelegationsResult {
  concurrentCapital: number;
  directCapital: number;
  delegatedCapital: number;
  adjustedVotingCapital: number;
  revokedDelegations: MeetingDelegation[];
  rejectedDelegations: MeetingDelegation[];
  conflictExcludedCapital: number;
  votesByChannel: Record<AttendanceChannel, number>;
  warnings: string[];
}

export interface BoardMemberAttendance {
  member_id: string;
  present: boolean;
  delegated_to?: string | null;
}

export interface BoardRepresentationResult {
  personalPresent: number;
  representedMembers: number;
  quorumCount: number;
  quorumReached: boolean;
  rejectedDelegations: string[];
  warnings: string[];
}

function positiveNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function computeCapitalVotingWeights(holdings: CapitalVotingHolding[]): CapitalVotingWeights {
  const byHolder = holdings.map((holding) => {
    const socialTitles = positiveNumber(holding.numero_titulos);
    const treasury = holding.is_treasury === true;
    const hasVotingRights = holding.voting_rights !== false && !treasury;
    const denominatorWeight = hasVotingRights
      ? nonNegativeNumber(holding.denominator_weight, socialTitles)
      : 0;
    const votesPerTitle = nonNegativeNumber(holding.votes_per_title, 1);
    const votingWeight = hasVotingRights ? socialTitles * votesPerTitle : 0;

    return {
      holder_id: holding.holder_id,
      social_titles: socialTitles,
      denominator_weight: denominatorWeight,
      voting_weight: votingWeight,
      excluded_from_vote: !hasVotingRights,
      treasury,
    };
  });

  return {
    socialCapitalTitles: byHolder.reduce((total, row) => total + row.social_titles, 0),
    quorumDenominator: byHolder.reduce((total, row) => total + row.denominator_weight, 0),
    votingWeight: byHolder.reduce((total, row) => total + row.voting_weight, 0),
    byHolder,
  };
}

export function computeAttendanceWithDelegations(input: {
  holders: MeetingAttendanceHolder[];
  delegations: MeetingDelegation[];
  agendaItemId?: string;
  maxDelegationsPerRepresentative?: number;
}): AttendanceWithDelegationsResult {
  const presentHolders = new Set(input.holders.filter((holder) => holder.present).map((holder) => holder.holder_id));
  const holderCapital = new Map(input.holders.map((holder) => [holder.holder_id, positiveNumber(holder.capital)]));
  const acceptedByRepresentative = new Map<string, number>();
  const revokedDelegations: MeetingDelegation[] = [];
  const rejectedDelegations: MeetingDelegation[] = [];
  const warnings: string[] = [];
  const votesByChannel: Record<AttendanceChannel, number> = {
    PRESENCIAL: 0,
    TELEMATICO: 0,
    DISTANCIA: 0,
    DELEGADO: 0,
  };

  let delegatedCapital = 0;
  let conflictExcludedCapital = 0;

  for (const holder of input.holders) {
    if (!holder.present) continue;
    const channel = holder.channel ?? "PRESENCIAL";
    votesByChannel[channel] += positiveNumber(holder.capital);
  }

  for (const delegation of input.delegations) {
    if (delegation.revoked || presentHolders.has(delegation.from_holder_id)) {
      revokedDelegations.push(delegation);
      warnings.push(`delegation_revoked:${delegation.from_holder_id}`);
      continue;
    }

    const currentCount = acceptedByRepresentative.get(delegation.to_representative_id) ?? 0;
    if (input.maxDelegationsPerRepresentative !== undefined && currentCount >= input.maxDelegationsPerRepresentative) {
      rejectedDelegations.push(delegation);
      warnings.push(`delegation_limit_exceeded:${delegation.to_representative_id}`);
      continue;
    }

    acceptedByRepresentative.set(delegation.to_representative_id, currentCount + 1);
    const capital = positiveNumber(delegation.capital, holderCapital.get(delegation.from_holder_id) ?? 0);
    delegatedCapital += capital;
    votesByChannel[delegation.delegacion_tipo === "ELECTRONICA" ? "DISTANCIA" : "DELEGADO"] += capital;

    if (input.agendaItemId && delegation.conflictAgendaItemIds?.includes(input.agendaItemId)) {
      conflictExcludedCapital += capital;
      warnings.push(`delegated_vote_conflict_excluded:${delegation.from_holder_id}`);
    }
  }

  const directCapital = input.holders
    .filter((holder) => holder.present)
    .reduce((total, holder) => total + positiveNumber(holder.capital), 0);
  const concurrentCapital = directCapital + delegatedCapital;

  return {
    concurrentCapital,
    directCapital,
    delegatedCapital,
    adjustedVotingCapital: Math.max(0, concurrentCapital - conflictExcludedCapital),
    revokedDelegations,
    rejectedDelegations,
    conflictExcludedCapital,
    votesByChannel,
    warnings,
  };
}

export function computeBoardRepresentation(input: {
  members: BoardMemberAttendance[];
  totalMembers: number;
  isListedCompany?: boolean;
  indelegableMatter?: boolean;
}): BoardRepresentationResult {
  const memberIds = new Set(input.members.map((member) => member.member_id));
  const presentIds = new Set(input.members.filter((member) => member.present).map((member) => member.member_id));
  const rejectedDelegations: string[] = [];
  const warnings: string[] = [];
  let representedMembers = 0;

  for (const member of input.members) {
    if (member.present || !member.delegated_to) continue;
    if (!memberIds.has(member.delegated_to)) {
      rejectedDelegations.push(member.member_id);
      warnings.push(`board_delegation_to_non_director:${member.member_id}`);
      continue;
    }
    if (input.isListedCompany && input.indelegableMatter) {
      rejectedDelegations.push(member.member_id);
      warnings.push(`listed_board_indelegable_requires_personal_presence:${member.member_id}`);
      continue;
    }
    if (!presentIds.has(member.delegated_to)) {
      rejectedDelegations.push(member.member_id);
      warnings.push(`board_delegate_absent:${member.member_id}`);
      continue;
    }
    representedMembers += 1;
  }

  const personalPresent = presentIds.size;
  const quorumCount = personalPresent + representedMembers;
  return {
    personalPresent,
    representedMembers,
    quorumCount,
    quorumReached: quorumCount >= Math.floor(input.totalMembers / 2) + 1,
    rejectedDelegations,
    warnings,
  };
}
