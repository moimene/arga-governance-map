export type VoteChoice = "FOR" | "AGAINST" | "ABSTAIN";

export interface NoSessionVoteState {
  status: string;
  requires_unanimity: boolean;
  votes_for: number | null;
  votes_against: number | null;
  abstentions: number | null;
  total_members: number | null;
  voting_deadline: string | null;
}

export interface VoteGuardResult {
  ok: boolean;
  reason?: string;
}

export interface VoteUpdateResult {
  ok: boolean;
  reason?: string;
  updates?: Record<string, unknown>;
}

export interface NoSessionResultInput {
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  totalMembers: number;
  matterClass: string;
  requiresUnanimity: boolean;
}

export interface NoSessionResult {
  aprobado: boolean;
  motivo: string;
}

function count(value: number | null | undefined) {
  return Number(value ?? 0);
}

export function validateVoteWindow(
  state: Pick<NoSessionVoteState, "status" | "voting_deadline">,
  now = new Date(),
): VoteGuardResult {
  if (state.status !== "VOTING_OPEN") {
    return { ok: false, reason: "Votación no activa" };
  }

  if (state.voting_deadline && new Date(state.voting_deadline).getTime() < now.getTime()) {
    return { ok: false, reason: "Plazo de votación vencido" };
  }

  return { ok: true };
}

export function buildVoteCounterUpdate(
  state: NoSessionVoteState,
  choice: VoteChoice,
  now = new Date(),
): VoteUpdateResult {
  const guard = validateVoteWindow(state, now);
  if (!guard.ok) return guard;

  const col =
    choice === "FOR" ? "votes_for" :
    choice === "AGAINST" ? "votes_against" : "abstentions";
  const updates: Record<string, unknown> = { [col]: count(state[col]) + 1 };

  if (state.requires_unanimity && (choice === "AGAINST" || choice === "ABSTAIN")) {
    updates.status = "RECHAZADO";
    updates.closed_at = now.toISOString();
    return { ok: true, updates };
  }

  if (state.requires_unanimity && choice === "FOR") {
    const totalMembers = Math.max(count(state.total_members), 1);
    const votesFor = count(state.votes_for) + 1;
    const blockingVotes = count(state.votes_against) + count(state.abstentions);
    if (blockingVotes === 0 && votesFor >= totalMembers) {
      updates.status = "APROBADO";
      updates.closed_at = now.toISOString();
    }
  }

  return { ok: true, updates };
}

export function canMaterializeNoSessionAgreement(input: {
  existingAgreementId?: string | null;
  resolutionStatus?: string | null;
  resultado: "APROBADO" | "RECHAZADO";
}): VoteGuardResult {
  if (input.existingAgreementId) return { ok: true };
  if (input.resultado === "RECHAZADO") return { ok: true };
  if (!input.resolutionStatus || input.resolutionStatus === "VOTING_OPEN" || input.resolutionStatus === "APROBADO") {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `No se puede materializar un acuerdo aprobado desde estado ${input.resolutionStatus}.`,
  };
}

export function evaluateNoSessionResult(input: NoSessionResultInput): NoSessionResult {
  const votesFor = count(input.votesFor);
  const votesAgainst = count(input.votesAgainst);
  const abstentions = count(input.abstentions);
  const totalMembers = Math.max(count(input.totalMembers), votesFor + votesAgainst + abstentions);

  if (input.requiresUnanimity) {
    const aprobado = totalMembers > 0 && votesFor === totalMembers && votesAgainst === 0 && abstentions === 0;
    return {
      aprobado,
      motivo: aprobado
        ? "Unanimidad alcanzada"
        : `Unanimidad requerida — ${votesAgainst} voto(s) en contra o ${abstentions} abstención(es)`,
    };
  }

  const emitidos = votesFor + votesAgainst;
  if (emitidos === 0) return { aprobado: false, motivo: "Sin votos emitidos" };

  const pctFor = (votesFor / emitidos) * 100;
  const threshold =
    input.matterClass === "ESTRUCTURAL" ? 66.67 :
    input.matterClass === "ESTATUTARIA" ? 60 : 50;
  const aprobado = pctFor > threshold;
  return {
    aprobado,
    motivo: aprobado
      ? `Aprobado con ${pctFor.toFixed(1)}% de votos a favor (umbral: >${threshold}%)`
      : `Rechazado — ${pctFor.toFixed(1)}% de votos a favor (umbral: >${threshold}%)`,
  };
}
