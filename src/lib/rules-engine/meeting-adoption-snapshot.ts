import { evaluarPactosParasociales, type PactoParasocial, type PactosEvalOutput } from "./pactos-engine";
import { evaluarVotacion } from "./votacion-engine";
import {
  evaluateMeetingVoteCompleteness,
  type MeetingVoteCompleteness,
  type MeetingVoteValue,
} from "./meeting-vote-completeness";
import type {
  AdoptionMode,
  ConflictoInteres,
  EvalSeverity,
  ExplainNode,
  MateriaClase,
  RulePack,
  RuleParamOverride,
  TipoOrgano,
  TipoSocial,
  VotacionOutput,
} from "./types";

export interface MeetingAdoptionVoter {
  id: string;
  person_id?: string | null;
  name?: string | null;
  vote: MeetingVoteValue;
  conflict_flag?: boolean;
  conflict_reason?: string | null;
  voting_weight?: number | null;
}

export interface MeetingAdoptionSnapshotInput {
  agendaItemIndex: number;
  resolutionText: string;
  materia: string;
  materiaClase: MateriaClase;
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  adoptionMode?: AdoptionMode;
  primeraConvocatoria?: boolean;
  quorumReached?: boolean;
  voters: MeetingAdoptionVoter[];
  totalMiembros: number;
  capitalTotal: number;
  packs: RulePack[];
  overrides?: RuleParamOverride[];
  pactos?: PactoParasocial[];
  consentimientosPrevios?: string[];
  vetoRenunciado?: string[];
  votoCalidadHabilitado?: boolean;
}

export interface VoteSummary {
  favor: number;
  contra: number;
  abstenciones: number;
  en_blanco: number;
  conflict_excluded: number;
  present_weight: number;
  voting_weight: number;
  capital_total: number;
}

export interface MeetingAdoptionSnapshot {
  schema_version: "meeting-adoption-snapshot.v2";
  agenda_item_index: number;
  resolution_text: string;
  materia: string;
  materia_clase: MateriaClase;
  voting_context: {
    tipo_social: TipoSocial;
    organo_tipo: TipoOrgano;
    adoption_mode: AdoptionMode;
    primera_convocatoria: boolean;
    total_miembros: number;
    capital_total: number;
    quorum_reached: boolean;
    voto_calidad_habilitado: boolean;
  };
  status_resolucion: "ADOPTED" | "REJECTED";
  vote_summary: VoteSummary;
  vote_completeness: MeetingVoteCompleteness;
  voters: Array<{
    attendee_id: string;
    person_id: string | null;
    name: string | null;
    vote_value: MeetingVoteValue;
    conflict_flag: boolean;
    reason: string | null;
    voting_weight: number;
  }>;
  societary_validity: {
    ok: boolean;
    severity: EvalSeverity;
    quorum_reached: boolean;
    majority_reached: boolean;
    agreement_proclaimable: boolean;
    statutory_veto_active: boolean;
    blocking_issues: string[];
    warnings: string[];
    explain: ExplainNode[];
    voting: VotacionOutput;
  };
  pacto_compliance: {
    ok: boolean;
    severity: "OK" | "WARNING";
    pactos_evaluados: number;
    pactos_aplicables: number;
    pactos_incumplidos: number;
    blocking_issues: string[];
    warnings: string[];
    explain: ExplainNode[];
    result?: PactosEvalOutput;
  };
  evaluated_at: string;
}

function numericWeight(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

function isTruthyOverrideValue(value: unknown) {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "si", "sí", "activo", "active", "vigente"].includes(normalized);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return isTruthyOverrideValue(record.activo ?? record.active ?? record.enabled ?? true);
  }
  return false;
}

function statutoryVetoOverrides(overrides: RuleParamOverride[], materia: string) {
  return overrides.filter((override) => {
    const key = `${override.clave ?? ""}`.toLowerCase();
    const materiaMatches = !override.materia || override.materia === materia || override.materia === "*";
    return (
      override.fuente === "ESTATUTOS" &&
      materiaMatches &&
      key.includes("veto") &&
      isTruthyOverrideValue(override.valor)
    );
  });
}

export function buildMeetingAdoptionSnapshot(input: MeetingAdoptionSnapshotInput): MeetingAdoptionSnapshot {
  const overrides = input.overrides ?? [];
  const pactos = input.pactos ?? [];
  const voters = input.voters.map((voter) => {
    const conflict = voter.conflict_flag === true;
    const weight = numericWeight(voter.voting_weight);
    return {
      attendee_id: voter.id,
      person_id: voter.person_id ?? null,
      name: voter.name ?? null,
      vote_value: voter.vote,
      conflict_flag: conflict,
      reason: voter.conflict_reason?.trim() || null,
      voting_weight: weight,
    };
  });
  const voteCompleteness = evaluateMeetingVoteCompleteness(
    voters.map((voter) => ({
      id: voter.attendee_id,
      vote: voter.vote_value,
      conflict_flag: voter.conflict_flag,
      conflict_reason: voter.reason,
    }))
  );

  const eligibleRows = voters.filter((voter) => voter.vote_value !== "" && !voter.conflict_flag);
  const conflictRows = voters.filter((voter) => voter.conflict_flag);

  const sum = (rows: typeof voters, vote: MeetingVoteValue) =>
    rows
      .filter((row) => row.vote_value === vote)
      .reduce((total, row) => total + row.voting_weight, 0);

  const presentWeight = voters.reduce((total, row) => total + row.voting_weight, 0);
  const conflictWeight = conflictRows.reduce((total, row) => total + row.voting_weight, 0);
  const votingWeight = Math.max(0, presentWeight - conflictWeight);
  const capitalTotal = Math.max(input.capitalTotal || presentWeight || input.totalMiembros || 1, votingWeight, 1);

  const voteSummary: VoteSummary = {
    favor: sum(eligibleRows, "FAVOR"),
    contra: sum(eligibleRows, "CONTRA"),
    abstenciones: sum(eligibleRows, "ABSTENCION"),
    en_blanco: 0,
    conflict_excluded: conflictWeight,
    present_weight: presentWeight,
    voting_weight: votingWeight,
    capital_total: Math.max(0, capitalTotal - conflictWeight),
  };

  const conflictos: ConflictoInteres[] = conflictRows.map((row) => ({
    mandate_id: row.person_id ?? row.attendee_id,
    tipo: "EXCLUIR_VOTO",
    motivo: row.reason ?? "Conflicto de interes declarado en la reunion",
    capital_afectado: row.voting_weight,
  }));

  const pactoResult = evaluarPactosParasociales(pactos, {
    materias: [input.materia],
    capitalPresente: voteSummary.voting_weight,
    capitalTotal: capitalTotal,
    votosFavor: voteSummary.favor,
    votosContra: voteSummary.contra,
    consentimientosPrevios: input.consentimientosPrevios ?? [],
    vetoRenunciado: input.vetoRenunciado ?? [],
  });
  const pactoVetoActivo = pactoResult.resultados.some(
    (result) => result.tipo === "VETO" && result.aplica && !result.cumple
  );

  const votingResult = evaluarVotacion(
    {
      tipoSocial: input.tipoSocial,
      organoTipo: input.organoTipo,
      adoptionMode: input.adoptionMode ?? "MEETING",
      materiaClase: input.materiaClase,
      materias: [input.materia],
      votos: {
        favor: voteSummary.favor,
        contra: voteSummary.contra,
        abstenciones: voteSummary.abstenciones,
        en_blanco: voteSummary.en_blanco,
        capital_presente: voteSummary.voting_weight,
        capital_total: voteSummary.capital_total,
        total_miembros: input.totalMiembros,
        miembros_presentes: voteSummary.favor,
      },
      conflictos,
      votoCalidadHabilitado: input.votoCalidadHabilitado,
      esEmpate: voteSummary.favor === voteSummary.contra && voteSummary.favor > 0,
      vetoActivo: pactoVetoActivo,
    },
    input.packs,
    overrides
  );

  const vetoOverrides = statutoryVetoOverrides(overrides, input.materia);
  const statutoryVetoActive = vetoOverrides.length > 0;
  const statutoryVetoIssues = vetoOverrides.map(
    (override) => `statutory_veto:${override.clave}:${override.referencia ?? "sin_referencia"}`
  );
  const statutoryVetoExplain: ExplainNode[] = vetoOverrides.map((override) => ({
    regla: `Veto estatutario: ${override.clave}`,
    fuente: "ESTATUTOS",
    referencia: override.referencia,
    resultado: "BLOCKING",
    mensaje: "Existe un veto estatutario aplicable a la materia. Bloquea la proclamacion societaria hasta renuncia o consentimiento.",
  }));

  const quorumReached = input.quorumReached !== false;
  const societaryBlocking = [
    ...votingResult.blocking_issues,
    ...statutoryVetoIssues,
    ...(quorumReached ? [] : ["quorum_not_confirmed_for_point"]),
    ...(voteCompleteness.complete ? [] : ["votes_incomplete_for_point"]),
  ];
  const societaryOk = votingResult.acuerdoProclamable && quorumReached && !statutoryVetoActive && voteCompleteness.complete;
  const societaryExplain = [...votingResult.explain, ...statutoryVetoExplain];

  return {
    schema_version: "meeting-adoption-snapshot.v2",
    agenda_item_index: input.agendaItemIndex,
    resolution_text: input.resolutionText,
    materia: input.materia,
    materia_clase: input.materiaClase,
    voting_context: {
      tipo_social: input.tipoSocial,
      organo_tipo: input.organoTipo,
      adoption_mode: input.adoptionMode ?? "MEETING",
      primera_convocatoria: input.primeraConvocatoria ?? true,
      total_miembros: input.totalMiembros,
      capital_total: capitalTotal,
      quorum_reached: quorumReached,
      voto_calidad_habilitado: input.votoCalidadHabilitado === true,
    },
    status_resolucion: societaryOk ? "ADOPTED" : "REJECTED",
    vote_summary: voteSummary,
    vote_completeness: voteCompleteness,
    voters,
    societary_validity: {
      ok: societaryOk,
      severity: societaryOk ? "OK" : "BLOCKING",
      quorum_reached: quorumReached,
      majority_reached: votingResult.mayoriaAlcanzada,
      agreement_proclaimable: societaryOk,
      statutory_veto_active: statutoryVetoActive,
      blocking_issues: societaryBlocking,
      warnings: votingResult.warnings,
      explain: societaryExplain,
      voting: votingResult,
    },
    pacto_compliance: {
      ok: pactoResult.pacto_ok,
      severity: pactoResult.pacto_ok ? "OK" : "WARNING",
      pactos_evaluados: pactoResult.pactos_evaluados,
      pactos_aplicables: pactoResult.pactos_aplicables,
      pactos_incumplidos: pactoResult.pactos_incumplidos,
      blocking_issues: pactoResult.blocking_issues,
      warnings: pactoResult.warnings,
      explain: pactoResult.explain,
      result: pactoResult,
    },
    evaluated_at: new Date().toISOString(),
  };
}
