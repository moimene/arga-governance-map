import { describe, expect, it } from "vitest";
import {
  decisionMeetingAgendaPoints,
  mergeMeetingAgendaSources,
  newSessionAgendaPoint,
} from "../meeting-agenda";

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
          decision_text: "Se acuerda modificar el artículo 5 de los estatutos conforme al texto incorporado al expediente.",
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
      kind: "DECISORIO",
      decision_subtype: "CONSTITUTIVE",
      materia: "MODIFICACION_ESTATUTOS",
      tipo: "ESTATUTARIA",
      group_campaign_id: "campaign-1",
      group_campaign_step: "MODIFICACION_ESTATUTOS",
      resolution_text: "Se acuerda modificar el artículo 5 de los estatutos conforme al texto incorporado al expediente.",
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

  it("lets sourced agenda metadata override stale saved default matter classification", () => {
    const points = mergeMeetingAgendaSources({
      savedDebates: [
        {
          punto: "Operacion vinculada con aseguradora del grupo",
          notas: "Se mantiene la nota del secretario.",
          materia: "APROBACION_CUENTAS",
          tipo: "ORDINARIA",
          origin: "MEETING_FLOOR",
        },
      ],
      preparedAgreements: [
        {
          id: "agreement-related-party",
          agreement_kind: "OPERACION_VINCULADA",
          matter_class: "ESPECIAL",
          proposal_text: "Operacion vinculada con aseguradora del grupo",
        },
      ],
    });

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      materia: "OPERACION_VINCULADA",
      tipo: "ESPECIAL",
      origin: "PREPARED_AGREEMENT",
      agreement_id: "agreement-related-party",
      notas: "Se mantiene la nota del secretario.",
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
    expect(points[0].kind).toBe("DECISORIO");
    expect(points[0].resolution_text).toBe("Nombramiento de auditor");
  });

  it("preserva por separado título, notas y texto resolutivo", () => {
    const [point] = mergeMeetingAgendaSources({
      savedDebates: [
        {
          punto: "Formulación de cuentas anuales",
          notas: "El CFO expone las magnitudes principales.",
          resolution_text: "Se acuerda formular las cuentas anuales del ejercicio 2025 en los términos presentados.",
          kind: "DECISORIO",
        },
      ],
    });

    expect(point.punto).toBe("Formulación de cuentas anuales");
    expect(point.notas).toBe("El CFO expone las magnitudes principales.");
    expect(point.resolution_text).toContain("Se acuerda formular");
  });

  it("uses the materialized matter and exact proposal instead of title heuristics", () => {
    const [point] = mergeMeetingAgendaSources({
      agendaItems: [
        {
          id: "agenda-formulacion",
          order_number: 1,
          title: "Cuentas anuales",
          matter_code: "FORMULACION_CUENTAS",
          kind: "DECISORIO",
          decision_subtype: "CONSTITUTIVE",
          proposal_text:
            "Se acuerda formular las cuentas anuales del ejercicio 2025 en los términos incorporados al expediente.",
          requires_attachments: true,
        },
      ],
    });

    expect(point).toMatchObject({
      materia: "FORMULACION_CUENTAS",
      kind: "DECISORIO",
      decision_subtype: "CONSTITUTIVE",
      resolution_text:
        "Se acuerda formular las cuentas anuales del ejercicio 2025 en los términos incorporados al expediente.",
    });
  });

  it("preserves propuesta_acuerdo from the immutable convocatoria JSON", () => {
    const [point] = mergeMeetingAgendaSources({
      convocatoriaId: "convocatoria-inmutable",
      convocatoriaItems: [
        {
          titulo: "Poderes generales al CFO",
          materia: "DELEGACION_FACULTADES",
          tipo: "ORDINARIA",
          kind: "DECISORIO",
          propuesta_acuerdo:
            "Se acuerda conferir al CFO las facultades enumeradas individualmente en la propuesta incorporada.",
        },
      ],
    });

    expect(point.resolution_text).toContain("Se acuerda conferir al CFO");
  });

  it("preserves the five explicit convocatoria matters when agenda_items only materializes titles", () => {
    const agendaItems = [
      "Seguimiento del plan de negocio",
      "Formulación de las cuentas anuales",
      "Aprobación del presupuesto anual",
      "Designación de representante de la socia única en la filial",
      "Informe de riesgos del trimestre",
    ].map((title, index) => ({
      id: `agenda-${index + 1}`,
      order_number: index + 1,
      title,
      kind: index === 4 ? "INFORMATIVO" : "DECISORIO",
    }));

    const convocatoriaItems = [
      { titulo: agendaItems[0].title, materia: "APROBACION_PLAN_NEGOCIO", tipo: "ORDINARIA", kind: "DECISORIO" },
      { titulo: agendaItems[1].title, materia: "FORMULACION_CUENTAS", tipo: "ORDINARIA", kind: "DECISORIO" },
      { titulo: agendaItems[2].title, materia: "APROBACION_PRESUPUESTO", tipo: "ORDINARIA", kind: "DECISORIO" },
      { titulo: agendaItems[3].title, materia: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL", tipo: "ORDINARIA", kind: "DECISORIO" },
      { titulo: agendaItems[4].title, materia: "POLITICAS_CORPORATIVAS", tipo: "ORDINARIA", kind: "INFORMATIVO" },
    ];

    const points = mergeMeetingAgendaSources({
      agendaItems,
      convocatoriaId: "conv-five-points",
      convocatoriaItems,
    });

    expect(points).toHaveLength(5);
    expect(points.map((point) => point.materia)).toEqual([
      "APROBACION_PLAN_NEGOCIO",
      "FORMULACION_CUENTAS",
      "APROBACION_PRESUPUESTO",
      "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
      "POLITICAS_CORPORATIVAS",
    ]);
    expect(points[3]).toMatchObject({
      origin: "MEETING_AGENDA",
      source_table: "agenda_items",
      source_id: "agenda-4",
      materia: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
      kind: "DECISORIO",
    });
  });

  it("creates blank session-born points for in-meeting additions", () => {
    expect(newSessionAgendaPoint()).toMatchObject({
      punto: "",
      materia: "OTROS_LIBRE",
      tipo: "ORDINARIA",
      origin: "MEETING_FLOOR",
      kind: "DELIBERATIVO",
    });
  });

  it("classifies a representative in a subsidiary as its canonical matter", () => {
    const [point] = mergeMeetingAgendaSources({
      agendaItems: [
        {
          id: "agenda-representative",
          order_number: 1,
          title: "Designación de representante de la socia única en la filial",
          kind: "DECISORIO",
        },
      ],
    });

    expect(point).toMatchObject({
      materia: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
      tipo: "ORDINARIA",
      kind: "DECISORIO",
    });
  });

  it("no confunde al representante de administradora PJ del art. 212 bis con el representante del socio único", () => {
    const [point] = mergeMeetingAgendaSources({
      agendaItems: [
        {
          id: "agenda-admin-pj",
          order_number: 1,
          title: "Nombramiento del representante persona física del consejero persona jurídica en la filial",
          kind: "DECISORIO",
        },
      ],
    });

    expect(point.materia).toBe("OTROS_LIBRE");
  });

  it("no infiere socio único desde expresiones genéricas sobre derechos de socio", () => {
    const [point] = mergeMeetingAgendaSources({
      agendaItems: [
        {
          id: "agenda-derechos-genericos",
          order_number: 1,
          title: "Designación de representante para ejercer derechos de socio en una filial",
          kind: "DECISORIO",
        },
      ],
    });

    expect(point.materia).toBe("OTROS_LIBRE");
  });

  it("keeps a genuinely unknown decision in OTROS_LIBRE", () => {
    const [point] = mergeMeetingAgendaSources({
      agendaItems: [{
        id: "agenda-unknown",
        order_number: 1,
        title: "Decisión extraordinaria no catalogada",
        kind: "DECISORIO",
      }],
    });

    expect(point.materia).toBe("OTROS_LIBRE");
  });

  it("keeps informative points outside matter-specific rule validation", () => {
    const points = decisionMeetingAgendaPoints([
      { punto: "Informe trimestral", kind: "INFORMATIVO", materia: "POLITICAS_CORPORATIVAS" },
      { punto: "Aprobación de presupuesto", kind: "DECISORIO", materia: "APROBACION_PRESUPUESTO" },
      { punto: "Ruegos y preguntas", kind: "RUEGOS_PREGUNTAS", materia: "OTROS_LIBRE" },
    ]);

    expect(points).toEqual([
      { punto: "Aprobación de presupuesto", kind: "DECISORIO", materia: "APROBACION_PRESUPUESTO" },
    ]);
  });

  describe("kind and decision_subtype propagation on merge", () => {
    it("propagates DECISORIO kind from convocatoria source when saved debate has no kind", () => {
      const points = mergeMeetingAgendaSources({
        savedDebates: [
          {
            punto: "Nombramiento de auditor",
            notas: "Nota del secretario.",
            origin: "CONVOCATORIA",
            source_table: "convocatorias",
            source_id: "conv-1",
            source_index: 1,
          },
        ],
        convocatoriaId: "conv-1",
        convocatoriaItems: [
          {
            titulo: "Nombramiento de auditor",
            materia: "NOMBRAMIENTO_AUDITOR",
            tipo: "ORDINARIA",
            kind: "DECISORIO",
          },
        ],
      });

      expect(points).toHaveLength(1);
      expect(points[0].kind).toBe("DECISORIO");
    });

    it("keeps DELIBERATIVO kind from saved debate when source has DECISORIO (saved wins)", () => {
      const points = mergeMeetingAgendaSources({
        savedDebates: [
          {
            punto: "Nombramiento de auditor",
            notas: "Reclasificado manualmente.",
            origin: "CONVOCATORIA",
            source_table: "convocatorias",
            source_id: "conv-1",
            source_index: 1,
            kind: "DELIBERATIVO",
          },
        ],
        convocatoriaId: "conv-1",
        convocatoriaItems: [
          {
            titulo: "Nombramiento de auditor",
            materia: "NOMBRAMIENTO_AUDITOR",
            tipo: "ORDINARIA",
            kind: "DECISORIO",
          },
        ],
      });

      expect(points).toHaveLength(1);
      expect(points[0].kind).toBe("DELIBERATIVO");
    });

    it("returns null kind when both saved and source have no kind", () => {
      const points = mergeMeetingAgendaSources({
        savedDebates: [
          {
            punto: "Aprobacion de cuentas",
            notas: "Sin kind.",
            origin: "CONVOCATORIA",
            source_table: "convocatorias",
            source_id: "conv-1",
            source_index: 1,
          },
        ],
        convocatoriaId: "conv-1",
        convocatoriaItems: [
          {
            titulo: "Aprobacion de cuentas",
            materia: "APROBACION_CUENTAS",
            tipo: "ORDINARIA",
          },
        ],
      });

      expect(points).toHaveLength(1);
      expect(points[0].kind).toBeNull();
    });

    it("propagates decision_subtype from source when saved debate has none", () => {
      const points = mergeMeetingAgendaSources({
        savedDebates: [
          {
            punto: "Aprobacion de cuentas",
            notas: "Sin subtype.",
            origin: "CONVOCATORIA",
            source_table: "convocatorias",
            source_id: "conv-1",
            source_index: 1,
            kind: "DECISORIO",
          },
        ],
        convocatoriaId: "conv-1",
        convocatoriaItems: [
          {
            titulo: "Aprobacion de cuentas",
            materia: "APROBACION_CUENTAS",
            tipo: "ORDINARIA",
            kind: "DECISORIO",
            decision_subtype: "CONSTITUTIVE",
          },
        ],
      });

      expect(points).toHaveLength(1);
      expect(points[0].kind).toBe("DECISORIO");
      expect(points[0].decision_subtype).toBe("CONSTITUTIVE");
    });

    it("preserves saved kind when source has no kind field at all", () => {
      const points = mergeMeetingAgendaSources({
        savedDebates: [
          {
            punto: "Aprobacion de cuentas",
            notas: "Kind solo en saved.",
            origin: "CONVOCATORIA",
            source_table: "convocatorias",
            source_id: "conv-1",
            source_index: 1,
            kind: "DECISORIO",
          },
        ],
        convocatoriaId: "conv-1",
        convocatoriaItems: [
          {
            titulo: "Aprobacion de cuentas",
            materia: "APROBACION_CUENTAS",
            tipo: "ORDINARIA",
          },
        ],
      });

      expect(points).toHaveLength(1);
      expect(points[0].kind).toBe("DECISORIO");
    });
  });
});
