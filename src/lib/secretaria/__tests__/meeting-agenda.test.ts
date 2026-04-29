import { describe, expect, it } from "vitest";
import { mergeMeetingAgendaSources, newSessionAgendaPoint } from "../meeting-agenda";

describe("meeting agenda source merge", () => {
  it("builds formal agenda from meeting agenda, convocatoria and prepared agreements", () => {
    const points = mergeMeetingAgendaSources({
      agendaItems: [
        { id: "agenda-1", order_number: 1, title: "Aprobacion de cuentas", description: "Docs" },
      ],
      convocatoriaId: "conv-1",
      convocatoriaItems: [
        { titulo: "Nombramiento de auditor", materia: "NOMBRAMIENTO_AUDITOR", tipo: "ORDINARIA" },
      ],
      preparedAgreements: [
        {
          id: "agreement-1",
          agreement_kind: "MODIFICACION_ESTATUTOS",
          matter_class: "ESTATUTARIA",
          proposal_text: "Modificar articulo 5 de estatutos\nTexto completo",
          compliance_snapshot: { campaign_id: "campaign-1" },
          compliance_explain: { campaign_step: "MODIFICACION_ESTATUTOS" },
        },
      ],
    });

    expect(points).toHaveLength(3);
    expect(points.map((point) => point.origin)).toEqual([
      "MEETING_AGENDA",
      "CONVOCATORIA",
      "PREPARED_AGREEMENT",
    ]);
    expect(points[2]).toMatchObject({
      agreement_id: "agreement-1",
      materia: "MODIFICACION_ESTATUTOS",
      tipo: "ESTATUTARIA",
      group_campaign_id: "campaign-1",
      group_campaign_step: "MODIFICACION_ESTATUTOS",
    });
  });

  it("preserves saved secretary notes and appends new sourced points", () => {
    const points = mergeMeetingAgendaSources({
      savedDebates: [
        {
          punto: "Aprobacion de cuentas",
          notas: "Se debate el informe de auditoria.",
          origin: "CONVOCATORIA",
          source_table: "convocatorias",
          source_id: "conv-1",
          source_index: 1,
        },
      ],
      convocatoriaId: "conv-1",
      convocatoriaItems: [
        { titulo: "Aprobacion de cuentas", materia: "APROBACION_CUENTAS", tipo: "ORDINARIA" },
        { titulo: "Distribucion de dividendos", materia: "DISTRIBUCION_DIVIDENDOS", tipo: "ORDINARIA" },
      ],
    });

    expect(points).toHaveLength(2);
    expect(points[0].notas).toBe("Se debate el informe de auditoria.");
    expect(points[1]).toMatchObject({
      punto: "Distribucion de dividendos",
      origin: "CONVOCATORIA",
      source_index: 2,
    });
  });

  it("enriches a formal agenda duplicate with prepared agreement id", () => {
    const points = mergeMeetingAgendaSources({
      convocatoriaId: "conv-1",
      convocatoriaItems: [
        { titulo: "Nombramiento de auditor", materia: "NOMBRAMIENTO_AUDITOR", tipo: "ORDINARIA" },
      ],
      preparedAgreements: [
        {
          id: "agreement-1",
          agreement_kind: "NOMBRAMIENTO_AUDITOR",
          matter_class: "ORDINARIA",
          proposal_text: "Nombramiento de auditor",
        },
      ],
    });

    expect(points).toHaveLength(1);
    expect(points[0].agreement_id).toBe("agreement-1");
    expect(points[0].origin).toBe("PREPARED_AGREEMENT");
  });

  it("creates blank session-born points for in-meeting additions", () => {
    expect(newSessionAgendaPoint()).toMatchObject({
      punto: "",
      materia: "APROBACION_CUENTAS",
      tipo: "ORDINARIA",
      origin: "MEETING_FLOOR",
    });
  });
});
