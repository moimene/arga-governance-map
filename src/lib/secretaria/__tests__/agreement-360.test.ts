import { describe, expect, it } from "vitest";
import {
  buildMeetingAgreementDraftResetPayload,
  buildMeetingAgreementPayload,
  extractAgendaItemIndexFromExecutionMode,
  isMaterializableMeetingAgreement,
} from "../agreement-360";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

function snapshot(overrides: Partial<MeetingAdoptionSnapshot> = {}): MeetingAdoptionSnapshot {
  return {
    schema_version: "meeting-adoption-snapshot.v2",
    agenda_item_index: 2,
    resolution_text: "Aprobar el nombramiento de auditor",
    materia: "NOMBRAMIENTO_AUDITOR",
    materia_clase: "ORDINARIA",
    voting_context: {
      tipo_social: "SA",
      organo_tipo: "JUNTA_GENERAL",
      adoption_mode: "MEETING",
      primera_convocatoria: true,
      total_miembros: 10,
      capital_total: 100,
      quorum_reached: true,
      voto_calidad_habilitado: false,
    },
    status_resolucion: "ADOPTED",
    vote_summary: {
      favor: 80,
      contra: 10,
      abstenciones: 10,
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
    evaluated_at: "2026-04-27T10:00:00.000Z",
    ...overrides,
  };
}

const baseInput = {
  tenantId: "tenant-1",
  entityId: "entity-1",
  bodyId: "body-1",
  meetingId: "meeting-1",
  scheduledStart: "2026-04-27T09:30:00.000Z",
};

describe("agreement 360 meeting materialization", () => {
  it("materializa un agreement efectivo desde una resolución proclamable nacida en sala", () => {
    const payload = buildMeetingAgreementPayload({
      ...baseInput,
      snapshot: snapshot(),
      origin: "MEETING_FLOOR",
      materializedAt: "2026-04-27T11:00:00.000Z",
    });

    expect(payload).toMatchObject({
      tenant_id: "tenant-1",
      entity_id: "entity-1",
      body_id: "body-1",
      agreement_kind: "NOMBRAMIENTO_AUDITOR",
      matter_class: "ORDINARIA",
      adoption_mode: "MEETING",
      status: "ADOPTED",
      parent_meeting_id: "meeting-1",
      decision_date: "2026-04-27",
      decision_text: "Aprobar el nombramiento de auditor",
      inscribable: true,
    });
    expect(payload?.execution_mode).toMatchObject({
      mode: "MEETING",
      origin: "MEETING_FLOOR",
      agenda_item_index: 2,
      materialized: true,
    });
    expect(payload?.compliance_snapshot).toMatchObject({ agenda_item_index: 2 });
  });

  it("conserva proyeccion normativa de Acuerdo 360 en compliance_snapshot y explain", () => {
    const payload = buildMeetingAgreementPayload({
      ...baseInput,
      snapshot: snapshot({
        rule_trace: {
          source: "V2_CLOUD",
          rule_pack_id: "NOMBRAMIENTO_AUDITOR",
          rule_pack_version_id: "rpv-1",
          rule_pack_version: "1.0.0",
          payload_hash: "payload-hash",
          ruleset_snapshot_id: "ruleset-snapshot-1",
          warnings: ["cotizada_warning"],
        },
      }),
      origin: "MEETING_FLOOR",
      materializedAt: "2026-04-27T11:00:00.000Z",
    });

    expect(payload?.compliance_snapshot).toMatchObject({
      normative_snapshot_id: "ruleset-snapshot-1",
      normative_profile: {
        snapshot_id: "ruleset-snapshot-1",
        source_layers: ["LEY", "ESTATUTOS", "PACTO_PARASOCIAL", "SISTEMA"],
      },
    });
    expect(payload?.compliance_explain).toMatchObject({
      normative_snapshot: {
        snapshot_id: "ruleset-snapshot-1",
        rule_trace: {
          meeting_rule_pack_id: "NOMBRAMIENTO_AUDITOR",
          meeting_ruleset_snapshot_id: "ruleset-snapshot-1",
        },
      },
    });
    expect(payload?.execution_mode).toMatchObject({
      agreement_360: {
        normative_snapshot_id: "ruleset-snapshot-1",
      },
    });
  });

  it("no materializa resoluciones rechazadas o no proclamables", () => {
    const rejected = snapshot({
      status_resolucion: "REJECTED",
      societary_validity: {
        ...snapshot().societary_validity,
        ok: false,
        agreement_proclaimable: false,
        blocking_issues: ["majority_not_achieved"],
      },
    });

    expect(isMaterializableMeetingAgreement(rejected)).toBe(false);
    expect(buildMeetingAgreementPayload({ ...baseInput, snapshot: rejected })).toBeNull();
  });

  it("prepara reset no destructivo si un acuerdo vinculado deja de ser proclamable", () => {
    const rejected = snapshot({
      status_resolucion: "REJECTED",
      societary_validity: {
        ...snapshot().societary_validity,
        ok: false,
        agreement_proclaimable: false,
        blocking_issues: ["quorum_not_confirmed_for_point"],
      },
    });
    const payload = buildMeetingAgreementDraftResetPayload({
      ...baseInput,
      snapshot: rejected,
      reason: "quorum_not_confirmed_for_point",
    });

    expect(payload).toMatchObject({
      status: "DRAFT",
      decision_text: null,
      decision_date: null,
      agreement_kind: "NOMBRAMIENTO_AUDITOR",
    });
    expect(payload.execution_mode).toMatchObject({
      materialized: false,
      reason: "quorum_not_confirmed_for_point",
    });
  });

  it("extrae el punto desde execution_mode para idempotencia sin migración", () => {
    expect(extractAgendaItemIndexFromExecutionMode({ agenda_item_index: 4 })).toBe(4);
    expect(
      extractAgendaItemIndexFromExecutionMode({ agreement_360: { agenda_item_index: 5 } })
    ).toBe(5);
    expect(extractAgendaItemIndexFromExecutionMode({ agenda_item_index: "5" })).toBeNull();
  });
});
