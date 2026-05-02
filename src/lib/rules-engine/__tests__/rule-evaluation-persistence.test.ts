import { describe, expect, it } from "vitest";
import {
  buildRuleEvaluationResultInsert,
  evaluateRuleEvaluationPersistenceReadiness,
} from "../rule-evaluation-persistence";
import type { MeetingAdoptionSnapshot } from "../meeting-adoption-snapshot";

function snapshot(patch: Partial<MeetingAdoptionSnapshot> = {}): MeetingAdoptionSnapshot {
  return {
    schema_version: "meeting-adoption-snapshot.v2",
    agenda_item_index: 1,
    resolution_text: "Aprobar autorización de garantía",
    materia: "AUTORIZACION_GARANTIA",
    materia_clase: "ESTRUCTURAL",
    voting_context: {
      tipo_social: "SA",
      organo_tipo: "CONSEJO",
      adoption_mode: "MEETING",
      primera_convocatoria: true,
      total_miembros: 15,
      capital_total: 15,
      quorum_reached: true,
      voto_calidad_habilitado: true,
    },
    status_resolucion: "ADOPTED",
    vote_summary: {
      favor: 12,
      contra: 1,
      abstenciones: 2,
      en_blanco: 0,
      conflict_excluded: 0,
      present_weight: 15,
      voting_weight: 15,
      capital_total: 15,
    },
    vote_completeness: {
      complete: true,
      missing_vote_ids: [],
      missing_conflict_reason_ids: [],
      ignored_conflict_vote_ids: [],
    },
    voters: [],
    societary_validity: {
      ok: true,
      severity: "OK",
      quorum_reached: true,
      majority_reached: true,
      agreement_proclaimable: true,
      statutory_veto_active: false,
      blocking_issues: [],
      warnings: [],
      explain: [],
      voting: {
        etapa: "VOTACION",
        ok: true,
        severity: "OK",
        explain: [],
        blocking_issues: [],
        warnings: [],
        acuerdoProclamable: true,
        mayoriaAlcanzada: true,
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
    evaluated_at: "2026-05-01T00:00:00.000Z",
    ...patch,
  };
}

describe("rule-evaluation-persistence", () => {
  it("bloquea persistencia WORM si el punto usa fallback tecnico", () => {
    const input = {
      tenantId: "tenant",
      agreementId: "agreement",
      snapshot: snapshot({
        rule_trace: {
          source: "PROTOTYPE_FALLBACK",
          rule_pack_id: null,
          rule_pack_version_id: null,
          rule_pack_version: null,
          payload_hash: null,
          ruleset_snapshot_id: null,
          warnings: ["missing_cloud_rule_pack:CONSEJO:AUTORIZACION_GARANTIA:ESTRUCTURAL"],
        },
      }),
    };

    expect(evaluateRuleEvaluationPersistenceReadiness(input)).toEqual({
      ready: false,
      missing: [
        "rule_trace.source_v2_cloud",
        "rule_pack_version_id",
        "payload_hash",
        "ruleset_snapshot_id",
      ],
    });
  });

  it("construye una fila append-only versionada para rule_evaluation_results", async () => {
    const row = await buildRuleEvaluationResultInsert({
      tenantId: "tenant",
      agreementId: "agreement",
      snapshot: snapshot({
        rule_trace: {
          source: "V2_CLOUD",
          rule_pack_id: "AUTORIZACION_GARANTIA",
          rule_pack_version_id: "11111111-1111-4111-8111-111111111111",
          rule_pack_version: "1.1.0",
          payload_hash: "hash-payload",
          ruleset_snapshot_id: "snapshot-v2",
          warnings: [],
        },
      }),
    });

    expect(row?.etapa).toBe("MEETING_ADOPTION_POINT_1");
    expect(row?.rule_pack_version_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(row?.payload_hash).toBe("hash-payload");
    expect(row?.ruleset_snapshot_id).toBe("snapshot-v2");
    expect(row?.evaluation_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row?.explain.schema_version).toBe("rule-evaluation-result.meeting-adoption.v1");
  });
});
