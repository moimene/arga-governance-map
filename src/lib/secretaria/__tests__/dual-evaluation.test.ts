import { describe, expect, test } from "vitest";
import {
  buildConvocatoriaNoticeDoubleEvaluation,
  buildDualEvaluationComparison,
  buildMeetingAdoptionDoubleEvaluation,
} from "../dual-evaluation";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

function snapshot(ok: boolean, status: "ADOPTED" | "REJECTED" = ok ? "ADOPTED" : "REJECTED"): MeetingAdoptionSnapshot {
  return {
    schema_version: "meeting-adoption-snapshot.v2",
    agenda_item_index: 1,
    resolution_text: "Acuerdo",
    materia: "APROBACION_CUENTAS",
    materia_clase: "ORDINARIA",
    voting_context: {
      tipo_social: "SA",
      organo_tipo: "JUNTA_GENERAL",
      adoption_mode: "MEETING",
      primera_convocatoria: true,
      total_miembros: 1,
      capital_total: 100,
      quorum_reached: true,
      voto_calidad_habilitado: false,
    },
    status_resolucion: status,
    vote_summary: {
      favor: ok ? 60 : 40,
      contra: ok ? 20 : 60,
      abstenciones: 0,
      en_blanco: 0,
      conflict_excluded: 0,
      present_weight: 100,
      voting_weight: 100,
      capital_total: 100,
    },
    vote_completeness: {
      complete: true,
      missing_vote_ids: [],
      missing_conflict_reason_ids: [],
      ignored_conflict_vote_ids: [],
    },
    voters: [],
    societary_validity: {
      ok,
      severity: ok ? "OK" : "BLOCKING",
      quorum_reached: true,
      majority_reached: ok,
      agreement_proclaimable: ok,
      statutory_veto_active: false,
      blocking_issues: ok ? [] : ["majority_not_met"],
      warnings: [],
      explain: [],
      voting: {
        etapa: "VOTACION",
        ok,
        severity: ok ? "OK" : "BLOCKING",
        explain: [],
        blocking_issues: ok ? [] : ["majority_not_met"],
        warnings: [],
        acuerdoProclamable: ok,
        mayoriaAlcanzada: ok,
      },
    },
    pacto_compliance: {
      ok: true,
      severity: "OK",
      pactos_evaluados: 0,
      pactos_aplicables: 0,
      pactos_incumplidos: 0,
      blocking_issues: [],
      warnings: [],
      explain: [],
    },
    evaluated_at: "2026-04-30T00:00:00.000Z",
  };
}

describe("dual-evaluation", () => {
  test("marca convergencia cuando V1 y V2 coinciden", () => {
    const result = buildDualEvaluationComparison({
      stage: "CONVOCATORIA_NOTICE",
      effectiveSource: "V1_LEGACY",
      v1: { source: "V1_LEGACY", ok: true, label: "V1", summary: "ok" },
      v2: { source: "V2_CLOUD", ok: true, label: "V2", summary: "ok" },
    });

    expect(result.converged).toBe(true);
    expect(result.severity).toBe("OK");
    expect(result.effective_ok).toBe(true);
  });

  test("registra divergencia sin cambiar la fuente efectiva V1", () => {
    const result = buildDualEvaluationComparison({
      stage: "CONVOCATORIA_NOTICE",
      effectiveSource: "V1_LEGACY",
      v1: { source: "V1_LEGACY", ok: false, label: "V1", summary: "warning" },
      v2: { source: "V2_CLOUD", ok: true, label: "V2", summary: "ok" },
    });

    expect(result.converged).toBe(false);
    expect(result.severity).toBe("DIVERGENCE");
    expect(result.effective_ok).toBe(false);
    expect(result.divergence?.code).toBe("CONVOCATORIA_NOTICE_V1_V2_MISMATCH");
  });

  test("convocatoria compara V1 contra dias requeridos por V2", () => {
    const result = buildConvocatoriaNoticeDoubleEvaluation({
      now: "2026-04-30T00:00:00.000Z",
      meetingDate: "2026-05-10T10:00:00.000Z",
      v1NoticeOk: false,
      v2RequiredDays: 30,
    });

    expect(result.v1.ok).toBe(false);
    expect(result.v2.ok).toBe(false);
    expect(result.converged).toBe(true);
    expect(result.v2.details?.actual_days).toBe(10);
  });

  test("adopcion detecta que Cloud estricto no cubre una materia con fallback operativo", () => {
    const result = buildMeetingAdoptionDoubleEvaluation({
      operationalSnapshot: snapshot(true),
      cloudSnapshot: snapshot(false),
      cloudRulePackMissing: true,
      cloudMissingSpecs: ["CONSEJO:APROBACION_CUENTAS:ORDINARIA"],
    });

    expect(result.v1.ok).toBe(true);
    expect(result.v2.ok).toBe(false);
    expect(result.converged).toBe(false);
    expect(result.warnings[0]).toContain("Falta rule pack Cloud estricto");
  });
});
