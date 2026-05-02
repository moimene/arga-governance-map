import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

export type DualEvaluationStage = "CONVOCATORIA_NOTICE" | "MEETING_ADOPTION";
export type DualEvaluationSource = "V1_LEGACY" | "V2_CLOUD";
export type DualEvaluationSeverity = "OK" | "WARNING" | "DIVERGENCE";

export interface DualEvaluationSide {
  source: DualEvaluationSource;
  ok: boolean;
  label: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface DualEvaluationComparison {
  schema_version: "dual-evaluation.v1";
  stage: DualEvaluationStage;
  effective_source: DualEvaluationSource;
  effective_ok: boolean;
  converged: boolean;
  severity: DualEvaluationSeverity;
  v1: DualEvaluationSide;
  v2: DualEvaluationSide;
  warnings: string[];
  divergence: null | {
    code: string;
    message: string;
  };
}

export interface ConvocatoriaNoticeDualInput {
  meetingDate: string;
  now?: string | Date;
  isUniversal?: boolean;
  v1NoticeOk: boolean;
  v2RequiredDays: number;
  v2Severity?: string;
  v2BlockingIssues?: string[];
  v2Warnings?: string[];
}

function daysUntil(meetingDate: string, now: string | Date = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  const meeting = new Date(meetingDate);
  return Math.floor((meeting.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildDualEvaluationComparison(input: {
  stage: DualEvaluationStage;
  effectiveSource: DualEvaluationSource;
  v1: DualEvaluationSide;
  v2: DualEvaluationSide;
  warnings?: string[];
}): DualEvaluationComparison {
  const effective = input.effectiveSource === "V1_LEGACY" ? input.v1 : input.v2;
  const converged = input.v1.ok === input.v2.ok;
  const warnings = [...(input.warnings ?? [])];

  if (!converged) {
    warnings.push("Doble evaluacion V1/V2 divergente; se conserva el comportamiento operativo y se registra para revision.");
  }

  return {
    schema_version: "dual-evaluation.v1",
    stage: input.stage,
    effective_source: input.effectiveSource,
    effective_ok: effective.ok,
    converged,
    severity: converged ? (warnings.length > 0 ? "WARNING" : "OK") : "DIVERGENCE",
    v1: input.v1,
    v2: input.v2,
    warnings,
    divergence: converged
      ? null
      : {
          code: `${input.stage}_V1_V2_MISMATCH`,
          message: `${input.v1.label}=${input.v1.ok ? "OK" : "REVISAR"}; ${input.v2.label}=${input.v2.ok ? "OK" : "REVISAR"}.`,
        },
  };
}

export function buildConvocatoriaNoticeDoubleEvaluation(
  input: ConvocatoriaNoticeDualInput,
): DualEvaluationComparison {
  const actualDays = input.isUniversal ? 0 : daysUntil(input.meetingDate, input.now);
  const v2Ok = input.isUniversal ? true : actualDays >= input.v2RequiredDays && (input.v2BlockingIssues ?? []).length === 0;

  return buildDualEvaluationComparison({
    stage: "CONVOCATORIA_NOTICE",
    effectiveSource: "V1_LEGACY",
    v1: {
      source: "V1_LEGACY",
      ok: input.isUniversal ? true : input.v1NoticeOk,
      label: "Plazo V1 operativo",
      summary: input.isUniversal
        ? "Junta universal: no requiere convocatoria formal."
        : `V1 evalua ${actualDays} dia(s) de antelacion con fallback legacy.`,
      details: { actual_days: actualDays },
    },
    v2: {
      source: "V2_CLOUD",
      ok: v2Ok,
      label: "Plazo V2 rule pack",
      summary: input.isUniversal
        ? "Junta universal: el motor V2 no exige plazo."
        : `V2 exige ${input.v2RequiredDays} dia(s) segun rule pack.`,
      details: {
        actual_days: actualDays,
        required_days: input.v2RequiredDays,
        severity: input.v2Severity ?? null,
        blocking_issues: input.v2BlockingIssues ?? [],
        warnings: input.v2Warnings ?? [],
      },
    },
    warnings: input.v2Warnings ?? [],
  });
}

export function buildMeetingAdoptionDoubleEvaluation(input: {
  operationalSnapshot: MeetingAdoptionSnapshot;
  cloudSnapshot: MeetingAdoptionSnapshot;
  cloudRulePackMissing?: boolean;
  cloudMissingSpecs?: string[];
}): DualEvaluationComparison {
  const cloudOk =
    input.cloudRulePackMissing === true
      ? false
      : input.cloudSnapshot.societary_validity.ok && input.cloudSnapshot.status_resolucion === "ADOPTED";

  return buildDualEvaluationComparison({
    stage: "MEETING_ADOPTION",
    effectiveSource: "V1_LEGACY",
    v1: {
      source: "V1_LEGACY",
      ok: input.operationalSnapshot.societary_validity.ok && input.operationalSnapshot.status_resolucion === "ADOPTED",
      label: "Adopcion operativa",
      summary: "Resultado usado por el prototipo, con fallback tecnico si Cloud no cubre la materia.",
      details: {
        status_resolucion: input.operationalSnapshot.status_resolucion,
        warnings: input.operationalSnapshot.societary_validity.warnings,
      },
    },
    v2: {
      source: "V2_CLOUD",
      ok: cloudOk,
      label: "Adopcion Cloud estricta",
      summary: "Resultado calculado solo con rule packs Cloud compatibles.",
      details: {
        status_resolucion: input.cloudSnapshot.status_resolucion,
        rule_pack_missing: input.cloudRulePackMissing === true,
        missing_specs: input.cloudMissingSpecs ?? [],
        warnings: input.cloudSnapshot.societary_validity.warnings,
        blocking_issues: input.cloudSnapshot.societary_validity.blocking_issues,
      },
    },
    warnings: input.cloudRulePackMissing
      ? [`Falta rule pack Cloud estricto para: ${(input.cloudMissingSpecs ?? []).join(", ") || "materia sin identificar"}.`]
      : [],
  });
}
