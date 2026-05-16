import { describe, expect, it } from "vitest";
import {
  buildActaAgendaViewModel,
  computeCanonicalMinutesHash,
  renderActaAgendaItemsText,
  validateActaLegalStructure,
  type ActaAgendaItemRow,
  type ActaMeetingResolutionRow,
} from "../acta-agenda";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

const baseAgenda: ActaAgendaItemRow[] = [
  {
    id: "ai-1",
    meeting_id: "m-1",
    order_number: 1,
    title: "Informe del presidente",
    description: "Se informa de la evolución del ejercicio.",
    kind: "INFORMATIVO",
    tenant_id: "t-1",
  },
  {
    id: "ai-2",
    meeting_id: "m-1",
    order_number: 2,
    title: "Aprobación de cuentas",
    description: "Propuesta de aprobación de cuentas anuales.",
    kind: "DECISORIO",
    tenant_id: "t-1",
  },
  {
    id: "ai-3",
    meeting_id: "m-1",
    order_number: 3,
    title: "Seguimiento del plan de negocio",
    description: "Se debate el grado de avance del plan.",
    kind: "DELIBERATIVO",
    tenant_id: "t-1",
  },
  {
    id: "ai-4",
    meeting_id: "m-1",
    order_number: 4,
    title: "Nombramiento de auditor",
    description: "Propuesta de nombramiento de auditor.",
    kind: "DECISORIO",
    tenant_id: "t-1",
  },
  {
    id: "ai-5",
    meeting_id: "m-1",
    order_number: 5,
    title: "Ruegos y preguntas",
    description: "Se recogen intervenciones finales.",
    kind: "RUEGOS_PREGUNTAS",
    tenant_id: "t-1",
  },
];

const resolutions: ActaMeetingResolutionRow[] = [
  {
    id: "r-2",
    meeting_id: "m-1",
    agenda_item_index: 2,
    kind_resolution: "DECISION",
    status: "ADOPTED",
    resolution_text: "Se aprueban las cuentas anuales.",
    agreement_id: "ag-2",
    required_majority_code: "SIMPLE",
  },
  {
    id: "r-4",
    meeting_id: "m-1",
    agenda_item_index: 4,
    kind_resolution: "DECISION",
    status: "ADOPTED",
    resolution_text: "Se nombra auditor para el periodo legal.",
    agreement_id: "ag-4",
    required_majority_code: "SIMPLE",
  },
];

function snapshot(index: number, text: string): MeetingAdoptionSnapshot {
  return {
    schema_version: "meeting-adoption-snapshot.v2",
    engine_version: "test",
    agenda_item_index: index,
    agreement_id: `ag-${index}`,
    resolution_id: `r-${index}`,
    resolution_text: text,
    materia: index === 2 ? "APROBACION_CUENTAS" : "NOMBRAMIENTO_AUDITOR",
    materia_clase: "ORDINARIA",
    voting_context: {
      tipo_social: "SA",
      organo_tipo: "JUNTA_GENERAL",
      adoption_mode: "MEETING",
      primera_convocatoria: true,
      total_miembros: 100,
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
      voting: {} as MeetingAdoptionSnapshot["societary_validity"]["voting"],
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
    evaluated_at: "2026-05-15T10:00:00.000Z",
  };
}

describe("acta-agenda — contrato cronológico P0", () => {
  it("renderiza reunión mixta en el orden estricto del orden del día", () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: [...baseAgenda].reverse(),
      resolutions,
      snapshots: [
        snapshot(2, "Se aprueban las cuentas anuales."),
        snapshot(4, "Se nombra auditor para el periodo legal."),
      ],
    });

    expect(puntos.map((point) => point.order_number)).toEqual([1, 2, 3, 4, 5]);
    expect(puntos.filter((point) => point.decisorio).map((point) => point.order_number)).toEqual([2, 4]);
    expect(puntos.filter((point) => point.constancia).map((point) => point.order_number)).toEqual([1, 3, 5]);

    const rendered = renderActaAgendaItemsText(puntos);
    expect(rendered.indexOf("1. Informe del presidente")).toBeLessThan(
      rendered.indexOf("2. Aprobación de cuentas"),
    );
    expect(rendered.indexOf("3. Seguimiento del plan de negocio")).toBeLessThan(
      rendered.indexOf("4. Nombramiento de auditor"),
    );
    expect(rendered).toContain("Constancia:");
    expect(rendered).toContain("Resultado de votación: APROBADO.");
  });

  it("valida estructura completa sin huecos ni acuerdos bajo puntos no decisorios", () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: baseAgenda,
      resolutions,
      snapshots: [
        snapshot(2, "Se aprueban las cuentas anuales."),
        snapshot(4, "Se nombra auditor para el periodo legal."),
      ],
    });

    const result = validateActaLegalStructure({
      meetingId: "m-1",
      puntos,
      agendaItems: baseAgenda,
      agreementRows: [
        { id: "ag-2", parent_meeting_id: "m-1", agenda_item_id: "ai-2" },
        { id: "ag-4", parent_meeting_id: "m-1", agenda_item_id: "ai-4" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.blockingIssues).toEqual([]);
  });

  it("bloquea acuerdo bajo punto informativo", () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: baseAgenda,
      resolutions: [
        ...resolutions,
        {
          id: "r-1",
          meeting_id: "m-1",
          agenda_item_index: 1,
          kind_resolution: "DECISION",
          status: "ADOPTED",
          resolution_text: "Acuerdo indebido.",
          agreement_id: "ag-1",
        },
      ],
    });

    const result = validateActaLegalStructure({
      meetingId: "m-1",
      puntos,
      agendaItems: baseAgenda,
      agreementRows: [{ id: "ag-1", parent_meeting_id: "m-1", agenda_item_id: "ai-1" }],
    });

    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("agreement_under_non_decision_item");
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("non_decision_rendered_as_agreement");
  });

  it("bloquea punto decisorio aprobado sin voto, mayoría o proclamación", () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: baseAgenda.slice(0, 2),
      resolutions: [resolutions[0]],
    });

    const result = validateActaLegalStructure({
      meetingId: "m-1",
      puntos,
      agendaItems: baseAgenda.slice(0, 2),
      agreementRows: [{ id: "ag-2", parent_meeting_id: "m-1", agenda_item_id: "ai-2" }],
    });

    expect(result.ok).toBe(false);
    expect(result.blockingIssues.map((issue) => issue.code)).toContain("adopted_decision_without_vote_result");
  });

  it("bloquea acta que omite o reordena puntos", () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: baseAgenda,
      resolutions,
      snapshots: [
        snapshot(2, "Se aprueban las cuentas anuales."),
        snapshot(4, "Se nombra auditor para el periodo legal."),
      ],
    });

    const omitted = validateActaLegalStructure({
      meetingId: "m-1",
      puntos: puntos.slice(0, 4),
      agendaItems: baseAgenda,
    });
    const reordered = validateActaLegalStructure({
      meetingId: "m-1",
      puntos,
      agendaItems: baseAgenda,
      renderedOrderNumbers: [1, 3, 2, 4, 5],
    });

    expect(omitted.ok).toBe(false);
    expect(omitted.blockingIssues.map((issue) => issue.code)).toContain("minutes_order_mismatch");
    expect(reordered.ok).toBe(false);
    expect(reordered.blockingIssues.map((issue) => issue.code)).toContain("minutes_order_mismatch");
  });

  it("genera hash canónico estable y sensible al orden", async () => {
    const puntos = buildActaAgendaViewModel({
      agendaItems: baseAgenda,
      resolutions,
      snapshots: [
        snapshot(2, "Se aprueban las cuentas anuales."),
        snapshot(4, "Se nombra auditor para el periodo legal."),
      ],
    });
    const hash = await computeCanonicalMinutesHash({ meetingId: "m-1", puntos });
    const sameHash = await computeCanonicalMinutesHash({ meetingId: "m-1", puntos: [...puntos] });
    const changedHash = await computeCanonicalMinutesHash({
      meetingId: "m-1",
      puntos: [puntos[0], puntos[2], puntos[1], puntos[3], puntos[4]],
    });

    expect(hash).toBe(sameHash);
    expect(hash).not.toBe(changedHash);
  });
});
